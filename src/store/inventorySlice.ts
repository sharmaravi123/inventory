import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";

export interface InventoryItem {
  _id: string;

  product?: {
    _id?: string;
    id?: string | number;
    name?: string;
    purchasePrice?: number;
    sellingPrice?: number;
    price?: number;
    perBoxItem?: number;  // ⭐ यही से itemsPerBox मिलेगा
    taxPercent?: number;
  };

  warehouse?: {
    _id?: string;
    id?: string | number;
    name?: string;
  };

  productId?: string;
  warehouseId?: string;

  boxes: number;
  looseItems: number;

  /** server से आता है, अगर नहीं भी आए तो हम product.perBoxItem से खुद calc कर सकते हैं */
  totalItems: number;

  lowStockBoxes?: number | null;
  lowStockItems?: number | null;

  createdAt?: string;
  updatedAt?: string;
}

const getToken = (): string =>
  typeof window !== "undefined"
    ? localStorage.getItem("token") ?? ""
    : "";

export const fetchInventory = createAsyncThunk<InventoryItem[]>(
  "inventory/fetch",
  async () => {
    const token = getToken();
    const res = await axios.get("/api/stocks", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return (res.data?.stocks ?? []) as InventoryItem[];
  }
);

export const addInventory = createAsyncThunk<
  InventoryItem,
  Partial<InventoryItem>
>("inventory/add", async (payload) => {
  const token = getToken();
  const res = await axios.post("/api/stocks", payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data as InventoryItem;
});

export const updateInventory = createAsyncThunk<
  InventoryItem,
  { id: string; data: Partial<InventoryItem> }
>("inventory/update", async ({ id, data }) => {
  const token = getToken();
  const res = await axios.put(`/api/stocks/${id}`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data as InventoryItem;
});

export const deleteInventory = createAsyncThunk<string, string>(
  "inventory/delete",
  async (id) => {
    const token = getToken();
    await axios.delete(`/api/stocks/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return id;
  }
);

interface InventoryState {
  items: InventoryItem[];
  loading: boolean;
  error?: string | null;
}

const initialState: InventoryState = {
  items: [],
  loading: false,
  error: null,
};

const inventorySlice = createSlice({
  name: "inventory",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchInventory.pending, (state) => {
        state.loading = true;
      })
      .addCase(
        fetchInventory.fulfilled,
        (state, action: PayloadAction<InventoryItem[]>) => {
          state.items = action.payload;
          state.loading = false;
        }
      )
      .addCase(fetchInventory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? "Failed to fetch inventory";
      })
      .addCase(
        addInventory.fulfilled,
        (state, action: PayloadAction<InventoryItem>) => {
          state.items.unshift(action.payload);
        }
      )
      .addCase(
        updateInventory.fulfilled,
        (state, action: PayloadAction<InventoryItem>) => {
          const idx = state.items.findIndex(
            (x) => x._id === action.payload._id
          );
          if (idx !== -1) state.items[idx] = action.payload;
        }
      )
      .addCase(
        deleteInventory.fulfilled,
        (state, action: PayloadAction<string>) => {
          state.items = state.items.filter((x) => x._id !== action.payload);
        }
      );
  },
});

export default inventorySlice.reducer;
