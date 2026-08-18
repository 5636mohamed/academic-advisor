# Decision Tree — the §4.2 / §8 advising flow

This is the `runAdvisingCycle` flow (spec §8's end-to-end orchestration,
§4.2's branch decision, and `AMENDMENT 1`'s warning-ladder override) drawn
as a diagram. Kept in sync with
[`advisingCycle.service.ts`](../packages/api/src/modules/advising/advisingCycle.service.ts)
— if you change the branch logic there, update this diagram in the same
commit.

## End-to-end orchestration (one "Advise Me" run)

```mermaid
flowchart TD
    A[Load student + transcript] --> B{status == dismissed?}
    B -- yes --> B1[403 / dismissal notice. STOP.]
    B -- no --> C[Ask retake gate: §5]
    C --> D[buildCandidatePool: pool + mandatory F-retakes]
    D --> E[packPlan: mode = cgpa < 2.00 ? probation_repair : fast]
    E --> F[projectPlanCGPA -> projectedCGPA]
    F --> G[projectCGPATrend over real CgpaSnapshots -> trendSlope]
    G --> H[fetch warning counter]
    H --> I{Branch decision, see below}
    I --> J[Render plan + optional transfer recommendation card]
    J --> K{Student requests a transfer?}
    K -- yes --> L["Create pending TransferRequest\n(§17.4 chain — see below, NOT executed yet)"]
    K -- no --> N[Done — plan stands as shown]
```

Note: a transfer used to execute the moment the student clicked confirm
(`L[Execute transfer: §7]` directly). It now only ever creates a pending
request — see "The transfer pending chain" below for what actually runs
`recomputeAdvisingProfile`/§7's execution.

## The branch decision (`decideAdvisingAction`)

`AMENDMENT 1` (the warning-ladder rule) takes precedence the moment the
student's counter is ≥ 1. Only a student at warning 0/6 falls through to the
original trend-based tiering.

```mermaid
flowchart TD
    Start{warningCount} 
    Start -- "== 0" --> Trend{Trend-based tiering}
    Start -- "1 or 2" --> ShowNormal[SHOW_PLAN\nexplain: probation_warning_1_or_2_normal_recommendation]
    Start -- "== 3" --> Guard3{already used one\ninternal transfer?}
    Guard3 -- no --> Internal3[RECOMMEND_INTERNAL_TRANSFER\nexplain: probation_warning_3_internal_transfer_recommended]
    Guard3 -- yes --> Faculty3[RECOMMEND_FACULTY_TRANSFER\nexplain: ..._escalating_to_faculty]
    Start -- "4 or 5" --> Faculty45[RECOMMEND_FACULTY_TRANSFER\nexplain: probation_warning_4_plus_faculty_transfer_recommended]
    Start -- ">= 6" --> Dismissed[out of scope — dismissal already fired in onSemesterClose]

    Trend --> T1{projectedCGPA > cgpa + 0.01\nAND trend != declining?}
    T1 -- yes --> ShowPlan[SHOW_PLAN\nexplain: plan_projected_to_raise_cgpa]
    T1 -- no --> T2{best in-faculty dept exists,\ncgpa >= 2.00,\nsimulated trend improves,\nnot already transferred internally?}
    T2 -- yes --> Internal[RECOMMEND_INTERNAL_TRANSFER\nexplain: flat_or_declining_trend_but_better_fit_department_available_in_faculty]
    T2 -- no --> T3{cgpa < 2.00?}
    T3 -- yes --> FacultyLow[RECOMMEND_FACULTY_TRANSFER\nexplain: cgpa_remains_below_2_after_projection]
    T3 -- no --> FacultyNoAlt[RECOMMEND_FACULTY_TRANSFER\nexplain: no_departmental_alternative_improves_trend]
```

## The transfer pending chain (§17.4)

Once §4.2/§8 recommends a transfer and the student clicks "Request
transfer" (the `L` node above), §7's actual execution
(`executeInternalTransferForStudent`/`executeExternalTransferForStudent`,
unchanged) only ever runs at the very end of this 3-stage chain — never
directly from the student's click:

```mermaid
flowchart TD
    S[Student clicks Request transfer] --> P1["TransferRequest\nstatus: pending_advisor"]
    P1 --> AD{Student's advisor decides}
    AD -- approve --> P2["status: pending_vp\n(still not executed)"]
    AD -- decline --> AEnd["status: advisor_declined\nChain ends — nothing changes"]
    P2 --> VP{Vice President decides}
    VP -- approve --> Exec["Execute transfer: §7\n(same executeInternal/ExternalTransferForStudent\nas the old immediate-execute path)"] --> Done["status: approved"]
    VP -- decline --> VEnd["status: vp_declined\nChain ends — nothing changes"]
```

The request is visible to the student, the advisor, and the Vice
President at every stage (not just once it reaches the final one), and
the Vice President's dashboard counts per-advisor how many requests are
still `pending_advisor` or `pending_vp` ("in flight"), split internal vs.
external.

## Reading this against the code

Every leaf in the second diagram corresponds to one `return` statement in
`decideAdvisingAction` (`advisingCycle.service.ts`), and the `explain`
string shown is exactly what the API returns — the frontend's
`TransferExplanationCard` translates each one into a plain-language
sentence (`packages/web/src/components/TransferExplanationCard.tsx`). If a
new explain string is ever added to the service, add its sentence there too
and update this diagram.

## Worked examples

Every branch above is exercised by a named example in `BUILD_SPEC.md` §11
and a corresponding demo persona in
[`inMemoryDb.ts`](../packages/api/src/db/memory/inMemoryDb.ts):

| Example | Persona | Branch reached |
|---|---|---|
| A | Ahmed | `SHOW_PLAN` (tier 1, trend-based) |
| B | Salma | retake-gate YES, chain-unlock-prioritized retake |
| C | Karim | retake-gate NO + mandatory F-retake |
| D | Omar | first sub-2.00 semester, warning 1/6 |
| E | (unit-tested directly) | mid-window counter recovery |
| F | Nourhan | dismissal at warning 6/6 |
| G | Yara | Level-1 half-load, first semester unarmed |
| H | Sara | `RECOMMEND_INTERNAL_TRANSFER` (trend-based tier 2) |
| I / K | Hassan | `RECOMMEND_FACULTY_TRANSFER` → external transfer execution |
| J | Sara (continued) | §4.2.1 anti-loop guard |
| L | (post-Hassan-transfer) | insufficient trend history → safe `SHOW_PLAN` |
| M | Fatma | mandatory-retake credit overflow |
| warning ladder 1–4 | Omar / Mona / Youssef / Laila | `AMENDMENT 1` tiers |
