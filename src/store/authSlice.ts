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
  { role: "admin"; admin: unknown },
  { email: string; password: string },
  { rejectValue: string }
>("auth/adminLogin", async (data, { rejectWithValue }) => {
  try {
    const res = await axios.post("/api/admin/login", data, {
      withCredentials: true,
    });
    return { role: "admin" as const, admin: res.data.admin };
  } catch (err) {
    const error = err as AxiosError<{ error?: string }>;
    return rejectWithValue(error.response?.data?.error || "Login failed");
  }
});

// 👉 Ye sirf USER ke liye hai
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

    // backend se agar galti se role admin aajaye phir bhi hum yaha USER hi set karenge
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
      // ADMIN LOGIN
      .addCase(adminLogin.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        adminLogin.fulfilled,
        (state, action: PayloadAction<{ role: "admin"; admin: unknown }>) => {
          state.loading = false;
          state.role = action.payload.role;
          state.error = null;
        }
      )
      .addCase(adminLogin.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || "Login failed";
      })

      // USER LOGIN
      .addCase(userLogin.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        userLogin.fulfilled,
        (state, action: PayloadAction<{ role: "user"; user: LoginUser }>) => {
          state.loading = false;
          state.role = action.payload.role; // hamesha "user"
          state.user = action.payload.user;
          state.error = null;
        }
      )
      .addCase(userLogin.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || "Login failed";
      })

      // LOGOUT
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
