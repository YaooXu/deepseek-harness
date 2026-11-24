---
description: "记录持久化类型更改及其兼容性确认。"
kind: persistence-change
---

# 2026-11-24-invalid-tool-json-retry

[English](2026-11-24-invalid-tool-json-retry.md) | 中文

## 概述

为获准的无效工具 JSON 重试增加 llm-retry 通知来源。

## 目录

- [声明](#declaration)
- [兼容性](#compatibility)
- [验证](#verification)
- [开发备注](#dev-note)

<a id="declaration"></a>
## 声明

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
## 兼容性

已有来源分支和事件结构不变。新增 kind 明确标记生产方及 notice 形式，只携带文本，不是工具调用或人工命令。读者必须保留来源或拒绝未知来源，不能重新解释。KG 既有实验沿用冻结运行时续跑，不支持新写会话降级。

<a id="verification"></a>
## 验证

125 项重试、DeepSeek 流和重试策略测试通过，覆盖持久化修正通知、被拒同批调用不执行、取消和重试耗尽。

<a id="dev-note"></a>
## 开发备注

无。
