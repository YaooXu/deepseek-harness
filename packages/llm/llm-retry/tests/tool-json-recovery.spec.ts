/** Recover rejected tool JSON through the Loader, HTTP adapter and real tool executor. */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
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
  while (cleanup.length) await cleanup.pop()!()
  vi.unstubAllEnvs()
})

function toolResponse(prefix: string, ...inputs: string[]): Record<string, unknown>[] {
  return [start, ...inputs.flatMap((partial_json, index) => [
    { type: 'content_block_start', index, content_block: { type: 'tool_use', id: `${prefix}_${index}`, name: 'effect', input: {} } },
    { type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json } },
    { type: 'content_block_stop', index },
  ]), ...end('tool_use')]
}

const malformed = '{"request":{"timeout_seconds":300}]}'

async function harness(replies: Record<string, unknown>[][], maxRetries = 2, retryableCodes?: string[]) {
  vi.stubEnv('DSH_TEST_TOOL_JSON_KEY', 'test-key')
  const http = await server((response, count) => response.end(sse(replies[count - 1] ?? replies.at(-1)!)))
  cleanup.push(() => http.close())
  const root = await mkdtemp(join(tmpdir(), 'dsh-tool-json-'))
  cleanup.push(() => rm(root, { recursive: true, force: true }))
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
      apiKeyEnv: 'DSH_TEST_TOOL_JSON_KEY', baseURL: http.url,
      retryPolicy: {
        mode: 'normal', maxRetries, ...(retryableCodes === undefined ? {} : { retryableCodes }),
        backoff: { initialDelayMs: 1, maxDelayMs: 1, jitterRatio: 0 },
      },
    } } : {},
  }))))
  await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
  await ctx.loader.await()
  let executions = 0
  ctx.tools.register(defineContentToolFixture({
    name: 'effect', description: 'Record one external effect', parameters: {},
    async execute() {
      executions++
      return [{ type: 'text', text: 'Effect recorded.' }]
    },
  }))
  const agent = await ctx.agentLoop.create(SessionId('tool-json-recovery'), { provider: 'deepseek-official', model: MODEL })
  return { ctx, http, agent, executions: () => executions, async run() {
    agent.followup(user('Run the tool and finish.'))
    await agent.whenIdle()
  } }
}

describe('invalid tool JSON recovery', () => {
  it('regenerates the failed response without executing its valid sibling or replaying previous tools', async () => {
    const h = await harness([toolResponse('before', '{}'), toolResponse('bad', '{}', malformed), toolResponse('after', '{}'), textEvents])
    await h.run()
    expect(h.http.requests).toHaveLength(4)
    expect(h.executions()).toBe(2)
    expect(h.http.requests[1]!.body).toEqual(h.http.requests[2]!.body)
    const events = h.agent.session.snapshotEvents()
    expect(events.filter(e => e.type === 'llm/retry').map(e => e.data.failure.code)).toEqual(['INVALID_TOOL_JSON'])
    expect(events.filter(e => e.type === 'tool/call')).toHaveLength(2)
    const attempts = events.filter(e => e.type === 'assistant/attempt')
    expect(attempts).toHaveLength(1)
    const failedInputs = expandAssistantStream(attempts[0]!.data.stream).flatMap(({ chunk }) =>
      chunk.type === 'block-end' && chunk.block.type === 'tool-call' ? [chunk.block.arguments] : [])
    expect(failedInputs).toEqual(['{}', malformed])
    const argumentsInHistory = h.agent.session.deriveMessages().flatMap(message =>
      message.content.flatMap(block => block.type === 'tool-call' ? [block.arguments] : []))
    expect(argumentsInHistory).toEqual(['{}', '{}'])
    expect(events.at(-1)).toMatchObject({ type: 'turn/end', data: { reason: { kind: 'completed' } } })
  })

  it('stops after two configured retries without executing any tool', async () => {
    const h = await harness([toolResponse('bad', '{}', malformed)])
    await h.run()
    expect(h.http.requests).toHaveLength(3)
    expect(h.executions()).toBe(0)
    const events = h.agent.session.snapshotEvents()
    expect(events.filter(e => e.type === 'llm/retry')).toHaveLength(2)
    expect(events.filter(e => e.type === 'assistant/attempt')).toHaveLength(3)
    expect(events.filter(e => e.type === 'assistant/message')).toHaveLength(0)
    expect(events.at(-1)).toMatchObject({ type: 'turn/end', data: { reason: { kind: 'error', error: { code: 'INVALID_TOOL_JSON' } } } })
  })

  it('honors a zero retry budget', async () => {
    const h = await harness([toolResponse('bad', malformed)], 0)
    await h.run()
    expect(h.http.requests).toHaveLength(1)
    expect(h.executions()).toBe(0)
    expect(h.agent.session.snapshotEvents().filter(e => e.type === 'llm/retry')).toHaveLength(0)
  })

  it('cancels a scheduled recovery before another request', async () => {
    const h = await harness([toolResponse('bad', malformed), textEvents])
    h.ctx.on('session/event', (session, event) => {
      if (session === h.agent.session && event.type === 'llm/retry') h.agent.cancel({ kind: 'user' })
    })
    await h.run()
    expect(h.http.requests).toHaveLength(1)
    expect(h.executions()).toBe(0)
    expect(h.agent.session.snapshotEvents().filter(e => e.type === 'llm/retry-started')).toHaveLength(0)
    expect(h.agent.session.snapshotEvents().at(-1)).toMatchObject({
      type: 'turn/end', data: { reason: { kind: 'aborted' } },
    })
  })

  it('respects an explicit retry code allowlist', async () => {
    const h = await harness([toolResponse('bad', malformed), textEvents], 2, ['SERVER'])
    await h.run()
    expect(h.http.requests).toHaveLength(1)
    expect(h.executions()).toBe(0)
    expect(h.agent.session.snapshotEvents().filter(e => e.type === 'llm/retry')).toHaveLength(0)
    expect(h.agent.session.snapshotEvents().at(-1)).toMatchObject({
      type: 'turn/end', data: { reason: { kind: 'error', error: { code: 'INVALID_TOOL_JSON' } } },
    })
  })

  it('does not retry malformed protocol ordering', async () => {
    const h = await harness([[start, start], textEvents])
    await h.run()
    expect(h.http.requests).toHaveLength(1)
    expect(h.executions()).toBe(0)
    expect(h.agent.session.snapshotEvents().at(-1)).toMatchObject({
      type: 'turn/end', data: { reason: { kind: 'error', error: { code: 'MALFORMED_RESPONSE' } } },
    })
  })
})
