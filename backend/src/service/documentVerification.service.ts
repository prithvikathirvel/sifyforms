import * as dmsService from './dms.service';
import { DMS_ENABLED } from '../config/dms.config';
import { DocumentFacts, DocumentLookup } from '../lib/fileAnswer';
import logger from '../utils/logger';

/**
 * Reads a document's real metadata out of DMS.
 *
 * This is the bridge between the pure validation code in `lib/` and the service
 * that talks to DMS. `lib/fileAnswer.ts` takes a lookup function rather than
 * importing this module so that the rules can be exercised without a DMS
 * instance — which is how the tampering cases in this file's tests are run.
 *
 * Every failure resolves to null, and null means "reject". Losing DMS should
 * cause file uploads to be refused, not silently believed.
 */

function pick(...candidates: unknown[]): string | undefined {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim() !== '') return candidate.trim();
  }
  return undefined;
}

function pickNumber(...candidates: unknown[]): number | undefined {
  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value >= 0) return value;
  }
  return undefined;
}

/**
 * DMS has returned the same document under a few different envelope shapes over
 * time (`{document: {...}}`, the document itself, metadata nested or flat).
 * Rather than guess one, read whichever is present — but only from the
 * response, never from the request.
 */
export function readDocumentFacts(documentId: string, raw: any): DocumentFacts | null {
  if (!raw || typeof raw !== 'object') return null;
  const doc = raw.document && typeof raw.document === 'object' ? raw.document : raw;
  const metadata = doc.metadata && typeof doc.metadata === 'object' ? doc.metadata : {};

  const size = pickNumber(doc.size, doc.fileSize, doc.currentVersion?.size);
  const filename = pick(doc.originalFilename, doc.filename, doc.name, metadata.filename);
  const mimeType = pick(doc.mimeType, doc.contentType, metadata.mimeType);

  // A document that has been initiated but never uploaded has no size yet.
  // Accepting it would let a caller reference an empty placeholder as if it
  // were their CV.
  if (size === undefined || filename === undefined) return null;

  const status = pick(doc.status, doc.state);
  if (status && ['pending', 'initiated', 'deleted', 'quarantined'].includes(status.toLowerCase())) {
    return null;
  }

  return {
    documentId,
    filename,
    mimeType: mimeType ?? 'application/octet-stream',
    size,
    formId: pick(metadata.formId, doc.folderVars?.formId),
    fieldId: pick(metadata.fieldId),
    status,
  };
}

/** The lookup handed to `verifyFileAnswer`, or undefined when DMS is off. */
export function createDocumentLookup(): DocumentLookup | undefined {
  if (!DMS_ENABLED) return undefined;

  // One document is commonly referenced by several fields in one submission
  // (and by the same field twice). Cache per submission so verification costs
  // one DMS call per distinct document, not one per reference.
  const cache = new Map<string, Promise<DocumentFacts | null>>();

  return (documentId: string) => {
    const hit = cache.get(documentId);
    if (hit) return hit;

    const pending = dmsService
      .getDocument(documentId)
      .then((raw) => readDocumentFacts(documentId, raw))
      .catch((error) => {
        logger.error('DMS --> document verification failed', { documentId, message: error?.message });
        return null;
      });

    cache.set(documentId, pending);
    return pending;
  };
}
