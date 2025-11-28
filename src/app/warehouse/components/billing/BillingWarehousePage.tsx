// src/app/warehouse/components/billing/BillingWarehousePage.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  useListBillsQuery,
  useUpdateBillMutation,
  useLazySearchCustomersQuery,
  Bill,
  CreateBillPayload,
  CreateBillPaymentInput,
} from "@/store/billingApi";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { submitBill, clearBillingError } from "@/store/billingSlice";
import {
  fetchInventory,
  InventoryItem,
} from "@/store/inventorySlice";
import { fetchProducts } from "@/store/productSlice";
import { fetchWarehouses } from "@/store/warehouseSlice";

import OrderForm from "@/app/admin/components/billing/OrderForm";
import BillList from "@/app/admin/components/billing/BillList";
import BillPreview from "@/app/admin/components/billing/BillPreview";
import EditPaymentModal from "@/app/admin/components/billing/EditPaymentModal";

const COMPANY_GST_NUMBER = "27ABCDE1234F1Z5";

type BillingWarehousePageProps = {
  allowedWarehouseIdsProp?: string[];       // server-provided (admin-style)
  assignedWarehouseForUser?: string[];      // same pattern as inventory
};

type CustomerFormState = {
  name: string;
  shopName: string;
  phone: string;
  address: string;
  gstNumber: string;
};

type BillingProductOption = {
  id: string;
  productId: string;
  warehouseId: string;
  productName: string;
  warehouseName: string;
  sellingPrice: number;
  taxPercent: number;
  itemsPerBox: number;
  boxesAvailable: number;
  looseAvailable: number;
};

type BillFormItemState = {
  id: string;
  productSearch: string;
  selectedProduct?: BillingProductOption;
  quantityBoxes: number;
  quantityLoose: number;
};

type Product = {
  _id?: string | number;
  id?: string | number;
  name?: string;
  purchasePrice?: number;
  purchase_price?: number;
  sellingPrice?: number;
  sellPrice?: number;
  price?: number;
};

type Warehouse = {
  _id?: string | number;
  id?: string | number;
  name?: string;
};

export type Totals = {
  totalItemsCount: number;
  totalBeforeTax: number;
  totalTax: number;
  grandTotal: number;
};

const createRowId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 11);
};

const initialCustomerState: CustomerFormState = {
  name: "",
  shopName: "",
  phone: "",
  address: "",
  gstNumber: "",
};

const initialPaymentState: CreateBillPaymentInput = {
  mode: "CASH",
  cashAmount: 0,
  upiAmount: 0,
  cardAmount: 0,
};

const createEmptyItem = (): BillFormItemState => ({
  id: createRowId(),
  productSearch: "",
  selectedProduct: undefined,
  quantityBoxes: 0,
  quantityLoose: 0,
});

const extractId = (ref: unknown): string | undefined => {
  if (ref == null) return undefined;
  if (typeof ref === "string" || typeof ref === "number") return String(ref);
  if (typeof ref === "object") {
    const obj = ref as Record<string, unknown>;
    const candidate = obj._id ?? obj.id;
    if (candidate == null || candidate === "") return undefined;
    return String(candidate);
  }
  return undefined;
};

export default function BillingWarehousePage({
  allowedWarehouseIdsProp,
  assignedWarehouseForUser,
}: BillingWarehousePageProps) {
  const dispatch = useAppDispatch();
  const billingState = useAppSelector((state) => state.billing);

  const inventoryItems = useAppSelector(
    (state) => state.inventory.items
  ) as InventoryItem[];
  const inventoryLoading = useAppSelector(
    (state) => state.inventory.loading
  ) as boolean;
  const rawProducts = useAppSelector(
    (state) => state.product.products ?? []
  ) as Product[];
  const rawWarehouses = useAppSelector(
    (state) => state.warehouse.list ?? []
  ) as Warehouse[];

  const [customer, setCustomer] =
    useState<CustomerFormState>(initialCustomerState);
  const [items, setItems] = useState<BillFormItemState[]>([
    createEmptyItem(),
  ]);
  const [payment, setPayment] =
    useState<CreateBillPaymentInput>(initialPaymentState);

  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");

  const [triggerCustomerSearch, customerSearchResult] =
    useLazySearchCustomersQuery();

  const [billSearch, setBillSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [billForPaymentEdit, setBillForPaymentEdit] =
    useState<Bill | undefined>();
  const [billForEdit, setBillForEdit] =
    useState<Bill | undefined>();
  const [billForPreview, setBillForPreview] =
    useState<Bill | undefined>();

  const {
    data: billsData,
    isLoading: billsLoading,
    isFetching: billsFetching,
    refetch: refetchBills,
  } = useListBillsQuery({ search: billSearch });

  const [updateBill] = useUpdateBillMutation();

  const bills = billsData?.bills ?? [];

  useEffect(() => {
    dispatch(fetchInventory());
    dispatch(fetchProducts());
    dispatch(fetchWarehouses());
  }, [dispatch]);

  // 🔹 EXACT same pattern as UserInventoryManager
  const allowedWarehouseIds = useMemo(() => {
    if (Array.isArray(assignedWarehouseForUser)) return assignedWarehouseForUser;
    if (Array.isArray(allowedWarehouseIdsProp)) return allowedWarehouseIdsProp;
    return undefined; // admin/all
  }, [assignedWarehouseForUser, allowedWarehouseIdsProp]);

  const getProductById = (id?: string): Product | undefined => {
    if (!id) return undefined;
    const searchedId = String(id);
    return rawProducts.find(
      (p) => String(p._id ?? p.id) === searchedId
    );
  };

  const getWarehouseById = (id?: string): Warehouse | undefined => {
    if (!id) return undefined;
    const searchedId = String(id);
    return rawWarehouses.find(
      (w) => String(w._id ?? w.id) === searchedId
    );
  };

  const getSellingPrice = (productId?: string): number => {
    const p = getProductById(productId);
    if (!p) return 0;
    const selling = [
      p.sellingPrice,
      p.sellPrice,
      p.price,
    ].find((v) => typeof v === "number") as number | undefined;
    return selling ?? 0;
  };

  // 🔹 Only inventory from allowed warehouses (same idea as inventory manager)
  const billingProducts: BillingProductOption[] = useMemo(() => {
    return inventoryItems
      .map((inv) => {
        const invRecord = inv as unknown as Record<string, unknown>;
        const pid = extractId(inv.productId ?? invRecord.product) ?? "";
        const wid =
          extractId(inv.warehouseId ?? invRecord.warehouse) ?? "";

        if (
          Array.isArray(allowedWarehouseIds) &&
          allowedWarehouseIds.length > 0 &&
          !allowedWarehouseIds.includes(wid)
        ) {
          return undefined;
        }

        const prod = getProductById(pid);
        const wh = getWarehouseById(wid);

        const productName = prod?.name ?? pid ?? "Unknown product";
        const warehouseName = wh?.name ?? wid ?? "Unknown warehouse";
        const sellingPrice = getSellingPrice(pid);
        const taxPercent = inv.tax ?? 0;

        return {
          id: String(inv._id ?? `${pid}-${wid}`),
          productId: pid,
          warehouseId: wid,
          productName,
          warehouseName,
          sellingPrice,
          taxPercent,
          itemsPerBox: inv.itemsPerBox,
          boxesAvailable: inv.boxes,
          looseAvailable: inv.looseItems,
        };
      })
      .filter((bp): bp is BillingProductOption => Boolean(bp));
  }, [inventoryItems, rawProducts, rawWarehouses, allowedWarehouseIds]);

  // Debounced customer search
  useEffect(() => {
    if (customerSearch.trim().length < 2) {
      return;
    }

    const handle = window.setTimeout(() => {
      void triggerCustomerSearch(customerSearch);
    }, 400);

    return () => window.clearTimeout(handle);
  }, [customerSearch, triggerCustomerSearch]);

  const totals: Totals = useMemo(() => {
    let totalItemsCount = 0;
    let totalBeforeTax = 0;
    let totalTax = 0;
    let grandTotal = 0;

    items.forEach((item) => {
      const product = item.selectedProduct;
      if (!product) return;

      const totalItemsForLine =
        item.quantityBoxes * product.itemsPerBox +
        item.quantityLoose;

      const gross =
        totalItemsForLine * product.sellingPrice;

      let lineBeforeTax = gross;
      let taxAmount = 0;

      if (product.taxPercent > 0) {
        taxAmount =
          (gross * product.taxPercent) /
          (100 + product.taxPercent);
        lineBeforeTax = gross - taxAmount;
      }

      const lineTotal = gross;

      totalItemsCount += totalItemsForLine;
      totalBeforeTax += lineBeforeTax;
      totalTax += taxAmount;
      grandTotal += lineTotal;
    });

    return {
      totalItemsCount,
      totalBeforeTax,
      totalTax,
      grandTotal,
    };
  }, [items]);

  const handleCustomerSelect = (id: string): void => {
    const customerDoc = customerSearchResult.data?.customers.find(
      (c) => c._id === id
    );
    if (!customerDoc) return;

    setSelectedCustomerId(customerDoc._id);
    setCustomer({
      name: customerDoc.name,
      shopName: customerDoc.shopName ?? "",
      phone: customerDoc.phone,
      address: customerDoc.address,
      gstNumber: customerDoc.gstNumber ?? "",
    });
  };

  const buildBillItemsPayload = (validItems: BillFormItemState[]) => {
    return validItems.map((item) => {
      const product = item.selectedProduct;
      if (!product) {
        throw new Error("Product missing");
      }

      return {
        stockId: product.id,
        productId: product.productId,
        warehouseId: product.warehouseId,
        productName: product.productName,
        sellingPrice: product.sellingPrice,
        taxPercent: product.taxPercent,
        quantityBoxes: item.quantityBoxes,
        quantityLoose: item.quantityLoose,
        itemsPerBox: product.itemsPerBox,
      };
    });
  };

  const handleCreateBill = async (): Promise<void> => {
    if (!customer.name.trim() || !customer.phone.trim()) {
      alert("Customer name and phone are required");
      return;
    }

    const validItems = items.filter(
      (item) =>
        item.selectedProduct &&
        (item.quantityBoxes > 0 || item.quantityLoose > 0)
    );

    if (validItems.length === 0) {
      alert("Add at least one product with quantity");
      return;
    }

    const billItems = buildBillItemsPayload(validItems);

    const payload: CreateBillPayload = {
      customer: {
        name: customer.name,
        shopName: customer.shopName || undefined,
        phone: customer.phone,
        address: customer.address,
        gstNumber: customer.gstNumber || undefined,
      },
      companyGstNumber: COMPANY_GST_NUMBER,
      billDate: new Date().toISOString(),
      items: billItems,
      payment,
    };

    dispatch(clearBillingError());

    try {
      await dispatch(submitBill(payload)).unwrap();
      alert("Bill created successfully");

      setCustomer(initialCustomerState);
      setItems([createEmptyItem()]);
      setPayment(initialPaymentState);
      setSelectedCustomerId("");
      setCustomerSearch("");
      setShowForm(false);
      void refetchBills();
    } catch {
      // error stored in billing slice
    }
  };

  const handleUpdateBill = async (): Promise<void> => {
    if (!billForEdit) return;

    if (!customer.name.trim() || !customer.phone.trim()) {
      alert("Customer name and phone are required");
      return;
    }

    const validItems = items.filter(
      (item) =>
        item.selectedProduct &&
        (item.quantityBoxes > 0 || item.quantityLoose > 0)
    );

    if (validItems.length === 0) {
      alert("Add at least one product with quantity");
      return;
    }

    const billItems = buildBillItemsPayload(validItems);

    const payload: CreateBillPayload = {
      customer: {
        name: customer.name,
        shopName: customer.shopName || undefined,
        phone: customer.phone,
        address: customer.address,
        gstNumber: customer.gstNumber || undefined,
      },
      companyGstNumber: billForEdit.companyGstNumber,
      billDate: billForEdit.billDate,
      items: billItems,
      payment,
    };

    try {
      await updateBill({ id: billForEdit._id, payload }).unwrap();
      alert("Bill updated successfully");
      setBillForEdit(undefined);
      setShowForm(false);
      void refetchBills();
    } catch {
      alert("Failed to update bill");
    }
  };

  const isCreating = billingState.status === "loading";
  const isSuccess = billingState.status === "succeeded";
  const errorMessage = billingState.errorMessage;
  const billsBusy = billsLoading || billsFetching;

  const handleEditOrder = (bill: Bill): void => {
    setBillForEdit(bill);
    setShowForm(true);

    setCustomer({
      name: bill.customerInfo.name,
      shopName: bill.customerInfo.shopName ?? "",
      phone: bill.customerInfo.phone,
      address: bill.customerInfo.address,
      gstNumber: bill.customerInfo.gstNumber ?? "",
    });

    const formItems: BillFormItemState[] = bill.items.map((line) => {
      const rawLine = line as {
        product?: unknown;
        warehouse?: unknown;
        productName: string;
        quantityBoxes: number;
        quantityLoose: number;
      };

      const productId = extractId(rawLine.product) ?? "";
      const warehouseForLine = extractId(rawLine.warehouse) ?? "";

      const selectedProduct = billingProducts.find(
        (bp) =>
          bp.productId === productId &&
          bp.warehouseId === warehouseForLine
      );

      return {
        id: createRowId(),
        productSearch: selectedProduct?.productName ?? rawLine.productName,
        selectedProduct,
        quantityBoxes: rawLine.quantityBoxes,
        quantityLoose: rawLine.quantityLoose,
      };
    });

    setItems(formItems);

    setPayment({
      mode: bill.payment.mode,
      cashAmount: bill.payment.cashAmount,
      upiAmount: bill.payment.upiAmount,
      cardAmount: bill.payment.cardAmount,
    });
  };

  const handlePaymentUpdated = (): void => {
    setBillForPaymentEdit(undefined);
    void refetchBills();
  };

  // 🔹 Filter bills by allowed warehouses (like inventory filter)
  const warehouseBills = useMemo(() => {
    if (!Array.isArray(allowedWarehouseIds) || allowedWarehouseIds.length === 0) {
      // Admin case: see all bills
      return bills;
    }

    return bills.filter((bill) =>
      bill.items.some((line) => {
        const rawLine = line as {
          warehouseId?: string | number;
          warehouse?: unknown;
        };
        const widFromField = rawLine.warehouseId;
        const widFromPopulate = extractId(rawLine.warehouse);
        const wid = widFromField ?? widFromPopulate;
        if (!wid) return false;
        return allowedWarehouseIds.includes(String(wid));
      })
    );
  }, [bills, allowedWarehouseIds]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-[color:var(--color-primary)]">
            Warehouse Billing
          </h1>
          <p className="text-sm text-slate-600">
            Create and manage invoices using inventory from your assigned warehouse(s) only.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={billSearch}
            onChange={(e) => setBillSearch(e.target.value)}
            placeholder="Search bills by customer / phone"
            className="w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => {
              setShowForm((prev) => !prev);
              if (!showForm) {
                setBillForEdit(undefined);
                setCustomer(initialCustomerState);
                setItems([createEmptyItem()]);
                setPayment(initialPaymentState);
              }
            }}
            className="rounded-lg bg-[color:var(--color-primary)] px-4 py-2 text-sm font-semibold text-[color:var(--color-white)]"
          >
            {showForm ? "Close Form" : "Create Order"}
          </button>
        </div>
      </header>

      {showForm && (
        <section className="rounded-xl bg-[color:var(--color-neutral)] p-4">
          <OrderForm
            mode={billForEdit ? "edit" : "create"}
            companyGstNumber={COMPANY_GST_NUMBER}
            customer={customer}
            setCustomer={setCustomer}
            items={items}
            setItems={setItems}
            payment={payment}
            setPayment={setPayment}
            customerSearch={customerSearch}
            setCustomerSearch={setCustomerSearch}
            selectedCustomerId={selectedCustomerId}
            setSelectedCustomerId={setSelectedCustomerId}
            customerSearchResult={customerSearchResult.data}
            billingProducts={billingProducts}
            inventoryLoading={inventoryLoading}
            totals={totals}
            onCustomerSelect={handleCustomerSelect}
            onSubmit={billForEdit ? handleUpdateBill : handleCreateBill}
            isSubmitting={isCreating}
            lastInvoiceNumber={billingState.lastInvoiceNumber}
            isSuccess={isSuccess}
          />
        </section>
      )}

      <section>
        <BillList
          bills={warehouseBills}
          loading={billsBusy}
          onSelectBill={setBillForPreview}
          onEditPayment={setBillForPaymentEdit}
          onEditOrder={handleEditOrder}
        />
      </section>

      <EditPaymentModal
        bill={billForPaymentEdit}
        onClose={() => setBillForPaymentEdit(undefined)}
        onUpdated={handlePaymentUpdated}
      />

      <BillPreview
        bill={billForPreview}
        onClose={() => setBillForPreview(undefined)}
      />

      {errorMessage && (
        <div className="rounded-lg bg-[color:var(--color-error)]/10 p-3 text-sm text-[color:var(--color-error)]">
          {errorMessage}
        </div>
      )}
    </div>
  );
}
