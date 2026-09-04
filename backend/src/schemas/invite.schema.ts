import { z } from 'zod';
import { DEFAULT_ORG_MEMBER_ROLE } from '../config/rbac.config';

// Roles are data, so the set of valid names is not known at compile time.
// Shape is checked here; assignability is checked in the service.
export const CreateInviteSchema = z.object({
  email: z.string().email('A valid email address is required').max(191),
  role: z.string().min(1).max(50).default(DEFAULT_ORG_MEMBER_ROLE),
});

/*
 * A bulk invitation.
 *
 * The cap is not arbitrary. Every row costs a role lookup, a user lookup and a
 * membership lookup, and the whole thing runs inside one HTTP request; 200 rows
 * is comfortably inside any sane proxy timeout while being more than anyone
 * pastes by hand. Beyond that the honest answer is "do it in two goes", which
 * the error message says.
 *
 * Rows are validated individually rather than as a whole: a single bad address
 * in a list of eighty must not reject the other seventy-nine, so shape errors
 * are reported per row by the service and only the envelope is checked here.
 */
export const BulkInviteSchema = z.object({
  invites: z
    .array(
      z.object({
        email: z.string().min(1, 'An email address is required').max(320),
        role: z.string().max(50).optional(),
      })
    )
    .min(1, 'Add at least one person to invite')
    .max(200, 'Invite up to 200 people at a time. Split a longer list into batches.'),
  /** Applied to any row that does not name its own role. */
  defaultRole: z.string().min(1).max(50).default(DEFAULT_ORG_MEMBER_ROLE),
});

export type BulkInviteInput = z.infer<typeof BulkInviteSchema>;

export const UpdateOrgUserRoleSchema = z.object({
  role: z.string().min(1).max(50),
});

export type CreateInviteInput = z.infer<typeof CreateInviteSchema>;
export type UpdateOrgUserRoleInput = z.infer<typeof UpdateOrgUserRoleSchema>;
