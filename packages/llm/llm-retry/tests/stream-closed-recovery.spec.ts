/** Stream recovery through Loader, the Messages wire protocol, and native tool execution. */
import { appendFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import LlmRuntime, { expandAssistantStream } from '@deepseek-ai/dsh-llm'
import * as DeepSeek from '@deepseek-ai/dsh-llm-deepseek-api-key'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import * as NativeToolExecutor from '@deepseek-ai/dsh-tool-executor-native'
import { defineContentToolFixture } from '@deepseek-ai/dsh-tool-testkit'
import { end, MODEL, server, sourceModuleLoader, sse, start, textEvents, user } from '../../llm-deepseek/tests/helpers.ts'
import * as Retry from '../src/index.ts'

const cleanup: (() => Promise<unknown>)[] = []
afterEach(async () => {
  const failures: unknown[] = []
  while (cleanup.length) {
    try { await cleanup.pop()!() } catch (error) { failures.push(error) }
  }
  vi.unstubAllEnvs()
  if (failures.length) throw new AggregateError(failures, 'Stream recovery fixture cleanup failed')
})

function toolResponse(prefix: string, ...inputs: string[]): Record<string, unknown>[] {
  return [start, ...inputs.flatMap((partial_json, index) => [
    { type: 'content_block_start', index, content_block: { type: 'tool_use', id: `${prefix}_${index}`, name: 'effect', input: {} } },
    { type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json } },
    { type: 'content_block_stop', index },
  ]), ...end('tool_use')]
}

async function harness(replies: Record<string, unknown>[][]) {
  vi.stubEnv('DSH_TEST_STREAM_CLOSED_KEY', 'test-key')
  const http = await server((response, count) => {
    const reply = replies[count - 1]
    if (reply === undefined) throw new Error(`Unexpected Messages request ${count}`)
    response.end(sse(reply))
  })
  cleanup.push(() => http.close())
  const root = await mkdtemp(join(tmpdir(), 'dsh-stream-closed-'))
  cleanup.push(() => rm(root, { recursive: true, force: true }))
  const effects = join(root, 'effects.txt')
  const ctx = new Context()
  cleanup.push(() => ctx.fiber.dispose())
  ctx.baseUrl = pathToFileURL(root).href + '/'
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['llm', LlmRuntime], ['session', SessionStore], ['projection', SessionProjectionRegistry],
    ['prompt', SystemPrompt], ['tools', ToolRuntime], ['executor', NativeToolExecutor],
    ['agents', AgentRegistry], ['provider', DeepSeek], ['retry', Retry], ['loop', AgentLoop],
  ])
  ctx.loader.internal = sourceModuleLoader(async (name) => {
    if (!modules.has(name)) throw new Error(`Unexpected test plugin: ${name}`)
    return modules.get(name)
  })
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, JSON.stringify([...modules.keys()].map(name => ({
    name,
    ...name === 'provider' ? { config: {
      apiKeyEnv: 'DSH_TEST_STREAM_CLOSED_KEY', baseURL: http.url,
      retryPolicy: {
        mode: 'normal', maxRetries: 2,
        backoff: { initialDelayMs: 1, maxDelayMs: 1, jitterRatio: 0 },
      },
    } } : {},
  }))))
  await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
  await ctx.loader.await()
  ctx.tools.register(defineContentToolFixture({
    name: 'effect', description: 'Append one external effect', parameters: {},
    async execute() {
      await appendFile(effects, 'effect\n')
      return [{ type: 'text', text: 'Effect recorded.' }]
    },
  }))
  const agent = await ctx.agentLoop.create(SessionId('stream-closed-recovery'), { provider: 'deepseek-official', model: MODEL })
  return { http, agent, effects }
}

describe('STREAM_CLOSED tool safety', () => {
  it.each([
    { name: 'partial tool JSON', partial: toolResponse('failed', '{"request":').slice(0, -3) },
    { name: 'a complete tool block without message_stop', partial: toolResponse('failed', '{}').slice(0, -1) },
    { name: 'a complete sibling before a truncated tool', partial: toolResponse('failed', '{}', '{"request":').slice(0, -3) },
    { name: 'partial reasoning', partial: [start,
      { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'unfinished reasoning' } },
    ] },
  ])('regenerates $name without executing failed calls or repeating earlier effects', async ({ partial }) => {
    const h = await harness([toolResponse('before', '{}'), partial, toolResponse('after', '{}'), textEvents])
    h.agent.followup(user('Run the tool and finish.'))
    await h.agent.whenIdle()

    expect(h.http.requests).toHaveLength(4)
    expect(h.http.requests[1]!.body).toEqual(h.http.requests[2]!.body)
    expect(await readFile(h.effects, 'utf8')).toBe('effect\neffect\n')
    const events = h.agent.session.snapshotEvents()
    expect(events.filter(event => event.type === 'tool/call').map(event => event.data.callId))
      .toEqual(['before_0', 'after_0'])
    expect(events.filter(event => event.type === 'assistant/message').map(event => [event.data.turn, event.data.step]))
      .toEqual([[1, 1], [1, 2], [1, 3]])
    expect(events.filter(event => event.type === 'step/start').map(event => [event.data.turn, event.data.step]))
      .toEqual([[1, 1], [1, 2], [1, 3]])
    expect(events.filter(event => event.type === 'llm/retry').map(event => [event.data.turn, event.data.step, event.data.failure.code]))
      .toEqual([[1, 2, 'STREAM_CLOSED']])
    const attempts = events.filter(event => event.type === 'assistant/attempt')
    expect(attempts).toHaveLength(1)
    expect(expandAssistantStream(attempts[0]!.data.stream).at(-1)?.chunk).toMatchObject({
      type: 'finish', reason: { kind: 'error', failure: { code: 'STREAM_CLOSED' } },
    })
    const history = JSON.stringify(h.agent.session.deriveMessages())
    expect(history).not.toContain('failed_')
    expect(history).not.toContain('unfinished reasoning')
    expect(events.at(-1)).toMatchObject({ type: 'turn/end', data: { reason: { kind: 'completed' } } })
  })
})
