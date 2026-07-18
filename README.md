<p align="center">
  <a href="./README.zh-CN.md">简体中文</a> | <a href="./README.md">English</a>
</p>

# Grow Into Yourself

**Live demo:** https://clear-translate.creamy-scarf-2160.chatgpt.site

![From confusion to clarity](./docs/readme-hero.jpg)

Grow Into Yourself is a privacy-first clarity tool for difficult chats. It helps separate facts, pressure, safety signals and calmer boundary words.

This is an early public test for people who feel confused, blamed or controlled in difficult relationships. It does not diagnose anyone as NPD or replace emergency, medical, legal or mental-health support.

## What it does

- Keeps the other person’s messages and the user’s reply in separate text fields.
- Uses the server-side `/api/analyze` route for structured AI-assisted analysis.
- Falls back to clearly labelled local basic analysis when AI is unavailable.
- Preserves relationship-specific check-ins for partner/dating, family, workplace and friendship contexts.
- Includes practical learning pages, visual themes and a moderated anonymous support wall.

## Privacy principles

- Screenshot upload is paused in this test version.
- Text may be sent to the configured AI model for the current analysis.
- This site does not save private conversation text submitted for analysis.
- Community notes and feedback are saved only after active submission; approved notes become public.
- Secrets, local databases, exports and user uploads must never be committed.

## What it cannot diagnose

The tool cannot diagnose NPD, any personality disorder, trauma, abuse, a crime or another person’s intention. It focuses on observable words, repeated behaviour, boundaries, impact and safety signals. When evidence is limited, the result should say so.

## Research and sources

The educational pages link to the professional and research sources used for individual topics. See the [English learning guide](https://clear-translate.creamy-scarf-2160.chatgpt.site/learn#sources) or the [Chinese learning guide](https://clear-translate.creamy-scarf-2160.chatgpt.site/zh/learn#sources). Sources inform the educational framework; they do not turn a chat analysis into a clinical diagnosis.

## Local development

Requires Node.js 22.13 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Environment variables

| Variable | Purpose |
| --- | --- |
| `ADMIN_KEY` | Protects the admin API at runtime. |
| `OPENROUTER_API_KEY` | Server-side OpenRouter credential. Never expose it to browser code. |
| `OPENROUTER_MODEL` | Optional model override with a server-side fallback. |

Never commit `.env.local` or a real key.

## Testing

```bash
npm run lint
npm test
npm run build
```

## Deployment notes

The project uses Vinext, Cloudflare Workers, D1 and Drizzle. Keep `.openai/hosting.json` aligned with the Sites project. Configure secrets in the deployment environment, verify a preview, and only then update production. A GitHub push does not deploy or overwrite the current site.
