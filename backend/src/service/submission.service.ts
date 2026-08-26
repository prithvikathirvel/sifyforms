import { submissionDao } from '../dao/factory/submissionDao.factory';
import { formDao } from '../dao/factory/formDao.factory';
import { createError } from '../utils/errors';
import logger from '../utils/logger';
import { ACTIONS } from '../config/rbac.config';
import { assertResponseLevel, assertFormAction } from './formAccess.service';
import { viewSubmission, aggregateSubmissions } from './responseView.service';
import { validateSubmission } from '../lib/validation';
import { processAssessment } from '../services/assessment.processor';
import { checkVotingDuplicate, processVote } from '../services/voting.processor';
import { CreateSubmissionInput, UpdateSubmissionInput } from '../schemas/submission.schema';
import { SubmissionListFilter } from '../dao/interfaces/SubmissionDao';
import axios from 'axios';

export async function createSubmission(
  input: CreateSubmissionInput,
  ip: string | null,
  userAgent: string | null,
) {
  const { formId, data, captchaProblem, captchaAnswer } = input;

  const form = await formDao.findFormById(formId);
  if (!form || !form.isPublished) throw createError(404, 'Form not found or not published');

  const schema = JSON.parse(form.schema);
  const settings = JSON.parse(form.settings);

  if (settings.isFormActive === false) throw createError(403, 'This form is no longer accepting submissions.');
  if (settings.expirationDateTime && new Date() > new Date(settings.expirationDateTime)) {
    throw createError(403, 'This form has expired.');
  }

  // CAPTCHA verification
  let captchaActual = null;
  if (settings.reCaptcha) {
    if (!captchaProblem || !captchaAnswer) throw createError(400, 'Security verification is required');
    try {
      const parts = captchaProblem.split(' ');
      const num1 = parseInt(parts[0]);
      const op = parts[1];
      const num2 = parseInt(parts[2]);
      const answer = op === '+' ? num1 + num2 : num1 - num2;
      captchaActual = { text: captchaProblem, answer };
    } catch {
      throw createError(400, 'Invalid security challenge');
    }
  }

  // Field validation
  const validation = await validateSubmission(schema, data, captchaActual, captchaAnswer);
  if (!validation.valid) {
    throw Object.assign(createError(400, 'Validation failed'), { details: validation.errors });
  }
  const finalData = validation.data;

  // Voting duplicate prevention
  if (settings.formType === 'voting' && settings.voting?.duplicatePrevention !== 'none') {
    const method = settings.voting?.duplicatePrevention ?? 'ip';
    let identifier = '';
    if (method === 'ip') {
      identifier = ip || 'unknown';
    } else if (method === 'email') {
      const emailField = (schema.fields ?? []).find((f: any) => f.type === 'email');
      identifier = emailField ? String(finalData[emailField.id] ?? '') : '';
    }
    if (identifier) {
      const duplicateError = await checkVotingDuplicate(formId, identifier);
      if (duplicateError) throw Object.assign(createError(400, duplicateError), { code: 'ALREADY_VOTED' });
    }
  }

  // Server-side uniqueness check
  const uniqueFields = (schema.fields || []).filter((f: any) => f.unique);
  if (uniqueFields.length > 0) {
    const existing = await submissionDao.findSubmissionDataByFormId(formId);
    for (const field of uniqueFields) {
      const newValue = finalData[field.id];
      if (newValue === undefined || newValue === null || newValue === '') continue;
      const isDuplicate = existing.some(s => {
        try { return String(JSON.parse(s.data)[field.id]) === String(newValue); } catch { return false; }
      });
      if (isDuplicate) throw createError(400, `The value for "${field.label}" must be unique.`);
    }
  }

  const submission = await submissionDao.createSubmission({
    formId,
    data: JSON.stringify(finalData),
    ip,
    userAgent,
  });

  // People answered under the terms shown on the form at this moment, so freeze
  // the response policy: it cannot be widened after the fact.
  const ownership = await formDao.findFormOwnership(formId);
  if (ownership && !ownership.responsePolicyLockedAt) {
    await formDao.updateForm(formId, { responsePolicyLockedAt: new Date() });
  }

  // Fire-and-forget post-submission processing
  if (settings.formType === 'assessment') {
    setImmediate(() => processAssessment(submission.id));
  } else if (settings.formType === 'voting') {
    const method = settings.voting?.duplicatePrevention ?? 'ip';
    let identifier = '';
    if (method === 'ip') identifier = ip || 'unknown';
    else if (method === 'email') {
      const emailField = (schema.fields ?? []).find((f: any) => f.type === 'email');
      identifier = emailField ? String(finalData[emailField.id] ?? '') : '';
    }
    setImmediate(() => processVote(submission.id, identifier));
  }

  const redirectUrl = settings.redirectUrl || null;
  const safeRedirectUrl = (redirectUrl && /^(https?:\/\/)/i.test(redirectUrl)) ? redirectUrl : null;

  return {
    success: true,
    submissionId: submission.id,
    thankYouMessage: settings.thankYouMessage || 'Thank you for your submission!',
    redirectUrl: safeRedirectUrl,
  };
}

export async function checkFieldUniqueness(formId: string, fieldId: string, value: unknown) {
  const submissions = await submissionDao.findSubmissionDataByFormId(formId);
  const isUnique = !submissions.some(s => {
    try { return JSON.parse(s.data)[fieldId] === value; } catch { return false; }
  });
  return { isUnique };
}

export async function listSubmissions(
  formId: string, orgId: string, userId: string,
  page: number, limit: number,
  status?: string, search?: string,
  startDate?: string, endDate?: string,
) {
  const form = await formDao.findFormByIdAndOrg(formId, orgId);
  if (!form) throw createError(404, 'Form not found');

  // REDACTED is the floor for seeing rows at all. Anyone below it is either
  // aggregate-only or has no response access, and must use /aggregate instead.
  const access = await assertResponseLevel(userId, orgId, formId, 'REDACTED');
  const schema = JSON.parse(form.schema);

  const filter: SubmissionListFilter = {};
  if (status === 'read') filter.isRead = true;
  else if (status === 'unread') filter.isRead = false;
  if (startDate) filter.createdAtGte = new Date(startDate);
  if (endDate) filter.createdAtLte = new Date(endDate);

  const skip = (page - 1) * limit;

  const [submissions, total] = await Promise.all([
    submissionDao.findSubmissionsByFormId(formId, skip, limit, filter),
    submissionDao.countSubmissionsByFormId(formId, filter),
  ]);

  // Shaped before anything else touches it, so no unredacted value can leak
  // through a later code path such as search.
  let result = submissions
    .map(s => viewSubmission(s, schema, access.level, access.policy))
    .filter((s): s is NonNullable<typeof s> => s !== null);

  if (search) {
    const searchLower = search.toLowerCase();
    result = result.filter(s => JSON.stringify(s.data).toLowerCase().includes(searchLower));
  }

  return {
    submissions: result,
    access: { level: access.level, policy: access.policy },
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/**
 * Counts and distributions, with no individual response leaving the server.
 *
 * This is what an aggregate-only viewer gets, and it is the reason the AGGREGATE
 * tier is worth having: real insight from a form nobody may read row by row.
 */
export async function getSubmissionAggregate(formId: string, orgId: string, userId: string) {
  const form = await formDao.findFormByIdAndOrg(formId, orgId);
  if (!form) throw createError(404, 'Form not found');

  const access = await assertResponseLevel(userId, orgId, formId, 'AGGREGATE');
  const submissions = await submissionDao.findSubmissionsForExport(formId);
  const summary = aggregateSubmissions(formId, submissions, JSON.parse(form.schema));

  return { ...summary, formName: form.name, access: { level: access.level, policy: access.policy } };
}

export async function getSubmission(
  submissionId: string, formId: string, orgId: string, userId: string
) {
  const form = await formDao.findFormByIdAndOrg(formId, orgId);
  if (!form) throw createError(404, 'Form not found');

  const access = await assertResponseLevel(userId, orgId, formId, 'REDACTED');

  const submission = await submissionDao.findSubmissionByIdAndForm(submissionId, formId);
  if (!submission) throw createError(404, 'Submission not found');

  if (!submission.isRead) await submissionDao.markSubmissionAsRead(submissionId);

  const viewed = viewSubmission(submission, JSON.parse(form.schema), access.level, access.policy);
  if (!viewed) throw createError(403, 'You cannot view individual responses to this form');
  return viewed;
}

export async function updateSubmission(
  submissionId: string, formId: string, orgId: string, userId: string, updates: UpdateSubmissionInput,
) {
  const form = await formDao.findFormByIdAndOrg(formId, orgId);
  if (!form) throw createError(404, 'Form not found');

  // Editing response content requires seeing it unmasked; writing over a
  // redacted view would destroy the values the mask was hiding.
  const editsContent = updates.data !== undefined;
  await assertResponseLevel(userId, orgId, formId, editsContent ? 'FULL' : 'REDACTED');

  const submission = await submissionDao.findSubmissionByIdAndForm(submissionId, formId);
  if (!submission) throw createError(404, 'Submission not found');

  const updateData: { data?: string; isRead?: boolean; tags?: string } = {};
  if (updates.data !== undefined) updateData.data = JSON.stringify(updates.data);
  if (updates.isRead !== undefined) updateData.isRead = updates.isRead;
  if (updates.tags !== undefined) updateData.tags = JSON.stringify(updates.tags);

  const updated = await submissionDao.updateSubmission(submissionId, updateData);
  return { ...updated, data: JSON.parse(updated.data), tags: JSON.parse(updated.tags) };
}

export async function deleteSubmission(
  submissionId: string, formId: string, orgId: string, userId: string
) {
  const form = await formDao.findFormByIdAndOrg(formId, orgId);
  if (!form) throw createError(404, 'Form not found');

  await assertFormAction(userId, orgId, formId, ACTIONS.DELETE_RESPONSES);

  const submission = await submissionDao.findSubmissionByIdAndForm(submissionId, formId);
  if (!submission) throw createError(404, 'Submission not found');

  await submissionDao.deleteSubmissionById(submissionId);
  return { message: 'Submission deleted successfully' };
}

export async function exportSubmissions(
  formId: string, orgId: string, userId: string, format: string = 'json', ids?: string[]
) {
  const form = await formDao.findFormByIdAndOrg(formId, orgId);
  if (!form) throw createError(404, 'Form not found');

  // EXPORT is its own tier rather than a consequence of FULL: this is the point
  // at which the data leaves the platform, so it is granted and logged apart.
  const access = await assertResponseLevel(userId, orgId, formId, 'EXPORT');
  logger.info('Submission export', {
    userId, orgId, formId, format, count: ids ? ids.length : 'all', policy: access.policy,
  });

  const submissions = await submissionDao.findSubmissionsForExport(formId, ids);
  const data = submissions.map(s => ({
    id: s.id,
    ...JSON.parse(s.data),
    submittedAt: s.createdAt,
    isRead: s.isRead,
  }));

  if (format === 'csv') {
    if (data.length === 0) return { format: 'csv' as const, formName: form.name, csvContent: 'No submissions' };
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map((row: Record<string, unknown>) =>
        headers.map(h => {
          const val = row[h];
          if (val === null || val === undefined) return '';
          if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
          return `"${String(val).replace(/"/g, '""')}"`;
        }).join(',')
      ),
    ];
    return { format: 'csv' as const, formName: form.name, csvContent: csvRows.join('\n') };
  }

  return { format: 'json' as const, formName: form.name, data };
}

export async function bulkDeleteSubmissions(
  formId: string, orgId: string, userId: string, ids: string[]
) {
  const form = await formDao.findFormByIdAndOrg(formId, orgId);
  if (!form) throw createError(404, 'Form not found');

  await assertFormAction(userId, orgId, formId, ACTIONS.DELETE_RESPONSES);

  await submissionDao.bulkDeleteSubmissions(formId, ids);
  return { message: `${ids.length} submissions deleted successfully` };
}

export async function checkExternalValidation(
  formId: string,
  fieldId: string,
  value: unknown,
  formData?: Record<string, unknown>,
) {
  const form = await formDao.findFormById(formId);
  if (!form) throw createError(404, 'Form not found');

  const schema = JSON.parse(form.schema);
  const field = schema.fields.find((f: any) => f.id === fieldId);

  if (!field || !field.externalValidation?.enabled) return { isValid: true };

  const config = field.externalValidation;
  const payload: Record<string, unknown> = {};
  payload[config.fieldValueKey || 'value'] = value;

  if (config.params && Array.isArray(config.params)) {
    config.params.forEach((param: any) => {
      if (!param.key) return;
      if (param.type === 'static') payload[param.key] = param.value;
      else if (param.type === 'field' && formData) payload[param.key] = formData[param.value];
    });
  }

  const headers: Record<string, string> = {};
  (config.headers ?? []).forEach((h: any) => { if (h.key) headers[h.key] = h.value; });
  if (config.auth?.type === 'bearer' && config.auth.token) {
    headers['Authorization'] = `Bearer ${config.auth.token}`;
  } else if (config.auth?.type === 'basic' && config.auth.username && config.auth.password) {
    headers['Authorization'] = `Basic ${Buffer.from(`${config.auth.username}:${config.auth.password}`).toString('base64')}`;
  } else if (config.auth?.type === 'custom' && config.auth.customHeaderName && config.auth.token) {
    headers[config.auth.customHeaderName] = config.auth.token;
  }

  try {
    const isGet = (config.method || 'POST').toUpperCase() === 'GET';
    const response = await axios({ url: config.url, method: config.method || 'POST', headers, [isGet ? 'params' : 'data']: payload, timeout: 5000 });

    let extracted = response.data;
    const responseCheck = config.responseCheck;
    const checkType = responseCheck?.type || responseCheck?.logic || 'boolean';
    const path = responseCheck?.path || config.successPath;
    if (path) extracted = path.split('.').reduce((obj: any, k: string) => obj?.[k], response.data);

    let isValid = true;
    switch (checkType) {
      case 'boolean':    isValid = Boolean(extracted); break;
      case 'equals':     isValid = String(extracted) === String(responseCheck?.targetValue); break;
      case 'notEquals':  isValid = String(extracted) !== String(responseCheck?.targetValue); break;
      case 'contains':   isValid = String(extracted).includes(String(responseCheck?.targetValue)); break;
      case 'notContains':isValid = !String(extracted).includes(String(responseCheck?.targetValue)); break;
      case 'regex':      try { isValid = new RegExp(String(responseCheck?.targetValue)).test(String(extracted)); } catch { isValid = false; } break;
      case 'greaterThan':isValid = Number(extracted) > Number(responseCheck?.targetValue); break;
      case 'lessThan':   isValid = Number(extracted) < Number(responseCheck?.targetValue); break;
      case 'exists':     isValid = extracted !== undefined && extracted !== null; break;
      default:           isValid = Boolean(extracted);
    }

    return { isValid, message: isValid ? (config.successMsg || 'Verified') : (config.errorMsg || 'Validation failed') };
  } catch {
    return { isValid: false, message: config.errorMsg || 'Could not reach validation server' };
  }
}
