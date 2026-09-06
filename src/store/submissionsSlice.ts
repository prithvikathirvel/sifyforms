import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import api from '../lib/api';
import type { SubmissionsState, Submission } from '../types';
import { apiErrorMessage } from '../lib/apiError';

const initialState: SubmissionsState = {
  submissions: [],
  currentSubmission: null,
  access: null,
  pagination: {
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  },
  isLoading: false,
  error: null,
};

/**
 * The query the responses table runs.
 *
 * Every one of these is answered by the server. The table used to filter the
 * fifty rows it happened to be holding, which meant a search could not find a
 * response on page two and the count under the table described the wrong set.
 */
export interface SubmissionQuery {
  formId: string;
  page?: number;
  limit?: number;
  /** Free text, matched across every answer in the response. */
  search?: string;
  /** '', 'read' or 'unread'. */
  status?: string;
  /** ISO date strings, inclusive. */
  startDate?: string;
  endDate?: string;
  sort?: 'newest' | 'oldest';
}

export const fetchSubmissions = createAsyncThunk(
  'submissions/fetchSubmissions',
  async ({ formId, page = 1, limit = 50, search, status, startDate, endDate, sort }: SubmissionQuery, { rejectWithValue }) => {
    try {
      const response = await api.get(`/submissions/forms/${formId}/submissions`, {
        // Empty values are dropped rather than sent as blanks, so the request
        // URL reads as the question being asked and caches sensibly.
        params: {
          page,
          limit,
          ...(search ? { search } : {}),
          ...(status ? { status } : {}),
          ...(startDate ? { startDate } : {}),
          ...(endDate ? { endDate } : {}),
          ...(sort && sort !== 'newest' ? { sort } : {}),
        },
      });
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      return rejectWithValue(apiErrorMessage(err, 'Failed to fetch submissions'));
    }
  }
);

export const fetchSubmission = createAsyncThunk(
  'submissions/fetchSubmission',
  async ({ formId, submissionId }: { formId: string; submissionId: string }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/submissions/forms/${formId}/submissions/${submissionId}`);
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      return rejectWithValue(apiErrorMessage(err, 'Failed to fetch submission'));
    }
  }
);

export const updateSubmission = createAsyncThunk(
  'submissions/updateSubmission',
  async ({ formId, submissionId, data }: { formId: string; submissionId: string; data: Partial<Submission> }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/submissions/forms/${formId}/submissions/${submissionId}`, data);
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      return rejectWithValue(apiErrorMessage(err, 'Failed to update submission'));
    }
  }
);

export const deleteSubmission = createAsyncThunk(
  'submissions/deleteSubmission',
  async ({ formId, submissionId }: { formId: string; submissionId: string }, { rejectWithValue }) => {
    try {
      await api.delete(`/submissions/forms/${formId}/submissions/${submissionId}`);
      return submissionId;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      return rejectWithValue(apiErrorMessage(err, 'Failed to delete submission'));
    }
  }
);

export const bulkDeleteSubmissions = createAsyncThunk(
  'submissions/bulkDeleteSubmissions',
  async ({ formId, ids }: { formId: string; ids: string[] }, { rejectWithValue }) => {
    try {
      await api.post(`/submissions/forms/${formId}/submissions/bulk-delete`, { ids });
      return ids;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      return rejectWithValue(apiErrorMessage(err, 'Failed to delete the selected responses'));
    }
  }
);

export const exportSubmissions = createAsyncThunk(
  'submissions/exportSubmissions',
  async ({ formId, format, ids }: { formId: string; format: 'csv' | 'json'; ids?: string[] }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/submissions/forms/${formId}/submissions/export`, { format, ids }, {
        responseType: format === 'csv' ? 'blob' : 'json',
      });
      return { data: response.data, format };
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      return rejectWithValue(apiErrorMessage(err, 'Failed to export submissions'));
    }
  }
);

const submissionsSlice = createSlice({
  name: 'submissions',
  initialState,
  reducers: {
    setCurrentSubmission: (state, action: PayloadAction<Submission | null>) => {
      state.currentSubmission = action.payload;
    },
    clearSubmissions: (state) => {
      state.submissions = [];
      state.currentSubmission = null;
      state.pagination = initialState.pagination;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSubmissions.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchSubmissions.fulfilled, (state, action) => {
        state.isLoading = false;
        state.submissions = action.payload.submissions;
        state.pagination = action.payload.pagination;
        state.access = action.payload.access ?? null;
      })
      .addCase(fetchSubmissions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(bulkDeleteSubmissions.fulfilled, (state, action) => {
        const removed = new Set(action.payload);
        state.submissions = state.submissions.filter(s => !removed.has(s.id));
        state.pagination.total = Math.max(state.pagination.total - removed.size, 0);
      })
      .addCase(fetchSubmission.fulfilled, (state, action) => {
        state.currentSubmission = action.payload;
        const index = state.submissions.findIndex(s => s.id === action.payload.id);
        if (index !== -1) {
          state.submissions[index] = action.payload;
        }
      })
      .addCase(updateSubmission.fulfilled, (state, action) => {
        const index = state.submissions.findIndex(s => s.id === action.payload.id);
        if (index !== -1) {
          state.submissions[index] = action.payload;
        }
        if (state.currentSubmission?.id === action.payload.id) {
          state.currentSubmission = action.payload;
        }
      })
      .addCase(deleteSubmission.fulfilled, (state, action) => {
        state.submissions = state.submissions.filter(s => s.id !== action.payload);
        if (state.currentSubmission?.id === action.payload) {
          state.currentSubmission = null;
        }
      });
  },
});

export const { setCurrentSubmission, clearSubmissions, clearError } = submissionsSlice.actions;
export default submissionsSlice.reducer;
