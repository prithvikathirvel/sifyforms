# SifyForms product suggestions — 27 August 2026

These are recommendations only. Nothing in this file is implemented as part of the current UI update.

## 1. Time-based submission analytics

The dashboard currently receives totals and a top-forms list, but not daily or weekly response history. Add a small analytics endpoint that returns date buckets so the dashboard can show a meaningful 7-day or 30-day trend instead of creating a decorative graph from totals.

Suggested response:

```json
{
  "range": "30d",
  "series": [
    { "date": "2026-08-01", "submissions": 12 },
    { "date": "2026-08-02", "submissions": 18 }
  ]
}
```

This would support a compact line/area chart, previous-period comparison, and accurate growth indicators.

## 2. Team search and branch navigation

Deep organization trees become difficult to scan even with a good hierarchy. Add:

- Team-name search
- “Show path to result” behavior
- Expand/collapse branch controls
- Breadcrumb navigation
- Optional virtualization when an organization has hundreds of teams

## 3. Move or re-parent teams

Allow authorized administrators to move a team under a different parent. Before moving, show how inherited roles and owned forms will be affected. This is important once real organizational structures change.

## 4. Form ownership and type metadata

The Forms API already provides `teamId`, schema, settings, status, and response count. Consider adding lightweight server-derived display metadata:

- `fieldCount`
- `formTypeLabel`
- `lastSubmissionAt`
- `ownerTeamName`

This avoids making every frontend screen repeatedly parse large form schemas or join team names.

## 5. Saved form views

Let users save combinations of search, status, team, and sorting as personal views such as “My published assessments” or “Drafts in HR”. This becomes valuable when organizations have many forms.

## 6. Submission idempotency

Turnstile prevents challenge-token replay, but it does not prevent a user from retrying with a fresh token after a network timeout. Add a submission idempotency key so retries return the original result instead of creating duplicate responses.

## 7. Activity and security audit trail

Provide organization administrators with a searchable audit trail for:

- Form publish/unpublish
- Team and role changes
- Submission exports and deletions
- Security-verification failures
- API integration activity

This would significantly improve support, compliance, and incident investigation.
