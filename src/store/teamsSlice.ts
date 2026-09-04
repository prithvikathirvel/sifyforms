import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../lib/api';
import type { TeamsState, Team, TeamDetail, EffectivePermissions } from '../types';
import { apiErrorMessage, isCancelledPayload, payloadMessage } from '../lib/apiError';

/**
 * Teams (flat buckets), and the effective permissions the UI gates on.
 *
 * Permissions here decide what to *render*. Every write is re-checked on the
 * server, so a stale or tampered client state cannot grant access.
 */

const initialState: TeamsState = {
  teams: [],
  currentTeam: null,
  permissions: {},
  permissionStatus: {},
  permissionError: {},
  isLoading: false,
  error: null,
};

function errorMessage(error: unknown, fallback: string): string {
  const err = error as { response?: { data?: { error?: string } } };
  return apiErrorMessage(err, fallback);
}

export const fetchTeams = createAsyncThunk(
  'teams/fetchTeams',
  async (orgId: string, { rejectWithValue }) => {
    try {
      const response = await api.get(`/orgs/${orgId}/teams`);
      return response.data as Team[];
    } catch (error) {
      return rejectWithValue(errorMessage(error, 'Failed to load teams'));
    }
  }
);

export const fetchTeam = createAsyncThunk(
  'teams/fetchTeam',
  async ({ orgId, teamId }: { orgId: string; teamId: string }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/orgs/${orgId}/teams/${teamId}`);
      return response.data as TeamDetail;
    } catch (error) {
      return rejectWithValue(errorMessage(error, 'Failed to load team'));
    }
  }
);

export const createTeam = createAsyncThunk(
  'teams/createTeam',
  async (
    {
      orgId,
      ...body
    }: { orgId: string; name: string; description?: string },
    { dispatch, rejectWithValue }
  ) => {
    try {
      const response = await api.post(`/orgs/${orgId}/teams`, body);
      dispatch(fetchTeams(orgId));
      return response.data;
    } catch (error) {
      return rejectWithValue(errorMessage(error, 'Failed to create team'));
    }
  }
);

export const updateTeam = createAsyncThunk(
  'teams/updateTeam',
  async (
    {
      orgId,
      teamId,
      ...body
    }: { orgId: string; teamId: string; name?: string; description?: string | null },
    { dispatch, rejectWithValue }
  ) => {
    try {
      const response = await api.put(`/orgs/${orgId}/teams/${teamId}`, body);
      dispatch(fetchTeams(orgId));
      return response.data;
    } catch (error) {
      return rejectWithValue(errorMessage(error, 'Failed to update team'));
    }
  }
);

export const deleteTeam = createAsyncThunk(
  'teams/deleteTeam',
  async (
    { orgId, teamId }: { orgId: string; teamId: string },
    { dispatch, rejectWithValue }
  ) => {
    try {
      await api.delete(`/orgs/${orgId}/teams/${teamId}`);
      dispatch(fetchTeams(orgId));
      return teamId;
    } catch (error) {
      return rejectWithValue(errorMessage(error, 'Failed to delete team'));
    }
  }
);

// --- membership --------------------------------------------------------------

export const addTeamMember = createAsyncThunk(
  'teams/addTeamMember',
  async (
    { orgId, teamId, userId }: { orgId: string; teamId: string; userId: string },
    { dispatch, rejectWithValue }
  ) => {
    try {
      await api.post(`/orgs/${orgId}/teams/${teamId}/members`, { userId });
      dispatch(fetchTeam({ orgId, teamId }));
      return { teamId, userId };
    } catch (error) {
      return rejectWithValue(errorMessage(error, 'Failed to add team member'));
    }
  }
);

export const removeTeamMember = createAsyncThunk(
  'teams/removeTeamMember',
  async (
    { orgId, teamId, userId }: { orgId: string; teamId: string; userId: string },
    { dispatch, rejectWithValue }
  ) => {
    try {
      await api.delete(`/orgs/${orgId}/teams/${teamId}/members/${userId}`);
      dispatch(fetchTeam({ orgId, teamId }));
      return { teamId, userId };
    } catch (error) {
      return rejectWithValue(errorMessage(error, 'Failed to remove team member'));
    }
  }
);

// --- permissions --------------------------------------------------------------

/**
 * Resolve what the signed-in user may do, from their org role alone.
 */
export const fetchPermissions = createAsyncThunk(
  'teams/fetchPermissions',
  async ({ orgId }: { orgId: string }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/orgs/${orgId}/me/permissions`);
      // Keyed by organization so a previous organization's answer can't satisfy
      // the next one (someone who was an owner elsewhere must not keep owner
      // controls after switching).
      return { key: orgId, value: response.data as EffectivePermissions };
    } catch (error) {
      return rejectWithValue(errorMessage(error, 'Failed to load permissions'));
    }
  }
);

const teamsSlice = createSlice({
  name: 'teams',
  initialState,
  reducers: {
    clearTeamsError: (state) => {
      state.error = null;
    },
    clearCurrentTeam: (state) => {
      state.currentTeam = null;
    },
    resetTeams: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTeams.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTeams.fulfilled, (state, action) => {
        // Always clear the spinner, even when the payload is stale. A reply
        // that arrives for the organization we just left is not a reason to
        // keep the page loading forever.
        state.isLoading = false;
        if (action.meta.arg !== localStorage.getItem('currentOrgId')) return;
        state.teams = action.payload;
      })
      .addCase(fetchTeam.fulfilled, (state, action) => {
        state.currentTeam = action.payload;
      })
      .addCase(deleteTeam.fulfilled, (state, action) => {
        if (state.currentTeam?.id === action.payload) {
          state.currentTeam = null;
        }
      })
      .addCase(fetchPermissions.pending, (state, action) => {
        const key = action.meta.arg.orgId;
        state.permissionStatus[key] = 'loading';
        delete state.permissionError[key];
      })
      .addCase(fetchPermissions.fulfilled, (state, action) => {
        state.permissions[action.payload.key] = action.payload.value;
        state.permissionStatus[action.payload.key] = 'ready';
        delete state.permissionError[action.payload.key];
      })
      .addCase(fetchPermissions.rejected, (state, action) => {
        const key = action.meta.arg.orgId;
        if (isCancelledPayload(action.payload)) {
          // Switching organizations aborts the previous scope's requests. Drop
          // the status back to "not asked" so the hook issues a fresh lookup
          // instead of waiting on a reply that will never come.
          delete state.permissionStatus[key];
          return;
        }
        state.permissionStatus[key] = 'error';
        state.permissionError[key] = payloadMessage(action.payload, 'Failed to load permissions');
      })
      .addMatcher(
        (action) => action.type.startsWith('teams/') && action.type.endsWith('/rejected'),
        (state, action: any) => {
          // A cancelled request means a newer one replaced it. Reporting it
          // would flash "canceled" at the user for a switch they asked for.
          if (isCancelledPayload(action.payload)) return;
          state.isLoading = false;
          state.error = (action.payload as string) ?? 'Something went wrong';
        }
      );
  },
});

export const { clearTeamsError, clearCurrentTeam, resetTeams } = teamsSlice.actions;
export default teamsSlice.reducer;
