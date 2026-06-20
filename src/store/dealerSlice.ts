import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";
import {
  shouldSkipListFetch,
  type FetchWithForce,
} from "@/store/cachePolicy";
import type { RootState } from "@/store/store";

export interface Dealer {
    _id: string;
    name: string;
    phone: string;
    address?: string;
    gstin?: string;
    fassiNumber?: string;
    isActive?: boolean;
}

interface DealerState {
    list: Dealer[];
    loading: boolean;
    lastFetchedAt: number | null;
}

const initialState: DealerState = {
    list: [],
    loading: false,
    lastFetchedAt: null,
};

const getToken = () =>
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

export const fetchDealers = createAsyncThunk<
    Dealer[],
    FetchWithForce,
    { state: RootState }
>(
    "dealer/fetch",
    async () => {
        const res = await axios.get("/api/dealers", {
            headers: { Authorization: `Bearer ${getToken()}` },
        });
        return res.data.dealers;
    },
    {
        condition: (arg, { getState }) => {
            const { list, loading, lastFetchedAt } = getState().dealer;
            return !shouldSkipListFetch(loading, list.length, lastFetchedAt, arg);
        },
    }
);
export const createDealer = createAsyncThunk<Dealer, Partial<Dealer>>(
    "dealer/create",
    async (data) => {
        const res = await axios.post("/api/dealers", data, {
            headers: { Authorization: `Bearer ${getToken()}` },
        });
        return res.data;
    }
);
const dealerSlice = createSlice({
    name: "dealer",
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchDealers.pending, (state) => {
                state.loading = true;
            })
            .addCase(createDealer.fulfilled, (state, action) => {
                state.list.unshift(action.payload);
            })
            .addCase(
                fetchDealers.fulfilled,
                (state, action: PayloadAction<Dealer[]>) => {
                    state.loading = false;
                    state.list = action.payload;
                    state.lastFetchedAt = Date.now();
                }
            );
    },
});

export default dealerSlice.reducer;
