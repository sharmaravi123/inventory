import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";

export interface ProductType {
  _id: string;
  id: string;
  name: string;
  sku: string;
  categoryId: string;
  category?: { id: string; name: string } | null;
  purchasePrice: number;
    taxPercent: number;     // ✅ FIXED REQUIRED
  perBoxItem: number;
  sellingPrice: number;
  description?: string;
}

interface ProductState {
  products: ProductType[];
  loading: boolean;
  error: string | null;
}

const initialState: ProductState = { products: [], loading: false, error: null };

const getToken = () => localStorage.getItem("token");

// ✅ Fetch all products
export const fetchProducts = createAsyncThunk("product/fetchProducts", async (_, { rejectWithValue }) => {
  const token = getToken();
  try {
    const res = await fetch("/api/products", { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to fetch products");
    return data as ProductType[];
  } catch (err: unknown) {
    return rejectWithValue((err as Error).message);
  }
});

// ✅ Add product
export const addProduct = createAsyncThunk(
  "product/addProduct",
  async (payload: Partial<ProductType>, { rejectWithValue }) => {
    const token = getToken();
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add product");
      return data as ProductType;
    } catch (err: unknown) {
      return rejectWithValue((err as Error).message);
    }
  }
);

// ✅ Update product
export const updateProduct = createAsyncThunk(
  "product/updateProduct",
  async ({ id, ...payload }: Partial<ProductType> & { id: string }, { rejectWithValue }) => {
    const token = getToken();
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update product");
      return data as ProductType;
    } catch (err: unknown) {
      return rejectWithValue((err as Error).message);
    }
  }
);

// ✅ Delete product
export const deleteProduct = createAsyncThunk(
  "product/deleteProduct",
  async (id: string, { rejectWithValue }) => {
    const token = getToken();
    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete product");
      return id;
    } catch (err: unknown) {
      return rejectWithValue((err as Error).message);
    }
  }
);

// ✅ Slice
export const productSlice = createSlice({
  name: "product",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchProducts.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchProducts.fulfilled, (state, action: PayloadAction<ProductType[]>) => {
        state.loading = false; state.products = action.payload;
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        state.loading = false; state.error = action.payload as string;
      })
      .addCase(addProduct.fulfilled, (state, action: PayloadAction<ProductType>) => {
        state.products.unshift(action.payload);
      })
      .addCase(updateProduct.fulfilled, (state, action: PayloadAction<ProductType>) => {
        state.products = state.products.map(p => p.id === action.payload.id ? action.payload : p);
      })
      .addCase(deleteProduct.fulfilled, (state, action: PayloadAction<string>) => {
        state.products = state.products.filter(p => p.id !== action.payload);
      });
  },
});

export default productSlice.reducer;
