export interface DraftRecord {
  id: string;
  formId: string;
  identity: string;
  data: string;
  stepIndex: number;
  updatedAt: Date;
}

export interface UpsertDraftData {
  formId: string;
  identity: string;
  data: Record<string, unknown>;
  stepIndex?: number;
}

export interface DraftDao {
  findDraftByFormIdAndIdentity(formId: string, identity: string): Promise<DraftRecord | null>;
  upsert(data: UpsertDraftData): Promise<{ id: string; updatedAt: Date }>;
  deleteByFormAndIdentity(formId: string, identity: string): Promise<void>;
}
