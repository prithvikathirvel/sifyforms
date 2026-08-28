# SifyForms enterprise theme alternatives — 28 August 2026

Two complete, replacement-ready `src/index.css` options are provided here:

1. [`calm-indigo/index.css`](./calm-indigo/index.css)
2. [`mineral-teal/index.css`](./mineral-teal/index.css)

Both files preserve the project's existing fonts, responsive density, semantic statuses, public-page scope, scrollbar treatments, focus behavior, reduced-motion handling, and Tailwind directives. They also include compatibility mappings for the existing direct `brand-*` and `plum-*` utility classes, so replacing only `src/index.css` produces a coherent preview without also editing `tailwind.config.js`.

## Why the current theme feels comparatively strong

The current primary is `#521E99` (`265 67% 36%`): dark and highly chromatic. The color itself is accessible, but repeated use in buttons, icons, selected navigation, focus treatments, and pale purple surfaces makes the brand presence feel stronger than the amount of color typically used in dense enterprise tools.

SifyForms combines dashboards, form building, permissions, team hierarchy, response analysis, assessments, voting, imports, and security states. For this kind of product, color should organize actions and state—not decorate every region. The alternatives therefore use:

- Low-chroma brand ramps
- Near-white layered workspace backgrounds
- White cards and dialogs
- Stable dark text and readable secondary text
- Brand color primarily for actions, links, focus, and selection
- Independent success, warning, and destructive colors
- Restrained tinted surfaces rather than gradients

This follows patterns documented by current enterprise systems:

- [Atlassian Design System — Color](https://atlassian.design/foundations/color): neutral colors carry most backgrounds, text, and shapes; brand and semantic colors have explicit roles and emphasis levels.
- [IBM Carbon — Color](https://carbondesignsystem.com/elements/color/overview/): neutral gray is dominant, subtle value shifts create zones, and light interfaces alternate near-white backgrounds and white layers.
- [Microsoft Fluent 2 — Color](https://fluent2.microsoft.design/color): neutrals establish hierarchy, shared colors are used sparingly, and overusing brand color weakens navigation hierarchy.
- [W3C WCAG 2.2 — Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html): normal text requires at least 4.5:1 contrast and large text requires 3:1.
- [W3C WCAG 2.2 — Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html): meaningful controls, graphics, and state indicators require at least 3:1 against adjacent colors.

“Lower contrast” in these themes means lower *visual aggression and chroma*, not faint text. Readability remains intentionally above WCAG AA targets.

---

## Theme 1 — Calm Indigo / Porcelain

**Recommended first test.** This is the lowest-risk evolution of the current SifyForms identity. It keeps a violet-blue family but removes much of the saturation and the sharp magenta feeling.

### Character

- Calm, structured, credible
- Familiar for workflow, productivity, and administration software
- Closest to the existing purple brand direction
- Cool porcelain workspace separates white cards without looking gray

### Core palette

| Role | Value | Purpose |
|---|---:|---|
| Primary | `#4C5F8A` | Primary actions, active states, important links |
| Primary hover | `#405175` | Hover/pressed actions |
| Workspace | `#F6F7FA` | Authenticated application canvas |
| Card | `#FFFFFF` | Cards, dialogs, panels |
| Foreground | `#1F2937` | Main text |
| Muted text | `#667085` | Helper and secondary text |
| Border | `#E1E5EC` | Dividers and subtle containers |
| Input border | `#D5DAE3` | Form controls |
| Soft accent | `#EEF1F7` | Selected and informational surfaces |
| Success | `#2F7D68` | Published/success states |
| Warning | `#9A641F` | Caution states |
| Destructive | `#B94A5C` | Errors and destructive actions |

### Contrast checks on white

| Pair | Approx. ratio |
|---|---:|
| Primary `#4C5F8A` / white | `6.34:1` |
| Foreground `#1F2937` / white | `14.68:1` |
| Muted text `#667085` / white | `4.97:1` |
| Success `#2F7D68` / white | `4.94:1` |
| Destructive `#B94A5C` / white | `5.00:1` |

### Best fit

Choose this when SifyForms should continue to feel related to the present identity but calmer, less saturated, and more conventional for enterprise procurement and long work sessions.

---

## Theme 2 — Mineral Teal / Mist

A more distinctive alternative built around muted teal. Teal communicates reliability and data confidence without defaulting to conventional SaaS blue or the current high-saturation violet.

### Character

- Trustworthy, operational, composed
- Appropriate for data collection, workflows, compliance, and secure submissions
- A barely green-tinted mist canvas adds warmth without becoming colorful
- Brand color remains easy to distinguish from warning and destructive states

### Core palette

| Role | Value | Purpose |
|---|---:|---|
| Primary | `#336B6A` | Primary actions, active states, important links |
| Primary hover | `#2C5958` | Hover/pressed actions |
| Workspace | `#F5F8F7` | Authenticated application canvas |
| Card | `#FFFFFF` | Cards, dialogs, panels |
| Foreground | `#243332` | Main text |
| Muted text | `#5F706E` | Helper and secondary text |
| Border | `#DCE6E3` | Dividers and subtle containers |
| Input border | `#CBDAD6` | Form controls |
| Soft accent | `#ECF5F3` | Selected and informational surfaces |
| Success | `#2D7350` | Published/success states |
| Warning | `#99652A` | Caution states |
| Destructive | `#B54D58` | Errors and destructive actions |

### Contrast checks on white

| Pair | Approx. ratio |
|---|---:|
| Primary `#336B6A` / white | `6.08:1` |
| Foreground `#243332` / white | `13.17:1` |
| Muted text `#5F706E` / white | `5.21:1` |
| Success `#2D7350` / white | `5.71:1` |
| Destructive `#B54D58` / white | `5.04:1` |

### Best fit

Choose this when SifyForms should feel more operational and security-oriented while remaining approachable. It is the stronger identity change of the two.

---

## Direct replacement instructions

Back up the active file, then copy one theme over it:

```bash
cp src/index.css /tmp/sifyforms-index-current.css
cp suggestions/themes/calm-indigo/index.css src/index.css
npm run dev
```

Or test Mineral Teal:

```bash
cp suggestions/themes/mineral-teal/index.css src/index.css
npm run dev
```

Restore the current theme:

```bash
cp /tmp/sifyforms-index-current.css src/index.css
```

These are complete files, not token fragments. Do not append them to the existing stylesheet.

## Browser review checklist

Review each theme at browser zoom `100%` on:

- Mobile: approximately `360 × 800`
- Laptop: `1366 × 768` and `1440 × 900`
- Large monitor: `1920 × 1080`

Important routes and states:

1. Landing, login, signup, and organization selection
2. Dashboard statistics, analytics bars, team preview, and form cards
3. Forms search, filters, status chips, and action menus
4. Create Form modal in AI, scratch, template, and JSON modes
5. Deep team picker and full team browser
6. Teams hierarchy and member role controls
7. Form Builder field palette, inspector, settings, and validation dialogs
8. Submission results, errors, warnings, published and draft statuses
9. Keyboard focus on inputs, buttons, menus, dialogs, and tree controls

## Recommendation

Start with **Calm Indigo / Porcelain**. It reduces the current contrast sensation while preserving the strongest recognition link to the existing SifyForms mark. Test **Mineral Teal / Mist** second as the more differentiated product identity.
