import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

export interface Purchase {
  _id: string;
  invoiceNumber?: string;
  dealerId?: { name: string; phone: string; address: string };
  items: any[];
  grandTotal: number;
  createdAt: string;
  purchaseDate?: string;
}

interface PurchaseState {
  list: Purchase[];
  loading: boolean;
}

const initialState: PurchaseState = {
  list: [],
  loading: false,
};

const getToken = () =>
  typeof window !== "undefined" ? localStorage.getItem("adminToken") : null;

export const fetchPurchases = createAsyncThunk<Purchase[]>(
  "purchase/fetch",
  async () => {
    const token = getToken();
    const res = await fetch(`/api/purchase`, {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || "Failed to fetch purchases");
    }

    return Array.isArray(data) ? data : [];
  }
);



export const createPurchase = createAsyncThunk<Purchase, any>(
  "purchase/create",
  async (payload) => {
    const res = await fetch("/api/purchase", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || "Failed to create purchase");
    }
    return data;
  }
);

export const updatePurchase = createAsyncThunk<
  Purchase,
  { id: string; payload: any }
>("purchase/update", async ({ id, payload }) => {
  const res = await fetch(`/api/purchase/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error || "Failed to update purchase");
  }

  return data;
});

const purchaseSlice = createSlice({
  name: "purchase",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchPurchases.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchPurchases.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload;
      })
      .addCase(createPurchase.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(updatePurchase.fulfilled, (state) => {
        state.loading = false;
      });

  },
});

export default purchaseSlice.reducer;
