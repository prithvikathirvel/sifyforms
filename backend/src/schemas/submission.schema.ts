import { z } from 'zod';

export const CreateSubmissionSchema = z.object({
  formId: z.string().min(1),
  data: z.record(z.string(), z.any()),
  // Optional at the schema level because a form whose owner turned bot
  // protection off does not issue one. Whether a token is actually required is
  // decided per form, once its settings have been read.
  turnstileToken: z.string().min(1, 'Security verification is required').max(2048).optional(),
  surveySessionToken: z.string().min(32).max(256).optional(),
  // Accepted temporarily so older clients fail on Turnstile rather than on an
  // unknown key. The client-generated math CAPTCHA is no longer trusted.
  captchaProblem: z.string().optional(),
  captchaAnswer: z.string().optional(),
}).strict();

export const UpdateSubmissionSchema = z.object({
  data: z.record(z.string(), z.any()).optional(),
  isRead: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

export const ExportSubmissionsSchema = z.object({
  format: z.enum(['csv', 'json']),
  ids: z.array(z.string()).optional(),
});

export type CreateSubmissionInput = z.infer<typeof CreateSubmissionSchema>;
export type UpdateSubmissionInput = z.infer<typeof UpdateSubmissionSchema>;
export type ExportSubmissionsInput = z.infer<typeof ExportSubmissionsSchema>;
