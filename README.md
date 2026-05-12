# Snaplist

AI-powered second-hand listing generator. Upload a photo, get platform-specific listing copy for **Rednote **, **Facebook Marketplace**, and **eBay** — written in the right tone, in the right language.

---

## How it works

```
┌───────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────┐
│ 1. UPLOAD │ -> │ 2. EXTRACT   │ -> │ 3. REVIEW   │ -> │ 4. GEN   │
│  photo    │    │  Gemini Vision│    │  edit form  │    │  3x SSE  │
└───────────┘    └──────────────┘    └─────────────┘    └──────────┘
   compress         /api/extract        DirtyState        /api/generate
   <3MB             returns JSON        user wins         parallel streams
```

1. **Upload** — Image compressed client-side to <3MB (max 1024px edge).
2. **Extract** — Gemini 2.5 Flash returns category, brand, model, condition, suggested AUD price, notes.
3. **Review** — User edits the AI-prefilled form. Edits are sticky; late AI responses never overwrite user input (`DirtyState`).
4. **Generate** — Three parallel SSE streams produce platform-specific copy with isolated state per tab.

## Tech stack

- **Next.js 16** (App Router) + React 19
- **TypeScript** strict mode
- **Tailwind CSS v4** + shadcn/ui
- **Vercel AI SDK** + **Google Gemini 2.5 Flash** (vision + text)
- `browser-image-compression` for client-side compression
- `zod` for structured output validation

## Getting started

```bash
npm install
cp .env.example .env.local   # add GOOGLE_GENERATIVE_AI_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Key | Required | Purpose |
|-----|----------|---------|
| `GOOGLE_GENERATIVE_AI_API_KEY` | yes | Gemini 2.5 Flash for both extract + generate |

## Project layout

```
src/
├── app/
│   ├── page.tsx                    # main UI
│   ├── api/
│   │   ├── extract/route.ts        # Stage 2: image -> structured metadata
│   │   └── generate/route.ts       # Stage 4: metadata -> SSE listing text
│   └── globals.css                 # brutalist design tokens
├── components/
│   ├── upload-zone.tsx             # drag-drop + compression + preview
│   ├── metadata-form.tsx           # AI-prefilled form, DirtyState tracking
│   └── listing-editor.tsx          # SSE consumer (isolated per platform)
└── lib/
    ├── types.ts                    # ProductMetadata, DirtyState, Platform
    └── compress-image.ts           # browser-image-compression wrapper
```

## API

### `POST /api/extract`

```ts
// Request
{ imageBase64: string }

// Response
{ success: true, data: Partial<ProductMetadata> }
// or
{ success: false, error: string }
```

Returns **413** if payload exceeds 4.5MB, **429** on Gemini rate limit.

### `POST /api/generate`

```ts
// Request
{ prompt: string, platform: 'Rednote' | 'Facebook' | 'eBay' }

// Response
text/event-stream — token-by-token listing copy
```

Each platform has its own system prompt tuned for tone (casual Mandarin for Rednote, conversational English for Facebook, structured SEO for eBay).

## Design constraints

These are load-bearing; don't violate them:

1. **Compression before upload** — payload must be <3MB.
2. **Dirty state** — never overwrite a field the user has typed in, even if `/api/extract` resolves late.
3. **Streaming isolation** — SSE state stays local to `<ListingEditor>`. No hoisting to parent or global store.
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

MVP — single image upload, no auth, no database, no persistence.
