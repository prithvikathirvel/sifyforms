import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../lib/api';
import { apiErrorMessage } from '../lib/apiError';

/**
 * Role definitions.
 *
 * Roles are data, not constants, so every picker in the app reads from here
 * rather than a hardcoded list. Note the definitions live in the shared RBAC
 * service: a role created in one organization is visible to all of them.
 */

export interface RolePrivilege {
  feature: string;
  actions: string[];
}

export interface Role {
  id: string;
  name: string;
  description: string;
  privilege: RolePrivilege[];
  actions: string[];
  isActive: boolean;
  /** Built-in: permissions editable, name fixed, cannot be retired. */
  isSystem: boolean;
  assignedCount: number;
}

export interface PermissionCatalogueEntry {
  feature: string;
  actions: { key: string; value: string }[];
}

interface RolesState {
  roles: Role[];
  permissions: PermissionCatalogueEntry[];
  isLoading: boolean;
  error: string | null;
}

const initialState: RolesState = {
  roles: [],
  permissions: [],
  isLoading: false,
  error: null,
};

function errorMessage(error: unknown, fallback: string): string {
  const err = error as { response?: { data?: { error?: string } } };
  return apiErrorMessage(err, fallback);
}

export const fetchRoles = createAsyncThunk(
  'roles/fetchRoles',
  async (orgId: string, { rejectWithValue }) => {
    try {
      const response = await api.get(`/orgs/${orgId}/roles`);
      return response.data as { roles: Role[]; permissions: PermissionCatalogueEntry[] };
    } catch (error) {
      return rejectWithValue(errorMessage(error, 'Failed to load roles'));
    }
  }
);

export interface RolePayload {
  name: string;
  description?: string;
  privilege: RolePrivilege[];
}

export const createRole = createAsyncThunk(
  'roles/createRole',
  async ({ orgId, ...body }: RolePayload & { orgId: string }, { dispatch, rejectWithValue }) => {
    try {
      const response = await api.post(`/orgs/${orgId}/roles`, body);
      dispatch(fetchRoles(orgId));
      return response.data;
    } catch (error) {
      return rejectWithValue(errorMessage(error, 'Failed to create role'));
    }
  }
);

export const updateRole = createAsyncThunk(
  'roles/updateRole',
  async (
    { orgId, roleId, ...body }: RolePayload & { orgId: string; roleId: string },
    { dispatch, rejectWithValue }
  ) => {
    try {
      const response = await api.put(`/orgs/${orgId}/roles/${roleId}`, body);
      dispatch(fetchRoles(orgId));
      return response.data;
    } catch (error) {
      return rejectWithValue(errorMessage(error, 'Failed to update role'));
    }
  }
);

export const setRoleActive = createAsyncThunk(
  'roles/setRoleActive',
  async (
    { orgId, roleId, active }: { orgId: string; roleId: string; active: boolean },
    { dispatch, rejectWithValue }
  ) => {
    try {
      const response = await api.patch(`/orgs/${orgId}/roles/${roleId}/active`, { active });
      dispatch(fetchRoles(orgId));
      return response.data;
    } catch (error) {
      return rejectWithValue(errorMessage(error, 'Failed to change role status'));
    }
  }
);

const rolesSlice = createSlice({
  name: 'roles',
  initialState,
  reducers: {
    resetRoles: () => initialState,
    clearRolesError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRoles.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchRoles.fulfilled, (state, action) => {
        if (action.meta.arg !== localStorage.getItem('currentOrgId')) return;
        state.isLoading = false;
        state.roles = action.payload.roles;
        state.permissions = action.payload.permissions;
      })
      .addMatcher(
        (action) => action.type.startsWith('roles/') && action.type.endsWith('/rejected'),
        (state, action: any) => {
          state.isLoading = false;
          state.error = (action.payload as string) ?? 'Something went wrong';
        }
      );
  },
});

export const { clearRolesError, resetRoles } = rolesSlice.actions;
export default rolesSlice.reducer;
