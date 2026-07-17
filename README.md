# Grow Into Yourself

Grow Into Yourself is a privacy-first space for people who feel confused, blamed, or controlled in difficult relationships.

It helps users separate facts, emotional pressure, safety signals, and possible next-boundary words from difficult chats — without diagnosing anyone or labelling anyone as NPD.

This is an early public test. Features, wording and availability may change as the project is reviewed and improved.

## What it does

Grow Into Yourself offers a local screenshot-reading flow, a paste-and-review conversation tool, relationship-specific check-ins, practical learning pages and a moderated anonymous community wall.

## Key features

- Local OCR for English and Chinese chat screenshots, with automatic line and sentence reconstruction.
- Separate check-ins for partner/dating, family, workplace and friendship contexts.
- Five device-local visual themes and accessible motion preferences.
- Moderated community notes, supportive replies and a rotatable globe.
- A protected admin area for reviewing community submissions and feedback.

## Privacy principles

- Screenshots are processed locally in the browser. The English and Chinese OCR files are loaded as static assets and the selected images are not sent to the application server.
- Private screenshots and chat text are not published or used to train AI.
- Self-check answers remain on the device unless someone actively submits a community note or feedback.
- Community notes and replies are saved only after active submission. Approved notes are public.
- Secrets, local databases, exports and user uploads must never be committed.

## What it cannot diagnose

This tool cannot diagnose NPD, any personality disorder, trauma, abuse, a crime, or another person’s intention. It does not replace emergency, medical, legal or mental-health support.

## Local development

Requires Node.js 22.13 or newer.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

## Environment variables

| Variable | Purpose |
| --- | --- |
| `ADMIN_KEY` | Protects the admin API at runtime. Keep it in the deployment environment or `.env.local`. |

Never commit `.env.local` or a real key.

## Testing

```bash
npm run lint
npm run build
npm test --if-present
npx vinext check
```

## Deployment notes

The project uses Vinext, Cloudflare Workers, D1 and Drizzle. Keep `.openai/hosting.json` aligned with the deployment environment. Run the build and verify a preview before any production release. Saving source changes to GitHub does not deploy or overwrite an existing site.
