import { z } from 'zod';

export const CreateTeamSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens')
    .optional(),
  description: z.string().max(500).optional(),
  parentId: z.string().min(1).nullable().optional(), // null = root, undefined = root
});

export const UpdateTeamSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
});

export const MoveTeamSchema = z.object({
  parentId: z.string().min(1).nullable(), // null = move to root
});

export const AddTeamMemberSchema = z.object({
  userId: z.string().min(1).optional(),
  userIds: z.array(z.string().min(1)).min(1).optional(),
}).refine((data) => data.userId || (data.userIds && data.userIds.length > 0), {
  message: 'Provide userId or userIds',
  path: ['userId'],
});

export type CreateTeamInput = z.infer<typeof CreateTeamSchema>;
export type UpdateTeamInput = z.infer<typeof UpdateTeamSchema>;
export type MoveTeamInput = z.infer<typeof MoveTeamSchema>;
export type AddTeamMemberInput = z.infer<typeof AddTeamMemberSchema>;
