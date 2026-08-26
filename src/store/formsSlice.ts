import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import api from "../lib/api";
import type { FormsState, Form, FormSchema, FormSettings } from "../types";

const initialState: FormsState = {
  forms: [],
  currentForm: null,
  isLoading: true,
  error: null,
};

export const fetchForms = createAsyncThunk(
  "forms/fetchForms",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get("/forms");
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      return rejectWithValue(err.response?.data?.error || "Failed to fetch forms");
    }
  }
);

export const fetchForm = createAsyncThunk(
  "forms/fetchForm",
  async (formId: string, { rejectWithValue }) => {
    try {
      const response = await api.get(`/forms/${formId}`);
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      return rejectWithValue(err.response?.data?.error || "Failed to fetch form");
    }
  }
);

export const createTemplate = createAsyncThunk(
  "forms/createTemplate",
  async (data: { formId: string; name: string; description?: string; category?: string }, { rejectWithValue }) => {
    try {
      const response = await api.post("/templates", data);
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      return rejectWithValue(err.response?.data?.error || "Failed to create template");
    }
  }
);

export const duplicateTemplate = createAsyncThunk(
  "forms/duplicateTemplate",
  async (data: { templateId: string; name: string; teamId?: string | null }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/templates/${data.templateId}/duplicate`, {
        name: data.name,
        teamId: data.teamId,
      });
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      return rejectWithValue(err.response?.data?.error || "Failed to duplicate template");
    }
  }
);

export const duplicateForm = createAsyncThunk(
  "forms/duplicateForm",
  async ({ formId, name }: { formId: string; name: string }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/forms/${formId}/duplicate`, { name });
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      return rejectWithValue(err.response?.data?.error || "Failed to duplicate form");
    }
  }
);

export const saveFormAsTemplate = createAsyncThunk(
  "forms/saveFormAsTemplate",
  async ({ formId, name }: { formId: string; name: string }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/templates/${formId}/create-template`, { name });
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      return rejectWithValue(err.response?.data?.error || "Failed to save as template");
    }
  }
);

export const createForm = createAsyncThunk(
  "forms/createForm",
  async (data: { name: string; description?: string; schema: FormSchema; settings?: FormSettings; teamId?: string | null }, { rejectWithValue }) => {
    try {
      const response = await api.post("/forms", data);
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      return rejectWithValue(err.response?.data?.error || "Failed to create form");
    }
  }
);

export const updateForm = createAsyncThunk(
  "forms/updateForm",
  async ({ id, data }: { id: string; data: Partial<{ name: string; description: string; schema: FormSchema; settings: FormSettings; isPublished: boolean }> }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/forms/${id}`, data);
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      return rejectWithValue(err.response?.data?.error || "Failed to update form");
    }
  }
);

export const deleteForm = createAsyncThunk(
  "forms/deleteForm",
  async (formId: string, { rejectWithValue }) => {
    try {
      await api.delete(`/forms/${formId}`);
      return formId;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      return rejectWithValue(err.response?.data?.error || "Failed to delete form");
    }
  }
);

export const publishForm = createAsyncThunk(
  "forms/publishForm",
  async (formId: string, { rejectWithValue }) => {
    try {
      const response = await api.post(`/forms/${formId}/publish`);
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      return rejectWithValue(err.response?.data?.error || "Failed to publish form");
    }
  }
);

const formsSlice = createSlice({
  name: "forms",
  initialState,
  reducers: {
    setCurrentForm: (state, action: PayloadAction<Form | null>) => {
      state.currentForm = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchForms.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchForms.fulfilled, (state, action) => {
        state.isLoading = false;
        state.forms = action.payload;
      })
      .addCase(fetchForms.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchForm.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchForm.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentForm = action.payload;
      })
      .addCase(fetchForm.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(createTemplate.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createTemplate.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(createTemplate.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(duplicateTemplate.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(duplicateTemplate.fulfilled, (state, action) => {
        state.isLoading = false;
        // payload currently contains only { id, name, message }
        // add to forms list but do not set currentForm since it's incomplete
        state.forms.unshift(action.payload as any);
        // currentForm will be populated via fetchForm effect after navigation
      })
      .addCase(duplicateTemplate.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(createForm.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createForm.fulfilled, (state, action) => {
        state.isLoading = false;
        state.forms.unshift(action.payload);
        state.currentForm = action.payload;
      })
      .addCase(createForm.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(updateForm.fulfilled, (state, action) => {
        const index = state.forms.findIndex(f => f.id === action.payload.id);
        if (index !== -1) {
          state.forms[index] = action.payload;
        }
        if (state.currentForm?.id === action.payload.id) {
          state.currentForm = action.payload;
        }
      })
      .addCase(deleteForm.fulfilled, (state, action) => {
        state.forms = state.forms.filter(f => f.id !== action.payload);
        if (state.currentForm?.id === action.payload) {
          state.currentForm = null;
        }
      })
      .addCase(publishForm.fulfilled, (state, action) => {
        const index = state.forms.findIndex(f => f.id === action.payload.id);
        if (index !== -1) {
          state.forms[index] = action.payload;
        }
        if (state.currentForm?.id === action.payload.id) {
          state.currentForm = action.payload;
        }
      })
      .addCase(duplicateForm.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(duplicateForm.fulfilled, (state, action) => {
        state.isLoading = false;
        state.forms.unshift(action.payload);
      })
      .addCase(duplicateForm.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(saveFormAsTemplate.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(saveFormAsTemplate.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(saveFormAsTemplate.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setCurrentForm, clearError } = formsSlice.actions;
export default formsSlice.reducer;
