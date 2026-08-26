export interface SubmissionStatusRecord {
  processingStatus: string;
  formId: string;
}

export interface SubmissionDataRecord {
  data: string;
}

export interface SubmissionRecord {
  id: string;
  formId: string;
  data: string;
  ip: string | null;
  userAgent: string | null;
  isRead: boolean;
  tags: string;
  processingStatus: string;
  createdAt: Date;
}

export interface CreateSubmissionData {
  formId: string;
  data: string;
  ip?: string | null;
  userAgent?: string | null;
}

export interface UpdateSubmissionData {
  data?: string;
  isRead?: boolean;
  tags?: string;
}

export interface SubmissionListFilter {
  isRead?: boolean;
  createdAtGte?: Date;
  createdAtLte?: Date;
}

export interface SubmissionDao {
  findSubmissionStatusById(id: string): Promise<SubmissionStatusRecord | null>;
  findActiveSubmissionsByFormId(formId: string): Promise<SubmissionDataRecord[]>;
  findSubmissionDataByFormId(formId: string): Promise<SubmissionDataRecord[]>;
  countSubmissionsByOrg(orgId: string): Promise<number>;
  countRecentSubmissionsByOrg(orgId: string, since: Date): Promise<number>;
  createSubmission(data: CreateSubmissionData): Promise<SubmissionRecord>;
  findSubmissionsByFormId(formId: string, skip: number, take: number, filter: SubmissionListFilter): Promise<SubmissionRecord[]>;
  countSubmissionsByFormId(formId: string, filter: SubmissionListFilter): Promise<number>;
  findSubmissionByIdAndForm(id: string, formId: string): Promise<SubmissionRecord | null>;
  markSubmissionAsRead(id: string): Promise<void>;
  updateSubmission(id: string, data: UpdateSubmissionData): Promise<SubmissionRecord>;
  deleteSubmissionById(id: string): Promise<void>;
  findSubmissionsForExport(formId: string, ids?: string[]): Promise<SubmissionRecord[]>;
  bulkDeleteSubmissions(formId: string, ids: string[]): Promise<void>;
}

