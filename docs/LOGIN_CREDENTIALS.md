# Demo login credentials

The login page at `/login` is still a demo gate (client-side only, no real
auth backend or password hashing — same documented simplification as
before) — but it now actually validates an email + password pair instead of
just picking an identity from a list. Every student/professor's email is
**derived directly from their real seeded id** (`{id}@ejust.edu.eg`), not a
second hand-maintained list, so this table can't drift from the real data —
see `packages/web/src/auth/credentials.ts`.

## Advisor

| Email | Password |
|---|---|
| `advisor@ejust.edu.eg` | `admin` |

There is a single shared advisor account — it sees every student and owns
the venture board directly.

## Students

All students share one password: **`Student@123`**

| Name | Email | Notes |
|---|---|---|
| Ahmed | `ahmed-1@ejust.edu.eg` | Good standing, high CGPA |
| Sara | `sara-1@ejust.edu.eg` | Level 2, §11 Example H |
| Karim | `karim-1@ejust.edu.eg` | Has an F and a D on record (retake demo) |
| Omar (warning 1/6) | `omar-1@ejust.edu.eg` | Warning-ladder rung 1 |
| Mona (warning 2/6) | `mona-2@ejust.edu.eg` | Warning-ladder rung 2 |
| Youssef (warning 3/6) | `youssef-3@ejust.edu.eg` | Warning-ladder rung 3 — internal transfer tier |
| Laila (warning 4/6) | `laila-4@ejust.edu.eg` | Warning-ladder rung 4 — faculty transfer tier |
| Salma (retake gate — Example B) | `salma-1@ejust.edu.eg` | Retake-gate demo |
| Yara (Level-1 half-load — Example G) | `yara-1@ejust.edu.eg` | Half-load credit cap demo |
| Nourhan (dismissed — Example F) | `nourhan-1@ejust.edu.eg` | Dismissed — locked out of advising/registration |
| Hassan (faculty transfer — Examples I/K) | `hassan-1@ejust.edu.eg` | External/faculty transfer demo |
| Fatma (mandatory-overflow — Example M) | `fatma-1@ejust.edu.eg` | Mandatory-retake overflow demo |
| Mohamed (venture match — Scenario N) | `mohamed-1@ejust.edu.eg` | §16 venture-match demo |

## Professors (Faculty Console)

All professors share one password: **`Professor@123`**

| Name | Email |
|---|---|
| Dr. Youssef Kamel | `prof-kamel@ejust.edu.eg` |
| Dr. Salma Adel | `prof-adel@ejust.edu.eg` |

The Faculty Console (`/faculty/:id`) is kept as its own separate login path
— the advisor console's own Venture Board is a superset that manages
ventures directly and doesn't require signing in as a specific professor.
