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

## Architecture

Snaplist runs entirely on Vercel's platform, split across three runtime tiers — the
**browser**, the **Edge runtime**, and the **Node serverless runtime** — with all
paid/stateful dependencies (Gemini, Upstash, Neon) kept strictly behind the
serverless boundary. Nothing that holds a secret or a DB handle is ever reachable
from the client.

```mermaid
flowchart TB
    subgraph client["🖥️ Client — Browser (React 19)"]
        direction TB
        UP["UploadZone<br/>compressAndConvertToBase64<br/>webp · ≤1024px · &lt;3MB"]
        FORM["MetadataForm<br/>React state + DirtyState<br/>(user edits always win)"]
        HOOK["useListingGeneration<br/>orchestration only —<br/>never touches stream content"]
        subgraph editors["Per-platform stream isolation (constraint #3)"]
            direction LR
            E1["ListingEditor<br/>Facebook<br/>useCompletion"]
            E2["ListingEditor<br/>eBay<br/>useCompletion"]
            E3["ListingEditor<br/>Rednote<br/>useCompletion"]
        end
    end

    subgraph edge["⚡ Vercel Edge Runtime"]
        MW["middleware.ts<br/>issues anon_session_id<br/>httpOnly · SameSite=Lax<br/>(no server-only imports)"]
    end

    subgraph serverless["☁️ Vercel Serverless — Node runtime · 'server-only'"]
        direction TB
        EX["POST /api/extract<br/>413 guard → rate limit → AI"]
        SHARP["sharp thumbnail<br/>(parallel with AI)"]
        GEN["POST /api/generate<br/>streamText → ReadableStream"]
        ACT["server actions<br/>create / persist / mark"]
        AFTER["after() — persist copy<br/>post-response"]
    end

    subgraph third["🔌 Third-party services"]
        GEM["Google Gemini<br/>3.1 Flash-Lite<br/>vision + text"]
        UPS["Upstash Redis<br/>sliding-window<br/>fail-open"]
        NEON["Neon Postgres<br/>Drizzle ORM"]
    end

    %% session gate — every request first passes the Edge
    UP -.->|"HTTPS (cookie set on 1st hit)"| MW
    MW -.->|anon_session_id| EX
    MW -.->|anon_session_id| GEN

    %% extract path
    FORM -->|"base64 image"| EX
    EX -->|checkRateLimit| UPS
    EX -->|extractProductMetadata| GEM
    EX --> SHARP
    EX -->|createListing| ACT
    ACT --> NEON
    EX -->|"{ dbId, metadata }"| FORM

    %% generate path (isolated per platform)
    FORM --> HOOK
    HOOK -->|triggerId| E1 & E2 & E3
    E1 & E2 & E3 -->|"POST {prompt, platform, dbId}"| GEN
    GEN -->|streamText| GEM
    GEM -.->|tokens| GEN
    GEN ==>|"text/plain token stream"| E1 & E2 & E3
    GEN --> AFTER
    AFTER -->|persistGeneratedCopy| NEON
```

### Streaming lifecycle (`/api/generate`)

The generate route deliberately **awaits the first token before committing to
HTTP 200**, so a Gemini `429`/`503` surfaces as a real error status instead of a
truncated 200. Persistence happens *after* the client has the full stream, via
`after()`, and is skipped on mid-stream failure so partial copy never gets saved
as "the listing".

```mermaid
sequenceDiagram
    participant C as ListingEditor (client)
    participant G as /api/generate (serverless)
    participant AI as Gemini 3.1 Flash-Lite
    participant DB as Neon Postgres

    C->>G: POST { prompt, platform, dbId }
    G->>AI: streamText(system + prompt)
    AI-->>G: first token (awaited before 200)
    G-->>C: 200 text/plain — stream opens
    loop each token
        AI-->>G: token
        G-->>C: token (rendered live)
    end
    Note over G,DB: after() runs post-response
    G->>DB: persistGeneratedCopy(dbId, platform, copy)
```

### Data-flow boundaries & isolation

The diagram's tiers are enforced boundaries, not just visual grouping:

- **Client → network (compression boundary).** Images are compressed to webp
  (≤1024px, `<3MB`) *in the browser* before they ever hit the wire; the server
  re-checks and rejects anything over 4.5MB with a `413` before spending Sharp or
  Gemini cycles.
- **Edge ↔ serverless.** `middleware.ts` runs on the Edge runtime and issues the
  `anon_session_id` cookie for every visitor. It **cannot import the `server-only`
  module graph** (DB, AI, session), so the cookie name is duplicated as a literal
  rather than imported — this keeps the Edge bundle free of Node-only code.
- **`server-only` secret boundary.** The Gemini key, Neon connection, and Upstash
  client all live in modules marked `'server-only'`, so they are never bundled into
  client code. The browser only ever sees JSON metadata and token text.
- **Per-platform stream isolation (constraint #3, #5).** Each `<ListingEditor>`
  owns its own `useCompletion` stream. `useListingGeneration` coordinates lifecycle
  (a `triggerId` restart signal + an aggregate status map) but **never reads or
  writes stream content** — so one platform failing or being aborted can't poison
  the copy of its siblings.
- **Fail-open rate limiting.** Upstash is consulted *after* the cheap local guards
  but *before* Gemini. If Redis is slow or down, the limiter resolves as *allowed* —
  a rate-limiter outage must never take down a core upload.

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
npm run dev         # dev server
npm run build       # production build
npm run start       # serve production build
npm run lint        # eslint
npm test            # vitest unit tests (run once)
npm run test:watch  # vitest in watch mode
npx playwright test # end-to-end tests (Chromium)
```

## Testing & CI

- **Unit** — [Vitest](https://vitest.dev) (`happy-dom`), specs in `tests/**/*.test.ts`. Covers platform config, validators, and the fail-open rate limiter.
- **E2E** — [Playwright](https://playwright.dev) (Chromium), specs in `tests/**/*.spec.ts`. These drive the real app and make **live Gemini calls**; the dev server runs with Upstash creds blanked so the suite's uploads aren't blocked by the anonymous rate cap.

CI runs on GitHub Actions (`.github/workflows/playwright.yml`) for every push and PR to `master`, in three sequential jobs:

```
type-and-lint  ->  unit-tests  ->  e2e-tests
tsc + eslint       vitest run      playwright (Chromium)
```

The e2e job needs `DATABASE_URL` and `GOOGLE_GENERATIVE_AI_API_KEY` configured as repository secrets.

## Deployment

Deploy to Vercel. Set `GOOGLE_GENERATIVE_AI_API_KEY` in project env vars.

## Status

Single image upload with Neon Postgres persistence and a dashboard (listing
history, detail view, delete). Auth is anonymous (session cookie) — no login
yet. Object storage uses an inline base64 thumbnail placeholder; Cloudflare R2
and Auth.js (OAuth + anonymous-listing claim) are the next phase.
