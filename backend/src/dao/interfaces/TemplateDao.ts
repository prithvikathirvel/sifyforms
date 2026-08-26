export interface TemplateRecord {
  id: string;
  name: string;
  description: string | null;
  category: string;
  schema: string;
  settings: string;
  isStatic: boolean;
  orgId: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTemplateData {
  orgId: string;
  name: string;
  description?: string | null;
  category: string;
  schema: string;
  settings: string;
  isStatic: boolean;
  createdBy: string;
}

export interface TemplateDao {
  findTemplatesByOrg(orgId: string): Promise<TemplateRecord[]>;
  findTemplateById(id: string): Promise<TemplateRecord | null>;
  createTemplate(data: CreateTemplateData): Promise<TemplateRecord>;
}
