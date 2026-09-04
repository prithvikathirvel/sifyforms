import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import api from '../lib/api';
import type { OrgState, Organization } from '../types';
import { apiErrorMessage, isCancelledPayload } from '../lib/apiError';

const initialState: OrgState = {
  currentOrg: null,
  organizations: [],
  isLoading: false,
  error: null,
};

export const fetchOrganizations = createAsyncThunk(
  'org/fetchOrganizations',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/orgs');
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      return rejectWithValue(apiErrorMessage(err, 'Failed to fetch organizations'));
    }
  }
);

export const createOrganization = createAsyncThunk(
  'org/createOrganization',
  async (data: { name: string; slug: string; industry?: string }, { rejectWithValue }) => {
    try {
      const response = await api.post('/orgs', data);
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      return rejectWithValue(apiErrorMessage(err, 'Failed to create organization'));
    }
  }
);

export const updateOrganization = createAsyncThunk(
  'org/updateOrganization',
  async ({ orgId, data }: { orgId: string; data: Partial<Organization> }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/orgs/${orgId}`, data);
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      return rejectWithValue(apiErrorMessage(err, 'Failed to update organization'));
    }
  }
);

export const deleteOrganization = createAsyncThunk(
  'org/deleteOrganization',
  async (orgId: string, { rejectWithValue }) => {
    try {
      await api.delete(`/orgs/${orgId}`);
      return orgId;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      return rejectWithValue(apiErrorMessage(err, 'Failed to delete organization'));
    }
  }
);

const orgSlice = createSlice({
  name: 'org',
  initialState,
  reducers: {
    setCurrentOrg: (state, action: PayloadAction<Organization | null>) => {
      state.currentOrg = action.payload;
      if (action.payload) {
        localStorage.setItem('currentOrgId', action.payload.id);
      } else {
        localStorage.removeItem('currentOrgId');
      }
    },
    clearError: (state) => {
      state.error = null;
    },
    resetOrg: (state) => {
      state.currentOrg = null;
      state.organizations = [];
      state.error = null;
      state.isLoading = false;
      localStorage.removeItem('currentOrgId');
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchOrganizations.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchOrganizations.fulfilled, (state, action) => {
        state.isLoading = false;
        state.organizations = action.payload;
        const savedOrgId = localStorage.getItem('currentOrgId');
        if (!state.currentOrg) {
          const savedOrg = savedOrgId ? action.payload.find((o: Organization) => o.id === savedOrgId) : undefined;
          state.currentOrg = savedOrg ?? action.payload[0] ?? null;
          if (state.currentOrg) localStorage.setItem('currentOrgId', state.currentOrg.id);
          else localStorage.removeItem('currentOrgId');
        }
      })
      .addCase(fetchOrganizations.rejected, (state, action) => {
        state.isLoading = false;
        // Cancelled by an organization switch: a newer fetch is already on its
        // way, so there is nothing to tell the user about.
        state.error = isCancelledPayload(action.payload) ? null : (action.payload as string);
      })
      .addCase(createOrganization.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createOrganization.fulfilled, (state, action) => {
        state.isLoading = false;
        state.organizations.push(action.payload);
        state.currentOrg = action.payload;
        localStorage.setItem('currentOrgId', action.payload.id);
      })
      .addCase(createOrganization.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(updateOrganization.fulfilled, (state, action) => {
        const index = state.organizations.findIndex((o: Organization) => o.id === action.payload.id);
        if (index !== -1) {
          state.organizations[index] = action.payload;
        }
        if (state.currentOrg?.id === action.payload.id) {
          state.currentOrg = action.payload;
        }
      })
      .addCase(deleteOrganization.fulfilled, (state, action) => {
        state.organizations = state.organizations.filter((o: Organization) => o.id !== action.payload);
        if (state.currentOrg?.id === action.payload) {
          state.currentOrg = state.organizations[0] || null;
          if (state.currentOrg) localStorage.setItem('currentOrgId', state.currentOrg.id);
          else localStorage.removeItem('currentOrgId');
        }
      });
  },
});

export const { setCurrentOrg, clearError, resetOrg } = orgSlice.actions;
export default orgSlice.reducer;
