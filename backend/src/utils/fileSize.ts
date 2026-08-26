/**
 * field.fileConfig.maxSize is stored in bytes by the builder UI.
 * form settings dms.maxFileSize is stored in MB.
 * Values <= 1024 are treated as MB; larger values as bytes.
 */
export function resolveMaxSizeBytes(maxSize?: number): number | undefined {
  if (maxSize == null || maxSize <= 0) return undefined;
  return maxSize > 1024 ? maxSize : maxSize * 1024 * 1024;
}
