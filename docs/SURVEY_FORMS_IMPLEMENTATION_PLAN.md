# Sify Forms — Survey Forms Implementation Plan

**Status:** Proposed  
**Priority:** Product roadmap  
**Last updated:** 2 September 2026

## 1. Outcome

Add a first-class **Survey** form type without creating a second form builder. Survey authors should reuse the current fields, validation, conditional visibility, smart connections, themes, preview, DMS, authentication, teams, submissions, and public renderer, while gaining survey-specific questions, collection controls, and analysis.

A successful release lets an author:

1. choose **Survey** when creating a form;
2. build strong qualitative and quantitative questionnaires;
3. preview exactly what respondents will submit;
4. collect anonymous or identified responses safely;
5. monitor response quality and completion;
6. filter, cross-tabulate, visualize, and export results;
7. share a report without exposing raw personal data.

## 2. Product principles

- **One schema and renderer:** survey is a mode of Sify Forms, not a separate application.
- **Submit/preview parity:** builder preview and public form use shared field components and the same rules engine.
- **Mobile first and accessible:** keyboard operation, screen-reader names, visible focus, sufficient contrast, and touch targets are release gates.
- **Privacy by design:** anonymous means no identity linkage in application data; report sharing defaults to aggregate data.
- **Progressive complexity:** common surveys take minutes; advanced logic and research controls remain optional.
- **Immutable interpretation:** published versions preserve question wording, option IDs, and scale definitions so historical reports do not change meaning.

## 3. Survey capability map

### 3.1 Launch-essential question types

| Type | Author controls | Stored answer | Core report |
|---|---|---|---|
| Single choice | randomized choices, other/none, display as radio/dropdown/cards | option ID | count, %, trend |
| Multiple choice | min/max selections, exclusive choice, randomized choices | option IDs | count and % of respondents |
| Short/long text | length, pattern, optional sentiment/topic processing | string | response list, topics, word frequency |
| Rating | 3–10 points, icons/numbers/stars, labels | number | distribution, mean, median |
| Likert matrix | statements, scale points, N/A, required per row | row ID → option ID | stacked distribution, mean by row |
| NPS | 0–10, endpoint labels, optional follow-up | integer | NPS, promoter/passive/detractor split |
| CES/CSAT | configurable scale and labels | number | score and distribution |
| Ranking | drag/keyboard ranking, rank all or top N | ordered option IDs | average rank, rank distribution |
| Yes/No | custom labels | boolean/option ID | split |
| Date/number | current validation controls | date/number | summary and histogram |

### 3.2 Follow-up capabilities

- Constant-sum allocation with a configurable total.
- Matrix multiple choice.
- Semantic differential (bipolar labels).
- Image choice with accessible alternative text.
- Slider with ticks and value labels.
- MaxDiff/conjoint experiments only after a dedicated research design review; these should not be approximated with ordinary choice fields.

### 3.3 Questionnaire behavior

- Survey pages/sections and progress indicator.
- Skip/display logic using the existing conditional visibility AST.
- Page branching and early termination outcomes (qualified, screened out, quota full).
- Answer piping into later labels/descriptions, with escaping and a missing-value fallback.
- Choice carry-forward from a previous question.
- Choice and question randomization; pin “Other” and “None” positions.
- Required answers, soft-required prompts, and “Prefer not to answer”.
- Question numbering independent of schema order.
- Intro, consent, privacy, and completion blocks.
- Save and resume where authentication/policy permits.

## 4. Creation and authoring UX

### 4.1 Entry point

Extend Create Form with a type selector:

- Standard form
- Survey
- Assessment
- Voting
- Registration/Application (existing modes as applicable)

Choosing Survey sets `settings.formType = "survey"`, opens a survey starter gallery, and keeps the same builder route. Suggested templates: customer satisfaction, employee pulse, event feedback, product research, onboarding feedback, and NPS.

### 4.2 Survey builder additions

Add a **Survey questions** group to the field palette. Inspector accordions:

1. Question and help text
2. Answer scale/options
3. Validation
4. Display and randomization
5. Conditional visibility/branching
6. Scoring/metric mapping (NPS, CSAT, CES)
7. Reporting metadata (analysis label, tags)

Use the same inspector action-button style and standard modal shell as other fields.

### 4.3 Survey settings

Add a Survey tab in form settings:

- response identity: anonymous, pseudonymous, authenticated;
- one response policy and permitted update window;
- open/close dates and response cap;
- progress display and question numbering;
- randomization seed strategy;
- incomplete response policy;
- consent requirement;
- language and locale;
- report visibility;
- quality flags;
- quotas.

Show a publication readiness checklist: missing scale labels, unreachable pages, logic loops, required question without a non-response option, identity/privacy conflict, broken piping reference, and inaccessible image choice.

## 5. Data model

### 5.1 Extend form field schema

Prefer a discriminated `surveyConfig` attached to `FormField` so ordinary field behavior remains compatible:

```ts
type SurveyQuestionKind =
  | 'rating' | 'likert' | 'nps' | 'csat' | 'ces'
  | 'ranking' | 'semantic-differential' | 'constant-sum';

interface SurveyConfig {
  kind: SurveyQuestionKind;
  analysisLabel?: string;
  metricKey?: string;
  scale?: {
    min: number;
    max: number;
    minLabel?: string;
    midpointLabel?: string;
    maxLabel?: string;
    notApplicable?: boolean;
  };
  rows?: Array<{ id: string; label: string }>;
  randomize?: { enabled: boolean; pinOptionIds?: string[] };
  ranking?: { maxRanked?: number; requireAll?: boolean };
  softRequired?: boolean;
}
```

Option and row IDs must be stable UUIDs. Labels may change only in a new published version. Validate field-specific bounds in both frontend and backend Zod schemas.

### 5.2 Survey-level settings

```ts
interface SurveySettings {
  identityMode: 'anonymous' | 'pseudonymous' | 'identified';
  oneResponse: 'off' | 'cookie' | 'token' | 'account';
  showProgress: boolean;
  numberQuestions: boolean;
  partialResponsePolicy: 'exclude' | 'include' | 'separate';
  responseCap?: number;
  quotas?: SurveyQuota[];
  qualityRules?: SurveyQualityRules;
}
```

Do not claim anonymity if authenticated identity, payment, email notification, or identity-bearing query parameters are enabled. The UI must block or explicitly resolve conflicting settings.

### 5.3 Submission additions

Add indexed metadata instead of recomputing it from answer JSON:

- `formVersionId`
- `responseStatus`: in_progress, complete, screened_out, quota_full
- `startedAt`, `submittedAt`, `durationMs`
- `respondentKeyHash` (nullable; salted and form-scoped)
- `language`, `channel`, `sourceTag`
- `qualityFlags` JSON
- `surveyMetricSnapshot` JSON

Do not store raw IP/user agent for anonymous surveys unless a documented security retention policy requires it. If abuse prevention needs a fingerprint, use a short-lived, form-scoped keyed hash.

### 5.4 Versioning

Introduce a publish snapshot (`FormVersion`) containing immutable schema/settings. Every submission references one version. Reports can combine compatible versions only when stable question/option IDs and scale semantics match; otherwise show a version split.

## 6. Runtime and parity architecture

1. Extract shared `SurveyFieldControl` components used by FormPreview and PublicFormPage.
2. Keep answer normalization in a shared library (`surveyAnswers.ts`).
3. Execute randomization from a stable per-response seed; preview gets a fixed documented seed.
4. Extend the rule engine for page destinations and termination outcomes; detect loops before publish and enforce a server-side step limit.
5. Validate submissions against the published version server-side. Never trust hidden fields, branch state, scores, or client-calculated metrics.
6. Record only answers for questions reached by the respondent unless a deliberate retain-hidden-answer setting exists.

Parity tests should render each survey field in preview and public contexts from the same fixture, perform the same interactions, and compare normalized answers and validation messages.

## 7. Reporting experience

### 7.1 Survey overview

A new **Survey report** tab should show:

- total starts, complete responses, partials, completion rate;
- median completion time;
- responses over time;
- device/language/channel breakdown where policy allows;
- NPS/CSAT/CES headline cards;
- screened-out and quota-full counts;
- quality-flag count.

### 7.2 Question cards

Each question gets an appropriate visualization and a data table:

- choice: horizontal bars with count and percentage;
- rating/NPS: distribution plus mean/median and NPS segments;
- Likert: diverging or 100% stacked bars;
- ranking: average rank plus rank-position heatmap;
- text: searchable verbatim list; optional topics/sentiment clearly labelled as automated;
- numeric: histogram and summary statistics.

Percentages must state their denominator (all responses, answered question, or selected responses). Multiple-choice percentages may exceed 100%; explain this in the UI.

### 7.3 Filters and cross-tabs

- Date, completion status, form version, language, channel/source, answer, and quality flag.
- Save named filter views.
- Compare up to four segments.
- Cross-tab two categorical variables with counts, row %, column %, and base size.
- Suppress small cells using an organization-configurable privacy threshold.
- Weighting and significance tests are a later expert feature and must disclose method and base.

### 7.4 Report sharing and export

- CSV: one row per response and optional normalized long format.
- XLSX: overview, codebook, responses, and question summaries.
- PDF/print: branded summary.
- PNG/SVG chart export.
- Share links with expiry, password, revocation, allowed filters, and aggregate-only default.
- Public reports never expose hidden IDs, DMS links, auth claims, free text, or small segments unless explicitly authorized.

## 8. Metrics and calculation rules

- **NPS:** `% promoters (9–10) - % detractors (0–6)`; passives are 7–8. Display base and rounding rule.
- **CSAT:** configurable “satisfied” threshold; display both favorable percentage and distribution.
- **CES/rating:** preserve scale direction. Reversing a scale creates a new metric definition/version.
- Missing, skipped, N/A, and not-reached are separate states, not zero.
- Metric snapshots are calculated server-side on submission, while aggregate jobs can rebuild from canonical answers.

Create a `surveyAnalytics.service` with pure aggregation functions and database adapters. For low volume, calculate on request with caching. At scale, maintain incremental aggregate tables/jobs keyed by form version, question, option, date bucket, and permitted segment dimensions.

## 9. Quotas and response quality

### Quotas

Support total and answer-based quotas. Reserve quota capacity atomically when the qualifying answer is confirmed; release abandoned reservations after a timeout. Define whether edits can move respondents between quota cells. Provide quota-full termination messaging.

### Quality flags

Configurable, non-destructive flags:

- implausibly fast completion;
- straight-lining in matrices;
- duplicate respondent key;
- failed attention check;
- excessive missing answers;
- inconsistent trap/validation response.

Never silently delete a response. Reports default to all completed responses and let analysts exclude flagged responses with a visible filter.

## 10. API outline

- `POST /api/forms/:id/publish` creates version and runs readiness validation.
- `POST /api/public/forms/:id/survey-session` creates a response seed/session and checks capacity.
- Existing submission endpoint accepts version/session identifiers and validates canonical answers.
- `GET /api/forms/:id/survey-report` returns aggregate overview with filters.
- `GET /api/forms/:id/survey-report/questions/:questionId` returns question aggregation.
- `POST /api/forms/:id/survey-report/crosstab` returns privacy-checked cross-tab.
- `POST /api/forms/:id/report-shares` and revoke/list endpoints.
- Export endpoints create auditable asynchronous jobs for large datasets.

All report routes require explicit permissions (`survey.report.view`, `survey.responses.view`, `survey.report.share`, `survey.export`). Apply organization and team scope in the service/DAO layer, not only controllers.

## 11. Delivery plan

### Phase 0 — Foundation (1 sprint)

- Product definitions, UX prototypes, privacy review.
- Publish-version model and migrations.
- Shared preview/public survey renderer contract.
- Analytics event and metric specifications.

**Exit:** approved schema, clickable author/respond/report flow, migration rollback tested.

### Phase 1 — Survey MVP (2–3 sprints)

- Survey creation mode/templates.
- Rating, Likert, NPS, ranking, upgraded choice/text.
- Progress, numbering, required/soft-required, randomization.
- Anonymous/identified policy and one-response token mode.
- Basic overview/question reports and CSV export.

**Exit:** accessibility audit, parity suite, server validation, anonymous-data test, load test.

### Phase 2 — Logic and analysis (2 sprints)

- Page branching, termination, piping, carry-forward.
- Filters, saved views, cross-tabs, report links.
- XLSX/PDF exports.
- Quality flags and partial-response controls.

### Phase 3 — Research operations (2 sprints)

- Quotas and atomic reservations.
- Multi-language authoring/responding/report splits.
- Scheduled reports and webhook events.
- Aggregate job/caching path for large forms.

### Phase 4 — Advanced research (separate discovery)

- Weighting, significance testing, longitudinal linking, MaxDiff/conjoint.
- AI-assisted themes/summaries with opt-in governance, citations to source responses, PII controls, and clear uncertainty labels.

## 12. Testing and release gates

- Unit: answer normalization, randomization stability, NPS/CSAT, missing values, branch graph, quota allocation.
- Contract: frontend/backend Zod parity and old standard-form compatibility.
- Integration: create → publish → respond → aggregate → export.
- Visual: every question at mobile/tablet/desktop and all themes.
- Accessibility: WCAG 2.2 AA automated checks plus keyboard/screen-reader manual runs, including ranking and matrices.
- Security: authorization/tenant isolation, anonymous leakage, CSV formula injection, report-link enumeration, rate limiting.
- Performance targets: public form LCP < 2.5 s at p75; ordinary answer interaction < 100 ms; cached report < 2 s; async export for large data.
- Migration: existing forms require no changes and retain identical rendering/processing.

Roll out behind `survey_forms_v1` by organization, then internal Sify surveys, design partners, 10%, 50%, and general availability. Monitor submission errors, abandon rate by question, report latency, quota conflicts, and export failures. Keep a kill switch that disables new survey creation without making published surveys unavailable.

## 13. Decisions required before implementation

1. Exact legal meaning and retention behavior of anonymous mode.
2. Whether incomplete responses are saved by default.
3. First-release identity and one-response mechanisms.
4. Minimum-cell privacy threshold for shared reports.
5. Required export formats and maximum synchronous dataset.
6. Multi-language timing (MVP or Phase 3).
7. Whether AI text analysis is permitted for all tenants or separately contracted.
8. Data warehouse/BI integration expectations.

## 14. Recommended first vertical slice

Implement one end-to-end slice before adding all question types:

**Create Survey → NPS question + optional text follow-up → publish version → public response → server-calculated NPS → overview/report card → CSV export.**

This proves form typing, schema versioning, shared preview/public rendering, branching, canonical answer storage, analytics, permissions, and export. Likert, ranking, quotas, and advanced reporting can then build on a validated architecture rather than parallel one-off implementations.
