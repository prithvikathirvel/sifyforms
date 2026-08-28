# Security update — 28 August 2026

## Assessment results now use the same access rules as responses

While improving the Results and Leaderboard screens, we found that the protected assessment endpoints checked authentication and organization context but did not ask the form-access service what response level the person held.

That meant the UI could hide an assessment leaderboard while a signed-in organization member could still call the endpoint directly.

This is now corrected:

- Opening one submission’s processed assessment result requires at least **Redacted** response access.
- Opening the assessment leaderboard requires at least **Redacted** response access because it contains per-submission scores and IDs.
- Opening assessment analytics requires at least **Aggregate** response access because it contains totals and score distributions but no individual response.
- Express, Google Cloud Functions, and AWS Lambda adapters all pass the authenticated user ID into the same service checks.
- The frontend also hides Leaderboard when individual rows are unavailable and hides assessment analytics when aggregate access is unavailable.

The checks still apply the form’s response policy after roles and explicit shares are resolved. Anonymous forms therefore remain capped at aggregate insight, and a user cannot bypass that policy by calling an assessment endpoint directly.

No database migration is required for this security change.
