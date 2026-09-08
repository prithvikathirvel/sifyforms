import { api } from './api';

/**
 * The respondent's handle on a public form.
 *
 * ## What it replaces
 *
 * Three things the public form does needed to know "who is asking": reading and
 * writing the saved draft, checking whether a value is already taken, and
 * asking the organization's API to verify a value. All three used to answer
 * that with something the browser chose — the draft was addressed by email
 * address in the query string, and the other two by nothing at all. Knowing
 * somebody's email address was enough to read, overwrite or delete their
 * half-finished application.
 *
 * The server now issues a random token and recognises it by hash. This module
 * is the browser's half: get one, keep it, present it, and quietly replace it
 * when it expires.
 *
 * ## Why a header and not a cookie
 *
 * A cookie is attached by the browser to any request to our origin, including
 * ones another site caused — so it would make every draft write a CSRF target
 * and require a second token to defend the first. A header has to be set by our
 * own code, and the cross-origin rules prevent another page from setting it.
 *
 * ## Why localStorage
 *
 * A draft that cannot survive closing the tab is not a draft. The token is not
 * a credential for anything except this one form's own in-progress answers,
 * which are already in the page.
 */

const storageKey = (formId: string) => `sifyforms:form-session:${formId}`;

/** Sessions minted this page load, so concurrent callers share one round trip. */
const inFlight = new Map<string, Promise<string>>();

function readStored(formId: string): string | null {
  try {
    return localStorage.getItem(storageKey(formId));
  } catch {
    // Private browsing modes and some embedded webviews throw on access rather
    // than returning null. Falling back to a fresh session per request is slow
    // but correct; failing the form is not.
    return null;
  }
}

function writeStored(formId: string, token: string): void {
  try {
    localStorage.setItem(storageKey(formId), token);
  } catch {
    /* see readStored */
  }
}

export function clearFormSession(formId: string): void {
  try {
    localStorage.removeItem(storageKey(formId));
  } catch {
    /* see readStored */
  }
  inFlight.delete(formId);
}

/** Ask the server for a session. Only ever one request per form at a time. */
function mint(formId: string): Promise<string> {
  const existing = inFlight.get(formId);
  if (existing) return existing;

  const pending = api
    .post<{ token: string }>(`/forms/public/${formId}/session`, {})
    .then((response) => {
      const token = response.data?.token;
      if (!token) throw new Error('No form session token returned');
      writeStored(formId, token);
      return token;
    })
    .finally(() => {
      inFlight.delete(formId);
    });

  inFlight.set(formId, pending);
  return pending;
}

/** The current token for this form, minting one if there isn't a stored one. */
export async function getFormSessionToken(formId: string): Promise<string> {
  return readStored(formId) ?? (await mint(formId));
}

/**
 * `true` when the server is telling us the session is gone rather than
 * refusing the request on its merits.
 *
 * The distinction matters: one is retryable with a new session, the other is
 * not, and retrying a genuine refusal in a loop would be worse than showing the
 * error.
 */
function isSessionExpired(error: unknown): boolean {
  const response = (error as { response?: { status?: number; data?: { code?: string } } })?.response;
  return response?.status === 401 && response?.data?.code === 'FORM_SESSION_REQUIRED';
}

/**
 * Run a request with the form session attached, replacing the session once if
 * the server says it has expired.
 *
 * Sessions outlive most sittings but not all of them, and a person who leaves a
 * long application open over lunch should come back to a working autosave
 * rather than to a silent failure. One retry, never a loop.
 *
 *     await withFormSession(form.id, (config) => api.post('/drafts', body, config));
 */
export async function withFormSession<T>(
  formId: string,
  call: (config: { headers: Record<string, string> }) => Promise<T>,
): Promise<T> {
  const token = await getFormSessionToken(formId);
  try {
    return await call({ headers: { 'X-Form-Session': token } });
  } catch (error) {
    if (!isSessionExpired(error)) throw error;
    clearFormSession(formId);
    const fresh = await mint(formId);
    return call({ headers: { 'X-Form-Session': fresh } });
  }
}
