---
description: "记录持久化类型更改及其兼容性确认。"
kind: persistence-change
---

# 2026-11-01-tool-json-feedback

[English](2026-11-01-tool-json-feedback.md) | 中文

## 概述

新增 llm-retry 来源标记，用于在允许的重试前持久记录 user 角色的 JSON 纠错提示。

## 目录

- [声明](#declaration)
- [兼容性](#compatibility)
- [验证](#verification)
- [开发备注](#dev-note)

<a id="declaration"></a>
## 声明

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
## 兼容性

已有记录和重试预算保持有效。V4 读取器接受非空的生产者来源类型并保留未知来源元数据；旧读取器不需要 llm-retry 插件也会保留普通 user/message 正文。新读取器继续接受原有来源类型。新类型仅标识来源，不增加工具权限、可执行回放指令或必需投影。失败的 assistant attempt 仍仅用于诊断，被拒绝的工具调用不会执行。

<a id="verification"></a>
## 验证

重试与 DeepSeek 流式处理相关测试 100 项通过，覆盖下一次模型请求及派生历史中的纠错提示、已有工具操作不重放、有界耗尽、取消和显式重试策略。修正消息构造函数调用后 Host 编译通过。

<a id="dev-note"></a>
## 开发备注

无。
