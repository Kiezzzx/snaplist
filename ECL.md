# Snaplist V1.0 (SaaS Ready) — Engineering Check List

**Architecture Decision:** Next.js 15 App Router + Serverless + Parallel Streaming
**Infrastructure:** Auth.js (OAuth) + Neon DB (Drizzle) + Cloudflare R2 (Storage) + Upstash Redis (Rate Limit) + Google Gemini (Gemini 3.1 Flash)

---

## 1. Core Functional Flow

We are expanding the original 4-stage MVP into a 5-stage pipeline that includes authentication and data persistence:

### Stage 0 — Auth & Claim
- Users enter the app. Anonymous users are assigned an `anonymousSessionId` stored in a `SameSite=Lax` Cookie.
- Users can log in via Google/GitHub OAuth. Upon the first login callback, a **Claim** process is triggered to transfer the historical data generated during the anonymous session to the current `user_id`.

### Stage 1 — Upload & Extract
- User drags and drops an image. **[Pre-action]** Triggers Upstash Redis rate-limit validation (3 times/day for anonymous, 20 times/day for logged-in users).
- Client-side performs hard compression (limiting max edge and file size) before uploading to `/api/upload`.
- Backend uses **Sharp** to validate the format, generate a thumbnail, and asynchronously upload to Cloudflare R2. Simultaneously, a `listings` record with a `pending` status is created in the database.
- Calls Google Gemini Vision (`gemini-3.1-flash`) via `@ai-sdk/google` with `generateObject` to extract image metadata (brand, condition, suggested price, etc.) and returns it to the frontend.

### Stage 2 — Review & Smart Merge
- The frontend form displays the AI-extracted data alongside the thumbnail.
- **[Anti-Overwrite Mechanism]**: When merging the AI data, strictly skip any fields that the user has manually modified (marked as `isDirty: true`).

### Stage 3 — Parallel Generate
- User clicks "Generate". The frontend **aborts** any ongoing legacy network requests.
- Triggers parallel streaming APIs using `@ai-sdk/google` `streamText` with `gemini-3.1-flash` to generate copy for three platforms (Rednote, Facebook, eBay). The streamed text is returned in real-time via SSE and simultaneously written back to the `generatedCopies` field in the database.

### Stage 4 — Render & Dashboard
- The copy is rendered with a typewriter effect inside isolated `<ListingEditor>` components.
- **New Dashboard page**: Users can view their historically generated Listings (displaying thumbnails). A delete function is provided.

---

## 2. Database Schema (Drizzle ORM)

```typescript
import { pgTable, text, timestamp, uuid, jsonb, integer, index } from 'drizzle-orm/pg-core';
import { users } from './auth-schema'; // Relates to Auth.js users table

export const listings = pgTable('listings', {
  id: uuid('id').defaultRandom().primaryKey(),

  // Ownership: Supports anonymous usage, claimed after login
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  anonymousSessionId: text('anonymous_session_id'),

  // R2 Storage Keys: Decoupled from real URLs to prevent hotlinking and ease future CDN migrations
  originalImageKey: text('original_image_key'),
  thumbnailKey: text('thumbnail_key'),
  imageSize: integer('image_size'),

  // Async State Machine (Deadlock prevention)
  imageStatus: text('image_status').default('pending'), // 'pending' | 'uploaded' | 'processed' | 'failed'

  // Strongly Typed JSONB: Core product attributes and AI generated results
  metadata: jsonb('metadata').$type<{
    brand?: string; model?: string; condition?: string;
    category?: string; suggestedPrice?: number; notes?: string;
  }>(),
  generatedCopies: jsonb('generated_copies').$type<{
    Rednote?: { content: string };
    Facebook?: { content: string };
    eBay?: { content: string };
  }>(),

  status: text('status').default('draft'), // 'draft' | 'generated' | 'sold'

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userCreatedIdx: index('listings_user_created_idx').on(table.userId, table.createdAt.desc()),
  userStatusIdx: index('listings_user_status_idx').on(table.userId, table.status),
  anonSessionIdx: index('listings_anon_session_idx').on(table.anonymousSessionId),
}));
```

---

## 3. Core API Signatures (API Routes & Server Actions)

### A. `/api/upload` — Upload, Rate Limit & Feature Extraction
- **Pre-processing**: Interceptor executes Upstash Ratelimit. Returns a `429` status if exceeded.
- **Action**: Receives Base64 → Sharp generates Thumbnail → Concurrent streaming upload to Cloudflare R2 → Creates DB Draft record → Calls Gemini 3.1 Flash via `@ai-sdk/google` `generateObject` for feature extraction with Zod schema validation.
- **Returns**: `{ dbId, metadata, thumbnailUrl }`

### B. `/api/generate` — Parallel Streaming Generation
- **Receives**: `{ dbId, metadata, platform }`
- **Action**: Loads the platform-specific Prompt to execute `streamText` with `gemini-3.1-flash`. Upon stream completion, asynchronously triggers a Server Action to write the generated content back to the `generatedCopies` field of the corresponding DB record.
- **Returns**: `text/event-stream`

### C. Server Action: `claimAnonymousListings`
- **Action**: Triggered by the OAuth callback. Finds records in the database where `anonymousSessionId` matches the current Cookie and `userId` is null, then updates the `userId` to the currently logged-in user's ID.

---

## 4. Hard Constraints

These are the absolute bottom lines that must be adhered to during development. They are also excellent Senior-level architectural considerations to highlight during interviews:

### [Backend & DevOps Constraints]

**Fail-Open Rate Limiting**
Calls to Upstash Redis MUST be wrapped in a `try/catch` block. If Redis times out (>1.5s) or throws an error, it must **Fail-Open** (allow the request through). A core business function cannot be brought down simply because an edge caching node fails.

**Two-Phase Deletion Contract**
Never rely solely on the database's `onDelete: 'cascade'`. When deleting a historical record, the code MUST first call the AWS S3 SDK to delete the `originalImageKey` and `thumbnailKey` in Cloudflare R2. Only after R2 confirms successful deletion should the `DELETE FROM listings` query be executed. This prevents accumulating exorbitant "zombie storage" costs.

**Runtime Zod Parsing**
Drizzle's JSONB `$type<>` is only a compile-time illusion. Before rendering the `metadata` fetched from the database on the frontend, it MUST pass through a Zod schema parse to prevent dirty historical data from causing a frontend white-screen crash.

**Sharp Deployment Configuration (Vercel Build Limits)**
You MUST configure `serverComponentsExternalPackages: ['sharp']` in `next.config.js`, and set `memory: 1024` and `maxDuration: 30` in `vercel.json` for the relevant functions to prevent OOM errors and timeouts.

**Gemini Rate Limit Awareness**
`gemini-3.1-flash` free tier has strict limits (RPM: 5, RPD: 20). Production deployment should either upgrade to paid tier OR implement application-level request queuing. Anonymous users should be limited at the Upstash layer BEFORE hitting Gemini to avoid burning quota.

### [Frontend & UI Constraints]

**State Isolation & Localized Streaming**
The SSE generation state (`content`, `isLoading`) MUST be locked entirely within the bottom-level `<ListingEditor>` component. Hoisting the typewriter effect state to a global Store or parent Page is strictly prohibited to prevent page-level render avalanches (unnecessary re-renders).

**Asynchronous State Machine Healing**
When the frontend fetches historical records, if it detects `imageStatus === 'pending'` and the `updatedAt` is older than 2 minutes, the UI MUST render a "Processing Failed" state and provide a retry button. Do not leave the user stuck in an infinite loading spinner.

**Dirty State Form Protection**
If the AI extraction API takes a long time, and the user has already manually modified a form field (e.g., Price), the JSON returned by the AI MUST undergo a deep comparison. It must drop/ignore any fields that have been marked as `isDirty: true` to prevent overwriting user input.
