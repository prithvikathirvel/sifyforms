export const DMS_ENABLED = process.env.DMS_ENABLED === 'true';

export const DMS_BASE_URL =
  process.env.DMS_BASE_URL || 'https://apidev.sifymodernization.digital/dms/api';

export const DMS_API_KEY = process.env.DMS_API_KEY || '';

export const DMS_TENANT_ID = process.env.DMS_TENANT_ID || '';

export const DMS_FOLDER_MAP_SUBMISSIONS =
  process.env.DMS_FOLDER_MAP_SUBMISSIONS || 'submissions';

export const DMS_FOLDER_MAP_SUPPORT_DOCS =
  process.env.DMS_FOLDER_MAP_SUPPORT_DOCS || 'support-docs';

export const DMS_FOLDER_MAP_BRANDING =
  process.env.DMS_FOLDER_MAP_BRANDING || 'branding';

export const DMS_FOLDER_MAP_SIGNATURE =
  process.env.DMS_FOLDER_MAP_SIGNATURE || 'signatures';

// Max signed URL TTL before re-requesting (seconds)
export const DMS_SIGNED_URL_TTL = Number(process.env.DMS_SIGNED_URL_TTL || 900);
