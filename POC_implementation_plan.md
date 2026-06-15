# Refract Hackathon Implementation Plan

This document outlines the features we currently have versus what we need to add, based on the Hackathon PDF requirements, and proposes a plan for implementing the new features.

## 1. Feature Analysis (PDF vs Current State)

**What we already have (Based on PDF Requirements):**
- **Observability Dashboard:** A real-time Next.js dashboard.
- **Metrics Storage & Ingestion:** Scalable async ingestion via NATS and PostgreSQL storage.
- **Metrics Tracking:** Tracking of Cost, Tokens, Latency, and Errors.
- **Integration Pattern:** "Provider usage fields" capture via custom SDKs (`@refract/sdk` and `Refract-sdk`).

**What we need to add:**
- **Proxy/Gateway Capture Pattern:** The PDF highlights that a logging proxy sitting in the middle is the "most scalable architecture" and a real answer to "integrate anything". We currently only support SDK-based integration.
- **Prompt Analyzer:** Analyzing and categorizing the content of prompts to understand the "Usage Shape".
- **Enhanced Visualizations:** Bringing the new categorization data and proxy metrics to the dashboard.
- **AI Optimization Agent:** Mentioned in the PDF to find cost drivers and propose right-sizing or caching (this can be built after the foundation is ready).

## 2. Proposed Changes

### Component: Database Schema
Add support for storing prompt categories.
#### [MODIFY] `packages/database/src/schema/traces.ts`
- Add `promptCategory: varchar('prompt_category', { length: 50 })` to the `traces` table.
- Add an index for `promptCategory` to make dashboard aggregations fast.

### Component: Prompt Analyzer (Ingestion Service)
Categorize prompts as they are ingested asynchronously.
#### [MODIFY] `services/ingestion/src/worker.ts` (or equivalent ingestion processor)
- Intercept incoming traces containing a `prompt`.
- Implement a `categorizePrompt(prompt: string)` function (using heuristics or a lightweight API call) to classify the prompt into predefined categories (e.g., "Code Generation", "Creative Writing", "Data Extraction", "General Chat").
- Update the trace payload with the `promptCategory` before inserting into the database.

### Component: Proxy Gateway Service
Allow zero-code instrumentation by pointing API clients to our gateway.
#### [NEW] `services/proxy`
- Create a new Express or Hono-based proxy service.
- **Functionality:** 
  1. Receive requests formatted for OpenAI/Anthropic.
  2. Extract the prompt and requested model.
  3. Forward the request to the real LLM provider.
  4. Measure latency, receive the response, and parse token usage from the provider's response.
  5. Asynchronously send a trace payload to our existing `services/ingestion` endpoint (`:9411/v1/traces`).
  6. Return the unmodified response to the client.
- Create a `Dockerfile` and update `docker-compose.yml` to include the new proxy service on a new port (e.g., `8080`).

### Component: Dashboard Visualizations
Visualize the new prompt categories and proxy data.
#### [MODIFY] `services/api/src/routes/analytics.ts` (or similar)
- Add a new endpoint `GET /api/analytics/categories` to group and count traces by `promptCategory`.
#### [MODIFY] `apps/dashboard/app/(dashboard)/page.tsx`
- Add a new Recharts visualization (e.g., a Pie Chart or Bar Chart) showing the distribution of Prompt Categories.

## User Review Required

> [!IMPORTANT]
> - **Proxy Implementation:** Do you want the proxy to act primarily as an OpenAI-compatible endpoint, or should it support both OpenAI and Anthropic formats initially? (Focusing on OpenAI first is usually fastest for hackathons).
> - **Prompt Analyzer:** Should the prompt analyzer use a fast heuristic (regex/keyword matching) or make an actual lightweight LLM call (e.g., using a cheap model like `gpt-4o-mini`) to categorize the prompt? The LLM approach is more accurate but incurs a small cost per trace.
> - **suggestions.txt:** Note that the `suggestions.txt` file you referenced is actually empty! Please let me know if there was specific content you wanted to share from it.

## Verification Plan

### Automated Tests
- Run database migrations and ensure the schema compiles correctly.
- Add basic unit tests for the `categorizePrompt` logic.

### Manual Verification
- Point an existing LLM script (using the standard OpenAI SDK) to the new `services/proxy` endpoint.
- Verify the script receives a successful response.
- Open the Refract Dashboard and verify that a new trace appears, complete with token counts, latency, and the newly assigned `Prompt Category`.
- Check the dashboard charts to ensure the new Prompt Category visualizations render correctly.
