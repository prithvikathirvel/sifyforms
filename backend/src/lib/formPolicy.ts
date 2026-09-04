/**
 * The rules that a form's public page and the API must agree on.
 *
 * This is the server-side mirror of `src/lib/formPolicy.ts`. The browser copy
 * exists so a person is stopped before they waste time on a file that would be
 * refused; this copy is the one that actually enforces anything. Keep the two
 * in step — in particular the wording, so the message a person sees is the same
 * whichever side rejected them.
 */

// --- bot protection -----------------------------------------------------------

/**
 * Whether public submissions to this form must pass a Turnstile challenge.
 *
 * Defaults to on. A form saved before the switch existed, or one whose settings
 * could not be parsed, is protected — the safe direction to be wrong in.
 */
export function isBotProtectionEnabled(settings: any): boolean {
  return settings?.botProtection !== false;
}

// --- file uploads -------------------------------------------------------------

/** Ceiling on the per-form limit, so one form cannot opt into unbounded uploads. */
export const DMS_MAX_FILE_SIZE_MB = 100;

/** Applied when a form does not set its own limit. */
export const DMS_DEFAULT_MAX_FILE_SIZE_MB = 10;

export interface UploadRules {
  maxFileSizeMb: number;
  allowedMimeTypes: string[];
}

/**
 * The effective upload rules for a form.
 *
 * DMS is the only storage backend, so there is no "off" any more: the only
 * questions are how large a file may be and which kinds are welcome. An empty
 * `allowedMimeTypes` means "any type".
 */
export function resolveUploadRules(dms: any): UploadRules {
  const requested = Number(dms?.maxFileSize);
  const maxFileSizeMb = Number.isFinite(requested) && requested > 0
    ? Math.min(requested, DMS_MAX_FILE_SIZE_MB)
    : DMS_DEFAULT_MAX_FILE_SIZE_MB;

  const allowedMimeTypes: string[] = Array.isArray(dms?.allowedMimeTypes)
    ? dms.allowedMimeTypes.filter((t: unknown): t is string => typeof t === 'string' && t.trim().length > 0)
    : [];

  return { maxFileSizeMb, allowedMimeTypes };
}

/** Matches a concrete MIME type against one allow-list entry, `image/*` included. */
export function mimeTypeMatches(mimeType: string, pattern: string): boolean {
  const actual = (mimeType || '').toLowerCase().trim();
  const rule = (pattern || '').toLowerCase().trim();
  if (!rule) return false;
  if (rule === '*/*' || rule === '*') return true;
  if (rule.endsWith('/*')) return actual.startsWith(rule.slice(0, -1));
  return actual === rule;
}

export function isMimeTypeAllowed(mimeType: string, allowedMimeTypes: string[]): boolean {
  if (allowedMimeTypes.length === 0) return true;
  return allowedMimeTypes.some((pattern) => mimeTypeMatches(mimeType, pattern));
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Why a file cannot be uploaded, phrased for the person who picked it, or
 * `null` when it is fine.
 */
export function describeUploadRejection(
  file: { name: string; size: number; type: string },
  rules: UploadRules,
): string | null {
  const limitBytes = rules.maxFileSizeMb * 1024 * 1024;
  if (file.size > limitBytes) {
    return `"${file.name}" is ${formatBytes(file.size)}. The largest file this form accepts is ${rules.maxFileSizeMb} MB.`;
  }
  if (!isMimeTypeAllowed(file.type, rules.allowedMimeTypes)) {
    return `"${file.name}" is not an accepted file type.`;
  }
  return null;
}
