import {
  FormDao,
  FormOwnershipRecord, FormRecord, FullFormRecord, CreateFormData, UpdateFormData,
  FormWithCount, FormWithOrg, FormPublished, PublicFormRecord,
} from '../interfaces/FormDao';

export class FirestoreFormDao implements FormDao {
  async findFormById(_id: string): Promise<FormRecord | null> {
    throw new Error('FirestoreFormDao.findFormById not implemented');
  }
  async findFormByIdAndOrg(_id: string, _orgId: string): Promise<FullFormRecord | null> {
    throw new Error('FirestoreFormDao.findFormByIdAndOrg not implemented');
  }
  async findFormByIdAndOrgWithOrg(_id: string, _orgId: string): Promise<FormWithOrg | null> {
    throw new Error('FirestoreFormDao.findFormByIdAndOrgWithOrg not implemented');
  }
  async findFormBySlugUnique(_orgId: string, _slug: string): Promise<{ id: string } | null> {
    throw new Error('FirestoreFormDao.findFormBySlugUnique not implemented');
  }
  async findFormsByOrg(_orgId: string): Promise<FormWithCount[]> {
    throw new Error('FirestoreFormDao.findFormsByOrg not implemented');
  }
  async findPublicForm(_orgId: string, _formSlug: string): Promise<PublicFormRecord | null> {
    throw new Error('FirestoreFormDao.findPublicForm not implemented');
  }
  async createForm(_data: CreateFormData): Promise<FullFormRecord> {
    throw new Error('FirestoreFormDao.createForm not implemented');
  }
  async updateForm(_id: string, _data: UpdateFormData): Promise<FullFormRecord> {
    throw new Error('FirestoreFormDao.updateForm not implemented');
  }
  async deleteForm(_id: string): Promise<void> {
    throw new Error('FirestoreFormDao.deleteForm not implemented');
  }
  async publishForm(_id: string): Promise<FormPublished> {
    throw new Error('FirestoreFormDao.publishForm not implemented');
  }
  async countFormsByOrg(_orgId: string): Promise<number> {
    throw new Error('FirestoreFormDao.countFormsByOrg not implemented');
  }
  async findFormOwnership(_id: string): Promise<FormOwnershipRecord | null> {
    throw new Error('FirestoreFormDao.findFormOwnership not implemented');
  }
  async findFormsByTeams(_orgId: string, _teamIds: string[], _includeUnassigned: boolean): Promise<FormWithCount[]> {
    throw new Error('FirestoreFormDao.findFormsByTeams not implemented');
  }
  async reassignFormsToTeam(_fromTeamId: string, _toTeamId: string | null): Promise<number> {
    throw new Error('FirestoreFormDao.reassignFormsToTeam not implemented');
  }
}
