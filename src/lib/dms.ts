import { api } from './api';
import axios from 'axios';
import type { DmsFileReference } from '../types';

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
