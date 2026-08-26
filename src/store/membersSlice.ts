import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../lib/api';
import type { MembersState, OrgMember, OrgInvite, IncomingInvite } from '../types';

/**
 * Organization membership and invitations.
 *
 * Everything here goes through the forms backend, not the RBAC service: the
 * backend owns the org/team scoping and is the only thing that talks to RBAC.
 */

const initialState: MembersState = {
  members: [],
  invites: [],
  incomingInvites: [],
  isLoading: false,
  error: null,
};

function errorMessage(error: unknown, fallback: string): string {
  const err = error as { response?: { data?: { error?: string } } };
  return err.response?.data?.error || fallback;
}

// --- organization side -------------------------------------------------------

export const fetchMembers = createAsyncThunk(
  'members/fetchMembers',
  async (orgId: string, { rejectWithValue }) => {
    try {
      const response = await api.get(`/orgs/${orgId}/users`);
      return response.data as OrgMember[];
    } catch (error) {
      return rejectWithValue(errorMessage(error, 'Failed to load members'));
    }
  }
);

export const fetchInvites = createAsyncThunk(
  'members/fetchInvites',
  async (orgId: string, { rejectWithValue }) => {
    try {
      const response = await api.get(`/orgs/${orgId}/invites`);
      return response.data as OrgInvite[];
    } catch (error) {
      return rejectWithValue(errorMessage(error, 'Failed to load invitations'));
    }
  }
);

export const inviteMember = createAsyncThunk(
  'members/inviteMember',
  async (
    { orgId, email, role }: { orgId: string; email: string; role: string },
    { rejectWithValue }
  ) => {
    try {
      const response = await api.post(`/orgs/${orgId}/invites`, { email, role });
      return response.data as OrgInvite;
    } catch (error) {
      return rejectWithValue(errorMessage(error, 'Failed to send invitation'));
    }
  }
);

export const revokeInvite = createAsyncThunk(
  'members/revokeInvite',
  async ({ orgId, inviteId }: { orgId: string; inviteId: string }, { rejectWithValue }) => {
    try {
      await api.delete(`/orgs/${orgId}/invites/${inviteId}`);
      return inviteId;
    } catch (error) {
      return rejectWithValue(errorMessage(error, 'Failed to revoke invitation'));
    }
  }
);

export const updateMemberRole = createAsyncThunk(
  'members/updateMemberRole',
  async (
    { orgId, userId, role }: { orgId: string; userId: string; role: string },
    { rejectWithValue }
  ) => {
    try {
      await api.put(`/orgs/${orgId}/users/${userId}/role`, { role });
      return { userId, role };
    } catch (error) {
      return rejectWithValue(errorMessage(error, 'Failed to update role'));
    }
  }
);

export const removeMember = createAsyncThunk(
  'members/removeMember',
  async ({ orgId, userId }: { orgId: string; userId: string }, { rejectWithValue }) => {
    try {
      await api.delete(`/orgs/${orgId}/users/${userId}`);
      return userId;
    } catch (error) {
      return rejectWithValue(errorMessage(error, 'Failed to remove member'));
    }
  }
);

// --- invitee side ------------------------------------------------------------

/** Pending invites addressed to the signed-in user, for the org chooser. */
export const fetchMyInvites = createAsyncThunk(
  'members/fetchMyInvites',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/invites/me');
      return response.data as IncomingInvite[];
    } catch (error) {
      return rejectWithValue(errorMessage(error, 'Failed to load your invitations'));
    }
  }
);

export const acceptInvite = createAsyncThunk(
  'members/acceptInvite',
  async (inviteId: string, { rejectWithValue }) => {
    try {
      const response = await api.post(`/invites/${inviteId}/accept`);
      return { inviteId, ...response.data };
    } catch (error) {
      return rejectWithValue(errorMessage(error, 'Failed to accept invitation'));
    }
  }
);

export const rejectInvite = createAsyncThunk(
  'members/rejectInvite',
  async (inviteId: string, { rejectWithValue }) => {
    try {
      await api.post(`/invites/${inviteId}/reject`);
      return inviteId;
    } catch (error) {
      return rejectWithValue(errorMessage(error, 'Failed to decline invitation'));
    }
  }
);

const membersSlice = createSlice({
  name: 'members',
  initialState,
  reducers: {
    clearMembersError: (state) => {
      state.error = null;
    },
    resetMembers: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMembers.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchMembers.fulfilled, (state, action) => {
        state.isLoading = false;
        state.members = action.payload;
      })
      .addCase(fetchInvites.fulfilled, (state, action) => {
        state.invites = action.payload;
      })
      .addCase(inviteMember.fulfilled, (state, action) => {
        // The backend reuses one row per (org, email), so replace rather than push.
        const others = state.invites.filter((i) => i.id !== action.payload.id);
        state.invites = [action.payload, ...others];
      })
      .addCase(revokeInvite.fulfilled, (state, action) => {
        state.invites = state.invites.filter((i) => i.id !== action.payload);
      })
      .addCase(updateMemberRole.fulfilled, (state, action) => {
        const member = state.members.find((m) => m.id === action.payload.userId);
        if (member) member.role = action.payload.role;
      })
      .addCase(removeMember.fulfilled, (state, action) => {
        state.members = state.members.filter((m) => m.id !== action.payload);
      })
      .addCase(fetchMyInvites.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchMyInvites.fulfilled, (state, action) => {
        state.isLoading = false;
        state.incomingInvites = action.payload;
      })
      .addCase(acceptInvite.fulfilled, (state, action) => {
        state.incomingInvites = state.incomingInvites.filter(
          (i) => i.id !== action.payload.inviteId
        );
      })
      .addCase(rejectInvite.fulfilled, (state, action) => {
        state.incomingInvites = state.incomingInvites.filter((i) => i.id !== action.payload);
      })
      .addMatcher(
        (action) => action.type.startsWith('members/') && action.type.endsWith('/rejected'),
        (state, action: any) => {
          state.isLoading = false;
          state.error = (action.payload as string) ?? 'Something went wrong';
        }
      );
  },
});

export const { clearMembersError, resetMembers } = membersSlice.actions;
export default membersSlice.reducer;
