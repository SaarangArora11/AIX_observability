
## Refract Dashboard — Noir Prism Glass UI

A quirky, glass-morphic, data-driven frontend for your Refract observability backend. Built in TanStack Start with live wiring to your local microservices.

### Heads-up on "live APIs"
The Lovable preview runs in the cloud — it cannot reach `http://localhost:8081` on your machine directly. To make this work:
- The app reads API base URLs from `localStorage` (with a Settings panel to edit them), defaulting to `http://localhost:8081`, `:8082`, `:8090`.
- Run the dashboard locally (`bun dev` after pulling) to talk to your local services, OR expose them with a tunnel (ngrok/cloudflared) and paste those URLs in Settings.
- Each fetch has a graceful "backend unreachable" fallback state so the UI is never broken in preview.

### Design language — Noir Prism
- Near-black canvas (`#0d0d0d` → `#1a1a1a` radial), warm ember (`#e85d3a`) + prism gold (`#f0d78c`) accents.
- Frosted-glass cards: `backdrop-blur-xl`, layered borders (1px hairline + inner highlight), subtle film-grain overlay.
- Editorial typography: Instrument Serif display + Geist Mono for numbers/IDs + Inter body.
- Prismatic light leaks: animated conic-gradient blobs drifting behind the canvas.
- Quirky touches: mouse-tracked spotlight on cards (gradient follows cursor), magnetic hover on KPI tiles, card-stack swipe deck for trace browsing, framer-motion `layoutId` shared-element transitions when opening a trace.

### Routes
```
src/routes/
  __root.tsx          shell: noir bg, prism light leaks, sidebar nav, settings drawer
  index.tsx           Overview dashboard
  traces.tsx          Traces list + detail (split view with swipe deck)
  analyzer.tsx        Prompt Analyzer
  replay.tsx          Replay + embedded Demo Chat
```

### Surface details

**Overview** (`/`)
- KPI tiles: Prompt Efficiency Score, Estimated Savings ($), avg latency, total tokens, total traces, error rate. Each tile = magnetic glass card with mouse-tracked highlight + count-up animation.
- Token Flow stacked bar (input vs output over time) — Recharts with glass tooltip.
- Model-Task Alignment donut (overkill / good fit / underkill).
- Provider mix (Gemini / OpenAI / Anthropic) chip row.
- Recent traces ticker (animated list, MagicUI-style).
- Source: `GET {queryApi}/v1/metrics` + `/v1/traces?limit=50` (adjust to your real endpoints once we see them).

**Traces** (`/traces`)
- Left: searchable/filterable table (status, provider, model, latency, cost, tokens, source SDK/Proxy).
- Right: swipeable card deck — drag a trace card sideways to dismiss, up to pin, with framer-motion. Click → expands via shared `layoutId` into a full detail panel showing spans, prompt, completion, token breakdown, cost math, model-fit verdict.
- Delete button → `DELETE {queryApi}/v1/traces/:id` with optimistic UI.

**Analyzer** (`/analyzer`)
- Pick a trace → trigger analysis → animated reveal of category, complexity gauge, model-fit verdict (overkill/fit/underkill), suggested cheaper model, projected $ savings.
- Falls back to mock analysis on 429 (matches your backend's behavior).
- Endpoint: `POST {queryApi}/v1/analyze` with `{ traceId }`.

**Replay + Demo Chat** (`/replay`)
- Top: replay player for a selected trace — step through spans timeline-style, glass scrubber, token-by-token stream replay via `{replayApi}/v1/replay/:id`.
- Bottom: embedded Demo Chat that posts directly to `{proxyApi}/v1/chat/completions` with a model picker (gemini-2.0-flash, gemini-2.5-pro, gpt-4o-mini, claude-3-haiku). Uses AI Elements (`Conversation`, `Message`, `PromptInput`) for the chat surface so it stays polished.

### Cross-cutting components
- `GlassCard` — frosted surface with mouse-tracked spotlight (CSS variables updated on `mousemove`).
- `PrismBackdrop` — animated conic-gradient blobs + grain.
- `MagneticTile` — KPI tile that subtly pulls toward the cursor.
- `SwipeDeck` — framer-motion drag stack for traces.
- `SettingsDrawer` — edit the 3 API base URLs, persisted in localStorage; "Test connection" pings each service.
- `apiClient.ts` — thin fetch wrapper reading URLs from settings, with TanStack Query integration and 5s timeout + "unreachable" error class.

### Tech
- TanStack Query for all reads; `ensureQueryData` + `useSuspenseQuery` per route.
- framer-motion for swipe deck, shared-element trace expansion, magnetic hover, count-ups.
- Recharts for charts (themed to noir glass).
- AI Elements for the Demo Chat composer.
- Tailwind v4 tokens in `src/styles.css` (noir bg, ember/gold accents, glass surface tokens, prism gradient).

### Out of scope (ask if you want them)
- Auth — assumed open since these are local services.
- Alerts management surface.
- SDK install/onboarding wizard.

### Open question
I'm assuming endpoint shapes like `GET /v1/traces`, `GET /v1/metrics`, `POST /v1/analyze`, `DELETE /v1/traces/:id`, `GET /v1/replay/:id`, `POST /v1/chat/completions`. If your real endpoints differ, drop the route list (or an OpenAPI spec) when you implement and I'll wire to the exact shapes — otherwise I'll go with these and you can correct after first run.
