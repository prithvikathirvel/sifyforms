# Form Header / Branding — Display & Customization Plan

**Status:** Proposal (not yet implemented)
**Scope:** Public form renderer (`PublicFormPage` → `FormBranding`), editor Preview
(`FormPreview` → `PreviewBranding`), Settings modal (`SettingsModal`), and the
`FormBrandingSection` type.

---

## 1. Objective

Make the form **header and footer** reliably display any image a user uploads —
including "hard" images with unusual dimensions, oversized files, transparent
backgrounds, or tiny/extra-wide logos — and give authors fine-grained control
so the result looks intentional on every form, without breaking the
submit/preview parity requirement.

---

## 2. Current state (baseline)

`FormBrandingSection` (`src/types/index.ts`) supports:

```ts
{
  enabled?: boolean;
  logoUrl?: string;        // URL or data URI
  logoDocumentId?: string; // DMS reference
  text?: string;
  logoPosition?: 'left' | 'center' | 'right';
  textPosition?: 'left' | 'center' | 'right';
}
```

Rendering (`FormBranding.header`) currently pins the logo to `max-h-12` with
`object-contain`. Problems this plan addresses:

- **No width/size control** — a wide banner logo or a huge square logo can't be
  tuned, and a tiny logo can't be scaled up.
- **No fit policy** — `object-contain` letterboxes; there's no "cover / fill /
  custom" choice.
- **No background or padding** control — transparent PNGs on themed forms can
  look inconsistent.
- **No per-surface parity guard** — header is rendered twice (public + preview)
  with duplicated logic, so they can drift.

---

## 3. Proposed model

### 3.1 Type extensions (`FormBrandingSection`)

All new fields are **optional** — existing saved forms are unaffected.

```ts
export interface FormBrandingSection {
  enabled?: boolean;
  logoUrl?: string;
  logoDocumentId?: string;
  text?: string;
  logoPosition?: BrandingPosition;
  textPosition?: BrandingPosition;

  // ── NEW: image fit & sizing ─────────────────────────────
  /** How the uploaded image is fitted into its box. */
  logoFit?: 'contain' | 'cover' | 'fill';
  /** Fixed rendered width (px). Absent = auto from height/aspect. */
  logoWidth?: number;
  /** Fixed rendered height (px). Absent = default (48). */
  logoHeight?: number;
  /** Scale factor when only one dimension is set (default 1). */
  logoScale?: number;

  // ── NEW: presentation ──────────────────────────────────
  /** Background behind the header bar (CSS color or 'transparent'). */
  background?: string;
  /** Vertical padding of the header bar (px). */
  paddingY?: number;
  /** Rounded corners on the logo (px). */
  logoRadius?: number;
  /** Optional border around the header bar. */
  border?: { color?: string; width?: number; style?: 'solid' | 'dashed' | 'none' };

  // ── NEW: text styling ───────────────────────────────────
  /** Font size for the header text (px). */
  textSize?: number;
  /** Text color (CSS color). */
  textColor?: string;
  /** Text weight (400–800). */
  textWeight?: number;
}
```

### 3.2 Fit policy (the "hard images" problem)

| `logoFit` | Behaviour | Best for |
|---|---|---|
| `contain` (default) | Scale to fit inside the box, keep aspect ratio, letterbox | Standard logos |
| `cover` | Scale to fill the box, crop overflow | Banner / hero images |
| `fill` | Stretch to exactly fill the box (may distort) | Decorative tiles |

Rendering rules to make any image safe:

1. **Constrain hard dimensions** — if `logoHeight`/`logoWidth` are absent,
   clamp the intrinsic image into a sane box (`max-height: 96px`,
   `max-width: 100%`) so a 4000px banner or a tiny 16px favicon both look
   reasonable.
2. **Preserve aspect ratio unless `fill`** — `cover` crops, `contain`
   letterboxes, neither distorts.
3. **Guard transparent PNGs** — offer a white/`background`-colored padded
   container behind the logo so light logos aren't lost on themed forms.
4. **`object-position` center** by default (configurable later).

---

## 4. Editor (Settings) changes

Extend the header/footer section in `SettingsModal`:

- **Image preview + upload** (existing) plus new controls:
  - Fit dropdown: *Contain / Cover / Fill*.
  - Height & width numeric inputs (with "auto" toggle).
  - A **live thumbnail** that shows the current fit on a mock header strip.
- **Presentation**: background color picker, padding slider, logo radius,
  optional border controls.
- **Text styling**: size, color, weight.
- **Position**: keep existing `logoPosition` / `textPosition` (left/center/right).

Persistence: these write into `form.settings.header` / `form.settings.footer`
via the existing `updateSettings` flow — no new API.

---

## 5. Rendering (parity guarantee)

Extract the header/footer into a **single shared component** used by both the
public page and the preview, parameterized by the `FormBrandingSection`:

```
src/components/builder/FormBranding.tsx
```

- `PublicFormPage` replaces its local `FormBranding` with the shared one.
- `FormPreview` replaces its local `PreviewBranding` with the shared one.
- This guarantees **preview = published** for headers/footers (a stated
  requirement), and centralizes the fit/background/text logic in one place.

Shared component responsibilities:

- Resolve `logoUrl` (URL or DMS `getPublicDownloadUrl`).
- Apply fit/size/padding/background/border/text-styling from the section.
- Fall back gracefully (no logo, no text → render nothing).

---

## 6. Edge cases & rules

1. **Both logo and text on the same side** → grouped row (existing behaviour).
2. **Different sides** → three-column split row (existing behaviour).
3. **Image load failure** → render text only; never a broken `<img>` (use
   `onError` fallback).
4. **DMS logo** → keep the async resolve; show nothing while loading.
5. **Footer** → text-only today; the plan optionally extends it to support the
   same image controls later (deferred — see §8).
6. **Dark / themed forms** → use CSS variables (`--card`, `--foreground`) plus
   the explicit `background` override so contrast stays correct.
7. **Huge files** → the backend/DMS upload path already handles size limits;
   render-side, the max-dimension clamp prevents layout blowouts.

---

## 7. Suggested implementation order

1. Extend `FormBrandingSection` type (optional fields only).
2. Build shared `FormBranding` component with fit/size/presentation logic.
3. Swap both render sites (public + preview) to the shared component.
4. Add Settings UI controls (fit, size, background, text styling).
5. QA: square / wide / tiny / transparent / oversized images × light & dark
   themes × logo+text left/center/right combinations.

---

## 8. Deferred iterations (explicitly out of scope now)

- **Footer images** (keep text-only until image controls prove stable).
- **Cropping / focal-point editor** (client-side crop before upload).
- **Per-device overrides** (different header on mobile).
- **Multiple logos / full-width hero banner** with parallax or gradient blend.

---

## 9. Risks / mitigations

| Risk | Mitigation |
|---|---|
| Breaking existing forms | All new fields optional; defaults = current behaviour |
| Preview drifting from published | Single shared `FormBranding` component |
| Oversized images breaking layout | Max-dimension clamp + `object-fit` policy |
| Transparent logos invisible on themes | Background/padding container option |

---

## 10. Definition of done

- Any uploaded image (any aspect ratio) renders cleanly in header/footer on both
  the published form and the editor preview.
- Users can adjust fit (contain/cover/fill), size, background, padding, and
  text styling from the Settings modal.
- Existing forms with only the legacy fields render identically to today.
- Preview and published forms always match.
