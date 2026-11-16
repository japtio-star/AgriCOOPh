# COOP-OS — Development Roadmap

Version 0.1 · Draft for approval

## Definition of Done (applies to every module)

A module is **done** only when all of the following hold. Until then it is labelled
*preview* in the UI and in [PROGRESS.md](PROGRESS.md).

- [ ] All listed workflows work end to end against PostgreSQL (no local-state stand-ins).
- [ ] Every API and server action enforces permissions; matrix tests pass for all roles.
- [ ] Tenant isolation tests pass (cross-tenant read, write, FK reference all denied).
- [ ] Zod validation on every input; validation tests for edge cases.
- [ ] Audit log entries for all state changes.
- [ ] Error states, empty states and loading states implemented; no dead buttons.
- [ ] Responsive at 360 px, 768 px, 1280 px; keyboard accessible.
- [ ] Seed data for the demo tenant.
- [ ] User-facing help text and a module doc in `docs/modules/`.

## Phase 0 — Product architecture *(this delivery)*

Planning set in `docs/`. Exit: owner approves decisions in
[00-architecture-review.md §6](00-architecture-review.md#6-decisions-requested-before-phase-1).

## Phase 1 — Foundation

| # | Work item | Exit criteria |
|---|---|---|
| 1.1 | Scaffold Next.js + TS + Tailwind + shadcn/ui; ESLint/Prettier; Vitest; Playwright; docker-compose (Postgres, MinIO, Mailpit) | `docker compose up` → app runs; CI green |
| 1.2 | Env config validated with Zod (no fallback secrets) | App refuses to boot without secrets |
| 1.3 | Prisma schema: platform core tables; SQL migrations for roles, RLS, audit immutability | RLS coverage check in CI |
| 1.4 | `withTenant`, `RequestContext`, policy engine, permission registry & role templates | Unit + isolation tests |
| 1.5 | Auth: email/password, verification, reset, sessions, MFA (TOTP), optional Google | Auth E2E tests; rate limits |
| 1.6 | Onboarding wizard → org in `pending_verification` with default roles/modules | E2E: sign up → create org |
| 1.7 | Users & invitations, roles editor, branches, departments, org switcher | Matrix tests for admin area |
| 1.8 | App shell: dynamic sidebar, top bar (search stub limited to navigation commands, notifications, help link, org switcher, profile) | No item rendered without a working target |
| 1.9 | Audit log service + viewer; notification service (in-app) | |
| 1.10 | Numbering, approval engine, file service (signed URLs) — core APIs with tests | Used by Phase 2 |
| 1.11 | SaaS admin portal: tenants, verification, suspension, plans/modules (data-driven), subscriptions, trials, usage, manual billing records, announcements | Plans fully configurable |
| 1.12 | Demo tenant seed (Sample Agricultural Cooperative: 3 branches, 6 departments, staff users per role) | `is_demo` enforced |

## Phase 2 — Cooperative core (**MVP release at end of 2a**)

**2a (MVP):** Membership (A), Share Capital (B, without GL posting), Documents (I core),
basic dashboard, CSV import, privacy features. Demo tenant: 500 members with capital history.

**2b:** Governance (F), General Assembly (G), notification preferences, email adapter
(SMTP / provider), compliance calendar.

## Phase 3 — Financial operations

Finance (C) with posting engine and statements → Share capital GL posting + surplus
allocation → Savings (D) → Loans (E) with AniTala mock adapter → financial & portfolio
dashboards. Gate: CPA review of chart of accounts, posting rules, statement layouts; golden
tests on interest and amortization from pilot coop samples.

## Phase 4 — Business operations

HR (H), Inventory (J), Procurement (J), Operations (K), budgets, role-specific dashboards with
filters, document retention/templates.

## Phase 5 — Intelligence & integrations

Report builder & scheduled reports, public REST API with API keys & webhooks, AniTala real
integration (once spec/credentials exist), payment gateway and SMS adapters, Google Workspace
(sign-in already in P1; Drive/Calendar later), federation consolidated views with data-sharing
grants, member self-registration, PWA/offline capture evaluation, Filipino localisation.

## Sequencing rationale

- Platform engines first, because every module depends on them and retrofitting tenancy or
  audit is the most expensive kind of rework.
- Membership before anything financial: all subledgers reference members.
- Share capital in the MVP; full GL after, with posting requests queued so no data is lost.
- Governance/GA right after MVP because they share meetings/resolutions and are low-risk,
  high-visibility value for boards.
- Finance before Savings/Loans so money-moving modules post to the GL from day one of their
  release.

## Indicative effort (one senior full-stack engineer + part-time designer/QA)

| Phase | Weeks |
|---|---|
| 1 | 5–7 |
| 2a | 4–5 |
| 2b | 3–4 |
| 3 | 10–14 |
| 4 | 8–10 |
| 5 | ongoing |

Estimates assume timely access to pilot cooperatives and professional reviewers.
