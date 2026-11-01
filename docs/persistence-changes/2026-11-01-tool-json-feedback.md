---
description: "Records a persistence type transition and its compatibility acknowledgement."
kind: persistence-change
---

# 2026-11-01-tool-json-feedback

English | [中文](2026-11-01-tool-json-feedback.zh.md)

## Summary

Adds llm-retry attribution for a logged user-role JSON correction notice before an eligible retry.

## Table of Contents

- [Declaration](#declaration)
- [Compatibility](#compatibility)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="declaration"></a>
## Declaration

```yaml persistence-change
schemaVersion: 1
id: 2026-11-01-tool-json-feedback
baseline: false
changes:
  - root: "event:agent/inbox/spliced"
    previous: "2026-10-13-liveshare-share-viewer-principal"
    after: "82207378b37863a909f27a16ff7f1ce95a6928717787a8cf5fdca7ee9f1f32ea"
    decision: same-version
  - root: "event:developer/message"
    previous: "2026-10-13-liveshare-share-viewer-principal"
    after: "66e53333f47e50b471abf7d2f896c38624dacf34eb1fd13c989d1a95df5515c1"
    decision: same-version
  - root: "event:session/title-llm-request"
    previous: "2026-10-13-liveshare-share-viewer-principal"
    after: "59ca56399c7238a1ab6da6de2569f08d200e71ab2e0c45f7f0e3dfef55533c26"
    decision: same-version
  - root: "event:user/message"
    previous: "2026-10-13-liveshare-share-viewer-principal"
    after: "64cb5dccd6cbc0ecd1388adc5aee05d14d741bfd6a4c416493d6123d0cd0db86"
    decision: same-version
```

<a id="compatibility"></a>
## Compatibility

Existing records and retry budgets remain valid. The V4 reader admits nonempty producer source kinds and preserves unknown attribution metadata; older readers retain the ordinary user/message content without the llm-retry plugin. New readers still accept all prior source kinds. The new kind is attribution only: it adds no tool authority, executable replay instruction or mandatory projection. Failed assistant attempts remain diagnostic, and no rejected tool call executes.

<a id="verification"></a>
## Verification

Focused retry and DeepSeek stream suites: 100 tests passed, covering correction in the next model request and derived history, unchanged prior tool effects, bounded exhaustion, cancellation and explicit retry policy. The Host compiler passed after correcting the message constructor call.

<a id="dev-note"></a>
## Dev Note

None.
