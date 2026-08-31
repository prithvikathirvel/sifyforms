import { z } from 'zod';

/**
 * Shape only. Which features and actions actually exist, and whether the name
 * collides, is checked in role.service against the live catalogue.
 */
export const CreateRoleSchema = z.object({
  name: z.string().min(2).max(49),
  description: z.string().max(200).optional(),
  privilege: z
    .array(
      z.object({
        feature: z.string().min(1),
        actions: z.array(z.string()),
      })
    )
    .min(1, 'A role needs at least one permission'),
});

export type CreateRoleInput = z.infer<typeof CreateRoleSchema>;
