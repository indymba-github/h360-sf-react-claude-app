# v2.4.0 Home Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the authenticated Home page into an attention-first FINS command center with more meaningful dashboard summaries.

**Architecture:** Keep existing `/dashboard` Salesforce fetches. Add a pure helper that computes daily focus items, book-health metrics, and dashboard takeaways from already-loaded data, then render those outputs in a new Home command-center component.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Node `node:test`, existing inline style/theme-token patterns.

## Global Constraints

- Do not add new Salesforce objects or queries for the first Home pass.
- Do not hardcode Salesforce IDs, credentials, org URLs, or demo-only account names.
- Do not include the main Accounts page in this pass.
- Use existing theme tokens and compact operational UI styling.
- Add tests before production helper code.

---

## File Structure

| File | Responsibility |
|---|---|
| `dashboard/lib/home-command-center.ts` | Pure helper that computes daily focus, book health, and dashboard takeaways. |
| `dashboard/lib/home-command-center.test.ts` | Unit coverage for the helper. |
| `dashboard/components/home/HomeCommandCenter.tsx` | Renders focus items, book-health metrics, and dashboard takeaways. |
| `dashboard/app/dashboard/page.tsx` | Uses the helper/component and repositions existing Home sections. |

## Task 1: Home Summary Helper

**Files:**
- Create: `dashboard/lib/home-command-center.ts`
- Create: `dashboard/lib/home-command-center.test.ts`

**Interfaces:**
- Produces:
  - `buildHomeCommandCenter(input: HomeCommandCenterInput): HomeCommandCenter`
  - `HomeFocusItem`, `HomeHealthMetric`, `HomeDashboardTakeaway`
- Consumes already-loaded dashboard records and chart models.

- [ ] **Step 1: Write failing tests**

Create `dashboard/lib/home-command-center.test.ts` with tests for ranked focus items, quiet state, book-health details, and chart takeaways.

- [ ] **Step 2: Verify tests fail**

Run:

```bash
npx tsc --outDir /private/tmp/sf-dashboard-home-red --module commonjs --target ES2022 --esModuleInterop --moduleResolution node --skipLibCheck lib/home-command-center.test.ts
```

Expected: compile fails because `home-command-center.ts` does not exist.

- [ ] **Step 3: Implement helper**

Create `dashboard/lib/home-command-center.ts` with deterministic formatting and ranking logic.

- [ ] **Step 4: Verify helper tests pass**

Run the focused compile and Node test command for `home-command-center.test.ts`.

## Task 2: Home Command Center Component

**Files:**
- Create: `dashboard/components/home/HomeCommandCenter.tsx`
- Modify: `dashboard/app/dashboard/page.tsx`

**Interfaces:**
- Consumes `HomeCommandCenter` from `dashboard/lib/home-command-center.ts`.
- Produces compact Home page sections for daily focus, book health, and dashboard takeaways.

- [ ] **Step 1: Render daily focus cards**

Create a compact focus grid with ranked items, severity/tone styling, detail text, and optional account links.

- [ ] **Step 2: Render book-health metrics**

Render four metrics with value and detail copy. Keep dimensions stable with responsive grid constraints.

- [ ] **Step 3: Render dashboard takeaways**

Place takeaways immediately above the chart area so the charts have a plain-English interpretation.

- [ ] **Step 4: Wire into dashboard page**

Call `buildHomeCommandCenter()` after existing data is shaped, then render `HomeCommandCenter` below the heading and before chart panels.

## Task 3: Verification

**Files:**
- No new files.

- [ ] **Step 1: Run focused helper tests**

Compile and run `home-command-center.test.ts`.

- [ ] **Step 2: Run all local helper tests**

Compile and run all `dashboard/lib/*.test.ts` plus component tests used by this repo.

- [ ] **Step 3: Run app checks**

Run:

```bash
npx tsc --noEmit
npm run lint
npm run build
npm run smoke
```

- [ ] **Step 4: Report status**

Summarize changed files, test results, and any follow-up recommendations.
