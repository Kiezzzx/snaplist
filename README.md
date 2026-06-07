# Snaplist

AI-powered second-hand listing generator. Upload a photo, get platform-specific listing copy for **Facebook Marketplace**, **eBay**, and **Rednote**  — written in the right tone, in the right language.

---

## How it works

```
┌───────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────┐
│ 1. UPLOAD │ -> │ 2. EXTRACT   │ -> │ 3. REVIEW   │ -> │ 4. GEN   │
│  photo    │    │  Gemini Vision│    │  edit form  │    │  stream  │
└───────────┘    └──────────────┘    └─────────────┘    └──────────┘
   compress         /api/extract        DirtyState        /api/generate
   <3MB             returns JSON        user wins         parallel streams
```

1. **Upload** — Image compressed client-side to <3MB (max 1024px edge, webp).
2. **Extract** — Gemini 3.1 Flash-Lite returns category, brand, model, condition, suggested AUD price, notes.
3. **Review** — User edits the AI-prefilled form. Edits are sticky; late AI responses never overwrite user input (`DirtyState`).
4. **Generate** — Three parallel text streams (`text/plain`) produce platform-specific copy with isolated state per tab.

## Tech stack

- **Next.js 16** (App Router) + React 19
- **TypeScript** strict mode
- **Tailwind CSS v4** + shadcn/ui
- **Vercel AI SDK** + **Google Gemini 3.1 Flash-Lite** (vision + text)
- **Neon Postgres** + **Drizzle ORM** — listings persistence + dashboard history
- **Upstash Redis** — daily rate limiting (fail-open if unconfigured)
- `browser-image-compression` for client-side compression
- `zod` for structured output validation

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in the keys below
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Key | Required | Purpose |
|-----|----------|---------|
| `GOOGLE_GENERATIVE_AI_API_KEY` | yes | Gemini 3.1 Flash-Lite for both extract + generate |
| `DATABASE_URL` | yes | Neon Postgres connection (listings + dashboard) |
| `UPSTASH_REDIS_REST_URL` | no | Rate limiting; blank = disabled (fail-open) |
| `UPSTASH_REDIS_REST_TOKEN` | no | Rate limiting; blank = disabled (fail-open) |

## Project layout

```
src/
├── app/
│   ├── page.tsx                    # main UI (upload → review → generate)
│   ├── dashboard/                  # listing history + detail pages
│   ├── api/
│   │   ├── extract/route.ts        # image -> structured metadata
│   │   └── generate/route.ts       # metadata -> text/plain listing stream
│   └── globals.css                 # brutalist design tokens
├── components/
│   ├── listings/                   # upload-zone, metadata-form, listing-editor
│   └── dashboard/                  # listing-platform-tabs, delete-button
├── hooks/
│   └── use-listing-generation.ts   # cross-platform generation orchestration
└── lib/
    ├── platforms.ts                # PLATFORMS order + PLATFORM_META (single source)
    ├── types.ts                    # ProductMetadata, DirtyState, Platform
    ├── ai/                         # extract-metadata, generate-listing (prompts)
    ├── db/                         # Drizzle schema, validators, client
    ├── actions/                    # listings server actions (create/persist/delete)
    ├── ratelimit.ts                # Upstash fail-open limiter
    ├── session.ts                  # anonymous session cookie
    └── utils/compress-image.ts     # browser-image-compression wrapper
```

## API

### `POST /api/extract`

```ts
// Request
{ imageBase64: string }

// Response
{ success: true, dbId: string, metadata: Partial<ProductMetadata> }
// or
{ success: false, error: string, code?: 'RATE_LIMIT' | 'AI_BUSY' }
```

Returns **413** if payload exceeds 4.5MB, **429** on daily rate limit (`RATE_LIMIT`) or transient Gemini quota (`AI_BUSY`).

### `POST /api/generate`

```ts
// Request — the client serializes the reviewed metadata into `prompt`
{ prompt: string, platform: 'Facebook' | 'eBay' | 'Rednote', dbId: string }

// Response
text/plain — token-by-token listing copy (consumed with streamProtocol: 'text')
```

Each platform has its own system prompt tuned for tone (conversational English for Facebook, structured SEO for eBay, casual Mandarin for Rednote). On stream completion the copy is persisted back to the listing row.

## Design constraints

These are load-bearing; don't violate them:

1. **Compression before upload** — payload must be <3MB.
2. **Dirty state** — never overwrite a field the user has typed in, even if `/api/extract` resolves late.
3. **Streaming isolation** — stream state stays local to `<ListingEditor>`. No hoisting to parent or global store.
4. **AbortController** — every generate fetch is abortable. Cancel on regenerate or unmount.
5. **Per-platform error isolation** — one platform failing doesn't poison the others.
6. **413 enforcement** — `/api/extract` rejects payloads >4.5MB before calling the model.

## Scripts

```bash
npm run dev      # dev server
npm run build    # production build
npm run start    # serve production build
npm run lint     # eslint
```

## Deployment

Deploy to Vercel. Set `GOOGLE_GENERATIVE_AI_API_KEY` in project env vars.

## Status

Single image upload with Neon Postgres persistence and a dashboard (listing
history, detail view, delete). Auth is anonymous (session cookie) — no login
yet. Object storage uses an inline base64 thumbnail placeholder; Cloudflare R2
and Auth.js (OAuth + anonymous-listing claim) are the next phase.
