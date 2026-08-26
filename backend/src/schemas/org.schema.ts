import { z } from 'zod';

export const CreateOrgSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').max(100),
  slug: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  industry: z.string().optional(),
});

export const UpdateOrgSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  industry: z.string().optional(),
  logo: z.string().optional(),
});

export type CreateOrgInput = z.infer<typeof CreateOrgSchema>;
export type UpdateOrgInput = z.infer<typeof UpdateOrgSchema>;
