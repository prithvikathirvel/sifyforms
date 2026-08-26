export interface FormSettings {
  partialSubmission?: { enabled: boolean };
  authentication?: { enabled: boolean };
  [key: string]: unknown;
}

export interface FormRecord {
  id: string;
  schema: string;
  settings: string;
  isPublished: boolean;
}

/** The bits authorization needs, without loading the whole schema blob. */
export interface FormOwnershipRecord {
  id: string;
  orgId: string;
  teamId: string | null;
  responsePolicy: string;
  responsePolicyLockedAt: Date | null;
  createdBy: string;
}

export interface FullFormRecord {
  id: string;
  orgId: string;
  teamId: string | null;
  responsePolicy: string;
  responsePolicyLockedAt: Date | null;
  name: string;
  slug: string;
  description: string | null;
  schema: string;
  settings: string;
  isPublished: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FormWithCount extends FullFormRecord {
  _count: { submissions: number };
}

export interface FormWithOrg extends FullFormRecord {
  _count: { submissions: number };
  org: { slug: string; name: string };
}

export interface FormPublished extends FullFormRecord {
  org: { slug: string };
}

export interface PublicFormRecord {
  id: string;
  name: string;
  description: string | null;
  schema: string;
  settings: string;
  org: { name: string; slug: string; logo: string | null };
}

export interface CreateFormData {
  orgId: string;
  teamId?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  schema: string;
  settings: string;
  isPublished: boolean;
  createdBy: string;
}

export interface UpdateFormData {
  teamId?: string | null;
  responsePolicy?: string;
  responsePolicyLockedAt?: Date | null;
  name?: string;
  description?: string | null;
  schema?: string;
  settings?: string;
  isPublished?: boolean;
}

export interface FormDao {
  findFormById(id: string): Promise<FormRecord | null>;
  findFormByIdAndOrg(id: string, orgId: string): Promise<FullFormRecord | null>;
  findFormByIdAndOrgWithOrg(id: string, orgId: string): Promise<FormWithOrg | null>;
  findFormBySlugUnique(orgId: string, slug: string): Promise<{ id: string } | null>;
  findFormsByOrg(orgId: string): Promise<FormWithCount[]>;

  /** Just the fields authorization needs to place a form in its team. */
  findFormOwnership(id: string): Promise<FormOwnershipRecord | null>;

  /** Forms owned by any of the given teams, plus any with no team at all. */
  findFormsByTeams(orgId: string, teamIds: string[], includeUnassigned: boolean): Promise<FormWithCount[]>;

  /** Re-home every form of a deleted team onto the fallback team. */
  reassignFormsToTeam(fromTeamId: string, toTeamId: string | null): Promise<number>;
  findPublicForm(orgId: string, formSlug: string): Promise<PublicFormRecord | null>;
  createForm(data: CreateFormData): Promise<FullFormRecord>;
  updateForm(id: string, data: UpdateFormData): Promise<FullFormRecord>;
  deleteForm(id: string): Promise<void>;
  publishForm(id: string): Promise<FormPublished>;
  countFormsByOrg(orgId: string): Promise<number>;
}

