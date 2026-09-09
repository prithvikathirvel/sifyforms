/**
 * The product's own UI themes — distinct from the public-form themes, which
 * use the `data-theme` attribute. This one lives on `data-app-theme` of
 * <html> and is chosen in Organization settings → Appearance.
 *
 * The choice is kept per browser (localStorage): it paints immediately on
 * load, before React renders, so there is no flash of the wrong palette.
 */

export type AppThemeId = 'violet' | 'white' | 'ocean' | 'forest' | 'mono';

export interface AppTheme {
  id: AppThemeId;
  label: string;
  description: string;
  /** Three swatch colors (HSL parts) for the picker card. */
  swatch: [string, string, string];
}

export const APP_THEMES: AppTheme[] = [
  {
    id: 'violet',
    label: 'Sify Violet',
    description: 'The default — white cards on a quiet slate canvas.',
    swatch: ['hsl(265 67% 36%)', 'hsl(285 68% 39%)', 'hsl(225 25% 97%)'],
  },
  {
    id: 'white',
    label: 'Full White Slate',
    description: 'Pure white everywhere, slate borders, a steady blue accent.',
    swatch: ['hsl(221 83% 45%)', 'hsl(215 20% 88%)', 'hsl(0 0% 100%)'],
  },
  {
    id: 'ocean',
    label: 'Ocean Blue',
    description: 'A cool blue-tinted workspace with a deep ocean accent.',
    swatch: ['hsl(221 78% 42%)', 'hsl(214 45% 95%)', 'hsl(214 40% 96%)'],
  },
  {
    id: 'forest',
    label: 'Forest Green',
    description: 'Calm neutrals with a deep green accent.',
    swatch: ['hsl(160 84% 28%)', 'hsl(152 40% 95%)', 'hsl(150 20% 96%)'],
  },
  {
    id: 'mono',
    label: 'Slate Mono',
    description: 'Black, white and slate — nothing else. Quiet by design.',
    swatch: ['hsl(222 47% 11%)', 'hsl(215 20% 65%)', 'hsl(210 20% 98%)'],
  },
];

const STORAGE_KEY = 'sifyforms.appTheme';
const VALID: AppThemeId[] = APP_THEMES.map((t) => t.id);

export function readAppTheme(): AppThemeId {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as AppThemeId | null;
    if (saved && VALID.includes(saved)) return saved;
  } catch {
    // Storage unavailable: the default palette stands.
  }
  return 'violet';
}

/** Paint the chosen theme onto the document. Safe to call repeatedly. */
export function applyAppTheme(id: AppThemeId): void {
  const root = document.documentElement;
  root.dataset.appTheme = id;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Storage unavailable: the choice lasts for this page only.
  }
}
