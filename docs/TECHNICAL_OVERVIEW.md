<div align="center">

# AEGIS — Technical Deep Dive

[![Back to README](https://img.shields.io/badge/%E2%86%90-back%20to%20README-d6241f)](../README.md)

</div>

This is the engineering companion to the [README](../README.md). The
README explains what AEGIS is and what it does for the people who use it;
this file explains how it's actually built, for anyone who wants to run it
locally, extend it, or just understand the architecture. The **Features**
and **Tech Stack** sections of the README (package versions, hosting,
dependency rationale) aren't duplicated here — this file covers everything
around them: repository layout, how to run it yourself, how it's tested,
and how it's deployed.

## Architecture, in one paragraph

A browser talks to a React single-page app (`packages/web`), which talks
over plain REST/JSON to a Node/Express API (`packages/api/src/server.ts`).
The API holds all the real business logic — grading, probation tracking,
course recommendation, transfers, venture matching — in small, independently
tested modules under `packages/api/src/modules/`, and reads/writes its data
through one in-memory store (`packages/api/src/db/memory/inMemoryDb.ts`)
that's written to look and behave like a real database repository layer, so
swapping it for an actual Postgres database (a Prisma schema already exists
at `packages/api/src/db/prisma/schema.prisma`, ready but not yet wired in)
shouldn't require touching any route or business-logic module. Types and
grading tables that both the frontend and backend need to agree on live in
a third package, `packages/shared`, imported directly as source by both
(no build step of its own).

## Repository layout

```
packages/
  shared/   → @advisor/shared
              Plain TypeScript types (Student, Course, Advisor, VentureProject, …)
              and grading-scale tables. No logic — just the shapes both
              api and web build against, so they can never silently drift
              apart.

  api/      → @advisor/api — the backend
    src/
      server.ts              Every HTTP route (Express)
      db/
        memory/inMemoryDb.ts   The in-memory data store + every read/write
                                operation the routes call into
        seed/                  All seed data: the real course catalogs
                                (see below), advisors, students, venture
                                projects, external opportunities
        prisma/schema.prisma    A real database schema, scaffolded for
                                when the in-memory store is swapped out
      modules/
        grading/        CGPA math, credit caps, level thresholds
        probation/      The probation-counter state machine, dismissal
        advising/       The "generate my plan" orchestration
        prediction/     Per-course expected-grade projection — student's
                        own mean/mode blended with the course's own real
                        3-year mean/mode/trend (`docs/BUILD_SPEC.md` §3.1);
                        CGPA trajectory and curriculum-analytics demand
                        forecasting still use the shared OLS linear
                        regression (`linearRegression.ts`); best-case
                        projection, cold-start (new-student) assessment
        transfer/       Internal (same-faculty) and external (cross-
                        faculty) department transfer execution
        retakeGate/     The "should retakes be considered?" gate
        fitEngine/      The department/faculty best-fit quiz engine
        venture/        Venture-project matching and application lifecycle
        proposals/      Advisor course-proposal / dual-approval workflow
        friction/       Weekly workload ("cognitive load") scoring
        collider/       External opportunity (competitions, funding,
                        internships) matching
        curriculumAnalytics/  Demand forecasting, curriculum health
                        scoring, and bottleneck/dependency analysis —
                        department- and advisor-scoped (`docs/
                        CURRICULUM_ANALYTICS_BLUEPRINT.md`)
        auth/           Password hashing, session tokens, and the
                        per-request access guards behind real backend
                        login (`docs/BUILD_SPEC.md` §20) — cross-role
                        notification wiring also lives here and inline in
                        `server.ts`, not a dedicated module of its own

  web/      → @advisor/web — the frontend (Vite + React + React Router)
    src/
      portal/          The student-facing pages (dashboard, course plan,
                        transcript, venture board, department quiz);
                        `portal/ui/Sidebar.tsx` is the persistent left nav
                        shared by all 3 portals (`TopbarNav.tsx` is now
                        mobile-only — see §19.8 of the BUILD_SPEC)
      advisorConsole/  The advisor-facing pages (roster, per-student file,
                        venture board, transfer-request queue, Curriculum
                        Analytics pages)
      vpConsole/       The Vice President's pages (cross-advisor dashboard,
                        per-advisor drill-down, transfer-request review,
                        Curriculum Analytics pages)
      auth/            Real session state (a bearer token, not just a
                        role/id blob) and per-role route guards — backed
                        by the API's own `auth/` module, not a client-side
                        credential check (see "Login" below)
      api/client.ts    The one place every API call is made from; attaches
                        `Authorization: Bearer <token>` to every request
                        and centralizes 401 handling

docs/
  BUILD_SPEC.md          The full specification — the single source of
                          truth every business rule traces back to
  CURRICULUM_ANALYTICS_BLUEPRINT.md  Demand Forecasting, Curriculum
                          Health Monitor, and Bottleneck & Dependency
                          Analyzer — specified separately from the above
  HANDBOOK_RULES.md      Every rule restated in plain language, cross-
                          referenced to the code that implements it
  DECISION_TREE.md       The course-recommendation and transfer-approval
                          branch logic, as a diagram
  LOGIN_CREDENTIALS.md   The full demo credential roster
  TECHNICAL_OVERVIEW.md  This file
```

## The course catalog: real data, not a toy example

Every course, prerequisite, credit hour, and elective in the system is
transcribed from EJUST's actual Faculty of Engineering student handbook
(`FOE Handbook.pdf` at the repo root) — all 10 real undergraduate programs
(Computer Science, Electronics & Communications, Biomedical & Bioinformatics,
Electrical Power, Mechatronics, Materials Science, Industrial &
Manufacturing, Energy Resources, Environmental, and Chemical & Petrochemical
Engineering), not an invented example catalog. `docs/BUILD_SPEC.md` §18
covers exactly how each department's catalog was built and the handful of
documented simplifications made along the way (e.g. a shared cross-listed
course can only have one "normal semester" in this data model, so it's
pinned to the earliest semester any program uses it in). One dedicated
advisor and a real, varied student roster exist per department.

## Running it locally

```bash
npm install --workspaces

# backend — tests + API server
cd packages/api
npx vitest run                # runs the full backend test suite
npx tsx src/server.ts         # API on http://localhost:3001

# frontend — in a second terminal
cd packages/web
npx vite                      # app on http://localhost:5173, proxies /api to :3001
```

No `node_modules` are committed — `npm install --workspaces` pulls
everything (Express, Vitest, React, Vite, jsPDF, Prisma client, etc.)
across all three workspace packages in one pass, from the repo root.

Once both are running, open `http://localhost:5173/login` and sign in with
any credential from `docs/LOGIN_CREDENTIALS.md`. Login is now real,
server-verified authentication (`POST /api/auth/login`, `docs/
BUILD_SPEC.md` §20) — the server hashes/verifies the password and issues
a real bearer-token session, and every one of the ~83 API routes checks
that token against a per-request access guard instead of trusting a
client-supplied id. Passwords themselves are still the same shared,
publicly-documented demo constants (`docs/LOGIN_CREDENTIALS.md`) — a
deliberate, documented simplification for a demo app, not a hidden gap —
see `.github/SECURITY.md` for the full model.

## Testing

The backend has an extensive Vitest unit-test suite (run in CI on every
push via `.github/workflows/ci.yml`) — the exact current count is in the
"tests" badge at the top of the README, which reflects the live CI status
rather than a number that can go stale here. Tests are organized to mirror
`packages/api/src/modules/`, one test file per module, plus a set of
"wiring" tests (`test/unit/db/*Wiring.test.ts`) that exercise real
mutation paths through the actual in-memory store end to end — not just
each function in isolation — specifically to catch the class of bug where
individual pieces are each correct but don't actually connect the way a
real user's click-through would exercise them.

The frontend doesn't have its own automated test runner; verification
there is `npm run typecheck` plus Playwright-driven screenshot/interaction
checks against the real running app during development (the source of
this README's demo GIFs) — every UI change in this project's history has
been checked by actually clicking through the live app in a real browser
before being considered done, not just by reading the code.

## Deployment

The live demo linked at the top of the README is two separately-deployed
pieces, wired together with CORS:

- **`packages/web`** (the frontend) → **GitHub Pages**, built and deployed
  automatically on every push to `master` by `.github/workflows/pages.yml`.
- **`packages/api`** (the backend) → **Railway**, since GitHub Pages only
  serves static files and can't run a real server process. `railway.json`
  at the repo root configures the build/start commands — because this is
  an npm-workspaces monorepo, the install step has to run from the repo
  root, not from inside `packages/api` alone.

The frontend build is pointed at the live API through a
`VITE_API_BASE_URL` GitHub Actions repository variable — if the Railway
URL ever changes, updating that variable and re-running the Pages workflow
is the only step needed to repoint the live site. `render.yaml` is also
included in the repo as a ready-to-go alternative if you'd rather deploy
the API to Render instead of Railway.

| Piece | Platform | How |
|---|---|---|
| Frontend | GitHub Pages | Auto-built and deployed on every push to `master` (`.github/workflows/pages.yml`) |
| Backend | Railway | Free tier; `railway.json` configures build/start. `render.yaml` is a ready alternative |
| Tests & type-checking | GitHub Actions | `.github/workflows/ci.yml` runs the backend suite plus `shared`/`web` type-checks on every push and pull request |

## Where to go deeper

- **`docs/BUILD_SPEC.md`** — the complete specification. Every business
  rule in the system (grading scales, probation/dismissal thresholds,
  credit caps, the transfer approval chain, venture matching, the real
  10-program course catalog, real backend authentication) traces back to
  a numbered section here.
- **`docs/CURRICULUM_ANALYTICS_BLUEPRINT.md`** — the department/VP-facing
  Demand Forecasting, Curriculum Health Monitor, and Bottleneck &
  Dependency Analyzer features, specified separately from the main spec.
- **`docs/HANDBOOK_RULES.md`** — the same rules, restated in plain
  language with a pointer to the exact file that implements each one.
- **`docs/DECISION_TREE.md`** — the course-recommendation and transfer-
  approval logic laid out as a branching diagram.
- **`.github/SECURITY.md`** — this project's threat model and documented
  limitations (it's a demo-grade auth system, not a production one — this
  is stated plainly, not hidden).
- **`.github/CONTRIBUTING.md`** — coding conventions and how to open a pull
  request.
