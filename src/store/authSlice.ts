import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import api, { keycloakApi } from '../lib/api';
import type { AuthState, User } from '../types';
import { RemoveItemsFromLocalStorage } from '../lib/utils';

const initialState: AuthState = {
  user: null,
  keycloakUser: null,
  token: localStorage.getItem('token') || null,
  refreshToken: localStorage.getItem('refreshToken') || null,
  isLoading: false,
  error: null,
  needsOrgSetup: null,
};

/* Keycloak User Registration */
export const registerUser = createAsyncThunk(
  'user/registerUser',
  async (data: { email: string; password: string; firstName?: string; lastName?: string; phone?: string; username?: string; gender?: string; address?: string; additionalDetails: {[key: string]: any}
  }, { rejectWithValue }) => {
    try {
      const response = await keycloakApi.post('/user/', data);
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      return rejectWithValue(err.response?.data?.error || 'Registration failed');
    }
  }
);
/* Form Builder User Registration */
export const register = createAsyncThunk(
  'auth/register',
  async (data:  { id: string; email: string; password: string; firstName?: string; lastName?: string; phone?: string; username?: string; gender?: string; address?: string; additionalDetails: {[key: string]: any}}, { rejectWithValue }) => {
    try {
      const response = await api.post('/auth/register', data);
      localStorage.setItem('token', response.data.token);
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      return rejectWithValue(err.response?.data?.error || 'Registration failed');
    }
  }
);

export const login = createAsyncThunk(
  'auth/login',
  async (data: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const loginResponse = await keycloakApi.post('/user/login', data);
      const payload = loginResponse.data?.data ?? loginResponse.data;
      localStorage.setItem('token', payload.accessToken);
      localStorage.setItem('refreshToken', payload.refreshToken);
      return {
        token: payload.accessToken,
        refreshToken: payload.refreshToken,
        user: {
          ...payload.user,
          name: payload.user.username,
        } as import('../types').User,
      };
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      return rejectWithValue(err.response?.data?.error || 'Login failed');
    }
  }
);

export const getSession = createAsyncThunk(
  'auth/getSession',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/auth/session');
      const session = response.data;
      const orgId = session?.organizations?.[0]?.id;
      if (orgId) {
        localStorage.setItem('currentOrgId', orgId);
      }
      return session;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      return rejectWithValue(err.response?.data?.error || 'Session fetch failed');
    }
  }
);

export const logout = createAsyncThunk('auth/logout', async () => {
  RemoveItemsFromLocalStorage();
  return null;
});

export const fetchKeycloakUserByEmail = createAsyncThunk(
  'auth/fetchKeycloakUserByEmail',
  async (email: string, { rejectWithValue }) => {
    try {
      const response = await keycloakApi.get(`/user/${email}`);
      return response.data?.data ?? response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string; error?: string } } };
      return rejectWithValue(err.response?.data?.message || err.response?.data?.error || 'Failed to fetch user details');
    }
  }
);

export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  async (
    data: { phone?: string; username: string; firstName?: string; lastName?: string; address?: string; gender?: string; additionalDetails?: Record<string, unknown> },
    { rejectWithValue }
  ) => {
    try {
      // Step 1: Update Keycloak user
      const keycloakResponse = await keycloakApi.put('/user', data);

      // Step 2: Only after Keycloak succeeds, update app DB
      await api.put('/auth/profile', data);

      return keycloakResponse.data?.data ?? keycloakResponse.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string; error?: string } } };
      return rejectWithValue(err.response?.data?.message || err.response?.data?.error || 'Failed to update profile');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setUser: (state, action: PayloadAction<User | null>) => {
      state.user = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(register.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
      })
      .addCase(register.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(registerUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.keycloakUser = action.payload.user;  // ? preserved, never overwritten
        state.token = action.payload.token;
        state.refreshToken = action.payload.refreshToken;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(getSession.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getSession.fulfilled, (state, action) => {
        state.isLoading = false;
        const u = action.payload.user;
        state.user = u
          ? {
              ...u,
              name: u.name ?? (u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.firstName ?? u.username ?? null),
            }
          : null;
        state.needsOrgSetup = action.payload.needsOrgSetup ?? false;
      })
      .addCase(getSession.rejected, (state) => {
        state.isLoading = false;
        state.user = null;
        // Do not clear token on session fetch failure
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.keycloakUser = null;
        state.token = null;
        state.refreshToken = null;
      })
      .addCase(fetchKeycloakUserByEmail.fulfilled, (state, action) => {
        if (action.payload) {
          state.keycloakUser = action.payload;
        }
      })
      .addCase(updateProfile.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.isLoading = false;
        if (state.user && action.payload) {
          state.user = { ...state.user, ...action.payload };
        }
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError, setUser } = authSlice.actions;
export default authSlice.reducer;
