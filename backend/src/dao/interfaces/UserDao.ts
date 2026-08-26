export interface CreateUserData {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  phone?: string | null;
  gender?: string | null;
  address?: string | null;
  additionalDetails?: string | null;
}

export interface UserWithOrgs {
  id: string;
  email: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  ownedOrgs: { id: string; name: string; slug: string }[];
  orgs: { org: { id: string; name: string; slug: string } }[];
}

export interface UpdateProfileData {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  phone?: string | null;
  gender?: string | null;
  address?: string | null;
  additionalDetails?: string | null;
}

export interface UserDao {
  findUserByEmail(email: string): Promise<{ id: string; email: string } | null>;
  createUser(data: CreateUserData): Promise<void>;
  findUserWithOrgsByUserId(id: string): Promise<UserWithOrgs | null>;
  updateUser(id: string, data: UpdateProfileData): Promise<void>;
}
