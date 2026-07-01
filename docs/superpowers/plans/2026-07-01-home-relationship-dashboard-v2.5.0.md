# v2.5.0 Home Relationship Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Home dashboard graph area with relationship-management views.

**Architecture:** Add a pure helper for pipeline allocation, relationship coverage, service pressure, and next actions. Add a Home dashboard component that renders those helper outputs. Update `/dashboard` to provide two Account aggregate counts and remove the forecast/aging chart panels from Home.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Recharts, Node `node:test`, existing inline theme-token styling.

## Global Constraints

- Do not add financial-account rollups in this pass.
- Do not hardcode Salesforce IDs, credentials, org URLs, or demo account names.
- Keep the existing daily focus, book-health, news, intelligence queue, agenda, and chat rail.
- Add tests before production helper code.

---

## File Structure

| File | Responsibility |
|---|---|
| `dashboard/lib/home-relationship-dashboard.ts` | Pure helper for dashboard allocation, coverage, service pressure, and actions. |
| `dashboard/lib/home-relationship-dashboard.test.ts` | Unit coverage for relationship dashboard semantics. |
| `dashboard/components/home/HomeRelationshipDashboard.tsx` | Renders the new dashboard area. |
| `dashboard/components/PipelineChart.tsx` | Reworks existing pipeline chart from bar to allocation pie. |
| `dashboard/app/dashboard/page.tsx` | Fetches account coverage counts and replaces forecast/aging panels. |

## Task 1: Relationship Dashboard Helper

- [ ] Write failing tests for allocation, coverage, service pressure, and actions.
- [ ] Verify tests fail because helper does not exist.
- [ ] Implement helper.
- [ ] Verify focused tests pass.

## Task 2: Dashboard UI Replacement

- [ ] Rework `PipelineChart` into a stage allocation pie.
- [ ] Add `HomeRelationshipDashboard`.
- [ ] Update `/dashboard` to fetch coverage counts and render the new dashboard component.
- [ ] Remove Home usage of forecast and aging dashboard panels.

## Task 3: Verification

- [ ] Run focused tests.
- [ ] Run all local tests.
- [ ] Run TypeScript, lint, build, and smoke tests.
- [ ] Start local dev server for review.
