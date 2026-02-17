import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";


export interface CategoryType {
  id?: string | number;   // used in normalized API responses
  _id?: string;           // used when Mongoose sends raw documents
  name: string;
  description?: string | null;
}

interface CategoryState {
  categories: CategoryType[];
  loading: boolean;
  error: string | null;
}

const initialState: CategoryState = {
  categories: [],
  loading: false,
  error: null,
};

// Helper to get token
const getToken = () => localStorage.getItem("token");

// Async thunks
export const fetchCategories = createAsyncThunk(
  "category/fetchCategories",
  async () => {
    const token = getToken();
    const res = await fetch("/api/categories", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) throw new Error("Failed to fetch categories");
    return (await res.json()) as CategoryType[];
  }
);

export const addCategory = createAsyncThunk(
  "category/addCategory",
  async (data: { name: string; description?: string }, { rejectWithValue }) => {
    const token = getToken();
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      return rejectWithValue(err.error || "Failed to add category");
    }
    return (await res.json()) as CategoryType;
  }
);

export const updateCategory = createAsyncThunk(
  "category/updateCategory",
  async ({ id, name, description }: { id: string; name: string; description?: string }, { rejectWithValue }) => {
    const token = getToken();
    const res = await fetch(`/api/categories/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name, description }),
    });
    if (!res.ok) {
      const err = await res.json();
      return rejectWithValue(err.error || "Failed to update category");
    }
    return (await res.json()) as CategoryType;
  }
);

export const deleteCategory = createAsyncThunk(
  "category/deleteCategory",
  async (id: number, { rejectWithValue }) => {
    const token = getToken();
    const res = await fetch(`/api/categories/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      const err = await res.json();
      return rejectWithValue(err.error || "Failed to delete category");
    }
    return id;
  }
);

export const categorySlice = createSlice({
  name: "category",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // fetch
      .addCase(fetchCategories.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCategories.fulfilled, (state, action: PayloadAction<CategoryType[]>) => {
        state.loading = false;
        state.categories = action.payload;
      })
      .addCase(fetchCategories.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || null;
      })
      // add
      .addCase(addCategory.fulfilled, (state, action: PayloadAction<CategoryType>) => {
        state.categories.unshift(action.payload);
      })
      .addCase(addCategory.rejected, (state, action) => {
        state.error = typeof action.payload === "string" ? action.payload : "Add failed";
      })
      // update
      .addCase(updateCategory.fulfilled, (state, action: PayloadAction<CategoryType>) => {
        state.categories = state.categories.map((c) =>
          c.id === action.payload.id ? action.payload : c
        );
      })
      .addCase(updateCategory.rejected, (state, action) => {
        state.error = typeof action.payload === "string" ? action.payload : "Update failed";
      })
      .addCase(deleteCategory.fulfilled, (state, action: PayloadAction<number>) => {
        state.categories = state.categories.filter(
          (c) => c.id !== action.payload
        );
      })
      .addCase(deleteCategory.rejected, (state, action) => {
        state.error = typeof action.payload === "string" ? action.payload : "Delete failed";
      });
  },
});

export default categorySlice.reducer;
