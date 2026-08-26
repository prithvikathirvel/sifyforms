import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import api from '../lib/api';
import type { SubmissionsState, Submission } from '../types';

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

export const fetchSubmissions = createAsyncThunk(
  'submissions/fetchSubmissions',
  async ({ formId, page = 1, limit = 50 }: { formId: string; page?: number; limit?: number }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/submissions/forms/${formId}/submissions`, {
        params: { page, limit },
      });
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      return rejectWithValue(err.response?.data?.error || 'Failed to fetch submissions');
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
      return rejectWithValue(err.response?.data?.error || 'Failed to fetch submission');
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
      return rejectWithValue(err.response?.data?.error || 'Failed to update submission');
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
      return rejectWithValue(err.response?.data?.error || 'Failed to delete submission');
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
      return rejectWithValue(err.response?.data?.error || 'Failed to export submissions');
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
