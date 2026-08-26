import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../lib/api';
import type { FormSharingState, FormAccess, FormShare, AggregateResult } from '../types';

/**
 * Per-form access: what the signed-in user may do with one form, who else it is
 * shared with, and the aggregate view for people who may not read rows.
 *
 * Everything here is advisory for rendering. The server re-resolves the same
 * decision on every request, so a stale or edited client state grants nothing.
 */

const initialState: FormSharingState = {
  access: {},
  shares: {},
  aggregate: {},
  isLoading: false,
  error: null,
};

function errorMessage(error: unknown, fallback: string): string {
  const err = error as { response?: { data?: { error?: string } } };
  return err.response?.data?.error || fallback;
}

export const fetchFormAccess = createAsyncThunk(
  'formSharing/fetchFormAccess',
  async (formId: string, { rejectWithValue }) => {
    try {
      const response = await api.get(`/forms/${formId}/access`);
      return response.data as FormAccess;
    } catch (error) {
      return rejectWithValue(errorMessage(error, 'Failed to load form access'));
    }
  }
);

export const fetchFormShares = createAsyncThunk(
  'formSharing/fetchFormShares',
  async (formId: string, { rejectWithValue }) => {
    try {
      const response = await api.get(`/forms/${formId}/shares`);
      return { formId, shares: response.data as FormShare[] };
    } catch (error) {
      return rejectWithValue(errorMessage(error, 'Failed to load sharing'));
    }
  }
);

export const shareForm = createAsyncThunk(
  'formSharing/shareForm',
  async (
    {
      formId,
      ...body
    }: {
      formId: string;
      principalType: 'USER' | 'TEAM';
      principalId: string;
      level: string;
      canEdit?: boolean;
      expiresAt?: string | null;
    },
    { dispatch, rejectWithValue }
  ) => {
    try {
      const response = await api.post(`/forms/${formId}/shares`, body);
      dispatch(fetchFormShares(formId));
      return response.data as FormShare;
    } catch (error) {
      return rejectWithValue(errorMessage(error, 'Failed to share form'));
    }
  }
);

export const revokeFormShare = createAsyncThunk(
  'formSharing/revokeFormShare',
  async ({ formId, shareId }: { formId: string; shareId: string }, { rejectWithValue }) => {
    try {
      await api.delete(`/forms/${formId}/shares/${shareId}`);
      return { formId, shareId };
    } catch (error) {
      return rejectWithValue(errorMessage(error, 'Failed to revoke access'));
    }
  }
);

export const setResponsePolicy = createAsyncThunk(
  'formSharing/setResponsePolicy',
  async ({ formId, policy }: { formId: string; policy: string }, { dispatch, rejectWithValue }) => {
    try {
      const response = await api.put(`/forms/${formId}/response-policy`, { policy });
      dispatch(fetchFormAccess(formId));
      return response.data;
    } catch (error) {
      return rejectWithValue(errorMessage(error, 'Failed to change response visibility'));
    }
  }
);

export const moveFormToTeam = createAsyncThunk(
  'formSharing/moveFormToTeam',
  async (
    { formId, teamId }: { formId: string; teamId: string | null },
    { dispatch, rejectWithValue }
  ) => {
    try {
      const response = await api.put(`/forms/${formId}/team`, { teamId });
      dispatch(fetchFormAccess(formId));
      return response.data;
    } catch (error) {
      return rejectWithValue(errorMessage(error, 'Failed to move form'));
    }
  }
);

/** Counts and distributions. The only response endpoint an anonymous form exposes. */
export const fetchAggregate = createAsyncThunk(
  'formSharing/fetchAggregate',
  async (formId: string, { rejectWithValue }) => {
    try {
      const response = await api.get(`/submissions/forms/${formId}/submissions/aggregate`);
      return response.data as AggregateResult;
    } catch (error) {
      return rejectWithValue(errorMessage(error, 'Failed to load results'));
    }
  }
);

const formSharingSlice = createSlice({
  name: 'formSharing',
  initialState,
  reducers: {
    clearSharingError: (state) => {
      state.error = null;
    },
    resetSharing: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchFormAccess.fulfilled, (state, action) => {
        state.access[action.payload.formId] = action.payload;
      })
      .addCase(fetchFormShares.fulfilled, (state, action) => {
        state.shares[action.payload.formId] = action.payload.shares;
      })
      .addCase(revokeFormShare.fulfilled, (state, action) => {
        const list = state.shares[action.payload.formId];
        if (list) {
          state.shares[action.payload.formId] = list.filter((s) => s.id !== action.payload.shareId);
        }
      })
      .addCase(fetchAggregate.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchAggregate.fulfilled, (state, action) => {
        state.isLoading = false;
        state.aggregate[action.payload.formId] = action.payload;
      })
      .addMatcher(
        (action) => action.type.startsWith('formSharing/') && action.type.endsWith('/rejected'),
        (state, action: any) => {
          state.isLoading = false;
          state.error = (action.payload as string) ?? 'Something went wrong';
        }
      );
  },
});

export const { clearSharingError, resetSharing } = formSharingSlice.actions;
export default formSharingSlice.reducer;
