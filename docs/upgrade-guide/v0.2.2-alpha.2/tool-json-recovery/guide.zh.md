---
kind: upgrade-guide
description: "非法工具 JSON 使用专用的可重试错误码，替代 MALFORMED_RESPONSE。"
---

# 非法工具 JSON 使用专用错误码

[English](guide.md) | 中文

## 变更

DeepSeek Messages 适配器将完整且未截断响应中的工具参数 JSON 语法错误报告为 `INVALID_TOOL_JSON`，此前为 `MALFORMED_RESPONSE`。提供方的 normal 重试策略默认包含此错误码。其他协议错误保持不变。直接调用适配器仍只尝试一次；agent（智能体）恢复需要 `llm-retry`。

## 迁移

1. 更新按错误码分类此失败的调用方，使其识别 `INVALID_TOOL_JSON`。
2. 如果提供方显式设置了 `retryPolicy.retryableCodes`，添加 `INVALID_TOOL_JSON` 以启用恢复，或省略它以保留立即失败行为。通过 `retryPolicy.maxRetries` 限制重试次数，设为 `0` 可禁用重试。
3. 确认失败响应记录为 `assistant/attempt`，计划恢复记录为 `llm/retry`，工具仅在合法响应后执行。重试耗尽时返回 `INVALID_TOOL_JSON`，不执行被拒绝的调用。
