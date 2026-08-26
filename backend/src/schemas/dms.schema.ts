import { z } from 'zod';

export const InitiateUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().optional(),
  size: z.number().int().positive().optional(),
  context: z.enum(['submission', 'support-doc', 'branding', 'signature']),
  orgId: z.string().min(1),
  formId: z.string().min(1),
  fieldId: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

export const PublicInitiateUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().optional(),
  size: z.number().int().positive().optional(),
  formId: z.string().min(1),
  fieldId: z.string().min(1),
  idempotencyKey: z.string().optional(),
});

export const ConfirmUploadSchema = z.object({
  size: z.number().int().positive().optional(),
  checksum: z.string().optional(),
});

export const DownloadSchema = z.object({
  versionNumber: z.number().int().optional(),
});

export const PublicDownloadSchema = z.object({
  formId: z.string().min(1),
  versionNumber: z.number().int().optional(),
});
