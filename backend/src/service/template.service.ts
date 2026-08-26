import { templateDao } from '../dao/factory/templateDao.factory';
import { formDao } from '../dao/factory/formDao.factory';
import { teamDao } from '../dao/factory/teamDao.factory';
import { TemplateRecord } from '../dao/interfaces/TemplateDao';
import { generateSlug } from '../utils/slug';
import { createError } from '../utils/errors';

function parseTemplate(t: TemplateRecord) {
  return {
    ...t,
    type: t.isStatic ? 'static' : 'organization',
    schema: typeof t.schema === 'string' ? JSON.parse(t.schema) : t.schema,
    settings: typeof t.settings === 'string' ? JSON.parse(t.settings) : t.settings,
  };
}

export async function listTemplates(orgId: string) {
  const templates = await templateDao.findTemplatesByOrg(orgId);
  return templates.map(parseTemplate);
}

export async function getTemplate(id: string) {
  const template = await templateDao.findTemplateById(id);
  if (!template) {
    throw createError(404, 'Template not found');
  }
  return parseTemplate(template);
}

export async function createTemplateFromForm(
  formId: string,
  orgId: string,
  userId: string,
  name?: string,
  category?: string,
) {
  const sourceForm = await formDao.findFormByIdAndOrg(formId, orgId);
  if (!sourceForm) {
    throw createError(404, 'Source form not found');
  }

  const template = await templateDao.createTemplate({
    orgId,
    name: name || sourceForm.name,
    description: sourceForm.description,
    category: category || 'custom',
    schema: sourceForm.schema,
    settings: sourceForm.settings,
    isStatic: false,
    createdBy: userId,
  });

  return { id: template.id, name: template.name, message: 'Form saved as template successfully' };
}

export async function duplicateTemplate(
  templateId: string,
  orgId: string,
  userId: string,
  name?: string,
  teamId?: string | null,
) {
  const template = await templateDao.findTemplateById(templateId);
  if (!template) {
    throw createError(404, 'Template not found');
  }

  if (!template.isStatic && template.orgId !== orgId) {
    throw createError(403, 'Forbidden: You do not have access to this template');
  }

  const formName = name || template.name;
  // A form created from a template needs a team like any other, otherwise it
  // lands outside every permission scope.
  const targetTeam = teamId
    ? (await teamDao.findTeamById(teamId))?.orgId === orgId
      ? teamId
      : null
    : (await teamDao.findDefaultTeam(orgId))?.id ?? null;

  const newForm = await formDao.createForm({
    orgId,
    teamId: targetTeam,
    name: formName,
    slug: `${generateSlug(formName)}-${Date.now()}`,
    description: template.description,
    schema: template.schema,
    settings: template.settings,
    isPublished: false,
    createdBy: userId,
  });

  return newForm;
}
