# Contributing / 参与贡献

建议从可复现的问题、小范围修复或独立 UI 改进开始。

## 本地准备

```bash
npm ci
npm run demo
```

演示无需真实上游凭据。网络、账期和设备兼容性问题需要独立可复现的测试输入。

## 提交前验证

```bash
npm run ci:verify
npm run pw:install
npm run test:e2e
```

Linux 可用 `npx playwright install --with-deps chromium`。修改 UI 时附桌面/移动端截图；修改边界行为时增加回归测试。`npm run demo:screenshots` 更新 README 图片，使用模拟数据。

## Pull request

说明具体触发场景、变更后的行为及验证结果。保持主题清晰，避免夹带全库格式化或生产配置。遵循已有目录分层，前端不直接依赖 server。

请使用示例域名、文档 IP 和假 subId；不要上传真实账号、Cookie、邀请码、订阅、数据库、SSH 密钥或日志凭据。

问题反馈应包含 Node/系统/浏览器版本、复现步骤、预期/实际结果和脱敏日志。客户端问题补充客户端及内核版本，区分配置错误、导入失败和实际连接失败。

安全问题按 [SECURITY.md](SECURITY.md) 私下报告。原创贡献按 [MIT](LICENSE) 提交；第三方素材需注明来源和许可。
