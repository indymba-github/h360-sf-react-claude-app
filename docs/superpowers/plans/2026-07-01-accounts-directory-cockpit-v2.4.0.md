# v2.4.0 Accounts Directory Cockpit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the main Accounts page into a more meaningful directory cockpit using existing Account fields.

**Architecture:** Keep the existing Account query, API, pagination, and chat rail. Add a pure helper for account summary/card/filter semantics, then update `AccountsListClient` to render those outputs.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Node `node:test`, existing inline style/theme-token patterns.

## Global Constraints

- Do not add new Salesforce objects or queries.
- Do not hardcode Salesforce IDs, credentials, org URLs, or demo-only account names.
- Keep account cards compact and operational.
- Keep financial-account rollups out of this pass.
- Add tests before production helper code.

---

## File Structure

| File | Responsibility |
|---|---|
| `dashboard/lib/accounts-directory.ts` | Pure helper for summary metrics, display metadata, and quick filters. |
| `dashboard/lib/accounts-directory.test.ts` | Unit coverage for directory helper. |
| `dashboard/components/AccountsListClient.tsx` | Render summary strip, quick filters, and improved account cards. |

## Task 1: Directory Helper

- [ ] Write failing tests for summary metrics, card metadata, and quick filters.
- [ ] Verify tests fail because helper does not exist.
- [ ] Implement `buildAccountsDirectory()` and `filterAccountsDirectoryCards()`.
- [ ] Verify helper tests pass.

## Task 2: Accounts UI

- [ ] Import helper into `AccountsListClient`.
- [ ] Render summary strip above search.
- [ ] Add quick filter segmented controls.
- [ ] Render improved card metadata and attention status line.
- [ ] Preserve existing search, industry, sort, pagination, starring, and Salesforce links.

## Task 3: Verification

- [ ] Run focused helper tests.
- [ ] Run all local helper tests.
- [ ] Run TypeScript, lint, build, and smoke tests.
- [ ] Report changed files and results.
