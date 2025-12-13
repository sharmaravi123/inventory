import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";

export interface Warehouse {
  _id: string;
  id: string;
  name: string;
  address?: string;
  meta?: Record<string, unknown>;
  createdAt?: string;
}

interface WarehouseState {
  list: Warehouse[];
  loading: boolean;
  error: string | null;
}

const initialState: WarehouseState = {
  list: [],
  loading: false,
  error: null,
};

// 🟢 Fetch all warehouses
export const fetchWarehouses = createAsyncThunk<
  Warehouse[],
  void,
  { rejectValue: string }
>("warehouse/fetchAll", async (_, { rejectWithValue }) => {
  try {
    const token = localStorage.getItem("token");
    const res = await axios.get("/api/warehouse", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data.warehouses as Warehouse[];
  } catch (err: unknown) {
    const message =
      axios.isAxiosError(err) && err.response?.data?.error
        ? err.response.data.error
        : "Failed to fetch warehouses";
    return rejectWithValue(message);
  }
});

// 🟢 Create new warehouse
export const createWarehouse = createAsyncThunk<
  Warehouse,
  { name: string; address?: string; meta?: Record<string, unknown> },
  { rejectValue: string }
>("warehouse/create", async (payload, { rejectWithValue }) => {
  try {
    const token = localStorage.getItem("token");
    const res = await axios.post("/api/warehouse/create", payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data.warehouse as Warehouse;
  } catch (err: unknown) {
    const message =
      axios.isAxiosError(err) && err.response?.data?.error
        ? err.response.data.error
        : "Failed to create warehouse";
    return rejectWithValue(message);
  }
});

// Update warehouse (name + address)
export const updateWarehouse = createAsyncThunk(
  "warehouse/update",
  async (
    payload: { id: string; name?: string; address?: string },
    { rejectWithValue }
  ) => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.put(`/api/warehouse/${payload.id}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data.warehouse; // returns updated document
    } catch (err: unknown) {
      return rejectWithValue((err as Error).message);
    }
  }
);


// 🟢 Delete warehouse
export const deleteWarehouse = createAsyncThunk<
  string,
  string,
  { rejectValue: string }
>("warehouse/delete", async (id, { rejectWithValue }) => {
  try {
    const token = localStorage.getItem("token");
    await axios.delete(`/api/warehouse/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return id;
  } catch (err: unknown) {
    const message =
      axios.isAxiosError(err) && err.response?.data?.error
        ? err.response.data.error
        : "Failed to delete warehouse";
    return rejectWithValue(message);
  }
});

// 🟡 Slice
const warehouseSlice = createSlice({
  name: "warehouse",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // Fetch all
      .addCase(fetchWarehouses.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWarehouses.fulfilled, (state, action: PayloadAction<Warehouse[]>) => {
        state.loading = false;
        state.list = action.payload;
      })
      .addCase(fetchWarehouses.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Error fetching warehouses";
      })

      // Create
      .addCase(createWarehouse.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createWarehouse.fulfilled, (state, action: PayloadAction<Warehouse>) => {
        state.loading = false;
        state.list.unshift(action.payload);
      })
      .addCase(createWarehouse.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Error creating warehouse";
      })

      // Update
      .addCase(updateWarehouse.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateWarehouse.fulfilled, (state, action) => {
        state.loading = false;
        const updated = action.payload;
        const idx = state.list.findIndex((w) => w._id === updated._id);
        if (idx >= 0) {
          state.list[idx] = updated; 
        }
      })
      .addCase(updateWarehouse.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })


      // Delete
      .addCase(deleteWarehouse.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteWarehouse.fulfilled, (state, action: PayloadAction<string>) => {
        state.loading = false;
        state.list = state.list.filter((w) => w._id !== action.payload);
      })
      .addCase(deleteWarehouse.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Error deleting warehouse";
      });
  },
});

export default warehouseSlice.reducer;
