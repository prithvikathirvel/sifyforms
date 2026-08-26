import { z } from 'zod';
import { DEFAULT_TEAM_MEMBER_ROLE } from '../config/rbac.config';

export const CreateTeamSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens')
    .optional(),
  description: z.string().max(500).optional(),
  /** Omit or null to create a root team; set to nest under an existing team. */
  parentId: z.string().nullable().optional(),
});

export const UpdateTeamSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
});

export const AddTeamMemberSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  role: z.string().min(1).max(50).default(DEFAULT_TEAM_MEMBER_ROLE),
});

export const UpdateTeamMemberSchema = z.object({
  role: z.string().min(1).max(50),
});

export type CreateTeamInput = z.infer<typeof CreateTeamSchema>;
export type UpdateTeamInput = z.infer<typeof UpdateTeamSchema>;
export type AddTeamMemberInput = z.infer<typeof AddTeamMemberSchema>;
export type UpdateTeamMemberInput = z.infer<typeof UpdateTeamMemberSchema>;
