// Auth
export { registerUser, getSession, logout, updateProfile } from './auth.lambda';

// Draft
export { getDraft, saveDraft, deleteDraft } from './draft.lambda';

// Org
export { createOrg, listOrgs, getOrg, updateOrg, deleteOrg, listOrgUsers, inviteOrgUser, removeOrgUser } from './org.lambda';

// Template
export { listTemplates, getTemplate, createTemplateFromForm, duplicateTemplate } from './template.lambda';

// Processing
export { getSubmissionResultPublic, getPollResults, getSubmissionResult, getLeaderboard, getAssessmentAnalytics, getAuditLog } from './processing.lambda';

// Form
export { getPublicForm, createForm, listForms, getForm, updateForm, deleteForm, publishForm, duplicateForm, getFormStats, generateFormWithAI, editFormWithAI } from './form.lambda';

// Submission
export { createSubmission, checkFieldUniqueness, checkExternalValidation, listSubmissions, getSubmission, updateSubmission, deleteSubmission, exportSubmissions, bulkDeleteSubmissions } from './submission.lambda';

// ─── Notes ───────────────────────────────────────────────────────────────────
// Each export is a separate Lambda handler deployed individually via AWS SAM / Serverless Framework:
//   Functions:
//     registerUser:
//       handler: dist/controllers/lambda/index.registerUser
//       events: [{ http: { path: /registerUser, method: post } }]
// Each function is deployed by name matching the export in this file.
