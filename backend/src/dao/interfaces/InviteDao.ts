export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'REVOKED';

export interface InviteRecord {
  id: string;
  email: string;
  orgId: string;
  roleId: string | null;
  role: string;
  inviteStatus: string;
  invitedBy: string;
  createdAt: Date;
  respondedAt: Date | null;
}

export interface InviteOrgSummary {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  industry: string | null;
}

export interface InviteWithOrg extends InviteRecord {
  org: InviteOrgSummary;
}

export interface CreateInviteData {
  email: string;
  orgId: string;
  roleId: string | null;
  role: string;
  invitedBy: string;
}

export interface InviteDao {
  /**
   * Create the invite, or revive the existing row for this (org, email) when a
   * previous invite was revoked or rejected. One live invite per pair.
   */
  upsertInvite(data: CreateInviteData): Promise<InviteRecord>;

  findInviteById(id: string): Promise<InviteWithOrg | null>;
  findInviteByOrgAndEmail(orgId: string, email: string): Promise<InviteRecord | null>;

  /** Invites addressed to an email, newest first, optionally filtered by status. */
  findInvitesByEmail(email: string, status?: InviteStatus): Promise<InviteWithOrg[]>;

  /** Invites issued by an organization, newest first. */
  findInvitesByOrg(orgId: string, status?: InviteStatus): Promise<InviteRecord[]>;

  updateInviteStatus(id: string, status: InviteStatus): Promise<InviteRecord>;

  deleteInvite(id: string): Promise<void>;
}
