import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";

export interface Dealer {
    _id: string;
    name: string;
    phone: string;
    address?: string;
    gstin?: string;
}

interface DealerState {
    list: Dealer[];
    loading: boolean;
}

const initialState: DealerState = {
    list: [],
    loading: false,
};

const getToken = () =>
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

export const fetchDealers = createAsyncThunk<Dealer[]>(
    "dealer/fetch",
    async () => {
        const res = await axios.get("/api/dealers", {
            headers: { Authorization: `Bearer ${getToken()}` },
        });
        return res.data.dealers;
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
                }
            );
    },
});

export default dealerSlice.reducer;
