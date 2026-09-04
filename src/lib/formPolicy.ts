/**
 * The rules that a form's public page and the API must agree on.
 *
 * Both sides read the same settings object and must reach the same verdict: if
 * the browser lets a file through that the server rejects, the person only
 * finds out after filling the whole form in. Everything here is deliberately
 * pure and defensive about missing settings, because forms saved before a
 * setting existed still have to behave sensibly.
 *
 * A mirror of this file lives at `backend/src/lib/formPolicy.ts`. Keep the two
 * in step.
 */

import type { DmsSettings, FormSettings } from '../types';

// --- bot protection -----------------------------------------------------------

/**
 * Whether public submissions must pass a Cloudflare Turnstile challenge.
 *
 * Defaults to on. A form saved before this switch existed, or one whose
 * settings failed to parse, is protected — the safe direction to be wrong in.
 */
export function isBotProtectionEnabled(settings: Pick<FormSettings, 'botProtection'> | null | undefined): boolean {
  return settings?.botProtection !== false;
}

// --- file uploads -------------------------------------------------------------

/** Ceiling on the per-form limit, so one form cannot opt into unbounded uploads. */
export const DMS_MAX_FILE_SIZE_MB = 100;

/** Applied when a form does not set its own limit. */
export const DMS_DEFAULT_MAX_FILE_SIZE_MB = 10;

/** The upload categories offered in form settings. */
export const DMS_FILE_TYPE_GROUPS: { label: string; description: string; value: string; mimeTypes: string[] }[] = [
  {
    label: 'Images',
    description: 'JPG, PNG, GIF, WebP, SVG',
    value: 'image',
    mimeTypes: ['image/*'],
  },
  {
    label: 'PDF',
    description: 'Adobe PDF documents',
    value: 'pdf',
    mimeTypes: ['application/pdf'],
  },
  {
    label: 'Documents',
    description: 'Word documents and rich text',
    value: 'document',
    mimeTypes: [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/rtf',
      'application/vnd.oasis.opendocument.text',
    ],
  },
  {
    label: 'Spreadsheets',
    description: 'Excel and CSV files',
    value: 'spreadsheet',
    mimeTypes: [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/vnd.oasis.opendocument.spreadsheet',
    ],
  },
  {
    label: 'Presentations',
    description: 'PowerPoint slide decks',
    value: 'presentation',
    mimeTypes: [
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
  },
  {
    label: 'Plain text',
    description: 'TXT and Markdown notes',
    value: 'text',
    mimeTypes: ['text/plain', 'text/markdown'],
  },
];

/**
 * The effective upload rules for a form.
 *
 * DMS is the only storage backend now, so there is no "off": the question is
 * only how large a file may be and which kinds are welcome. An empty
 * `allowedMimeTypes` means "any type".
 */
export interface UploadRules {
  maxFileSizeMb: number;
  allowedMimeTypes: string[];
}

export function resolveUploadRules(dms: DmsSettings | null | undefined): UploadRules {
  const requested = Number(dms?.maxFileSize);
  const maxFileSizeMb = Number.isFinite(requested) && requested > 0
    ? Math.min(requested, DMS_MAX_FILE_SIZE_MB)
    : DMS_DEFAULT_MAX_FILE_SIZE_MB;

  const allowedMimeTypes = Array.isArray(dms?.allowedMimeTypes)
    ? dms.allowedMimeTypes.filter((type): type is string => typeof type === 'string' && type.trim().length > 0)
    : [];

  return { maxFileSizeMb, allowedMimeTypes };
}

/** Matches a concrete MIME type against one allow-list entry, `image/*` included. */
export function mimeTypeMatches(mimeType: string, pattern: string): boolean {
  const actual = (mimeType || '').toLowerCase().trim();
  const rule = (pattern || '').toLowerCase().trim();
  if (!rule) return false;
  if (rule === '*/*' || rule === '*') return true;
  if (rule.endsWith('/*')) return actual.startsWith(`${rule.slice(0, -1)}`);
  return actual === rule;
}

export function isMimeTypeAllowed(mimeType: string, allowedMimeTypes: string[]): boolean {
  if (allowedMimeTypes.length === 0) return true;
  return allowedMimeTypes.some((pattern) => mimeTypeMatches(mimeType, pattern));
}

/**
 * Why a file cannot be uploaded, phrased for the person who picked it, or
 * `null` when it is fine. The same sentences are used by the API so the two
 * never contradict each other.
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
    return `"${file.name}" is not an accepted file type. This form accepts ${describeAllowedTypes(rules.allowedMimeTypes)}.`;
  }
  return null;
}

/** A short, human list of what may be uploaded — for hint text and error copy. */
export function describeAllowedTypes(allowedMimeTypes: string[]): string {
  if (allowedMimeTypes.length === 0) return 'any file type';
  const labels = DMS_FILE_TYPE_GROUPS
    .filter((group) => group.mimeTypes.some((mime) => allowedMimeTypes.includes(mime)))
    .map((group) => group.label.toLowerCase());
  const unmatched = allowedMimeTypes.filter(
    (mime) => !DMS_FILE_TYPE_GROUPS.some((group) => group.mimeTypes.includes(mime)),
  );
  const all = [...new Set([...labels, ...unmatched])];
  if (all.length === 0) return 'any file type';
  if (all.length === 1) return all[0];
  return `${all.slice(0, -1).join(', ')} and ${all[all.length - 1]}`;
}

/** The value for an `<input type="file" accept>` attribute, or undefined for "any". */
export function acceptAttribute(allowedMimeTypes: string[]): string | undefined {
  return allowedMimeTypes.length > 0 ? allowedMimeTypes.join(',') : undefined;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
