# Assessment analytics

_Last verified: 28 August 2026_

## Database impact

No new table, column, or SQL migration is required for the enhanced Assessment Analytics page.

The backend derives the new metrics from data already stored in:

- `ProcessingResult.result` — score, percentage, pass/fail, section totals, and per-question correctness
- `ProcessingResult.formId` — indexed form lookup
- `Submission.createdAt` — attempt timeline through the existing one-to-one relation
- `Form.settings` — configured pass threshold

The previously documented optional `Submission(formId, createdAt)` index benefits general response analytics. Assessment analytics already uses the indexed `ProcessingResult.formId` lookup and its related submission timestamps.

## New aggregate response

`GET /api/processing/forms/:formId/assessment-analytics` now returns:

- Total processed attempts
- Passed and failed totals
- Pass rate and configured threshold
- Average raw score and average maximum score
- Average, median, highest, and lowest percentages
- Score spread (population standard deviation)
- Score distribution, including a correct `100%` bucket
- Fourteen-day daily attempt, average-score, and pass-rate series
- Current seven-day versus previous seven-day attempt comparison
- Current versus previous average-score change
- Per-question attempts, correct/incorrect totals, accuracy, and average points
- Per-section total score, maximum score, and percentage

The API does not return submitted answers or correct answers in aggregate analytics.

## Privacy behavior

The endpoint requires at least `AGGREGATE` response access.

When the viewer has aggregate-only access and fewer than the configured aggregate privacy minimum (currently five) have completed the assessment, detailed score, timeline, question, and section analytics are suppressed. Users with legitimate individual-response access may still use the administrative analytics for the small set.

The Leaderboard requires `REDACTED` or stronger response access because it contains per-submission score records.

## Ranking behavior

Leaderboard ranking uses total score. Equal scores receive equal competition rank:

```text
1, 1, 3, 4
```

Equal-score entries are ordered consistently by submission time. The endpoint also returns participant count, highest score, highest percentage, average percentage, and pass rate.
