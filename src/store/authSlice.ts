import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import api, { refreshSession, setAccessToken } from '../lib/api';
import type { AuthState, User } from '../types';
import { RemoveItemsFromLocalStorage } from '../lib/utils';

const initialState: AuthState = {
  user: null,
  accountUser: null,
  token: null,
  bootstrapped: false,
  isLoading: false,
  error: null,
  needsOrgSetup: null,
};

function message(error: unknown, fallback: string): string {
  const err = error as { response?: { data?: { error?: string; message?: string } } };
  return err.response?.data?.error ?? err.response?.data?.message ?? fallback;
}

/**
 * Create an account.
 *
 * One call. The account used to be created in two - once against the
 * user-management service from the browser, once against this backend - and a
 * failure in between left a person able to sign in and be refused forever.
 */
export const register = createAsyncThunk(
  'auth/register',
  async (
    data: {
      email: string;
      password: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      username: string;
      gender?: string;
      address?: string;
      additionalDetails?: Record<string, unknown>;
    },
    { rejectWithValue }
  ) => {
    try {
      const response = await api.post('/auth/register', data);
      return response.data;
    } catch (error: unknown) {
      return rejectWithValue(message(error, 'Registration failed'));
    }
  }
);

export const login = createAsyncThunk(
  'auth/login',
  async (data: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const response = await api.post('/auth/login', data);
      setAccessToken(response.data.accessToken);
      return {
        token: response.data.accessToken as string,
        user: response.data.user as User | null,
      };
    } catch (error: unknown) {
      return rejectWithValue(message(error, 'Login failed'));
    }
  }
);

/**
 * Resume a session on page load.
 *
 * The access token is not persisted anywhere the page can read, so the only way
 * back into a session after a reload is to exchange the refresh cookie.
 */
export const restoreSession = createAsyncThunk('auth/restoreSession', async (_, { rejectWithValue }) => {
  try {
    return await refreshSession();
  } catch {
    return rejectWithValue(null);
  }
});

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
      return rejectWithValue(message(error, 'Session fetch failed'));
    }
  }
);

export const logout = createAsyncThunk('auth/logout', async () => {
  try {
    await api.post('/auth/logout');
  } catch {
    // The local session is cleared regardless: a failure to revoke upstream
    // must never leave someone apparently signed in.
  }
  setAccessToken(null);
  RemoveItemsFromLocalStorage();
  return null;
});

/** Account details as the user-management service holds them, for the profile screen. */
export const fetchAccountDetails = createAsyncThunk(
  'auth/fetchAccountDetails',
  async (_: void, { rejectWithValue }) => {
    try {
      const response = await api.get('/auth/account');
      return response.data;
    } catch (error: unknown) {
      return rejectWithValue(message(error, 'Failed to fetch user details'));
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
      // The backend updates the user-management service first and only mirrors
      // the change locally once that succeeded.
      const response = await api.put('/auth/profile', data);
      return response.data?.user ?? data;
    } catch (error: unknown) {
      return rejectWithValue(message(error, 'Failed to update profile'));
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
      .addCase(register.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(register.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.token = action.payload.token;
        state.bootstrapped = true;
        if (action.payload.user) state.accountUser = action.payload.user;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.token = action.payload as string;
        state.bootstrapped = true;
      })
      .addCase(restoreSession.rejected, (state) => {
        state.token = null;
        state.bootstrapped = true;
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
      .addCase(getSession.rejected, (state, action) => {
        state.isLoading = false;
        state.user = null;
        // Keep the token for transient network failures, but remember the
        // message so the UI can tell a real "user not found" apart from a
        // blip and respond accordingly (sign out vs. retry).
        state.error = (action.payload as string) ?? 'Session fetch failed';
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.accountUser = null;
        state.token = null;
        state.needsOrgSetup = null;
        state.bootstrapped = true;
      })
      .addCase(fetchAccountDetails.fulfilled, (state, action) => {
        if (action.payload) {
          state.accountUser = action.payload;
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
