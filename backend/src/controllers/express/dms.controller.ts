import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AuthRequest } from '../../middleware/auth.middleware';
import * as dmsService from '../../service/dms.service';
import { formDao } from '../../dao/factory/formDao.factory';
import {
  DMS_ENABLED,
  DMS_FOLDER_MAP_SUBMISSIONS,
  DMS_FOLDER_MAP_SUPPORT_DOCS,
  DMS_FOLDER_MAP_BRANDING,
  DMS_FOLDER_MAP_SIGNATURE,
} from '../../config/dms.config';
import logger from '../../utils/logger';

const CONTEXT_TO_FOLDER_MAP: Record<string, string> = {
  submission: DMS_FOLDER_MAP_SUBMISSIONS,
  'support-doc': DMS_FOLDER_MAP_SUPPORT_DOCS,
  branding: DMS_FOLDER_MAP_BRANDING,
  signature: DMS_FOLDER_MAP_SIGNATURE,
};

export async function initiateUpload(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!DMS_ENABLED) {
      res.status(StatusCodes.SERVICE_UNAVAILABLE).json({ error: 'DMS is not enabled on this server.' });
      return;
    }
    const { filename, mimeType, size, context, orgId, formId, idempotencyKey } = req.body;
    const folderMap = CONTEXT_TO_FOLDER_MAP[context];
    if (!folderMap) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: `Invalid context: ${context}` });
      return;
    }

    const result = await dmsService.initiateUpload({
      filename,
      mimeType,
      size,
      folderMap,
      folderVars: { orgId, formId },
      metadata: { orgId, formId },
      idempotencyKey,
      userId: req.user?.id,
    });

    res.status(StatusCodes.CREATED).json({
      documentId: result.document.id,
      uploadUrl: result.upload.url,
      uploadMethod: result.upload.method,
      uploadHeaders: result.upload.headers || {},
      expiresAt: result.upload.expiresAt,
    });
  } catch (error: any) {
    logger.error('DMS --> initiateUpload --> Error', error);
    const status = error.response?.status || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ error: error.response?.data?.message || error.message });
  }
}

export async function publicInitiateUpload(req: Request, res: Response): Promise<void> {
  try {
    if (!DMS_ENABLED) {
      res.status(StatusCodes.SERVICE_UNAVAILABLE).json({ error: 'DMS is not enabled on this server.' });
      return;
    }
    const { filename, mimeType, size, formId, fieldId, idempotencyKey } = req.body;

    // Validate form exists, is published, and has DMS enabled
    const form = await formDao.findFormById(formId);
    if (!form || !form.isPublished) {
      res.status(StatusCodes.NOT_FOUND).json({ error: 'Form not found or not published.' });
      return;
    }

    const settings = JSON.parse(form.settings || '{}');
    if (!settings.dms?.enabled) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: 'File storage is not enabled for this form.' });
      return;
    }

    // Validate field exists and is a file field
    const schema = JSON.parse(form.schema || '{}');
    const field = (schema.fields || []).find((f: any) => f.id === fieldId);
    if (!field || (field.type !== 'file' && field.type !== 'signature')) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: 'Invalid file field.' });
      return;
    }

    const folderMap = field.type === 'signature' ? DMS_FOLDER_MAP_SIGNATURE : DMS_FOLDER_MAP_SUBMISSIONS;

    // Validate file constraints from fileConfig
    if (field.fileConfig) {
      if (field.fileConfig.maxSize && size && size > field.fileConfig.maxSize * 1024 * 1024) {
        res.status(StatusCodes.BAD_REQUEST).json({
          error: `File size exceeds maximum allowed (${field.fileConfig.maxSize} MB).`,
        });
        return;
      }
      if (field.fileConfig.accept && field.fileConfig.accept.length > 0 && mimeType) {
        const accepted = field.fileConfig.accept as string[];
        const isAllowed = accepted.some((pattern: string) => {
          if (pattern.startsWith('.')) {
            return filename.toLowerCase().endsWith(pattern.toLowerCase());
          }
          if (pattern.endsWith('/*')) {
            return mimeType.startsWith(pattern.replace('/*', '/'));
          }
          return mimeType === pattern;
        });
        if (!isAllowed) {
          res.status(StatusCodes.BAD_REQUEST).json({ error: 'File type not allowed for this field.' });
          return;
        }
      }
    }

    // Also check form-level DMS limits
    if (settings.dms.maxFileSize && size && size > settings.dms.maxFileSize * 1024 * 1024) {
      res.status(StatusCodes.BAD_REQUEST).json({
        error: `File size exceeds form maximum (${settings.dms.maxFileSize} MB).`,
      });
      return;
    }
    if (settings.dms.allowedMimeTypes?.length && mimeType) {
      const allowed = settings.dms.allowedMimeTypes as string[];
      const isAllowed = allowed.some((pattern: string) => {
        if (pattern.endsWith('/*')) return mimeType.startsWith(pattern.replace('/*', '/'));
        return mimeType === pattern;
      });
      if (!isAllowed) {
        res.status(StatusCodes.BAD_REQUEST).json({ error: 'File type not allowed by form settings.' });
        return;
      }
    }

    const ownership = await formDao.findFormOwnership(formId);
    const orgId = ownership?.orgId || 'unknown';
    const result = await dmsService.initiateUpload({
      filename,
      mimeType,
      size,
      folderMap,
      folderVars: { orgId, formId },
      metadata: { orgId, formId, fieldId },
      idempotencyKey,
    });

    res.status(StatusCodes.CREATED).json({
      documentId: result.document.id,
      uploadUrl: result.upload.url,
      uploadMethod: result.upload.method,
      uploadHeaders: result.upload.headers || {},
      expiresAt: result.upload.expiresAt,
    });
  } catch (error: any) {
    logger.error('DMS --> publicInitiateUpload --> Error', error);
    const status = error.response?.status || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ error: error.response?.data?.message || error.message });
  }
}

export async function confirmUpload(req: Request, res: Response): Promise<void> {
  try {
    if (!DMS_ENABLED) {
      res.status(StatusCodes.SERVICE_UNAVAILABLE).json({ error: 'DMS is not enabled on this server.' });
      return;
    }
    const documentId = Array.isArray(req.params.documentId) ? req.params.documentId[0] : req.params.documentId;
    const { size, checksum } = req.body;

    const result = await dmsService.confirmUpload(documentId, { size, checksum });
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('DMS --> confirmUpload --> Error', error);
    const status = error.response?.status || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ error: error.response?.data?.message || error.message });
  }
}

export async function downloadUrl(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!DMS_ENABLED) {
      res.status(StatusCodes.SERVICE_UNAVAILABLE).json({ error: 'DMS is not enabled on this server.' });
      return;
    }
    const documentId = Array.isArray(req.params.documentId) ? req.params.documentId[0] : req.params.documentId;
    const { versionNumber } = req.body;

    const url = await dmsService.getDownloadUrl(documentId, versionNumber);
    res.status(StatusCodes.OK).json({ url });
  } catch (error: any) {
    logger.error('DMS --> downloadUrl --> Error', error);
    const status = error.response?.status || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ error: error.response?.data?.message || error.message });
  }
}

export async function previewUrl(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!DMS_ENABLED) {
      res.status(StatusCodes.SERVICE_UNAVAILABLE).json({ error: 'DMS is not enabled on this server.' });
      return;
    }
    const documentId = Array.isArray(req.params.documentId) ? req.params.documentId[0] : req.params.documentId;
    const { versionNumber } = req.body;

    const url = await dmsService.getPreviewUrl(documentId, versionNumber);
    res.status(StatusCodes.OK).json({ url });
  } catch (error: any) {
    logger.error('DMS --> previewUrl --> Error', error);
    const status = error.response?.status || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ error: error.response?.data?.message || error.message });
  }
}
