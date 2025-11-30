// store/authSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import axios, { AxiosError } from "axios";

interface LoginUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  warehouses: { _id: string; name: string }[];
  access: Record<string, unknown>;
}

interface AdminLoginData {
  id: string;
  name: string | null;
  email: string | null;
  role: "admin";
  token: string;
}

interface AuthState {
  role: "admin" | "user" | null;
  loading: boolean;
  error: string | null;
  user: LoginUser | null;
}

const initialState: AuthState = {
  role: null,
  loading: false,
  error: null,
  user: null,
};

export const adminLogin = createAsyncThunk<
  { role: "admin"; admin: AdminLoginData },
  { email: string; password: string },
  { rejectValue: string }
>("auth/adminLogin", async (data, { rejectWithValue }) => {
  try {
    const res = await axios.post("/api/admin/login", data, {
      withCredentials: true,
    });

    const admin = res.data.admin as AdminLoginData;

    return { role: "admin" as const, admin };
  } catch (err) {
    const error = err as AxiosError<{ error?: string }>;
    return rejectWithValue(error.response?.data?.error || "Login failed");
  }
});

export const userLogin = createAsyncThunk<
  { role: "user"; user: LoginUser },
  { email: string; password: string },
  { rejectValue: string }
>("auth/userLogin", async (payload, { rejectWithValue }) => {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await res.json()) as {
      success?: boolean;
      user?: LoginUser;
      error?: string;
    };

    if (!res.ok || !data.user) {
      return rejectWithValue(data.error ?? "Login failed");
    }

    return { role: "user" as const, user: data.user };
  } catch {
    return rejectWithValue("Login failed");
  }
});

export const logoutUser = createAsyncThunk("auth/logoutUser", async () => {
  const res = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin",
  });
  if (!res.ok) {
    throw new Error("Logout failed");
  }
  return true;
});

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    clearAuth(state) {
      state.role = null;
      state.error = null;
      state.user = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(adminLogin.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(adminLogin.fulfilled, (state, action) => {
        state.loading = false;
        state.role = action.payload.role;
        state.error = null;
        // Admin data store karo if needed
        state.user = {
          id: action.payload.admin.id,
          name: action.payload.admin.name || "",
          email: action.payload.admin.email || "",
          role: "admin",
          warehouses: [],
          access: {},
        };
      })
      .addCase(adminLogin.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || "Login failed";
      })
      .addCase(userLogin.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        userLogin.fulfilled,
        (state, action: PayloadAction<{ role: "user"; user: LoginUser }>) => {
          state.loading = false;
          state.role = action.payload.role;
          state.user = action.payload.user;
          state.error = null;
        }
      )
      .addCase(userLogin.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || "Login failed";
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.role = null;
        state.loading = false;
        state.user = null;
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.error = action.error.message || "Logout failed";
        state.loading = false;
      });
  },
});

export const { clearAuth } = authSlice.actions;
export default authSlice.reducer;
