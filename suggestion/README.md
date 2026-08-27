# Product suggestions

The UI revamp keeps the current API contract intact. These are the highest-value follow-ups I would consider as the product grows; none are required for the current dashboard, forms, or teams experience to work.

## 1. Add a response time series to `/api/forms/stats`

The dashboard can currently show totals, recent response counts, the top forms, and team totals. A real trend chart needs a server-produced series so the client never guesses or reconstructs sensitive response data.

Suggested response shape:

```json
{
  "submissionTrend": [
    { "date": "2026-08-21", "count": 4 },
    { "date": "2026-08-22", "count": 9 }
  ],
  "trendWindow": "30d"
}
```

Recommended behavior:

- support 7, 30, and 90 day windows;
- return zero-count days so the line does not jump over quiet periods;
- scope the series using the same visibility rules as `topForms`;
- include a previous-period total or percentage change for a trustworthy comparison;
- keep aggregation on the server, especially for anonymous or restricted forms.

This would unlock a response-volume line/area chart, the most useful default analytics view for an operations dashboard.

## 2. Form-level conversion funnel

For published forms, track visits, starts, completions, and completion rate. This will show whether a form is receiving few responses because it has low reach or because respondents abandon it.

Useful optional fields:

- `views`;
- `started`;
- `completed`;
- `completionRate`;
- `medianCompletionSeconds`.

The metric should be opt-in or clearly documented because it introduces visitor analytics and retention considerations.

## 3. Team roll-up analytics

The teams page now makes the hierarchy readable. A future analytics endpoint could provide roll-ups for a selected team and all descendants:

- forms owned by the branch;
- responses by child team;
- active versus inactive members;
- response trend for the branch;
- forms with no activity in the selected period.

The UI should always label whether a number is **direct** or **including sub-teams**. That distinction is important for deeply nested organizations.

## 4. Form health signals

Small, explainable indicators would help users act on the library instead of only browsing it:

- draft not updated in 30 days;
- published form with zero responses;
- unusually high response volume;
- forms with no owning team;
- expiring or inactive forms.

These can start as derived server-side flags and do not need a new workflow immediately.

## 5. Safer destructive actions

The current UI keeps the existing delete behavior and confirmation flow. A future confirmation dialog could show the exact impact before deleting:

- number of descendant teams;
- forms that will move to `General`;
- members affected;
- whether the action is reversible.

An audit log for team, membership, publishing, and deletion events would be a strong companion feature for enterprise customers.

## 6. Hierarchy quality-of-life improvements

The next useful team features would be:

- drag-and-drop move with a deliberate confirmation step;
- breadcrumb navigation for the selected team;
- saved or shareable views for frequently used branches;
- keyboard navigation through the tree;
- bulk member assignment;
- branch-level archive rather than only delete.

These should be added only with corresponding backend authorization and audit events; the current frontend deliberately does not invent any new write operations.
