export type SharePrincipalType = 'USER' | 'TEAM';

export interface FormShareRecord {
  id: string;
  formId: string;
  principalType: string;
  principalId: string;
  level: string;
  canEdit: boolean;
  expiresAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertFormShareData {
  formId: string;
  principalType: SharePrincipalType;
  principalId: string;
  level: string;
  canEdit: boolean;
  expiresAt: Date | null;
  createdBy: string;
}

export interface FormShareDao {
  /** Create the share, or replace the terms of an existing one. */
  upsertShare(data: UpsertFormShareData): Promise<FormShareRecord>;

  findShareById(id: string): Promise<FormShareRecord | null>;

  /** Every share on a form, including expired ones, for the management view. */
  findSharesByForm(formId: string): Promise<FormShareRecord[]>;

  /**
   * Live shares that apply to this user: those granted to them directly, and
   * those granted to any team in `teamIds`. Expired shares are excluded here
   * rather than filtered later, so an expiry is enforced, not merely displayed.
   */
  findActiveSharesForPrincipals(
    formId: string,
    userId: string,
    teamIds: string[],
    now: Date
  ): Promise<FormShareRecord[]>;

  /** Forms shared with this user or their teams - for "shared with me" listing. */
  findFormIdsSharedWith(userId: string, teamIds: string[], now: Date): Promise<string[]>;

  deleteShare(id: string): Promise<void>;
}
