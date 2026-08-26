import axios from 'axios';
import {
  DMS_BASE_URL,
  DMS_API_KEY,
  DMS_TENANT_ID,
} from '../config/dms.config';

interface InitiateUploadParams {
  filename: string;
  mimeType?: string;
  size?: number;
  folderMap: string;
  folderVars: Record<string, string>;
  metadata?: Record<string, string>;
  idempotencyKey?: string;
  userId?: string;
}

interface UploadSession {
  document: {
    id: string;
    status: string;
    originalFilename: string;
    mimeType: string;
    size: number;
    [key: string]: any;
  };
  upload: {
    url: string;
    method: string;
    headers?: Record<string, string>;
    expiresAt: string;
  };
  replayed: boolean;
}

interface ConfirmUploadParams {
  size?: number;
  checksum?: string;
}

interface ConfirmedDocument {
  document: {
    id: string;
    status: string;
    currentVersion: number;
    [key: string]: any;
  };
}

interface DownloadSession {
  signedUrl?: { url: string; expiresAt: string };
  download?: { url: string };
}

function createDmsClient() {
  return axios.create({
    baseURL: DMS_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': DMS_API_KEY,
      'x-tenant-id': DMS_TENANT_ID,
    },
    timeout: 30_000,
  });
}

const client = createDmsClient();

export async function initiateUpload(params: InitiateUploadParams): Promise<UploadSession> {
  const body: Record<string, any> = {
    filename: params.filename,
    folderMap: params.folderMap,
    folderVars: params.folderVars,
  };
  if (params.mimeType) body.mimeType = params.mimeType;
  if (params.size) body.size = params.size;
  if (params.metadata) body.metadata = params.metadata;
  if (params.idempotencyKey) body.idempotencyKey = params.idempotencyKey;

  const headers: Record<string, string> = {};
  if (params.userId) headers['x-user-id'] = params.userId;

  const { data } = await client.post<UploadSession>('/documents', body, { headers });
  return data;
}

export async function confirmUpload(
  documentId: string,
  params?: ConfirmUploadParams,
): Promise<ConfirmedDocument> {
  const body: Record<string, any> = {};
  if (params?.size) body.size = params.size;
  if (params?.checksum) body.checksum = params.checksum;

  const { data } = await client.post<ConfirmedDocument>(
    `/documents/${encodeURIComponent(documentId)}/upload`,
    body,
  );
  return data;
}

export async function getDownloadUrl(
  documentId: string,
  versionNumber?: number,
): Promise<string> {
  const body: Record<string, any> = {};
  if (versionNumber !== undefined) body.versionNumber = versionNumber;

  const { data } = await client.post<DownloadSession>(
    `/documents/${encodeURIComponent(documentId)}/download`,
    body,
  );
  return data.signedUrl?.url || data.download?.url || '';
}

export async function getPreviewUrl(
  documentId: string,
  versionNumber?: number,
): Promise<string> {
  const body: Record<string, any> = {};
  if (versionNumber !== undefined) body.versionNumber = versionNumber;

  const { data } = await client.post<any>(
    `/documents/${encodeURIComponent(documentId)}/preview`,
    body,
  );
  return data.signedUrl?.url || '';
}

export async function getDocument(documentId: string): Promise<any | null> {
  try {
    const { data } = await client.get<{ document?: any } & Record<string, any>>(`/documents/${encodeURIComponent(documentId)}`);
    return data?.document || data;
  } catch {
    return null;
  }
}

export function extractDocumentOrgId(document: any): string | undefined {
  if (!document || typeof document !== 'object') return undefined;
  return (
    document.metadata?.orgId ||
    document.document?.metadata?.orgId ||
    document.folderVars?.orgId ||
    document.orgId
  );
}
