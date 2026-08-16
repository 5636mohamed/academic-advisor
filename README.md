# Academic Advising & Early-Warning System

**Author:** Mohamed Elhariry — Department of Electronics and Communication
Engineering, Egypt-Japan University of Science and Technology (E-JUST)

Implementation of `docs/BUILD_SPEC.md` — the full specification for the
probation/dismissal state machine, retake-gate planning, department/faculty
best-fit engine, internal/external transfer execution, a role-restricted
student portal, best-case grade projection, a dual advisor/student course
approval-and-registration workflow, advisor PDF reporting (§15), and the
Innovation & Venture Catalyst — a research/spin-off matching engine with its
own student, advisor, and Faculty Console surfaces (§16).

## Screenshots

The student portal and advisor console were redesigned to match the
project's E-JUST UI mockups (`UI Design Student/`, `UI Design Professor/`) —
a shared red/white design system, dark mode throughout, and smooth
transitions on every interactive surface. The Faculty Console keeps its
original look (out of scope for this pass).

### Live demo

Recorded straight off the running app (Playwright, headless Chromium) —
login → dashboard → course plan → department quiz → venture board → dark
mode, and the equivalent advisor flow, each real navigation and real data,
not a mockup.

| Student portal | Advisor console |
|---|---|
| ![Student portal walkthrough](docs/media/student-portal-demo.gif) | ![Advisor console walkthrough](docs/media/advisor-console-demo.gif) |

### Static screenshots

**Student portal**

| Dashboard | Dashboard (dark mode) |
|---|---|
| ![Student dashboard](docs/screenshots/student-dashboard-light.png) | ![Student dashboard, dark mode](docs/screenshots/student-dashboard-dark.png) |

| Course Plan | Department Quiz | Venture Board |
|---|---|---|
| ![Course plan roster](docs/screenshots/student-course-plan.png) | ![Department fit quiz wizard](docs/screenshots/student-department-quiz.png) | ![Venture board](docs/screenshots/student-venture-board.png) |

**Advisor console**

| Dashboard | All Students | Venture Board |
|---|---|---|
| ![Advisor dashboard](docs/screenshots/advisor-dashboard.png) | ![All students roster](docs/screenshots/advisor-all-students.png) | ![Advisor venture board](docs/screenshots/advisor-venture-board.png) |

## Status
See `PROGRESS.md` for exactly what is implemented vs. still to be built, and
which spec section each file maps to (read the newest "SESSION N NOTE" at
the top first). As of session 9, on top of sessions 6–8's core (grading,
prediction, probation/dismissal, retake gate, department/faculty fit,
transfer execution, the full advisor/student frontend, best-case grading,
the proposal/approval workflow, and real advisor/student/professor access
separation):

- **§16 Innovation & Venture Catalyst** — a `ventureFitScore` weighted-sum
  engine (course competency / skill alignment / academic trajectory)
  matches students to professors' research projects and commercial
  spin-offs. The Venture Gate + Interest Form live entirely on the
  student's **Venture Board** tab (never inside "Advise Me" — answering
  them has zero effect on course recommendation); a qualifying match also
  shows as a gold card on the Plan Results screen (both the student's and
  the advisor's), purely additively. The Venture Board shows which
  professor hosts each project and lets the student attach a PDF CV while
  expressing interest in **any** listed project, not only ones that
  cleared the match-score threshold. Professors get their own **Faculty
  Console** (`/faculty/:professorId`) to post projects and review a
  ranked, auto-generated candidate list — each row's CV opens in an
  inline, in-page viewer, never a download. Every Level 3+, non-dismissed
  demo student — Mohamed included — comes with a pre-seeded Venture Gate
  opt-in, so the whole eligible cohort shows up ranked from a cold boot;
  Level 1–2 students never see the gate at all (real eligibility rule) and
  a dismissed student is 403'd from venture matching same as every other
  self-service route.
- **Night mode** — a systemwide light/dark theme (§9.4), not just one
  page: every color in the app is a CSS custom property with a dark
  counterpart, toggled from a button in every masthead (and the login
  page). Defaults to the OS's `prefers-color-scheme`, remembers an
  explicit choice across visits.
- **Three-way access separation** — advisor, student, and (as of this
  session) professor are enforced-separate parties: a demo login at
  `/login` picks one identity, and route guards bounce any session away
  from another party's pages, not just hide the links to them.
- **Student portal** (`/portal/:studentId`) — the student's own restricted
  view of the same engine: letters only, never a raw percentage, per §15.1.
- **Best-case grade projection** (§15.2) — alongside every course's
  realistic expected grade, a "if you performed like your best semester"
  optimistic grade and its real CGPA impact, shown in both the advisor and
  student views.
- **Course proposal / dual-approval workflow** (§15.3) — the advisor
  reviews the system's recommended courses, can approve them or swap in an
  alternate (scored live by the same prediction engine); the student sees
  both options and picks one — picking the advisor-approved option
  registers it immediately, picking the other prompts a "contact your
  advisor" popup instead.
- **Advisor PDF report** (§15.4) — one click in the Advisor Console exports
  a roster PDF with each student's pending / advisor-approved / registered
  course counts.

See `PROGRESS.md`'s newest session note for exact test counts and what's
still a documented simplification (no real login backend, in-memory
store, etc.).

## Structure
```
packages/
  shared/   → types + grading tables shared by api & web
  api/      → Node/TS backend: grading, prediction, probation, retake-gate,
              fit-engine, transfer-execution, proposal, and venture-matching
              modules + the full HTTP API (src/server.ts) over an
              in-memory data layer
  web/      → React/TS frontend — Vite + React Router. Three route trees:
              the advisor app, the student portal (/portal/:id), and the
              Faculty Console (/faculty/:id), each behind its own auth guard
docs/
  BUILD_SPEC.md      → full specification (the single source of truth)
  HANDBOOK_RULES.md  → every business rule restated in plain language, cross-referenced to code
  DECISION_TREE.md   → the advising-cycle branch logic as a diagram
```

## Getting started
```bash
npm install --workspaces

# backend — tests + API server
cd packages/api
npx vitest run                # 179 tests
npx tsx src/server.ts         # API on http://localhost:3001

# frontend — in a second terminal
cd packages/web
npx vite                      # app on http://localhost:5173, proxies /api to :3001
```

Open `http://localhost:5173/login` and sign in with a real email + password
(still a demo gate — client-side only, no server-side session) — the
Advisor, a student, or a professor. The full credential roster (every
student/professor email is derived straight from their real seeded id) is
in `docs/LOGIN_CREDENTIALS.md`. The demo roster includes personas for
every worked example in spec §11 (a good-standing student, a mid-probation
warning-ladder student, a mandatory-retake-overflow case, a dismissed
student, a faculty-transfer candidate, **Mohamed for the §16 venture-match
scenario**, etc.) so every branch of the system is reachable through the
UI, not just through unit tests.

No `node_modules` are committed. `npm install --workspaces` installs
everything (Express, Vitest, React, Vite, jsPDF, Prisma client, etc.)
across all three workspace packages.

## Author

**Mohamed Elhariry**
Department of Electronics and Communication Engineering
Egypt-Japan University of Science and Technology (E-JUST)

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](.github/CONTRIBUTING.md)
for local setup, coding conventions, and how to submit a pull request. This
project follows a [Code of Conduct](.github/CODE_OF_CONDUCT.md).

## Security

See [SECURITY.md](.github/SECURITY.md) for the project's supported version,
known limitations, and how to privately report a vulnerability.

## License

Licensed under the [Apache License, Version 2.0](LICENSE).
