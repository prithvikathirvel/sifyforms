import { z } from 'zod';
import { DEFAULT_ORG_MEMBER_ROLE } from '../config/rbac.config';

// Roles are data, so the set of valid names is not known at compile time.
// Shape is checked here; assignability is checked in the service.
export const CreateInviteSchema = z.object({
  email: z.string().email('A valid email address is required').max(191),
  role: z.string().min(1).max(50).default(DEFAULT_ORG_MEMBER_ROLE),
});

export const UpdateOrgUserRoleSchema = z.object({
  role: z.string().min(1).max(50),
});

export type CreateInviteInput = z.infer<typeof CreateInviteSchema>;
export type UpdateOrgUserRoleInput = z.infer<typeof UpdateOrgUserRoleSchema>;
