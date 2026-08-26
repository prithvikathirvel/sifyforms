import {
  FormDao,
  FormOwnershipRecord, FormRecord, FullFormRecord, CreateFormData, UpdateFormData,
  FormWithCount, FormWithOrg, FormPublished, PublicFormRecord,
} from '../interfaces/FormDao';

export class MongoFormDao implements FormDao {
  async findFormById(_id: string): Promise<FormRecord | null> {
    throw new Error('MongoFormDao.findFormById not implemented');
  }
  async findFormByIdAndOrg(_id: string, _orgId: string): Promise<FullFormRecord | null> {
    throw new Error('MongoFormDao.findFormByIdAndOrg not implemented');
  }
  async findFormByIdAndOrgWithOrg(_id: string, _orgId: string): Promise<FormWithOrg | null> {
    throw new Error('MongoFormDao.findFormByIdAndOrgWithOrg not implemented');
  }
  async findFormBySlugUnique(_orgId: string, _slug: string): Promise<{ id: string } | null> {
    throw new Error('MongoFormDao.findFormBySlugUnique not implemented');
  }
  async findFormsByOrg(_orgId: string): Promise<FormWithCount[]> {
    throw new Error('MongoFormDao.findFormsByOrg not implemented');
  }
  async findPublicForm(_orgId: string, _formSlug: string): Promise<PublicFormRecord | null> {
    throw new Error('MongoFormDao.findPublicForm not implemented');
  }
  async createForm(_data: CreateFormData): Promise<FullFormRecord> {
    throw new Error('MongoFormDao.createForm not implemented');
  }
  async updateForm(_id: string, _data: UpdateFormData): Promise<FullFormRecord> {
    throw new Error('MongoFormDao.updateForm not implemented');
  }
  async deleteForm(_id: string): Promise<void> {
    throw new Error('MongoFormDao.deleteForm not implemented');
  }
  async publishForm(_id: string): Promise<FormPublished> {
    throw new Error('MongoFormDao.publishForm not implemented');
  }
  async countFormsByOrg(_orgId: string): Promise<number> {
    throw new Error('MongoFormDao.countFormsByOrg not implemented');
  }
  async findFormOwnership(_id: string): Promise<FormOwnershipRecord | null> {
    throw new Error('MongoFormDao.findFormOwnership not implemented');
  }
  async findFormsByTeams(_orgId: string, _teamIds: string[], _includeUnassigned: boolean): Promise<FormWithCount[]> {
    throw new Error('MongoFormDao.findFormsByTeams not implemented');
  }
  async reassignFormsToTeam(_fromTeamId: string, _toTeamId: string | null): Promise<number> {
    throw new Error('MongoFormDao.reassignFormsToTeam not implemented');
  }
}
