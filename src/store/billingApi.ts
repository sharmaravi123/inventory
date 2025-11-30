// store/billingApi.ts
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export type Customer = {
  _id: string;
  name: string;
  shopName?: string;
  phone: string;
  address: string;
  gstNumber?: string;
};

export type ProductForBilling = {
  id: string;
  name: string;
  sellingPrice: number;
  taxPercent: number;
  itemsPerBox: number;
  boxesAvailable: number;
  looseAvailable: number;
  warehouseId: string;
  warehouseName: string;
};

export type PaymentMode = "CASH" | "UPI" | "CARD" | "SPLIT";

export type CreateBillPaymentInput = {
  mode: PaymentMode;
  cashAmount?: number;
  upiAmount?: number;
  cardAmount?: number;
};

// stockId included
export type BillItemInput = {
  stockId: string;
  productId: string;
  warehouseId: string;
  productName: string;
  sellingPrice: number;
  taxPercent: number;
  quantityBoxes: number;
  quantityLoose: number;
  itemsPerBox: number;
};

// 👇 server se jo item aata hai, usme warehouseId bhi rakho
export type BillItemForClient = {
  productName: string;
  sellingPrice: number;
  taxPercent: number;
  quantityBoxes: number;
  quantityLoose: number;
  itemsPerBox: number;
  totalItems: number;
  totalBeforeTax: number;
  taxAmount: number;
  lineTotal: number;

  // warehouse wise filtering ke liye important:
  warehouseId?: string;
  warehouse?: {
    _id?: string;
    id?: string;
    name?: string;
  };
};

export type PaymentInfoClient = {
  mode: PaymentMode;
  cashAmount: number;
  upiAmount: number;
  cardAmount: number;
};

export type BillStatus =
  | "PENDING"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "PARTIALLY_PAID";

export type Bill = {
  _id: string;
  invoiceNumber: string;
  billDate: string;
  customerInfo: {
    name: string;
    shopName?: string;
    phone: string;
    address: string;
    gstNumber?: string;
  };
  companyGstNumber?: string;
  items: BillItemForClient[];
  totalItems: number;
  totalBeforeTax: number;
  totalTax: number;
  grandTotal: number;
  payment: PaymentInfoClient;
  amountCollected: number;
  balanceAmount: number;
  status: BillStatus;

  // driver + delivery info
  driver?: string;
  vehicleNumber?: string;
  deliveredAt?: string;
};

type CreateBillResponse = {
  bill: {
    _id: string;
    invoiceNumber: string;
    billDate: string;
    grandTotal: number;
  };
};

type CustomersResponse = {
  customers: Customer[];
};

type BillsListResponse = {
  bills: Bill[];
};

type SingleBillResponse = {
  bill: Bill;
};

type AssignDriverPayload = {
  billId: string;
  driverId: string | null;
};

type MarkDeliveredPayload = {
  billId: string;
};

// ---------- RETURNS TYPES (same as before) ----------
export type BillReturnItem = {
  productId: string;
  warehouseId: string;
  productName: string;
  quantityBoxes: number;
  quantityLoose: number;
  itemsPerBox: number;
  totalItems: number;
};

export type BillReturn = {
  _id: string;
  billId: string;
  customerInfo: {
    name: string;
    shopName?: string;
    phone: string;
    address: string;
    gstNumber?: string;
  };
  reason?: string;
  note?: string;
  items: BillReturnItem[];
  createdAt: string;
};

export type CreateBillReturnItemInput = {
  productId: string;
  warehouseId: string;
  quantityBoxes: number;
  quantityLoose: number;
};

export type CreateBillPayload = {
  customer: Customer;
  companyGstNumber?: string;
  billDate: string;
  items: BillItemInput[];
  payment: CreateBillPaymentInput;
  driverId?: string;
  vehicleNumber?: string;
};

export type CreateBillReturnPayload = {
  billId: string;
  items: CreateBillReturnItemInput[];
  reason?: string;
  note?: string;
};

type BillReturnsResponse = {
  returns: BillReturn[];
};

type CreateBillReturnResponse = {
  returnDoc: BillReturn;
};

// 👇 yaha args type change kiya: warehouseId optional
export type BillsListArgs = {
  search: string;
  warehouseId?: string;
};

export const billingApi = createApi({
  reducerPath: "billingApi",
  baseQuery: fetchBaseQuery({
    baseUrl: "/api",
  }),
  tagTypes: ["Bill", "BillList", "BillReturn"],
  endpoints: (builder) => ({
    // -------- create bill --------
    createBill: builder.mutation<CreateBillResponse, CreateBillPayload>({
      query: (payload) => ({
        url: "billing",
        method: "POST",
        body: payload,
      }),
      invalidatesTags: ["BillList"],
    }),

    // -------- list bills (warehouse wise) --------
    listBills: builder.query<BillsListResponse, BillsListArgs>({
      query: ({ search, warehouseId }) => {
        const trimmed = search.trim();
        const params: Record<string, string> = {};

        if (trimmed) {
          // existing filters
          params.customer = trimmed;
          params.phone = trimmed;
        }

        if (warehouseId) {
          // 👇 IMPORTANT: backend ko ye param pe filter lagana hoga
          params.warehouseId = warehouseId;
        }

        return {
          url: "billing",
          params,
        };
      },
      providesTags: (result) =>
        result?.bills
          ? [
              ...result.bills.map((bill) => ({
                type: "Bill" as const,
                id: bill._id,
              })),
              "BillList",
            ]
          : ["BillList"],
    }),

    // -------- get single bill --------
    getBill: builder.query<SingleBillResponse, string>({
      query: (id) => ({
        url: `billing/${id}`,
      }),
      providesTags: (_res, _err, id) => [{ type: "Bill", id }],
    }),

    // -------- update full bill --------
    updateBill: builder.mutation<
      SingleBillResponse,
      { id: string; payload: CreateBillPayload }
    >({
      query: ({ id, payload }) => ({
        url: `billing/${id}`,
        method: "PUT",
        body: {
          customer: payload.customer,
          companyGstNumber: payload.companyGstNumber,
          billDate: payload.billDate,
          items: payload.items,
          payment: payload.payment,
          driverId: payload.driverId,
          vehicleNumber: payload.vehicleNumber,
        },
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: "Bill", id: arg.id },
        "BillList",
      ],
    }),

    // -------- update only payment --------
    updateBillPayment: builder.mutation<
      SingleBillResponse,
      { id: string; payment: CreateBillPaymentInput }
    >({
      query: ({ id, payment }) => ({
        url: `billing/${id}`,
        method: "PUT",
        body: { payment },
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: "Bill", id: arg.id },
        "BillList",
      ],
    }),

    // -------- assign / change driver --------
    assignBillDriver: builder.mutation<SingleBillResponse, AssignDriverPayload>(
      {
        query: ({ billId, driverId }) => ({
          url: `billing/${billId}`,
          method: "PUT",
          body: {
            driverId: driverId ?? undefined,
          },
        }),
        invalidatesTags: (_res, _err, arg) => [
          { type: "Bill", id: arg.billId },
          "BillList",
        ],
      }
    ),

    // -------- mark bill delivered --------
    markBillDelivered: builder.mutation<
      SingleBillResponse,
      MarkDeliveredPayload
    >({
      query: ({ billId }) => ({
        url: `billing/${billId}`,
        method: "PUT",
        body: {
          status: "DELIVERED",
        },
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: "Bill", id: arg.billId },
        "BillList",
      ],
    }),

    // -------- create bill return --------
    createBillReturn: builder.mutation<
      CreateBillReturnResponse,
      CreateBillReturnPayload
    >({
      query: ({ billId, items, reason, note }) => ({
        url: `billing/${billId}/return`,
        method: "POST",
        body: { items, reason, note },
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: "Bill", id: arg.billId },
        "BillList",
        "BillReturn",
      ],
    }),

    // -------- list returns per bill --------
    listBillReturns: builder.query<BillReturnsResponse, string>({
      query: (billId) => ({
        url: `billing/${billId}/return`,
      }),
      providesTags: (_res, _err, billId) => [
        { type: "Bill", id: billId },
        "BillReturn",
      ],
    }),

    // -------- customers search --------
    searchCustomers: builder.query<CustomersResponse, string>({
      query: (search) => ({
        url: "customers",
        params: { q: search },
      }),
    }),

    // -------- products search for billing --------
    searchProducts: builder.query<ProductForBilling[], { q: string }>({
      query: ({ q }) => ({
        url: "products/billing-search",
        params: { q },
      }),
    }),
  }),
});

export const {
  useCreateBillMutation,
  useListBillsQuery,
  useGetBillQuery,
  useUpdateBillMutation,
  useUpdateBillPaymentMutation,
  useAssignBillDriverMutation,
  useMarkBillDeliveredMutation,
  useCreateBillReturnMutation,
  useListBillReturnsQuery,
  useLazySearchCustomersQuery,
  useLazySearchProductsQuery,
} = billingApi;
