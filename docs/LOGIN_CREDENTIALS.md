# Demo login credentials

The login page at `/login` is still a demo gate (client-side only, no real
auth backend or password hashing — same documented simplification as
before) — but it now actually validates an email + password pair instead of
just picking an identity from a list. Every student/professor's email is
**derived directly from their real seeded id** (`{id}@ejust.edu.eg`), not a
second hand-maintained list, so this table can't drift from the real data —
see `packages/web/src/auth/credentials.ts`.

## Vice President

| Email | Password |
|---|---|
| `vice-president@ejust.edu.eg` | `EJUST@2025` |

A single global account overseeing all 5 advisors — per-advisor roster
summaries and drill-down, a flat cross-advisor pending-approvals queue,
per-advisor transfer-request counters, final sign-off on the transfer
pending chain, and its own Venture Board (can post projects, attributed to
"Office of the Vice President").

## Advisors

All 5 advisors share one password: **`Advisor@123`**

| Name | Email | Roster |
|---|---|---|
| Prof. Nabil Fathy | `advisor-nabil@ejust.edu.eg` | 25 students (incl. Ahmed, Sara, Karim) |
| Prof. Mervat Aziz | `advisor-mervat@ejust.edu.eg` | 25 students (incl. Omar, Mona, Youssef) |
| Prof. Tarek Younis | `advisor-tarek@ejust.edu.eg` | 25 students (incl. Laila, Salma, Yara) |
| Prof. Hoda Sami | `advisor-hoda@ejust.edu.eg` | 25 students (incl. Nourhan, Hassan) |
| Prof. Waleed Kassem | `advisor-waleed@ejust.edu.eg` | 25 students (incl. Fatma, Mohamed) |

Each advisor sees only their own 25-student roster (real server-side
scoping — see `?advisorId=` on the `/api/students`/`/api/advisor/report`
routes, not just what the UI happens to show) and owns their own venture
board postings, transfer-request queue, and roster PDF report. 125 students
total across all 5 advisors — see the table below for the 13 named/scripted
personas; the other 112 are deterministically generated filler students
with a realistic spread of standings.

## Students

All students share one password: **`Student@123`**

| Name | Email | Advisor | Notes |
|---|---|---|---|
| Ahmed | `ahmed-1@ejust.edu.eg` | Prof. Nabil Fathy | Good standing, high CGPA |
| Sara | `sara-1@ejust.edu.eg` | Prof. Nabil Fathy | Level 2, §11 Example H |
| Karim | `karim-1@ejust.edu.eg` | Prof. Nabil Fathy | Has an F and a D on record (retake demo) |
| Omar (warning 1/6) | `omar-1@ejust.edu.eg` | Prof. Mervat Aziz | Warning-ladder rung 1 |
| Mona (warning 2/6) | `mona-2@ejust.edu.eg` | Prof. Mervat Aziz | Warning-ladder rung 2 |
| Youssef (warning 3/6) | `youssef-3@ejust.edu.eg` | Prof. Mervat Aziz | Warning-ladder rung 3 — internal transfer tier |
| Laila (warning 4/6) | `laila-4@ejust.edu.eg` | Prof. Tarek Younis | Warning-ladder rung 4 — faculty transfer tier |
| Salma (retake gate — Example B) | `salma-1@ejust.edu.eg` | Prof. Tarek Younis | Retake-gate demo |
| Yara (Level-1 half-load — Example G) | `yara-1@ejust.edu.eg` | Prof. Tarek Younis | Half-load credit cap demo |
| Nourhan (dismissed — Example F) | `nourhan-1@ejust.edu.eg` | Prof. Hoda Sami | Dismissed — locked out of advising/registration |
| Hassan (faculty transfer — Examples I/K) | `hassan-1@ejust.edu.eg` | Prof. Hoda Sami | External/faculty transfer demo |
| Fatma (mandatory-overflow — Example M) | `fatma-1@ejust.edu.eg` | Prof. Waleed Kassem | Mandatory-retake overflow demo |
| Mohamed (venture match — Scenario N) | `mohamed-1@ejust.edu.eg` | Prof. Waleed Kassem | §16 venture-match demo |

The other 112 students (ids like `advisor-nabil-gen-1`) are deterministically
generated filler — same password, no individual login worth listing here.

## Professors (Faculty Console)

All professors share one password: **`Professor@123`**

| Name | Email |
|---|---|
| Dr. Youssef Kamel | `prof-kamel@ejust.edu.eg` |
| Dr. Salma Adel | `prof-adel@ejust.edu.eg` |

The Faculty Console (`/faculty/:id`) is kept as its own separate login path
— the advisor console's own Venture Board is a superset that manages
ventures directly and doesn't require signing in as a specific professor.
