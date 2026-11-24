---
description: "Records a persistence type transition and its compatibility acknowledgement."
kind: persistence-change
---

# 2026-11-24-invalid-tool-json-retry

English | [中文](2026-11-24-invalid-tool-json-retry.zh.md)

## Summary

Adds the llm-retry notice source for a permitted invalid-tool-JSON retry.

## Table of Contents

- [Declaration](#declaration)
- [Compatibility](#compatibility)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="declaration"></a>
## Declaration

```yaml persistence-change
schemaVersion: 1
id: 2026-11-24-invalid-tool-json-retry
baseline: false
changes:
  - root: "event:agent/inbox/spliced"
    previous: "2026-11-19-cua-input-notices"
    after: "253ab19ccfcff97f9ad86deddcc33123eba25009d5cb689706e46eae7ddcb053"
    decision: same-version
  - root: "event:developer/message"
    previous: "2026-11-19-cua-input-notices"
    after: "94df9e9757d0cae4e3fa8452e74ff36559ad44030d8fb040cea795351d11061c"
    decision: same-version
  - root: "event:session/title-llm-request"
    previous: "2026-11-19-cua-input-notices"
    after: "9b5096a588afadaf14cd3a5e958f03be4ab4a7f67ed3dc5ccf539356d2cbd613"
    decision: same-version
  - root: "event:user/message"
    previous: "2026-11-19-cua-input-notices"
    after: "70c6ef309c485db938c628f35697b7ce2d7c825b2892ac74c8927e52bb27323b"
    decision: same-version
```

<a id="compatibility"></a>
## Compatibility

Existing source variants and event shapes are unchanged. The new kind is explicitly producer-attributed with form notice; it carries text, not a tool invocation or human command. Readers must retain its attribution or reject the unknown source rather than reinterpret it. KG resumes existing experiments with their frozen runtime; downgrade of newly written sessions is not supported.

<a id="verification"></a>
## Verification

125 focused retry, DeepSeek stream and retry-policy tests passed, including durable correction notices, no execution of rejected sibling calls, cancellation and retry exhaustion.

<a id="dev-note"></a>
## Dev Note

None.
