/**
 * Which paths belong to the signed-in application, and which are open to the
 * public internet.
 *
 * The distinction has to be drawn this way round — enumerate the application
 * and treat everything else as public — because the public surface cannot be
 * enumerated. A published form lives at `/:orgSlug/:formSlug`, so its path is
 * two pieces of user-supplied text: `/acme/leave-request`, `/finance/expenses`,
 * anything at all.
 *
 * Listing "public prefixes" instead is the mistake this module exists to
 * prevent. That list can only ever name the routes somebody remembered, and
 * every form a customer publishes is a path nobody could have written down. The
 * application's own routes, by contrast, are a closed set defined in `App.tsx`
 * and changed only when a developer adds a screen.
 */

/**
 * The application's routes, matched by segment count and shape rather than by
 * prefix.
 *
 * Precision matters because the two namespaces overlap. An organization whose
 * slug is `forms` publishes a form at `/forms/staff-survey`, which a prefix
 * test on `/forms` would wrongly claim. React Router resolves that URL to the
 * public form — `/forms/:formId/edit` needs three segments and `/forms` needs
 * one — so this must resolve it the same way, or the two disagree about what
 * the user is looking at.
 *
 * `null` matches any single segment, mirroring a `:param` in the route table.
 */
const APPLICATION_ROUTES: ReadonlyArray<ReadonlyArray<string | null>> = [
  ['dashboard'],
  ['forms'],
  ['forms', null, 'edit'],
  ['forms', null, 'submissions'],
  ['members'],
  ['teams'],
  ['roles'],
  ['settings'],
  ['settings', 'profile'],
  ['account'],
  ['account', 'edit'],
  ['org', 'setup'],
  // Sign-in and sign-up hold no session yet, but they own session state and
  // are unambiguously ours.
  ['auth', 'login'],
  ['auth', 'signup'],
];

/** Strip the Vite base path (`/form-builder/` in production) if present. */
function withoutBase(pathname: string): string {
  const base = import.meta.env.BASE_URL || '/';
  if (base !== '/' && pathname.startsWith(base)) {
    return pathname.slice(base.length - 1) || '/';
  }
  return pathname;
}

function segments(pathname: string): string[] {
  return withoutBase(pathname).split('/').filter(Boolean);
}

/**
 * Whether this path is part of the signed-in application.
 *
 * `/` is the marketing landing page and is deliberately excluded: it renders
 * for anybody, and a visitor arriving there has nothing to restore.
 */
export function isApplicationPath(pathname: string): boolean {
  const parts = segments(pathname);
  if (parts.length === 0) return false;

  return APPLICATION_ROUTES.some(
    (route) =>
      route.length === parts.length &&
      route.every((expected, i) => expected === null || expected === parts[i])
  );
}

/**
 * Whether this path is a public one — a published form, the payment return
 * page, or the landing page.
 */
export function isPublicPath(pathname: string): boolean {
  return !isApplicationPath(pathname);
}

/** True for the sign-in and sign-up screens, which explain themselves on load. */
export function isAuthPath(pathname: string): boolean {
  const parts = segments(pathname);
  return parts[0] === 'auth';
}
