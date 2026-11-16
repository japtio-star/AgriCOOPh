# COOP-OS — Architecture Review & Recommendation

Status: **Planning — awaiting approval**  ·  Date: 2026-11-16  ·  Phase: 0 (Product Architecture)

This is the entry point to the COOP-OS planning set. It records what exists today, what we
recommend, and the decisions that need an owner's sign-off before Phase 1 begins.

| # | Deliverable | File |
|---|---|---|
| 1 | Product Requirements Document | [01-prd.md](01-prd.md) |
| 2 | System Architecture (incl. ADRs, tenant isolation) | [02-system-architecture.md](02-system-architecture.md) |
| 3 | Database ERD & table catalog | [03-database-erd.md](03-database-erd.md) |
| 4 | Role & Permission Matrix | [04-roles-permissions.md](04-roles-permissions.md) |
| 5 | Module & Feature Breakdown (dependencies, overlaps) | [05-modules-features.md](05-modules-features.md) |
| 6 | Navigation Structure | [06-navigation.md](06-navigation.md) |
| 7 | Development Roadmap & MVP | [07-roadmap.md](07-roadmap.md) |
| 8 | API Architecture | [08-api-architecture.md](08-api-architecture.md) |
| 9 | Security Architecture | [09-security-architecture.md](09-security-architecture.md) |
| — | Project progress log | [PROGRESS.md](PROGRESS.md) |

---

## 1. Repository assessment

### 1.1 What exists

The repository holds a Google AI Studio–generated prototype named **"AgriCOOPh Membership
Database System (AMDS)"** — a federation-level tool to list cooperatives, their members, and
M&E report submissions (CAPAR / CAIS).

| Area | Current implementation |
|---|---|
| Runtime | Node 22, single `server.ts` (Express 4) that also mounts Vite in middleware mode |
| Frontend | React 19, React Router 7, Tailwind 4, Recharts, lucide-react, `motion` |
| Database | SQLite via `better-sqlite3`, schema created in code at boot (`amds.db`) |
| Auth | bcrypt + JWT (24 h) stored in `localStorage` |
| Files | `multer` to local `./uploads`, served publicly by `express.static` |
| Size | ~690 lines of TSX + ~300 lines of server code, 5 pages, 8 tables |
| Tests / CI / Docker | None |
| Unused deps | `@google/genai` (no AI feature uses it), `motion` |

### 1.2 Defects that rule out building on this code as-is

These are concrete, verified in `server.ts` and `src/`:

1. **Tenant breakout on write** — `POST /api/members` accepts `coop_id` from the request body
   (`coop_id || req.user.coop_id`), so any authenticated user can create members in any
   cooperative. Same pattern on `POST /api/reports`.
2. **Tenant leak on read** — `GET /api/cooperatives` returns every cooperative to every user.
3. **Public files** — `/uploads` is served by `express.static` with no auth; filenames are
   `Date.now()-originalname`, i.e. guessable. Member documents would be world-readable.
4. **Hardcoded fallback JWT secret** (`'fallback_secret_key_123'`) and seeded password
   `admin123` that are active whenever env vars are missing.
5. **No authorization beyond a role string**; `Data Encoder` / `Viewer` roles exist in the
   schema but are never enforced.
6. **No input validation**, no rate limiting, permissive `cors()`, SQL `verbose: console.log`
   logs every query (including PII) to stdout.
7. **Account enumeration** — login returns "User not found" vs. "Invalid password".
8. **Decorative UI** — e.g. the "Upload Report" button, the search box and notification bell
   have no handlers; the Members page has no create/edit form.
9. **SQLite** cannot provide Row-Level Security, concurrent writers, or the transactional
   guarantees an accounting ledger needs at multi-tenant scale.

### 1.3 What is worth keeping

- The **domain intent**: AgriCOOPh operates as a federation tracking affiliated cooperatives
  and CDA-related report submissions. That is a real requirement and maps to COOP-OS's
  *Federation* capability (Phase 5) and *Documents/Reporting* modules.
- The **tooling choices** that already match the target stack: TypeScript, React 19,
  Tailwind 4, Recharts, lucide-react, date-fns, clsx/tailwind-merge.
- The visual direction (neutral surfaces, green accent) is a reasonable starting point,
  though the dark navy sidebar will be replaced by the agricultural-green identity.

### 1.4 Recommendation on the existing code

**Replace, don't migrate.** The prototype is small (~1k LOC), and every one of its server
endpoints must be rewritten for tenant isolation, validation and RBAC anyway. A migration
would cost more than a clean foundation and would carry the insecure patterns forward.

Proposed handling: tag the current commit as `prototype-amds-v0` so it stays retrievable, then
replace it with the COOP-OS foundation in Phase 1. Its seed data (2 coops, 3 members) is
demonstration data only; nothing needs migrating.

---

## 2. Recommended architecture (summary)

Full detail in [02-system-architecture.md](02-system-architecture.md).

| Concern | Choice | Why |
|---|---|---|
| App framework | **Next.js (App Router) + React + TypeScript**, one deployable | Matches preferred stack; server components cut client JS for data-heavy tables; route handlers give a REST API in the same codebase |
| Domain layer | Framework-independent `src/server/modules/*` services | API and UI call the same services; extractable to a separate API later |
| UI | Tailwind 4 + shadcn/ui (Radix) + Recharts + TanStack Table | Accessible primitives, no proprietary component lock-in |
| Validation | Zod schemas shared by forms, API and services | One source of truth for input rules |
| Database | **PostgreSQL 16** | RLS, `NUMERIC` money, constraints, triggers, mature hosting |
| ORM | **Prisma** (multi-file schema) + raw SQL migrations for RLS/triggers | Type safety; SQL where Prisma cannot express policy |
| Tenant isolation | Shared schema + `organization_id` on every tenant row + **Postgres RLS** driven by a transaction-local setting + composite FKs | Defence in depth: app filter, DB policy, and FK all must agree |
| Auth | Better Auth (email/password, DB sessions, Google OAuth, TOTP 2FA) — our own RBAC on top | HttpOnly cookie sessions, revocable; we keep permission logic in our code |
| Files | S3-compatible private bucket (MinIO in dev), short-lived signed URLs, metadata in Postgres | Private by default; works on AWS/GCS/R2 |
| Background jobs | pg-boss (Postgres-backed queue) | Interest accrual, notifications, PAR snapshots without adding Redis |
| Money | `NUMERIC(18,2)` (rates `NUMERIC(9,6)`), `decimal.js` in code, never floats | Correct peso arithmetic |
| Tests | Vitest (unit/integration against real Postgres), Playwright (E2E) | RLS can only be tested against a real database |
| Delivery | Docker + docker-compose (app, postgres, minio), GitHub Actions CI | Docker-compatible, CI/CD-ready |

---

## 3. Module analysis: overlaps and shared engines

The 12 modules are not 12 independent apps. Several capabilities recur across them; building
each once as a **platform service** is the single biggest lever on cost and consistency.

| Shared engine | Used by | Notes |
|---|---|---|
| **Member registry** | B, D, E, F, G, L, member portal | Every financial and governance record hangs off `members` |
| **Posting engine** (subledger → GL) | B Share Capital, D Savings, E Loans, J Inventory, K Operations | Each module emits a *posting request*; the engine maps it to accounts via per-org posting rules and writes a balanced journal. Modules never write journal lines directly |
| **Approval workflow engine** | B withdrawals, C journals/disbursements, D withdrawals, E loans, I documents, J requisitions/POs, H leave | Configurable steps, amount thresholds, maker ≠ checker |
| **Document/attachment service** | All modules | One storage path, one access-control model, versioning |
| **Meetings & resolutions** | F Governance, G General Assembly, committees (incl. Credit Committee) | Same entities: meeting → agenda → attendance → minutes → resolutions → votes |
| **Numbering service** | Member IDs, OR/receipt numbers, JV numbers, resolution numbers, loan accounts | Per-org configurable formats, gap-free where required, concurrency-safe |
| **Audit log** | All | Append-only, before/after diffs |
| **Notifications** | All | In-app first; email/SMS through adapters |
| **Custom fields** | Members first, then employees, products | Typed field definitions per org, validated with Zod at runtime |
| **Financial periods** | B, C, D, E | A closed period blocks posting everywhere |

Other overlaps resolved by design:

- **Inventory (J) vs. Operations sales (K)**: inventory owns stock quantities; K owns sales
  documents that *consume* stock via the inventory service. No duplicate stock counts.
- **HR employees vs. users vs. members**: three distinct entities linked through a shared
  `person` concept — a farmer can be a member, an employee and a system user at once without
  duplicated identity data.
- **Loans (E) vs. AniTala.online**: COOP-OS owns the loan *account lifecycle* (application
  record, approval, release, schedule, collections, GL). Agricultural credit *assessment* is
  delegated to AniTala through an adapter interface (`CreditAssessmentProvider`); until its API
  specification is available a manual-assessment provider is used. No AniTala endpoints are
  assumed.
- **Credit Committee (E) vs. Committees (F)**: the credit committee is an ordinary committee
  record in Governance; loan approval steps reference committee membership.

### Dependency order (what must exist before what)

```
Platform core (tenancy, auth, RBAC, audit, numbering, files, notifications)
 └─ Member registry (A)
     ├─ Documents (I) ─────────────────────────────┐
     ├─ Governance (F) ── General Assembly (G)     │
     ├─ Share Capital (B) ─┐                       │
     │                     ├─ Finance/GL (C) ──────┼─ Reports & Intelligence (L)
     ├─ Savings (D) ───────┤   (posting engine)    │
     └─ Loans (E) ─────────┘                       │
 HR (H) ── Inventory (J) ── Procurement (J) ── Operations (K) ─┘
```

Share Capital, Savings and Loans can run **before** Finance is enabled: they keep their own
subledgers and queue posting requests; when the Finance module is enabled, the posting engine
posts them (or the accountant books them manually). This matters because many small coops
will buy membership + share capital first.

---

## 4. Recommended MVP

**MVP = Phase 1 (Foundation) + Membership + Share Capital + Documents.**

Reasoning:

- Every cooperative type has members and share capital; not every one has savings, loans or
  inventory. This is the broadest-applicability slice.
- The member register and share capital ledger are records every cooperative is expected to
  keep, and they are the data most coops currently hold in spreadsheets — fastest time to
  value for onboarding.
- It exercises every platform engine (tenancy, RBAC, approvals for withdrawals, numbering,
  documents, audit) on a contained domain before money movement gets complex.
- It is sellable on its own as the **Starter** plan plus a Share Capital add-on.
- Full double-entry accounting is the highest-risk module (correctness, professional review);
  it follows immediately in Phase 3 with the posting engine already designed for it.

Governance and General Assembly complete Phase 2 after the MVP cut. See
[07-roadmap.md](07-roadmap.md).

---

## 5. Technical risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Cross-tenant data exposure | Critical (DPA breach, loss of trust) | Three-layer isolation (app scoping, RLS, composite FKs); app DB role without `BYPASSRLS`; automated isolation tests on every table; CI check that every tenant table has RLS enabled |
| Accounting errors | Critical | Balanced-entry DB constraint on posting; immutable posted entries (trigger); reversals only; period locks; property-based tests on posting rules; review by a Philippine CPA before production |
| Interest / amortization mismatches with coop practice | High | Interest methods are configured, not coded per coop (diminishing, straight/flat, add-on, with configurable day-count and rounding); golden-file tests against spreadsheets supplied by pilot coops |
| Regulatory over-claiming | High (legal) | No "CDA compliant" language in product; templates labelled "for review"; configurable reporting templates versioned with effective dates |
| Scope size (12 modules) | High | Strict phases; module flags; "done" = workflows + permissions + validation + tests ([07-roadmap.md](07-roadmap.md)) |
| Prisma and RLS interplay | Medium | All tenant queries go through a `withTenant(orgId, fn)` wrapper that opens a transaction and sets `app.org_id` locally; raw SQL migrations for policies; tested with PgBouncer transaction pooling |
| Low connectivity / older devices at rural coops | Medium | Server-rendered pages, small bundles, paginated tables, mobile layouts; offline capture deferred (Phase 5 candidate) |
| Data migration from spreadsheets | Medium | CSV import with dry-run validation report, from Phase 2 onward |
| AniTala / payment / SMS integrations without specs | Medium | Adapter interfaces + mock implementations; no invented third-party APIs |

---

## 6. Decisions requested before Phase 1

1. **Replace the prototype** with the COOP-OS foundation (tagging it `prototype-amds-v0`)?
   *Recommended: yes.*
2. **Stack** as in §2 (Next.js + Postgres/Prisma + RLS + Better Auth + S3-compatible storage)?
   *Recommended: yes.*
3. **MVP scope** as in §4?
4. **First tenant profile**: is the first real customer AgriCOOPh as a *federation* (the
   current prototype's use case) or individual primary cooperatives? This changes whether a
   minimal federation view moves earlier than Phase 5.
5. **Hosting region**: a Singapore cloud region (lowest latency available from most major
   providers) vs. a Philippine data centre. Cross-border transfer is permitted under the Data
   Privacy Act with safeguards, but some customers may require local hosting. This should be
   confirmed with counsel / the DPO.
