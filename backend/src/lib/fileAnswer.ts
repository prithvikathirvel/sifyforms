/**
 * What a file answer actually is, as opposed to what the browser says it is.
 *
 * A file field's answer is not the file. The bytes go straight from the browser
 * to DMS through a pre-signed URL; what arrives in the submission is a short
 * JSON object *describing* that upload:
 *
 *     { documentId, filename, mimeType, size }
 *
 * Every one of those four values used to be taken at face value. The size and
 * type checks read `f.size` and `f.mimeType` out of the request body, so a
 * 900 MB executable declared as a 1 KB PDF passed a field configured
 * `accept: ['.pdf'], maxSize: 2`. The `documentId` was never looked at at all,
 * so a submission could reference a document belonging to another tenant and
 * the reference would be stored and later resolved to a download URL.
 *
 * The pre-upload check in `publicInitiateUpload` does not help: it validates
 * the same client-supplied numbers, before a single byte has been sent. Declare
 * 1 KB, receive a URL, upload whatever you like.
 *
 * This module fixes the direction the information flows. The `documentId` is
 * the only part of the answer that is worth anything, because it is the only
 * part the server issued. Everything else is discarded and re-read from DMS,
 * which knows what was actually uploaded and to which form and field it was
 * issued.
 */

import { UploadRules, isMimeTypeAllowed } from './formPolicy';

/** What the answer says. Only `documentId` survives verification. */
export interface ClaimedFile {
  documentId: string;
  filename?: unknown;
  mimeType?: unknown;
  size?: unknown;
  status?: unknown;
}

/** What DMS says. This is what gets stored. */
export interface DocumentFacts {
  documentId: string;
  filename: string;
  mimeType: string;
  size: number;
  formId?: string;
  fieldId?: string;
  status?: string;
}

/**
 * Looks a document up in DMS. Returns null when it does not exist or cannot be
 * read — which is a rejection, not a pass.
 */
export type DocumentLookup = (documentId: string) => Promise<DocumentFacts | null>;

export interface FileValidationContext {
  formId: string;
  /** Form-level ceiling, used when the field has no `fileConfig` of its own. */
  uploadRules: UploadRules;
  /**
   * Absent when DMS is switched off for this deployment. Without it a
   * documentId cannot be checked, so file answers are refused outright rather
   * than trusted — the alternative is to keep believing the browser, which is
   * the bug.
   */
  lookup?: DocumentLookup;
}

export interface FileValidationResult {
  error?: string;
  /** Server-derived replacements for whatever the client sent. */
  files?: DocumentFacts[];
}

/**
 * A value is a file answer only if it is an object with a documentId.
 *
 * The previous loop read `if (typeof f !== 'object' || !f) continue;`, so
 * sending the string `"anything at all"` skipped every file check and was
 * stored as the answer. Skipping an input you do not recognise is not
 * validation.
 */
function asClaimedFile(value: unknown): ClaimedFile | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const documentId = (value as Record<string, unknown>).documentId;
  if (typeof documentId !== 'string' || documentId.trim() === '') return null;
  return { ...(value as Record<string, unknown>), documentId: documentId.trim() } as ClaimedFile;
}

function extensionMatches(filename: string, pattern: string): boolean {
  return filename.toLowerCase().endsWith(pattern.toLowerCase());
}

/** The field's own `accept` list, applied to the DMS filename and content type. */
function acceptAllows(facts: DocumentFacts, accept: string[]): boolean {
  return accept.some((pattern) => {
    if (pattern.startsWith('.')) return extensionMatches(facts.filename, pattern);
    if (pattern.endsWith('/*')) return facts.mimeType.startsWith(pattern.replace('/*', '/'));
    return facts.mimeType === pattern;
  });
}

/**
 * Resolve `fileConfig.maxSize`, which is stored in two different units.
 *
 * The builder writes bytes; form-level DMS settings are in MB. The existing
 * convention — values at or below 1024 mean MB, larger values mean bytes — is
 * preserved here rather than corrected, because changing it would silently
 * loosen every form that relied on the current reading.
 */
function resolveMaxBytes(maxSize: unknown): number | undefined {
  const value = Number(maxSize);
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return value > 1024 ? value : value * 1024 * 1024;
}

/**
 * Verify one field's file answer end to end.
 *
 * Returns either an error message for the respondent or the list of documents
 * as DMS describes them, which the caller stores in place of what was sent.
 */
export async function verifyFileAnswer(
  field: any,
  value: unknown,
  context: FileValidationContext,
): Promise<FileValidationResult> {
  const raw = Array.isArray(value) ? value : [value];
  const cfg = field.fileConfig;

  // Count limits first: they are the cheapest check and the only ones that can
  // be answered without talking to DMS.
  if (cfg && !cfg.multiple && raw.length > 1) {
    return { error: 'Only one file is allowed.' };
  }
  if (cfg?.maxFiles && raw.length > cfg.maxFiles) {
    return { error: `Maximum ${cfg.maxFiles} files allowed.` };
  }
  // A ceiling even when the field never configured one, so a field with no
  // fileConfig cannot be handed ten thousand references.
  if (!cfg && raw.length > 20) {
    return { error: 'Too many files.' };
  }

  const claimed: ClaimedFile[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    const file = asClaimedFile(entry);
    if (!file) {
      return { error: 'This file could not be verified. Please remove it and upload it again.' };
    }
    // The same upload listed twice would otherwise count once against maxFiles
    // and twice in storage.
    if (seen.has(file.documentId)) continue;
    seen.add(file.documentId);
    claimed.push(file);
  }

  if (claimed.length === 0) return { files: [] };

  if (!context.lookup) {
    return { error: 'File uploads are unavailable on this server.' };
  }

  const verified: DocumentFacts[] = [];

  for (const file of claimed) {
    const facts = await context.lookup(file.documentId);
    if (!facts) {
      return { error: 'This file could not be verified. Please remove it and upload it again.' };
    }

    /*
     * The document has to be one this form asked for.
     *
     * DMS records the form and field in the document's metadata when the upload
     * is initiated, and initiation is the step the server controls. Comparing
     * against it is what stops a submission from attaching a document belonging
     * to another organization — which was accepted before, and stored, and
     * later resolved into a download URL for whoever opened the response.
     *
     * The message is deliberately the same as "not found": a caller must not be
     * able to tell "no such document" from "that document is not yours",
     * because the difference is itself an oracle over other tenants' ids.
     */
    if (facts.formId && facts.formId !== context.formId) {
      return { error: 'This file could not be verified. Please remove it and upload it again.' };
    }
    if (facts.fieldId && facts.fieldId !== String(field.id)) {
      return { error: 'This file could not be verified. Please remove it and upload it again.' };
    }

    // Every limit below is applied to DMS's numbers, never to the request's.
    const fieldMaxBytes = resolveMaxBytes(cfg?.maxSize);
    const formMaxBytes = context.uploadRules.maxFileSizeMb * 1024 * 1024;
    // The stricter of the two wins, and the form-level ceiling applies even to
    // a field that never configured one — previously `if (field.fileConfig)`
    // meant an unconfigured field had no size check whatsoever.
    const maxBytes = fieldMaxBytes ? Math.min(fieldMaxBytes, formMaxBytes) : formMaxBytes;

    if (facts.size > maxBytes) {
      return { error: `File "${facts.filename}" exceeds the maximum size allowed for this field.` };
    }

    if (Array.isArray(cfg?.accept) && cfg.accept.length > 0) {
      if (!acceptAllows(facts, cfg.accept as string[])) {
        return { error: `File "${facts.filename}" is not an allowed type.` };
      }
    }
    // The form-level allow-list applies regardless, for the same reason as the
    // size ceiling.
    if (!isMimeTypeAllowed(facts.mimeType, context.uploadRules.allowedMimeTypes)) {
      return { error: `File "${facts.filename}" is not an allowed type.` };
    }

    verified.push({
      documentId: facts.documentId,
      filename: facts.filename,
      mimeType: facts.mimeType,
      size: facts.size,
      status: 'active',
    });
  }

  return { files: verified };
}
