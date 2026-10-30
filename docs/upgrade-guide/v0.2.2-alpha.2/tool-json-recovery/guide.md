---
kind: upgrade-guide
description: "Invalid tool JSON uses a dedicated retryable error code instead of MALFORMED_RESPONSE."
---

# Invalid tool JSON uses a dedicated error code

English | [中文](guide.zh.md)

## Change

The DeepSeek Messages adapter reports syntactically invalid tool arguments in completed, non-truncated responses as `INVALID_TOOL_JSON`, previously `MALFORMED_RESPONSE`. The normal provider retry policy includes this code by default. Other protocol errors remain unchanged. Direct adapter calls still make one attempt; agent recovery requires `llm-retry`.

## Migration

1. Update consumers that classify this failure by code to recognize `INVALID_TOOL_JSON`.
2. If your provider sets an explicit `retryPolicy.retryableCodes`, add `INVALID_TOOL_JSON` to enable recovery, or omit it to retain immediate failure. Use `retryPolicy.maxRetries` to bound retries, including `0` to disable them.
3. Verify that failed responses appear as `assistant/attempt`, scheduled recovery appears as `llm/retry`, and tools execute only after a valid response. Exhaustion returns `INVALID_TOOL_JSON` without executing rejected calls.
