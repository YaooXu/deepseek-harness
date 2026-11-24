---
kind: upgrade-guide
description: "完整响应中的无效工具 JSON 使用 INVALID_TOOL_JSON 和有界请求重试，不再使用 MALFORMED_RESPONSE。"
---

# 无效工具 JSON 恢复

[English](guide.md) | 中文

## 变更

DeepSeek Messages 适配器将完整响应中语法无效的工具 JSON 分类为 `INVALID_TOOL_JSON`。normal 提供者重试策略包含此错误码。获准的重试在可取消退避结束后记录模型可见的修正通知。被拒响应的工具调用均不执行，包括其他语法有效的同批调用；此前成功的调用保留其已记录结果。非对象 JSON 和损坏的协议帧仍为 `MALFORMED_RESPONSE`。

## 迁移

1. 更新将完整响应中无效工具 JSON 识别为 `MALFORMED_RESPONSE` 的错误处理，识别 `INVALID_TOOL_JSON`。
2. 若部署显式设置 `retryPolicy.retryableCodes`，加入 `INVALID_TOOL_JSON` 才会启用恢复；显式列表仍是依据。保留有限的 `maxRetries` 以限制恢复次数。
3. Session 消费方必须保留来源为 `llm-retry` 的用户消息通知。不要将其当成人工输入，也不要从模型回放中删除。
4. 验证无效尝试不执行工具、此前成功的工具结果保留、取消会停止退避，且重试耗尽仍报告失败。
