import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import {
  shouldSkipRecordFetch,
  type FetchWithForce,
} from "@/store/cachePolicy";
import type { RootState } from "@/store/store";

/* ================= TYPES ================= */

export interface CompanyProfile {
  _id?: string;
  name: string;
  addressLine1: string;
  addressLine2: string;
  phone: string;
  gstin: string;

  bankName: string;
  accountHolder: string;
  accountNumber: string;
  ifscCode: string;
  branch: string;
}

interface CompanyProfileState {
  data: CompanyProfile | null;
  loading: boolean;
  lastFetchedAt: number | null;
}

const initialState: CompanyProfileState = {
  data: null,
  loading: false,
  lastFetchedAt: null,
};

/* ================= API HELPERS ================= */

const getToken = () =>
  typeof window !== "undefined" ? localStorage.getItem("token") : null;

/* ================= THUNKS ================= */

export const fetchCompanyProfile = createAsyncThunk<
  CompanyProfile | null,
  FetchWithForce,
  { state: RootState }
>(
  "companyProfile/fetch",
  async () => {
    const res = await axios.get("/api/company-profile", {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    return res.data;
  },
  {
    condition: (arg, { getState }) => {
      const { data, loading, lastFetchedAt } = getState().companyProfile;
      return !shouldSkipRecordFetch(loading, Boolean(data), lastFetchedAt, arg);
    },
  }
);

export const updateCompanyProfile = createAsyncThunk<
  CompanyProfile,
  CompanyProfile
>(
  "companyProfile/update",
  async (payload) => {
    const res = await axios.put("/api/company-profile", payload, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
        "Content-Type": "application/json",
      },
    });
    return res.data;
  }
);

/* ================= SLICE ================= */

const companyProfileSlice = createSlice({
  name: "companyProfile",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCompanyProfile.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchCompanyProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
        state.lastFetchedAt = Date.now();
      })
      .addCase(fetchCompanyProfile.rejected, (state) => {
        state.loading = false;
      })
      .addCase(updateCompanyProfile.fulfilled, (state, action) => {
        state.data = action.payload;
      });
  },
});

export default companyProfileSlice.reducer;
