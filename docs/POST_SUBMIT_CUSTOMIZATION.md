# After-Submit Experience Customization

Form authors can configure the screens shown after a successful response from **Builder → Settings → General**.

## Templates

- **Minimal** — quiet, neutral confirmation suitable for general forms.
- **Celebration** — stronger color and recognition for surveys, milestones, and feedback.
- **Professional** — trust-focused treatment for business and operational workflows.
- **Next steps** — left-aligned, action-oriented screen for directing respondents onward.

Selecting a template applies a coordinated accent, page background, and icon. Every value can then be adjusted independently.

## Customizable content and style

Authors can configure:

- Headline and multi-line message
- Check, sparkles, heart, or thumbs-up icon
- Accent and page-background colors
- Optional response reference
- Optional received timestamp
- Primary action label and URL
- Secondary action label and URL
- Redirect URL when no in-app confirmation should be shown

Only HTTP and HTTPS action links are rendered. Invalid or unsafe URL schemes are ignored on the public page.

## Loading activity

Assessment processing and poll-result loading use the same selected template. Authors can customize:

- Loading title
- Loading description
- Activity bar
- Spinner
- Pulse indicator

The loading screen explicitly confirms that the response was received before asynchronous results are ready.

## Result pages

Assessment and poll results are placed inside the configured after-submit experience rather than using separate unrelated cards. Assessment scores, section breakdowns, answer reviews, vote totals, and poll distributions remain type-specific while sharing the chosen template, message, colors, metadata, and actions.

## Redirect precedence

When **Redirect URL** is configured, the external redirect replaces the customized after-submit screen. Leave Redirect URL empty to use templates, result layouts, loading activity, metadata, and actions.

## Compatibility

Forms created before this feature continue using the Minimal template and their existing `thankYouMessage`. Editing the new Message field keeps the legacy thank-you value synchronized for older clients and backend responses.
