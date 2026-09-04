/**
 * One place that knows how this API reports failure.
 *
 * The backend answers in two shapes:
 *
 *   { "error": "Something went wrong" }
 *
 *   { "error": "Validation failed",
 *     "details": [ { "field": "password", "message": "Password must be at least 8 characters long" } ] }
 *
 * The second shape is the useful one: "Validation failed" tells a person
 * nothing, while the detail lines are exactly what they need to fix. These
 * helpers always prefer the details, and hand back the per-field breakdown so a
 * form can attach each message to the input that caused it.
 */

export interface ApiFieldError {
  field: string;
  message: string;
}

/**
 * Marker message for a cancelled request. Reducers compare against this to
 * recognise "nothing went wrong, a newer request replaced this one".
 */
export const REQUEST_CANCELLED = 'Request cancelled';

interface ErrorEnvelope {
  error?: unknown;
  message?: unknown;
  details?: unknown;
  errors?: unknown;
}

function envelope(error: unknown): ErrorEnvelope | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const withResponse = error as { response?: { data?: unknown } };
  const data = withResponse.response?.data ?? error;
  if (!data || typeof data !== 'object') return undefined;
  return data as ErrorEnvelope;
}

function readDetail(entry: unknown): ApiFieldError | null {
  if (typeof entry === 'string') return { field: '', message: entry };
  if (!entry || typeof entry !== 'object') return null;

  const detail = entry as { field?: unknown; path?: unknown; message?: unknown; msg?: unknown };
  const message = typeof detail.message === 'string'
    ? detail.message
    : typeof detail.msg === 'string'
      ? detail.msg
      : '';
  if (!message) return null;

  const rawField = detail.field ?? detail.path;
  const field = Array.isArray(rawField)
    ? rawField.join('.')
    : typeof rawField === 'string'
      ? rawField
      : '';

  return { field, message };
}

/**
 * Field-by-field validation messages, when the server sent any. Empty array
 * for every other kind of failure, so callers can branch on `.length`.
 */
export function apiFieldErrors(error: unknown): ApiFieldError[] {
  const data = envelope(error);
  const raw = Array.isArray(data?.details)
    ? data?.details
    : Array.isArray(data?.errors)
      ? data?.errors
      : null;
  if (!raw) return [];
  return raw.map(readDetail).filter((detail): detail is ApiFieldError => detail !== null);
}

/**
 * True when the request was cancelled rather than answered — an aborted
 * `AbortController` (we rotate one on every organization switch) or a component
 * that unmounted mid-flight.
 *
 * These are not failures anybody needs to read about: something newer is
 * already on its way. Callers use this to avoid two mistakes that both look
 * like a hang — showing "canceled" as an error banner, and leaving a loading
 * flag pinned because the reply that would have cleared it never arrived.
 */
export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { code?: unknown; name?: unknown; message?: unknown };
  if (err.code === 'ERR_CANCELED') return true;
  if (err.name === 'CanceledError' || err.name === 'AbortError') return true;
  return err.message === 'canceled';
}

/**
 * The sentence to show a person. Detail messages win over the generic envelope
 * title, so "Validation failed" never reaches the screen on its own.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  // Axios reports an aborted request as the bare word "canceled". Never let
  // that reach a person.
  if (isAbortError(error)) return REQUEST_CANCELLED;

  const details = apiFieldErrors(error);
  if (details.length > 0) {
    return details.map((detail) => detail.message).join('\n');
  }

  const data = envelope(error);
  if (typeof data?.error === 'string' && data.error.trim()) return data.error;
  if (typeof data?.message === 'string' && data.message.trim()) return data.message;

  const axiosLike = error as { code?: string; message?: string };
  if (axiosLike?.code === 'ERR_NETWORK') return 'Cannot reach the server. Check your connection and try again.';
  if (typeof axiosLike?.message === 'string' && axiosLike.message && axiosLike.message !== 'Request failed') {
    return axiosLike.message;
  }

  return fallback;
}

/** Rejected-thunk payload carrying both the sentence and the field breakdown. */
export interface ApiErrorPayload {
  message: string;
  fields: ApiFieldError[];
}

export function apiErrorPayload(error: unknown, fallback: string): ApiErrorPayload {
  return { message: apiErrorMessage(error, fallback), fields: apiFieldErrors(error) };
}

/** Reads the sentence back out of whatever a thunk rejected with. */
export function payloadMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'string') return payload;
  if (payload && typeof payload === 'object' && typeof (payload as ApiErrorPayload).message === 'string') {
    return (payload as ApiErrorPayload).message;
  }
  return fallback;
}

/** Reads the field breakdown back out of whatever a thunk rejected with. */
export function payloadFieldErrors(payload: unknown): ApiFieldError[] {
  if (payload && typeof payload === 'object' && Array.isArray((payload as ApiErrorPayload).fields)) {
    return (payload as ApiErrorPayload).fields;
  }
  // Tolerates a raw response body being handed straight through.
  return apiFieldErrors(payload);
}

/**
 * True when a rejected thunk's payload came from a cancelled request.
 *
 * Reducers use this to leave the slice exactly as it was: no error banner, and
 * no loading flag flipped off underneath the newer request that is still in
 * flight.
 */
export function isCancelledPayload(payload: unknown): boolean {
  return payloadMessage(payload, '') === REQUEST_CANCELLED;
}
