import { formDao } from '../dao/factory/formDao.factory';
import { orgDao } from '../dao/factory/orgDao.factory';
import { teamDao } from '../dao/factory/teamDao.factory';
import { submissionDao } from '../dao/factory/submissionDao.factory';
import { ACTIONS, RESPONSE_POLICIES, ResponsePolicy } from '../config/rbac.config';
import { reachableTeamIds, loadForm } from './formAccess.service';
import { getEffectivePermissions } from './permission.service';
import { CreateFormInput, UpdateFormInput } from '../schemas/form.schema';
import { generateFormSlug } from '../utils/slug';
import { createError } from '../utils/errors';
import { aiService } from './ai.service';
import { parseCSVFromBuffer } from '../utils/csv';

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseForm<T extends { schema: string; settings: string }>(form: T) {
  return {
    ...form,
    schema: JSON.parse(form.schema),
    settings: JSON.parse(form.settings),
  };
}

/**
 * The published schema must not expose any external-validation internals. The
 * respondent's browser only needs `enabled` (to trigger the live check); the
 * URL, method, auth, headers, params, response-check logic and messages are all
 * re-read server-side from the database by `checkExternalValidation`.
 */

/** Remove assessment and external-validation secrets before a published schema leaves the server. */
function sanitizePublicSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const fields = Array.isArray(schema.fields) ? schema.fields : [];
  return {
    ...schema,
    fields: fields.map((field) => {
      if (!field || typeof field !== 'object' || Array.isArray(field)) return field;
      const safeField = { ...(field as Record<string, unknown>) };

      // Assessment scoring secrets
      delete safeField.correctAnswer;
      delete safeField.points;
      delete safeField.section;

      // External-validation internals. We keep only `enabled`; everything else
      // (endpoint, credentials, response checks) is re-read from the DB at
      // request time, so validation behaviour is unchanged.
      if (safeField.externalValidation && typeof safeField.externalValidation === 'object') {
        const ev = safeField.externalValidation as Record<string, unknown>;
        const safe = { enabled: ev.enabled === true };
        safeField.externalValidation = safe;
      }

      return safeField;
    }),
  };
}

/** Expose only the assessment flags the respondent UI needs. */
function sanitizePublicSettings(settings: Record<string, unknown>): Record<string, unknown> {
  if (!settings.assessment || typeof settings.assessment !== 'object' || Array.isArray(settings.assessment)) {
    return settings;
  }
  const assessment = settings.assessment as Record<string, unknown>;
  return {
    ...settings,
    assessment: {
      showScoreAfterSubmit: assessment.showScoreAfterSubmit === true,
      showCorrectAnswers:
        assessment.showScoreAfterSubmit === true && assessment.showCorrectAnswers === true,
    },
  };
}

async function generateUniqueSlug(orgId: string): Promise<string> {
  let slug = generateFormSlug();
  for (let attempts = 0; attempts < 5; attempts++) {
    const existing = await formDao.findFormBySlugUnique(orgId, slug);
    if (!existing) return slug;
    slug = generateFormSlug();
  }
  return slug;
}

// ─── Service functions ───────────────────────────────────────────────────────

/**
 * The team a new form belongs to: the one asked for, else the organization's
 * General team. A form with no team would be governed by nothing.
 */
async function resolveTeamId(orgId: string, requested?: string | null): Promise<string | null> {
  if (requested) {
    const team = await teamDao.findTeamById(requested);
    if (!team || team.orgId !== orgId) throw createError(404, 'Team not found');
    return team.id;
  }
  const fallback = await teamDao.findDefaultTeam(orgId);
  return fallback?.id ?? null;
}

export async function createForm(input: CreateFormInput, orgId: string, userId: string) {
  const slug = await generateUniqueSlug(orgId);
  const teamId = await resolveTeamId(orgId, input.teamId);
  const form = await formDao.createForm({
    orgId,
    teamId,
    name: input.name,
    slug,
    description: input.description ?? null,
    schema: JSON.stringify(input.schema),
    settings: JSON.stringify(input.settings || {}),
    isPublished: false,
    createdBy: userId,
  });
  return parseForm(form);
}

/**
 * Forms the caller can reach.
 *
 * `seeAllTeams` is for organization admins; everyone else sees the forms of the
 * teams they belong to and of every team beneath those, because a team role
 * inherits downward.
 */
export async function listForms(orgId: string, userId: string, seeAllTeams: boolean) {
  const forms = seeAllTeams
    ? await formDao.findFormsByOrg(orgId)
    : await formDao.findFormsByTeams(orgId, await reachableTeamIds(orgId, userId), false);

  // What the viewer may do with each form, so the client can hide the controls
  // it would only be refused on. Resolved per team rather than per form -
  // permissions are identical for every form in a team, and the underlying
  // lookup is cached per (user, team) anyway.
  const teamIds = [...new Set(forms.map(f => f.teamId ?? ''))];
  const byTeam = new Map<string, string[]>();
  await Promise.all(
    teamIds.map(async teamId => {
      const effective = await getEffectivePermissions(userId, orgId, teamId || undefined);
      byTeam.set(teamId, effective.actions);
    })
  );

  return forms.map(form => {
    const actions = byTeam.get(form.teamId ?? '') ?? [];
    return {
      ...parseForm(form),
      submissionCount: form._count.submissions,
      access: {
        canEdit: actions.includes(ACTIONS.EDIT_FORM),
        canDelete: actions.includes(ACTIONS.DELETE_FORM),
        canPublish: actions.includes(ACTIONS.PUBLISH_FORM),
        canShare: actions.includes(ACTIONS.SHARE_FORM),
        canMove: actions.includes(ACTIONS.MOVE_FORM),
        // Anything at or above REDACTED can open individual responses; below
        // that the submissions screen only has aggregate results to show.
        canViewResponses:
          actions.includes(ACTIONS.VIEW_RESPONSES_REDACTED) ||
          actions.includes(ACTIONS.VIEW_RESPONSES_FULL),
        canViewResults: actions.includes(ACTIONS.VIEW_AGGREGATE),
      },
    };
  });
}

/** Move a form to another team, handing it to that team's roles. */
export async function moveForm(formId: string, orgId: string, teamId: string | null) {
  await loadForm(formId, orgId);
  const target = await resolveTeamId(orgId, teamId);
  const updated = await formDao.updateForm(formId, { teamId: target });
  return parseForm(updated);
}

/**
 * Set the form's response-visibility policy.
 *
 * Locked once the first response arrives: people answered under the terms shown
 * at the time, and quietly widening access afterwards would break that.
 */
export async function setResponsePolicy(formId: string, orgId: string, policy: string) {
  if (!(RESPONSE_POLICIES as readonly string[]).includes(policy)) {
    throw createError(400, `Unknown response policy "${policy}". Expected one of: ${RESPONSE_POLICIES.join(', ')}`);
  }
  const form = await loadForm(formId, orgId);
  if (form.responsePolicyLockedAt) {
    throw createError(
      400,
      'This form already has responses, so its visibility policy is locked. Duplicate the form to collect under different terms.'
    );
  }
  const updated = await formDao.updateForm(formId, { responsePolicy: policy as ResponsePolicy });
  return parseForm(updated);
}

export async function getForm(formId: string, orgId: string) {
  const form = await formDao.findFormByIdAndOrgWithOrg(formId, orgId);
  if (!form) throw createError(404, 'Form not found');
  let parsedSchema: unknown;
  try { parsedSchema = JSON.parse(form.schema); }
  catch { parsedSchema = { fields: [], variables: [] }; }
  return {
    ...form,
    schema: parsedSchema,
    settings: JSON.parse(form.settings),
    submissionCount: form._count.submissions,
  };
}

export async function updateForm(formId: string, orgId: string, data: UpdateFormInput) {
  const form = await formDao.findFormByIdAndOrg(formId, orgId);
  if (!form) throw createError(404, 'Form not found');

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.schema !== undefined) updateData.schema = JSON.stringify(data.schema);
  if (data.settings !== undefined) updateData.settings = JSON.stringify(data.settings);
  if (data.isPublished !== undefined) updateData.isPublished = data.isPublished;

  const updated = await formDao.updateForm(formId, updateData);
  return parseForm(updated);
}

export async function deleteForm(formId: string, orgId: string) {
  const form = await formDao.findFormByIdAndOrg(formId, orgId);
  if (!form) throw createError(404, 'Form not found');
  await formDao.deleteForm(formId);
  return { message: 'Form deleted successfully' };
}

export async function duplicateForm(formId: string, orgId: string, userId: string, name?: string) {
  const sourceForm = await formDao.findFormByIdAndOrg(formId, orgId);
  if (!sourceForm) throw createError(404, 'Source form not found');

  const slug = await generateUniqueSlug(orgId);
  const duplicated = await formDao.createForm({
    orgId,
    // A copy stays in its original team, and starts with no responses, so its
    // policy is editable again.
    teamId: sourceForm.teamId,
    name: name || `${sourceForm.name} (Copy)`,
    slug,
    description: sourceForm.description,
    schema: sourceForm.schema,
    settings: sourceForm.settings,
    isPublished: false,
    createdBy: userId,
  });
  return parseForm(duplicated);
}

export async function publishForm(formId: string, orgId: string) {
  const form = await formDao.findFormByIdAndOrg(formId, orgId);
  if (!form) throw createError(404, 'Form not found');
  const updated = await formDao.publishForm(formId);
  return {
    ...parseForm(updated),
    publicUrl: `/${updated.org.slug}/${updated.slug}`,
  };
}

export async function getPublicForm(orgSlug: string, formSlug: string) {
  const org = await orgDao.findOrgBySlug(orgSlug);
  if (!org) throw createError(404, 'Organization not found');

  const form = await formDao.findPublicForm(org.id, formSlug);
  if (!form) throw createError(404, 'Form not found or not published');

  const settings = JSON.parse(form.settings) as Record<string, unknown>;
  if (settings.isFormActive === false) throw createError(403, 'This form is no longer accepting submissions.');
  if (
    typeof settings.expirationDateTime === 'string' &&
    new Date() > new Date(settings.expirationDateTime)
  ) {
    throw createError(403, 'This form has expired.');
  }

  return {
    id: form.id,
    name: form.name,
    description: form.description,
    schema: sanitizePublicSchema(JSON.parse(form.schema) as Record<string, unknown>),
    settings: sanitizePublicSettings(settings),
    org: form.org,
  };
}

/**
 * Dashboard figures.
 *
 * Scoped the same way the forms list is: an administrator sees the whole
 * organization, everyone else sees the teams they can reach. A dashboard that
 * counted forms the viewer cannot open would just be confusing.
 */
export async function getStats(orgId: string, userId: string, seeAllTeams: boolean) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const visibleForms = seeAllTeams
    ? await formDao.findFormsByOrg(orgId)
    : await formDao.findFormsByTeams(orgId, await reachableTeamIds(orgId, userId), false);

  const [org, teams, recentSubmissions] = await Promise.all([
    orgDao.findOrgWithUsersById(orgId),
    teamDao.findTeamsByOrg(orgId),
    submissionDao.countRecentSubmissionsByOrg(orgId, thirtyDaysAgo),
  ]);

  const totalSubmissions = visibleForms.reduce((sum, f) => sum + f._count.submissions, 0);

  // Ranked here rather than in the client so the client never has to hold the
  // full list to find the top few.
  const topForms = [...visibleForms]
    .filter(f => f._count.submissions > 0)
    .sort((a, b) => b._count.submissions - a._count.submissions)
    .slice(0, 4)
    .map(f => ({
      id: f.id,
      name: f.name,
      teamId: f.teamId,
      submissionCount: f._count.submissions,
      isPublished: f.isPublished,
    }));

  const recentForms = [...visibleForms]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 4)
    .map(f => ({
      id: f.id,
      name: f.name,
      teamId: f.teamId,
      submissionCount: f._count.submissions,
      isPublished: f.isPublished,
      updatedAt: f.updatedAt,
    }));

  // Which teams actually hold work, so the dashboard can show where activity sits.
  const byTeam = new Map<string, { forms: number; submissions: number }>();
  for (const form of visibleForms) {
    const key = form.teamId ?? 'unassigned';
    const entry = byTeam.get(key) ?? { forms: 0, submissions: 0 };
    entry.forms += 1;
    entry.submissions += form._count.submissions;
    byTeam.set(key, entry);
  }

  const teamBreakdown = teams
    .map(team => ({
      id: team.id,
      name: team.name,
      parentId: team.parentId,
      path: team.path,
      depth: team.depth,
      memberCount: team._count.members,
      forms: byTeam.get(team.id)?.forms ?? 0,
      submissions: byTeam.get(team.id)?.submissions ?? 0,
    }))
    // Materialized path keeps every parent immediately before its descendants.
    .sort((a, b) => a.path.localeCompare(b.path));

  return {
    totalForms: visibleForms.length,
    publishedForms: visibleForms.filter(f => f.isPublished).length,
    draftForms: visibleForms.filter(f => !f.isPublished).length,
    totalSubmissions,
    recentSubmissions,
    totalMembers: org?.users.length ?? 0,
    totalTeams: teams.length,
    topForms,
    recentForms,
    teamBreakdown,
  };
}

export async function generateFormWithAI(prompt: string) {
  try {
    return await aiService.generateForm({ prompt });
  } catch (aiError: any) {
    if (aiError.message?.includes('timeout')) throw createError(408, aiError.message);
    if (aiError.message?.includes('configuration')) throw createError(500, 'AI service not configured');
    throw createError(500, aiError.message || 'Failed to generate form with AI');
  }
}

export async function editFormWithAI(formId: string, orgId: string, prompt: string, sessionId?: string) {
  const form = await formDao.findFormByIdAndOrg(formId, orgId);
  if (!form) throw createError(404, 'Form not found');
  const currentSchema = JSON.parse(form.schema);
  const result = await aiService.editForm(currentSchema, prompt, sessionId);
  return { schema: result.formData.form, sessionId: result.sessionId };
}

export async function parseCSVData(buffer: Buffer) {
  const results = await parseCSVFromBuffer(buffer);
  if (results.length === 0) return { headers: [], rows: [], count: 0 };
  return { headers: Object.keys(results[0]), rows: results, count: results.length };
}
