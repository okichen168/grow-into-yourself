<p align="center">
  <a href="./README.zh-CN.md">简体中文</a> | <a href="./README.md">English</a>
</p>

# 长成自己 / Grow Into Yourself

**在线测试版：** https://clear-translate.creamy-scarf-2160.chatgpt.site

![从混乱走向清醒](./docs/readme-hero.jpg)

Grow Into Yourself 是一个用于拆解困难聊天的关系清醒工具，帮助用户分开看事实、压力、安全信号和更稳的边界回复。

这是早期公开测试版，不诊断任何人为 NPD，也不能替代紧急、医疗、法律或心理健康支持。

## 当前功能

- 用两个文本框区分“对方发来的话”和“我说过或准备回复的话”。
- 通过服务端 `/api/analyze` 返回结构化 AI 辅助分析。
- 没有密钥、模型失败、格式错误或超时时，明确回退到本地基础分析。
- 保留伴侣/暧昧、家人、职场、朋友/同学四类关系自查。
- 保留科普、主题选择和带旋转地球的匿名互助墙。

## 隐私原则

- 测试版暂不支持直接上传截图。
- 为了生成本次分析，文本可能发送给配置的 AI 模型。
- 本站不保存用于分析的私人聊天文本。
- 匿名互助留言和产品反馈只有在用户主动提交后才会保存；审核通过的留言会公开。
- 密钥、本地数据库、导出文件和用户上传内容不得提交到仓库。

## 不能诊断什么

本工具不能诊断 NPD、人格障碍、创伤、虐待或违法行为，也不能判断他人的真实动机。分析只关注可观察的原话、重复行为、权力、边界、影响和安全信号；证据不足时必须明确说明不确定。

## 研究与来源

各科普主题会链接相应的专业资料与研究来源，可查看[英文科普页](https://clear-translate.creamy-scarf-2160.chatgpt.site/learn#sources)或[中文科普页](https://clear-translate.creamy-scarf-2160.chatgpt.site/zh/learn#sources)。这些资料用于建立教育框架，不会让聊天分析变成临床诊断。

## 本地开发

需要 Node.js 22.13 或更新版本。

```bash
npm install
cp .env.example .env.local
npm run dev
```

## 环境变量

| 变量 | 用途 |
| --- | --- |
| `ADMIN_KEY` | 保护后台管理接口。 |
| `OPENROUTER_API_KEY` | 仅服务端读取的 OpenRouter 密钥。 |
| `OPENROUTER_MODEL` | 可选模型配置；不填写时使用服务端默认模型。 |

不要提交 `.env.local` 或真实密钥。

## 测试

```bash
npm run lint
npm test
npm run build
```

## 部署说明

项目使用 Vinext、Cloudflare Workers、D1 和 Drizzle。部署密钥只应配置在托管环境中；先验证预览，再更新正式版本。推送 GitHub 不会自动覆盖当前线上站点。
