// src/store/inventorySlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";

export interface InventoryItem {
  _id: string;
  // populated nested objects (may be present if API populated relations)
  product?: { _id?: string; id?: string | number; name?: string; purchasePrice?: number };
  warehouse?: { _id?: string; id?: string | number; name?: string };

  // raw id fields (may be present if API returned IDs only)
  productId?: string;
  warehouseId?: string;

  boxes: number;
  itemsPerBox: number;
  looseItems: number;
  totalItems: number;
  lowStockBoxes?: number | null;
  lowStockItems?: number | null;
  tax: number;
  createdAt?: string;

  updatedAt?: string;

}


const getToken = (): string => (typeof window !== "undefined" ? localStorage.getItem("token") ?? "" : "");

export const fetchInventory = createAsyncThunk<InventoryItem[]>("inventory/fetch", async () => {
  const token = getToken();
  const res = await axios.get("/api/stocks", { headers: { Authorization: `Bearer ${token}` } });
  console.log(res.data, 'console the stock')
  // API returns { stocks: [...] } per our new route
  return (res.data?.stocks ?? []) as InventoryItem[];
});

export const addInventory = createAsyncThunk<InventoryItem, Partial<InventoryItem>>(
  "inventory/add",
  async (payload) => {
    const token = getToken();
    const res = await axios.post("/api/stocks", payload, { headers: { Authorization: `Bearer ${token}` } });
    return res.data as InventoryItem;
  }
);

export const updateInventory = createAsyncThunk<InventoryItem, { id: string; data: Partial<InventoryItem> }>(
  "inventory/update",
  async ({ id, data }) => {
    const token = getToken();
    const res = await axios.put(`/api/stocks/${id}`, data, { headers: { Authorization: `Bearer ${token}` } });
    return res.data as InventoryItem;
  }
);


export const deleteInventory = createAsyncThunk<string, string>("inventory/delete", async (id) => {
  const token = getToken();
  await axios.delete(`/api/stocks/${id}`, { headers: { Authorization: `Bearer ${token}` } });
  return id;
});

interface InventoryState {
  items: InventoryItem[];
  loading: boolean;
  error?: string | null;
}

const initialState: InventoryState = { items: [], loading: false, error: null };

const inventorySlice = createSlice({
  name: "inventory",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchInventory.pending, (s) => { s.loading = true; })
      .addCase(fetchInventory.fulfilled, (s, a: PayloadAction<InventoryItem[]>) => { s.items = a.payload; s.loading = false; })
      .addCase(fetchInventory.rejected, (s, a) => { s.loading = false; s.error = a.error.message ?? "Failed to fetch inventory"; })

      .addCase(addInventory.fulfilled, (s, a: PayloadAction<InventoryItem>) => { s.items.unshift(a.payload); })

      .addCase(updateInventory.fulfilled, (s, a: PayloadAction<InventoryItem>) => {
        const idx = s.items.findIndex((x) => x._id === a.payload._id);
        if (idx !== -1) s.items[idx] = a.payload;
      })

      .addCase(deleteInventory.fulfilled, (s, a: PayloadAction<string>) => {
        s.items = s.items.filter((x) => x._id !== a.payload);
      });
  },
});

export default inventorySlice.reducer;
