export interface DraftRecord {
  id: string;
  formId: string;
  identity: string | null;
  data: string;
  stepIndex: number;
  updatedAt: Date;
}

export interface UpsertDraftData {
  formId: string;
  /**
   * The row that authorises the draft. A server-issued session id, never
   * anything the caller chose for itself.
   */
  sessionId: string;
  /**
   * A label, kept for a future server-verified resume flow. Nothing is ever
   * looked up by it — that was the bug.
   */
  identity?: string | null;
  data: Record<string, unknown>;
  stepIndex?: number;
}

export interface DraftDao {
  findDraftByFormIdAndSession(formId: string, sessionId: string): Promise<DraftRecord | null>;
  upsert(data: UpsertDraftData): Promise<{ id: string; updatedAt: Date }>;
  deleteByFormAndSession(formId: string, sessionId: string): Promise<void>;
}
