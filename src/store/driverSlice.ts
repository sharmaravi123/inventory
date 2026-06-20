// src/store/driverSlice.ts
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  shouldSkipListFetch,
  type FetchWithForce,
} from "@/store/cachePolicy";
import type { RootState } from "@/store/store";

export type Driver = {
  _id: string;
  name: string;
  email: string;
  phone: string;
  vehicleNumber: string;
  vehicleType?: string;
  isActive: boolean;
};

type DriversResponse = {
  drivers: Driver[];
};

type RegisterDriverBody = {
  name: string;
  email: string;
  password: string;
  phone: string;
  vehicleNumber: string;
  vehicleType?: string;
};

type RegisterDriverResponse = {
  driver?: Driver;
  error?: string;
};

type UpdateDriverBody = {
  name?: string;
  email?: string;
  phone?: string;
  vehicleNumber?: string;
  vehicleType?: string;
  isActive?: boolean;
  password?: string;
};

type UpdateDriverResponse = {
  driver?: Driver;
  error?: string;
};

type DeleteDriverResponse = {
  success: boolean;
};

type LoginBody = {
  email: string;
  password: string;
};

type LoginResponse = {
  driver?: Omit<Driver, "isActive">;
  token?: string;
  error?: string;
};

type MeResponse = {
  driver?: Omit<Driver, "isActive">;
  error?: string;
};

type DriverState = {
  items: Driver[];
  loading: boolean;
  saving: boolean;
  deletingId: string | null;
  error: string | null;
  currentDriver: Driver | null;
  authToken: string | null;
  authLoading: boolean;
  authError: string | null;
  lastFetchedAt: number | null;
};

const initialState: DriverState = {
  items: [],
  loading: false,
  saving: false,
  deletingId: null,
  error: null,
  currentDriver: null,
  authToken: null,
  authLoading: false,
  authError: null,
  lastFetchedAt: null,
};

// GET /api/driver
export const fetchDrivers = createAsyncThunk<
  Driver[],
  FetchWithForce,
  { rejectValue: string; state: RootState }
>(
  "drivers/fetchAll",
  async (_, { rejectWithValue }) => {
  try {
    const res = await fetch("/api/driver", { method: "GET" });
    const data = (await res.json()) as DriversResponse | { error?: string };

    if (!res.ok) {
      const message =
        "error" in data && typeof data.error === "string"
          ? data.error
          : "Failed to fetch driver";
      return rejectWithValue(message);
    }

    if (!("drivers" in data) || !Array.isArray(data.drivers)) {
      return rejectWithValue("Invalid drivers response");
    }

    return data.drivers;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch drivers";
    return rejectWithValue(message);
  }
  },
  {
    condition: (arg, { getState }) => {
      const { items, loading, lastFetchedAt } = getState().driver;
      return !shouldSkipListFetch(loading, items.length, lastFetchedAt, arg);
    },
  }
);

// POST /api/driver/register
export const createDriver = createAsyncThunk<
  Driver,
  RegisterDriverBody,
  { rejectValue: string }
>("drivers/create", async (body, { rejectWithValue }) => {
  try {
    const res = await fetch("/api/driver/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as RegisterDriverResponse;

    if (!res.ok || !data.driver) {
      const message = data.error ?? "Failed to create driver";
      return rejectWithValue(message);
    }

    return data.driver;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create driver";
    return rejectWithValue(message);
  }
});

// PUT /api/driver/[id]
export const updateDriver = createAsyncThunk<
  Driver,
  { id: string; updates: UpdateDriverBody },
  { rejectValue: string }
>("drivers/update", async ({ id, updates }, { rejectWithValue }) => {
  try {
    const res = await fetch(`/api/driver/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    const data = (await res.json()) as UpdateDriverResponse;

    if (!res.ok || !data.driver) {
      const message = data.error ?? "Failed to update driver";
      return rejectWithValue(message);
    }

    return data.driver;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update driver";
    return rejectWithValue(message);
  }
});

// DELETE /api/driver/[id]
export const deleteDriver = createAsyncThunk<
  string,
  string,
  { rejectValue: string }
>("drivers/delete", async (id, { rejectWithValue }) => {
  try {
    const res = await fetch(`/api/driver/${id}`, {
      method: "DELETE",
    });

    const data = (await res.json()) as DeleteDriverResponse | { error?: string };

    if (!res.ok) {
      const message =
        "error" in data && typeof data.error === "string"
          ? data.error
          : "Failed to delete driver";
      return rejectWithValue(message);
    }

    if (!("success" in data) || data.success !== true) {
      return rejectWithValue("Failed to delete driver");
    }

    return id;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to delete driver";
    return rejectWithValue(message);
  }
});

// POST /api/driver/login
export const loginDriver = createAsyncThunk<
  { driver: Driver; token: string },
  LoginBody,
  { rejectValue: string }
>("drivers/login", async (body, { rejectWithValue }) => {
  try {
    const res = await fetch("/api/driver/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include",
    });

    const data = (await res.json()) as LoginResponse;

    if (!res.ok || !data.driver || !data.token) {
      const message = data.error ?? "Failed to login";
      return rejectWithValue(message);
    }

    const driver: Driver = {
      ...data.driver,
      isActive: true,
    };

    return { driver, token: data.token };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to login";
    return rejectWithValue(message);
  }
});

// GET /api/driver/me
export const fetchCurrentDriver = createAsyncThunk<
  Driver,
  void,
  { rejectValue: string }
>("drivers/fetchCurrent", async (_, { rejectWithValue }) => {
  try {
    const res = await fetch("/api/driver/me", {
      method: "GET",
      credentials: "include",
    });

    const data = (await res.json()) as MeResponse;

    if (!res.ok || !data.driver) {
      const message = data.error ?? "Failed to fetch driver";
      return rejectWithValue(message);
    }

    const driver: Driver = {
      ...data.driver,
      isActive: true,
    };

    return driver;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch driver";
    return rejectWithValue(message);
  }
});

const driverSlice = createSlice({
  name: "drivers",
  initialState,
  reducers: {
    clearDriverError(state) {
      state.error = null;
    },
    clearDriverAuthError(state) {
      state.authError = null;
    },
    logoutDriver(state) {
      state.currentDriver = null;
      state.authToken = null;
      state.authError = null;
    },
    setCurrentDriver(state, action: PayloadAction<Driver | null>) {
      state.currentDriver = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetch
      .addCase(fetchDrivers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchDrivers.fulfilled,
        (state, action: PayloadAction<Driver[]>) => {
          state.loading = false;
          state.items = action.payload;
          state.lastFetchedAt = Date.now();
        }
      )
      .addCase(fetchDrivers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Failed to fetch drivers";
      })

      // create
      .addCase(createDriver.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(
        createDriver.fulfilled,
        (state, action: PayloadAction<Driver>) => {
          state.saving = false;
          state.items.unshift(action.payload);
        }
      )
      .addCase(createDriver.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload ?? "Failed to create driver";
      })

      // update
      .addCase(updateDriver.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(
        updateDriver.fulfilled,
        (state, action: PayloadAction<Driver>) => {
          state.saving = false;
          const index = state.items.findIndex(
            (d) => d._id === action.payload._id
          );
          if (index !== -1) {
            state.items[index] = action.payload;
          }
        }
      )
      .addCase(updateDriver.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload ?? "Failed to update driver";
      })

      // delete
      .addCase(deleteDriver.pending, (state, action) => {
        state.deletingId = action.meta.arg;
        state.error = null;
      })
      .addCase(
        deleteDriver.fulfilled,
        (state, action: PayloadAction<string>) => {
          state.deletingId = null;
          state.items = state.items.filter((d) => d._id !== action.payload);
        }
      )
      .addCase(deleteDriver.rejected, (state, action) => {
        state.deletingId = null;
        state.error = action.payload ?? "Failed to delete driver";
      })

      // login
      .addCase(loginDriver.pending, (state) => {
        state.authLoading = true;
        state.authError = null;
      })
      .addCase(
        loginDriver.fulfilled,
        (
          state,
          action: PayloadAction<{ driver: Driver; token: string }>
        ) => {
          state.authLoading = false;
          state.currentDriver = action.payload.driver;
          state.authToken = action.payload.token;
        }
      )
      .addCase(loginDriver.rejected, (state, action) => {
        state.authLoading = false;
        state.authError = action.payload ?? "Failed to login";
      })

      // fetch current driver
      .addCase(fetchCurrentDriver.pending, (state) => {
        state.authLoading = true;
        state.authError = null;
      })
      .addCase(
        fetchCurrentDriver.fulfilled,
        (state, action: PayloadAction<Driver>) => {
          state.authLoading = false;
          state.currentDriver = action.payload;
        }
      )
      .addCase(fetchCurrentDriver.rejected, (state, action) => {
        state.authLoading = false;
        state.authError = action.payload ?? "Failed to fetch driver";
        state.currentDriver = null;
      });
  },
});

export const {
  clearDriverError,
  clearDriverAuthError,
  logoutDriver,
  setCurrentDriver,
} = driverSlice.actions;

export default driverSlice.reducer;
