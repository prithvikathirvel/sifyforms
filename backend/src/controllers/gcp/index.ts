// Auth
export { registerUser, getSession, logout, updateProfile } from './auth.gcp';

// Draft
export { getDraft, saveDraft, deleteDraft } from './draft.gcp';

// Org
export { createOrg, listOrgs, getOrg, updateOrg, deleteOrg, listOrgUsers, inviteOrgUser, removeOrgUser } from './org.gcp';

// Template
export { listTemplates, getTemplate, createTemplateFromForm, duplicateTemplate } from './template.gcp';

// Processing
export { getSubmissionResultPublic, getPollResults, getSubmissionResult, getLeaderboard, getAssessmentAnalytics, getAuditLog } from './processing.gcp';

// Form
export { getPublicForm, createForm, listForms, getForm, updateForm, deleteForm, publishForm, duplicateForm, getFormStats, generateFormWithAI, editFormWithAI } from './form.gcp';

// Submission
export { createSubmission, checkFieldUniqueness, checkExternalValidation, listSubmissions, getSubmission, updateSubmission, deleteSubmission, exportSubmissions, bulkDeleteSubmissions } from './submission.gcp';

// ─── Notes ───────────────────────────────────────────────────────────────────
// Exports are required for GCF deployment — each function is deployed by name:
//   gcloud functions deploy registerUser --entry-point=registerUser --source=.
// The framework matches the --entry-point flag to the named export in this file.
