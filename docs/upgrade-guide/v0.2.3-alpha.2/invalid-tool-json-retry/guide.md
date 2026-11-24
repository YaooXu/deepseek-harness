---
kind: upgrade-guide
description: "Completed invalid tool JSON uses INVALID_TOOL_JSON and bounded request retries instead of MALFORMED_RESPONSE."
---

# Invalid tool JSON recovery

English | [中文](guide.zh.md)

## Change

The DeepSeek Messages adapter classifies syntactically invalid tool JSON in a completed response as `INVALID_TOOL_JSON`. The normal provider retry policy includes this code. A permitted retry records a model-visible correction after cancellable backoff. Tool calls from the rejected response do not execute, including otherwise valid sibling calls; earlier successful calls retain their recorded results. Non-object JSON and damaged protocol frames remain `MALFORMED_RESPONSE`.

## Migration

1. Update failure routing that expects `MALFORMED_RESPONSE` for completed invalid tool JSON to recognize `INVALID_TOOL_JSON`.
2. If the deployment explicitly sets `retryPolicy.retryableCodes`, add `INVALID_TOOL_JSON` to opt into recovery; an explicit list remains authoritative. Keep a finite `maxRetries` for bounded recovery.
3. Session consumers must preserve the producer-attributed `llm-retry` user-message notice. Do not treat it as human input or remove it from model replay.
4. Verify that invalid attempts execute no tools, successful earlier tool results are retained, cancellation stops backoff, and exhausted retries remain failures.
