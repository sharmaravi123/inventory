import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

export interface User {
  _id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  warehouses?: { _id: string; name?: string }[]; // populated or just ids
  access?: { level: "all" | "limited"; permissions: string[] };
}

interface UserState {
  list: User[];
  loading: boolean;
  error: string | null;
  current: User | null;
  currentLoading: boolean;
}

const initialState: UserState = {
  list: [],
  loading: false,
  error: null,
  current: null,
  currentLoading: false,
};

const axiosInstance = axios.create({ withCredentials: true, baseURL: "/" });

// 🔹 current logged-in user (token se)
export const fetchCurrentUser = createAsyncThunk<
  User,
  void,
  { rejectValue: string }
>("user/fetchCurrent", async (_, { rejectWithValue }) => {
  try {
    const res = await axiosInstance.get("/api/user/me");
    // expect { user: {...} }
    return (res.data?.user ?? res.data) as User;
  } catch (err: unknown) {
    return rejectWithValue(
      (err as Error).message || "Failed to fetch current user"
    );
  }
});

// fetch all users
export const fetchUsers = createAsyncThunk<
  User[],
  void,
  { rejectValue: string }
>("user/fetchAll", async (_, { rejectWithValue }) => {
  try {
    const res = await axiosInstance.get("/api/user/list");
    const data = res.data?.users ?? res.data;
    return (data as User[]) || [];
  } catch (err: unknown) {
    return rejectWithValue(
      (err as Error).message || "Failed to fetch users"
    );
  }
});

// create user (single warehouseId)
export const createUser = createAsyncThunk<
  User,
  {
    name: string;
    email: string;
    password?: string; // optional
    warehouseId?: string; // single warehouse
    access: { level: "all" | "limited"; permissions: string[] };
  },
  { rejectValue: string }
>("user/create", async (payload, { rejectWithValue }) => {
  try {
    const res = await axiosInstance.post("/api/user/create", payload);
    return res.data.user as User;
  } catch (err: unknown) {
    return rejectWithValue(
      (err as Error).message || "Failed to create user"
    );
  }
});

// update access / single warehouse
export const updateUserAccess = createAsyncThunk<
  User,
  {
    userId: string;
    access?: { level: "all" | "limited"; permissions: string[] };
    warehouseId?: string; // single
  },
  { rejectValue: string }
>("user/updateAccess", async (payload, { rejectWithValue }) => {
  try {
    const res = await axiosInstance.patch("/api/user/update-access", payload);
    return (res.data?.user ?? res.data) as User;
  } catch (err: unknown) {
    return rejectWithValue(
      (err as Error).message || "Failed to update user"
    );
  }
});

// delete user
export const deleteUser = createAsyncThunk<
  string,
  { userId: string },
  { rejectValue: string }
>("user/delete", async ({ userId }, { rejectWithValue }) => {
  try {
    const res = await axiosInstance.post("/api/user/delete", { userId });
    if (res.data?.success) return userId;
    return rejectWithValue(res.data?.error || "Delete failed");
  } catch (err: unknown) {
    return rejectWithValue(
      (err as Error).message || "Failed to delete user"
    );
  }
});

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // 🔹 current user
      .addCase(fetchCurrentUser.pending, (state) => {
        state.currentLoading = true;
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.currentLoading = false;
        state.current = action.payload;
      })
      .addCase(fetchCurrentUser.rejected, (state, action) => {
        state.currentLoading = false;
        state.error = action.payload || "Error loading current user";
      })

      // 🔹 all users
      .addCase(fetchUsers.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload ?? [];
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Error loading users";
      })

      // 🔹 create user
      .addCase(createUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(createUser.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) state.list.unshift(action.payload);
      })
      .addCase(createUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Error creating user";
      })

      // 🔹 update access
      .addCase(updateUserAccess.fulfilled, (state, action) => {
        const user = action.payload;
        if (!user || !user._id) return;
        const idx = state.list.findIndex((u) => u._id === user._id);
        if (idx !== -1) state.list[idx] = user;
        else state.list.unshift(user);

        // agar current user hai to usko bhi update kar do
        if (state.current && state.current._id === user._id) {
          state.current = user;
        }
      })
      .addCase(updateUserAccess.rejected, (state, action) => {
        state.error = action.payload || "Failed to update user";
      })

      // 🔹 delete
      .addCase(deleteUser.fulfilled, (state, action) => {
        state.list = state.list.filter((u) => u._id !== action.payload);
        if (state.current && state.current._id === action.payload) {
          state.current = null;
        }
      })
      .addCase(deleteUser.rejected, (state, action) => {
        state.error = action.payload || "Failed to delete user";
      });
  },
});

export default userSlice.reducer;
