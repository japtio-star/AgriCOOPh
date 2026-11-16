# COOP-OS — Project Progress

Status legend: ⬜ not started · 🟨 in progress · 🟩 done (meets Definition of Done) ·
🟦 preview (works, DoD incomplete)

## Current phase: 0 — Product architecture (awaiting approval)

| Item | Status | Notes |
|---|---|---|
| Repository assessment | 🟩 | See [00-architecture-review.md §1](00-architecture-review.md#1-repository-assessment) |
| PRD | 🟩 draft | [01-prd.md](01-prd.md) |
| System architecture + ADR summary | 🟩 draft | [02-system-architecture.md](02-system-architecture.md) |
| Database ERD | 🟩 draft | [03-database-erd.md](03-database-erd.md) — Phases 1–3 detailed; Phase 4 tables listed |
| Role & permission matrix | 🟩 draft | [04-roles-permissions.md](04-roles-permissions.md) |
| Module & feature breakdown | 🟩 draft | [05-modules-features.md](05-modules-features.md) |
| Navigation structure | 🟩 draft | [06-navigation.md](06-navigation.md) |
| Roadmap & MVP | 🟩 draft | [07-roadmap.md](07-roadmap.md) |
| API architecture | 🟩 draft | [08-api-architecture.md](08-api-architecture.md) |
| Security architecture | 🟩 draft | [09-security-architecture.md](09-security-architecture.md) |
| Owner decisions (§6 of review) | ⬜ | Pending |

## Modules

| Module | Phase | Status |
|---|---|---|
| Platform core & SaaS admin | 1 | ⬜ |
| Membership | 2a | ⬜ |
| Share Capital | 2a | ⬜ |
| Documents | 2a | ⬜ |
| Governance | 2b | ⬜ |
| General Assembly | 2b | ⬜ |
| Finance | 3 | ⬜ |
| Savings | 3 | ⬜ |
| Loans | 3 | ⬜ |
| HR | 4 | ⬜ |
| Inventory & Procurement | 4 | ⬜ |
| Operations | 4 | ⬜ |
| Reporting & Intelligence | 2a→5 | ⬜ |
| Integrations & Federation | 5 | ⬜ |

## Existing code

The AMDS prototype (`server.ts`, `src/`) is still in the repository and is **not** part of
COOP-OS. Known issues are listed in the architecture review §1.2. It is to be tagged
`prototype-amds-v0` and replaced at the start of Phase 1, pending approval.

## External dependencies / reviews outstanding

- Philippine CPA review: chart of accounts, posting rules, statement templates (before P3 GA).
- Counsel / DPO: retention defaults, hosting region, DPA template.
- Pilot cooperative sample data: ledgers, amortization schedules, member lists (anonymised).
- AniTala.online API specification and credentials.

## Changelog

- 2026-11-16 — Phase 0 planning set drafted.
