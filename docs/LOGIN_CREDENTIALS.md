# Demo login credentials

The login page at `/login` is still a demo gate (client-side only, no real
auth backend or password hashing — same documented simplification as
before) — but it now actually validates an email + password pair instead of
just picking an identity from a list. Every student/advisor's email is
**derived directly from their real seeded name**
(`firstname.lastname@aegis.edu.eg`), not a second hand-maintained list, so
this table can't drift from the real data — see
`packages/web/src/auth/credentials.ts`. There is no professor login — see
the note at the bottom of this file.

## Vice President

| Email | Password |
|---|---|
| `vice-president@aegis.edu.eg` | `AEGIS@2025` |

A single global account overseeing all 5 advisors — per-advisor roster
summaries and drill-down, a flat cross-advisor pending-approvals queue,
per-advisor transfer-request counters, final sign-off on the transfer
pending chain, and its own Venture Board (can post projects, attributed to
"Office of the Vice President").

## Advisors

All 5 advisors share one password: **`Advisor@123`**

| Name | Email | Roster |
|---|---|---|
| Prof. Nabil Fathy | `nabil.fathy@aegis.edu.eg` | 25 students (incl. Ahmed, Sara, Karim) |
| Prof. Mervat Aziz | `mervat.aziz@aegis.edu.eg` | 25 students (incl. Omar, Mona, Youssef) |
| Prof. Tarek Younis | `tarek.younis@aegis.edu.eg` | 25 students (incl. Laila, Salma, Yara) |
| Prof. Hoda Sami | `hoda.sami@aegis.edu.eg` | 25 students (incl. Nourhan, Hassan) |
| Prof. Waleed Kassem | `waleed.kassem@aegis.edu.eg` | 25 students (incl. Fatma, Mohamed) |

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
| Ahmed Mostafa | `ahmed.mostafa@aegis.edu.eg` | Prof. Nabil Fathy | Good standing, high CGPA |
| Sara Salem | `sara.salem@aegis.edu.eg` | Prof. Nabil Fathy | Level 2, §11 Example H |
| Karim Zaki | `karim.zaki@aegis.edu.eg` | Prof. Nabil Fathy | Has an F and a D on record (retake demo) |
| Omar Fahmy (warning 1/6) | `omar.fahmy@aegis.edu.eg` | Prof. Mervat Aziz | Warning-ladder rung 1 |
| Mona Adel (warning 2/6) | `mona.adel@aegis.edu.eg` | Prof. Mervat Aziz | Warning-ladder rung 2 |
| Youssef Naguib (warning 3/6) | `youssef.naguib@aegis.edu.eg` | Prof. Mervat Aziz | Warning-ladder rung 3 — internal transfer tier |
| Laila Anwar (warning 4/6) | `laila.anwar@aegis.edu.eg` | Prof. Tarek Younis | Warning-ladder rung 4 — faculty transfer tier |
| Salma Ibrahim (retake gate — Example B) | `salma.ibrahim@aegis.edu.eg` | Prof. Tarek Younis | Retake-gate demo |
| Yara Mahmoud (Level-1 half-load — Example G) | `yara.mahmoud@aegis.edu.eg` | Prof. Tarek Younis | Half-load credit cap demo |
| Nourhan Adly (dismissed — Example F) | `nourhan.adly@aegis.edu.eg` | Prof. Hoda Sami | Dismissed — locked out of advising/registration |
| Hassan Reda (faculty transfer — Examples I/K) | `hassan.reda@aegis.edu.eg` | Prof. Hoda Sami | External/faculty transfer demo |
| Fatma Zaher (mandatory-overflow — Example M) | `fatma.zaher@aegis.edu.eg` | Prof. Waleed Kassem | Mandatory-retake overflow demo |
| Mohamed Farag (venture match — Scenario N) | `mohamed.farag@aegis.edu.eg` | Prof. Waleed Kassem | §16 venture-match demo |

The other 112 students (ids like `advisor-nabil-gen-1`) are deterministically
generated with their own realistic first+last name (from a fixed name pool)
and log in the same way — `firstname.lastname@aegis.edu.eg`, same shared
password, no individual listing here.

Every id above (`ahmed-1`, `advisor-nabil`, …) still exists and still works
exactly as before for anything that isn't the login screen itself — API
routes, URLs, seed data — only the *email address* shown at `/login` is now
name-derived instead of id-derived.
