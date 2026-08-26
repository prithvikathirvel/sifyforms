import { z } from 'zod';

export const CreateSubmissionSchema = z.object({
  formId: z.string(),
  data: z.record(z.string(), z.any()),
  captchaProblem: z.string().optional(),
  captchaAnswer: z.string().optional(),
});

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
