import {
  createSlice,
  createAsyncThunk,
  PayloadAction,
} from "@reduxjs/toolkit";
import type { CreateBillPayload } from "../store/billingApi";
import { billingApi } from "./billingApi";

export type BillingStatus = "idle" | "loading" | "succeeded" | "failed";

export interface BillingState {
  status: BillingStatus;
  lastInvoiceNumber?: string;
  errorMessage?: string;
}

const initialState: BillingState = {
  status: "idle",
  lastInvoiceNumber: undefined,
  errorMessage: undefined,
};

export const submitBill = createAsyncThunk<
  string,
  CreateBillPayload,
  { rejectValue: string }
>(
  "billing/submitBill",
  async (payload, { rejectWithValue, dispatch }) => {
    try {
      const result = await dispatch(
        billingApi.endpoints.createBill.initiate(payload)
      ).unwrap();

      // Keep list in sync immediately after create, so UI updates without manual reload.
      dispatch(billingApi.util.invalidateTags(["BillList"]));
      dispatch(
        billingApi.endpoints.listBills.initiate(
          { search: "" },
          { subscribe: false, forceRefetch: true }
        )
      );

      return result.bill.invoiceNumber;
    } catch (err) {
      let message = "Failed to create bill";
      const error = err as unknown;

      if (
        typeof error === "object" &&
        error !== null &&
        "data" in error
      ) {
        const data = (error as { data?: unknown }).data;
        if (
          typeof data === "object" &&
          data !== null &&
          "error" in data
        ) {
          const raw = (data as { error: unknown }).error;
          message = String(raw);
        }
      } else if (error instanceof Error) {
        message = error.message;
      }

      return rejectWithValue(message);
    }
  }
);

const billingSlice = createSlice({
  name: "billing",
  initialState,
  reducers: {
    resetBillingState: () => initialState,
    clearBillingError(state) {
      state.errorMessage = undefined;
    },
    clearBillingSuccess(state) {
      state.lastInvoiceNumber = undefined;
      state.status = "idle";
    },
    setBillingError(state, action: PayloadAction<string>) {
      state.errorMessage = action.payload;
      state.status = "failed";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(submitBill.pending, (state) => {
        state.status = "loading";
        state.errorMessage = undefined;
        state.lastInvoiceNumber = undefined;
      })
      .addCase(
        submitBill.fulfilled,
        (state, action: PayloadAction<string>) => {
          state.status = "succeeded";
          state.lastInvoiceNumber = action.payload;
          state.errorMessage = undefined;
        }
      )
      .addCase(submitBill.rejected, (state, action) => {
        state.status = "failed";
        state.lastInvoiceNumber = undefined;
        state.errorMessage =
          action.payload ?? "Bill submission failed";
      });
  },
});

export const {
  resetBillingState,
  clearBillingError,
  clearBillingSuccess,
  setBillingError,
} = billingSlice.actions;

export default billingSlice.reducer;
