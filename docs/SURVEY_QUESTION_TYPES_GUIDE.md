# Survey Question Types Guide

This guide explains the survey controls available in SifyForms, when to use each one, how answers are stored, and how the report should be interpreted. A complete importable survey is available in [`SURVEY_MVP_IMPORT_EXAMPLE.json`](./SURVEY_MVP_IMPORT_EXAMPLE.json).

## Quick reference

| Question | Best use | Answer shape | Primary report |
|---|---|---|---|
| NPS | Loyalty and recommendation intent | Integer `0–10` | NPS score, promoters, passives, detractors |
| CSAT | Satisfaction with a specific interaction | Integer, normally `1–5` | Mean and satisfied/top-box percentage |
| CES | How easy or difficult a task was | Integer, normally `1–7` | Mean effort score |
| Likert matrix | Agreement with several related statements | Object keyed by statement ID | Mean for every statement |
| Ranking | Relative priority between options | Ordered array of option IDs | Average rank by option |
| Rating | Lightweight visual sentiment | Integer `1–5` | Distribution and average |
| Choice | Segmentation and categorical feedback | Option ID or array of IDs | Count and percentage by option |
| Text | Reasons, context, and open feedback | String | Answer rate; raw text remains in authorized response views/exports |

## NPS — Net Promoter Score

NPS asks how likely someone is to recommend a product, service, or organization.

**Clean example**

> How likely are you to recommend us to a colleague or friend?
>
> `0 — Not at all likely` … `10 — Extremely likely`

Respondents are grouped as:

- **Promoters:** 9–10
- **Passives:** 7–8
- **Detractors:** 0–6

The server calculates:

```text
NPS = (% promoters) - (% detractors)
```

NPS ranges from `-100` to `100`. It is not an average of the selected scores. Compare NPS over time or between equivalent respondent groups; do not treat it as a complete explanation of customer sentiment.

Recommended conditional follow-ups:

- Score 0–6: “What is the most important thing we should improve?”
- Score 9–10: “What is the best part of the experience?”

## CSAT — Customer Satisfaction

CSAT measures satisfaction with a defined interaction or outcome.

**Clean example**

> Overall, how satisfied are you with your support experience?
>
> `1 — Very dissatisfied` … `5 — Very satisfied`

Use a precise reference such as “this purchase,” “today’s support interaction,” or “the onboarding process.” The report displays the mean and the percentage in the satisfied/top boxes. For a five-point scale, scores 4 and 5 count as satisfied.

Avoid asking a broad satisfaction question when the respondent has not completed the interaction being measured.

## CES — Customer Effort Score

CES measures how easy it was to complete a goal.

**Clean example**

> The product made it easy to complete my goal.
>
> `1 — Strongly disagree` … `7 — Strongly agree`

Keep the direction consistent: a higher score in the example means lower effort and a better result. Do not alternate between “easy” and “difficult” wording in the same survey because that makes reports easy to misread.

A useful branch is:

1. Ask whether the task was completed.
2. If yes or partly, show CES.
3. If no, ask what blocked completion.

## Likert and Likert matrices

A Likert item asks a respondent to select a position on an ordered agreement scale. A Likert matrix places multiple related statements on the same scale.

**Clean example**

| Statement | 1 | 2 | 3 | 4 | 5 |
|---|---:|---:|---:|---:|---:|
| The product was easy to learn | ○ | ○ | ○ | ○ | ○ |
| The product worked reliably | ○ | ○ | ○ | ○ | ○ |
| The information was clear | ○ | ○ | ○ | ○ | ○ |

Labels:

- `1 — Strongly disagree`
- `3 — Neither agree nor disagree`
- `5 — Strongly agree`

Each row is an independent answer. SifyForms stores a matrix as an object:

```json
{
  "easy_to_learn": 4,
  "reliable": 5,
  "clear": 3
}
```

The server validates every row ID and score against the published survey definition. Required matrices must have an answer for every configured statement. Reports calculate a separate mean for each row.

Good matrix design:

- Keep statements short and focused on one idea.
- Use the same scale and direction for every row.
- Prefer four to seven rows; split very large matrices across pages.
- Do not combine two claims, such as “fast and reliable,” in one statement.
- On small screens, the matrix scrolls horizontally while retaining 44-pixel selection controls.

## Ranking

Ranking asks respondents to put options in relative order.

**Clean example**

> Rank the improvements that matter most, with the most important first.
>
> 1. Faster performance
> 2. Simpler navigation
> 3. Better reporting
> 4. More integrations

The answer is stored as an ordered list of stable option IDs:

```json
["performance", "navigation", "reporting", "integrations"]
```

Reports calculate the average position of each option. A lower average rank means a higher priority. SifyForms provides keyboard- and touch-accessible move-up/move-down buttons. Choice order can be randomized once per response and remains stable as the respondent moves between pages.

Use ranking only when relative priority matters. Use checkboxes instead when respondents merely need to select every applicable item.

## Rating, choice, and text questions

### Rating

A one-to-five-star rating is suitable for a quick, familiar sentiment signal. Prefer CSAT when a standardized satisfaction report is required.

### Choice

Radio buttons select one option. Checkboxes and multi-select controls select multiple options. Store stable, analysis-friendly values such as `current_customer`, not values that change when display wording is edited.

### Text

Text questions explain why a score was chosen and can drive real-time conditional follow-ups. For example, a follow-up can appear while the respondent types the word `support` or `slow`.

Do not make every comment field required. A soft-required prompt is useful when an explanation is valuable but respondents must remain able to continue.

## Conditional, real-time survey paths

Conditions are evaluated against current answers. Hidden answers are also discarded by server validation, preventing a modified client from submitting answers to a branch the respondent should not see.

Example based on a numeric score:

```json
"showWhen": {
  "id": "show_detractor_reason",
  "logic": "and",
  "conditions": [
    { "id": "low_nps", "fieldId": "nps", "operator": "lte", "value": 6 }
  ]
}
```

Example based on text typed by the respondent:

```json
"showWhen": {
  "id": "show_support_followup",
  "logic": "and",
  "conditions": [
    { "id": "mentions_support", "fieldId": "experience_text", "operator": "contains", "value": "support" }
  ]
}
```

Conditions should improve relevance, not pressure respondents toward a particular answer. Remember that text `contains` matching uses the configured text value; use simple, expected keywords.

## Survey identity modes

- **Strict anonymous:** safe default. No direct identity fields, uploads, authentication, payments, raw IP, or user-agent storage.
- **Pseudonymous:** responses can use an explicit pseudonymous mechanism without claiming strict anonymity.
- **Identified:** use when the survey intentionally needs respondent identity.

Incomplete survey sessions are saved separately from completed submissions. Strict-anonymous partial sessions use an opaque browser token that is hashed by the server and is not treated as identity.

## Importing the complete example

1. Open **Create new form**.
2. Choose **Import JSON**.
3. Copy the entire content of `docs/SURVEY_MVP_IMPORT_EXAMPLE.json` into the JSON input.
4. Import and review each page, condition, anonymity setting, and required field.
5. Preview the survey and test at least the low-NPS, high-NPS, task-failed, `support`, and `slow` branches before publishing.

The example intentionally uses strict-anonymous mode and therefore contains no email, phone, signature, file upload, authentication, or payment collection.

## Installing the example as a reusable template

The complete idempotent MySQL command is in [`SURVEY_MVP_TEMPLATE_INSERT.sql`](./SURVEY_MVP_TEMPLATE_INSERT.sql). It installs the example as a global static template named **Adaptive Customer Experience Survey**. The fixed ID and `ON DUPLICATE KEY UPDATE` clause make the command safe to rerun without creating duplicates.

Run it after selecting the SifyForms database:

```bash
mysql -h "$DB_HOST" -u "$DB_USER" -p "$DB_NAME" < docs/SURVEY_MVP_TEMPLATE_INSERT.sql
```

Verify the registration:

```sql
SELECT id, name, category, isStatic, orgId
FROM Template
WHERE id = 'survey-customer-experience-mvp-v1';
```

For an organization-only template, do not use the global SQL unchanged. Set `isStatic` to `FALSE`, provide the target `orgId`, and provide a valid `createdBy` user ID according to that organization's template policy.
