import { api } from './api';
import axios from 'axios';
import type { DmsFileReference, PendingLocalFile, FormFileValue } from '../types';

interface InitiateResponse {
  documentId: string;
  uploadUrl: string;
  uploadMethod: string;
  uploadHeaders: Record<string, string>;
  expiresAt: string;
}

interface InitiateParams {
  filename: string;
  mimeType?: string;
  size?: number;
  context: 'submission' | 'support-doc' | 'branding' | 'signature';
  orgId: string;
  formId: string;
  fieldId?: string;
  idempotencyKey?: string;
}

interface PublicInitiateParams {
  filename: string;
  mimeType?: string;
  size?: number;
  formId: string;
  fieldId: string;
  idempotencyKey?: string;
}

export function isPendingLocalFile(value: unknown): value is PendingLocalFile {
  if (!value || typeof value !== 'object') return false;
  const v = value as PendingLocalFile;
  return v.status === 'pending' && typeof v.pendingId === 'string' && v.file instanceof File;
}

export function isDmsFileReference(value: unknown): value is DmsFileReference {
  if (!value || typeof value !== 'object') return false;
  const v = value as DmsFileReference & { pendingId?: string };
  return typeof v.documentId === 'string' && v.documentId.length > 0 && !v.pendingId;
}

export function toSerializableDmsRef(ref: DmsFileReference): DmsFileReference {
  return {
    documentId: ref.documentId,
    filename: ref.filename,
    mimeType: ref.mimeType,
    size: ref.size,
    status: ref.status || 'active',
  };
}

/**
 * field.fileConfig.maxSize is stored in bytes (builder UI).
 * form settings dms.maxFileSize is stored in MB.
 * Values <= 1024 are treated as MB; larger values as bytes.
 */
export function resolveMaxSizeBytes(maxSize?: number): number | undefined {
  if (maxSize == null || maxSize <= 0) return undefined;
  return maxSize > 1024 ? maxSize : maxSize * 1024 * 1024;
}

export function dataUrlToFile(dataUrl: string, filename: string): File {
  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid data URL');
  }
  const mimeType = matches[1];
  const binary = atob(matches[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], filename, { type: mimeType });
}

export async function triggerBrowserDownload(url: string, filename?: string): Promise<void> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Download failed');
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename || 'download';
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export function downloadLocalFile(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function initiateUpload(params: InitiateParams): Promise<InitiateResponse> {
  const { data } = await api.post<InitiateResponse>('/dms/upload/initiate', params);
  return data;
}

export async function publicInitiateUpload(params: PublicInitiateParams): Promise<InitiateResponse> {
  const { data } = await api.post<InitiateResponse>('/dms/upload/public-initiate', params);
  return data;
}

export async function uploadToPresignedUrl(
  url: string,
  file: File,
  method: string,
  headers: Record<string, string>,
  onProgress?: (percent: number) => void,
): Promise<void> {
  await axios({
    method: (method || 'PUT') as any,
    url,
    data: file,
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      ...headers,
    },
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded * 100) / e.total));
      }
    },
  });
}

export async function confirmUpload(documentId: string, isPublic = false): Promise<void> {
  const path = isPublic
    ? `/dms/upload/public-confirm/${documentId}`
    : `/dms/upload/confirm/${documentId}`;
  await api.post(path, {});
}

export async function getDownloadUrl(documentId: string): Promise<string> {
  const { data } = await api.post<{ url: string }>(`/dms/download/${documentId}`, {});
  return data.url;
}

export async function getPublicDownloadUrl(documentId: string, formId: string): Promise<string> {
  const { data } = await api.post<{ url: string }>(`/dms/download/public/${documentId}`, { formId });
  return data.url;
}

export async function getPreviewUrl(documentId: string): Promise<string> {
  const { data } = await api.post<{ url: string }>(`/dms/preview/${documentId}`, {});
  return data.url;
}

/**
 * Full 3-step upload flow for public form respondents.
 */
export async function uploadFilePublic(
  file: File,
  formId: string,
  fieldId: string,
  onProgress?: (percent: number) => void,
): Promise<DmsFileReference> {
  const session = await publicInitiateUpload({
    filename: file.name,
    mimeType: file.type,
    size: file.size,
    formId,
    fieldId,
  });

  await uploadToPresignedUrl(
    session.uploadUrl,
    file,
    session.uploadMethod,
    session.uploadHeaders,
    onProgress,
  );

  await confirmUpload(session.documentId, true);

  return {
    documentId: session.documentId,
    filename: file.name,
    mimeType: file.type,
    size: file.size,
    status: 'active',
  };
}

/**
 * Full 3-step upload flow for authenticated users (builder context).
 */
export async function uploadFileAuthenticated(
  file: File,
  context: 'submission' | 'support-doc' | 'branding' | 'signature',
  orgId: string,
  formId: string,
  onProgress?: (percent: number) => void,
): Promise<DmsFileReference> {
  const session = await initiateUpload({
    filename: file.name,
    mimeType: file.type,
    size: file.size,
    context,
    orgId,
    formId,
  });

  await uploadToPresignedUrl(
    session.uploadUrl,
    file,
    session.uploadMethod,
    session.uploadHeaders,
    onProgress,
  );

  await confirmUpload(session.documentId, false);

  return {
    documentId: session.documentId,
    filename: file.name,
    mimeType: file.type,
    size: file.size,
    status: 'active',
  };
}

function extractFile(item: unknown): File | null {
  if (item instanceof File) return item;
  if (isPendingLocalFile(item)) return item.file;
  return null;
}

/**
 * Upload any locally-held files for a file field. Already-uploaded DMS
 * references are passed through unchanged.
 */
export async function resolveFilesForSubmission(
  value: unknown,
  formId: string,
  fieldId: string,
): Promise<DmsFileReference[] | null> {
  if (value == null || value === '') return null;

  const items: unknown[] = Array.isArray(value)
    ? value
    : value instanceof FileList
      ? Array.from(value)
      : [value];

  if (items.length === 0) return null;

  const results: DmsFileReference[] = [];
  for (const item of items) {
    if (isDmsFileReference(item)) {
      results.push(toSerializableDmsRef(item));
      continue;
    }
    const file = extractFile(item);
    if (file) {
      results.push(await uploadFilePublic(file, formId, fieldId));
    }
  }
  return results.length > 0 ? results : null;
}

/**
 * Upload a locally-captured signature (data URL or pending file) to DMS.
 */
export async function resolveSignatureForSubmission(
  value: unknown,
  formId: string,
  fieldId: string,
): Promise<DmsFileReference | string | null> {
  if (value == null || value === '') return null;
  if (isDmsFileReference(value)) return toSerializableDmsRef(value);

  const file = extractFile(value);
  if (file) {
    return uploadFilePublic(file, formId, fieldId);
  }

  if (typeof value === 'string' && value.startsWith('data:')) {
    const uploaded = await uploadFilePublic(
      dataUrlToFile(value, `signature-${fieldId}.png`),
      formId,
      fieldId,
    );
    return uploaded;
  }

  return value as any;
}

export function createPendingLocalFile(file: File): PendingLocalFile {
  return {
    pendingId: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
    filename: file.name,
    mimeType: file.type,
    size: file.size,
    status: 'pending',
    file,
  };
}

export type { FormFileValue };
