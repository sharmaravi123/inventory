import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

/* ---------------------------------------------
   CUSTOMER TYPE
--------------------------------------------- */
export type Customer = {
  _id?: string;
  name: string;
  shopName?: string;
  phone: string;
  address: string;
  gstNumber?: string;
  customPrices?: { product: string; price: number }[];
};
export type AssignDriverPayload = {
  billId: string;
  driverId: string | null;
};

export type MarkDeliveredPayload = {
  billId: string;
};


/* ---------------------------------------------
   BILLING PRODUCT OPTION (from inventory)
--------------------------------------------- */
export type ProductForBilling = {
  id: string;                // stockId
  productId: string;
  warehouseId: string;

  productName: string;
  warehouseName: string;

  sellingPrice: number;
  taxPercent: number;
  itemsPerBox: number;       // ALWAYS from product.perBoxItem
  boxesAvailable: number;
  looseAvailable: number;
};

/* ---------------------------------------------
   PAYMENT
--------------------------------------------- */
export type PaymentMode = "CASH" | "UPI" | "CARD" | "SPLIT";

export type CreateBillPaymentInput = {
  mode: PaymentMode;
  cashAmount?: number;
  upiAmount?: number;
  cardAmount?: number;
};

/* ---------------------------------------------
   BILLING ITEM INPUT (CREATE BILL)
--------------------------------------------- */
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

  // 🔥 Added fields (server already uses them)
  discountType: "NONE" | "PERCENT" | "CASH";
  discountValue: number;
  overridePriceForCustomer: boolean;
};

/* ---------------------------------------------
   SERVER RESPONSE ITEM (GET BILL)
--------------------------------------------- */
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

  // 🔥 Added missing fields
  discountType?: "NONE" | "PERCENT" | "CASH";
  discountValue?: number;

  // warehouse reference
  warehouseId?: string;
  warehouse?: {
    _id?: string;
    id?: string;
    name?: string;
  };

  // product reference
  product?: {
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

/* ---------------------------------------------
   BILL MODEL
--------------------------------------------- */
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
    customer?: string; // customer id (added for edit)
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

  // delivery info
  driver?: string;
  vehicleNumber?: string;
  deliveredAt?: string;
};

/* ---------------------------------------------
   API RESPONSE TYPES
--------------------------------------------- */
type CreateBillResponse = {
  bill: {
    _id: string;
    invoiceNumber: string;
    billDate: string;
    grandTotal: number;
  };
};

type CustomersResponse = { customers: Customer[] };
type BillsListResponse = { bills: Bill[] };
type SingleBillResponse = { bill: Bill };

/* ---------------------------------------------
   BILL RETURN TYPES
--------------------------------------------- */
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
  customerInfo: Bill["customerInfo"];
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

export type CreateBillReturnPayload = {
  billId: string;
  items: CreateBillReturnItemInput[];
  reason?: string;
  note?: string;
};

type BillReturnsResponse = { returns: BillReturn[] };
type CreateBillReturnResponse = { returnDoc: BillReturn };

/* ---------------------------------------------
   LIST BILL ARGS (warehouse wise)
--------------------------------------------- */
export type BillsListArgs = {
  search: string;
  warehouseId?: string;
};

/* ---------------------------------------------
   CREATE BILL PAYLOAD
--------------------------------------------- */
export type CreateBillPayload = {
  customer: Customer;
  companyGstNumber?: string;
  billDate: string;
  items: BillItemInput[];
  payment: CreateBillPaymentInput;
  driverId?: string;
  vehicleNumber?: string;
};

/* ---------------------------------------------
   BILLING API
--------------------------------------------- */
export const billingApi = createApi({
  reducerPath: "billingApi",
  baseQuery: fetchBaseQuery({
    baseUrl: "/api",
  }),
  tagTypes: ["Bill", "BillList", "BillReturn"],
  endpoints: (builder) => ({
    /* ---------- CREATE BILL ---------- */
    createBill: builder.mutation<CreateBillResponse, CreateBillPayload>({
      query: (payload) => ({
        url: "billing",
        method: "POST",
        body: payload,
      }),
      invalidatesTags: ["BillList"],
    }),

    /* ---------- LIST BILLS WITH FILTERS ---------- */
    listBills: builder.query<BillsListResponse, BillsListArgs>({
      query: ({ search, warehouseId }) => {
        const params: Record<string, string> = {};

        if (search.trim()) {
          params.customer = search;
          params.phone = search;
        }

        if (warehouseId) params.warehouseId = warehouseId;

        return { url: "billing", params };
      },
      providesTags: (result) =>
        result?.bills
          ? [
            ...result.bills.map((b) => ({
              type: "Bill" as const,
              id: b._id,
            })),
            "BillList",
          ]
          : ["BillList"],
    }),

    /* ---------- GET SINGLE BILL ---------- */
    getBill: builder.query<SingleBillResponse, string>({
      query: (id) => ({ url: `billing/${id}` }),
      providesTags: (_res, _err, id) => [{ type: "Bill", id }],
    }),

    /* ---------- UPDATE BILL ---------- */
    updateBill: builder.mutation<
      SingleBillResponse,
      { id: string; payload: CreateBillPayload }
    >({
      query: ({ id, payload }) => ({
        url: `billing/${id}`,
        method: "PUT",
        body: payload,
      }),
      invalidatesTags: (_r, _e, arg) => [
        { type: "Bill", id: arg.id },
        "BillList",
      ],
    }),

    // -------- assign / change driver --------
    // -------- assign / change driver --------
    assignBillDriver: builder.mutation<SingleBillResponse, AssignDriverPayload>({
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
    }),

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


    /* ---------- UPDATE PAYMENT ONLY ---------- */
    updateBillPayment: builder.mutation<
      SingleBillResponse,
      { id: string; payment: CreateBillPaymentInput }
    >({
      query: ({ id, payment }) => ({
        url: `billing/${id}`,
        method: "PUT",
        body: { payment },
      }),
      invalidatesTags: (_r, _e, arg) => [
        { type: "Bill", id: arg.id },
        "BillList",
      ],
    }),

    /* ---------- RETURN BILL ---------- */
    createBillReturn: builder.mutation<
      CreateBillReturnResponse,
      CreateBillReturnPayload
    >({
      query: ({ billId, items, reason, note }) => ({
        url: `billing/${billId}/return`,
        method: "POST",
        body: { items, reason, note },
      }),
      invalidatesTags: (_r, _e, arg) => [
        { type: "Bill", id: arg.billId },
        "BillList",
        "BillReturn",
      ],
    }),

    listBillReturns: builder.query<BillReturnsResponse, string>({
      query: (billId) => ({ url: `billing/${billId}/return` }),
      providesTags: (_r, _e, billId) => [
        { type: "Bill", id: billId },
        "BillReturn",
      ],
    }),

    /* ---------- SEARCH CUSTOMERS ---------- */
    searchCustomers: builder.query<CustomersResponse, string>({
      query: (q) => ({
        url: "customers",
        params: { q },
      }),
    }),

    /* ---------- SEARCH PRODUCTS FOR BILLING ---------- */
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
  useCreateBillReturnMutation,
  useAssignBillDriverMutation,
  useMarkBillDeliveredMutation,
  useListBillReturnsQuery,
  useLazySearchCustomersQuery,
  useLazySearchProductsQuery,
} = billingApi;
