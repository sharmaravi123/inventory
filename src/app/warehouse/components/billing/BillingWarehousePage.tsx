"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  useListBillsQuery,
  useUpdateBillMutation,
  useLazySearchCustomersQuery,
  Bill,
  CreateBillPayload,
  CreateBillPaymentInput,
  BillItemInput,
} from "@/store/billingApi";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { submitBill, clearBillingError } from "@/store/billingSlice";
import { fetchInventory, InventoryItem } from "@/store/inventorySlice";
import { fetchProducts, ProductType } from "@/store/productSlice";
import { fetchWarehouses, Warehouse } from "@/store/warehouseSlice";

import OrderForm from "@/app/admin/components/billing/OrderForm";
import type {
  BillFormItemState,
  CustomerFormState,
  BillingProductOption,
  Totals,
} from "@/app/admin/components/billing/BillingAdminPage";

import BillList from "@/app/admin/components/billing/BillList";
import BillPreview from "@/app/admin/components/billing/BillPreview";
import EditPaymentModal from "@/app/admin/components/billing/EditPaymentModal";

const COMPANY_GST_NUMBER = "27ABCDE1234F1Z5";

// ---------------------------- UTIL ----------------------------

const createRowId = () => crypto.randomUUID();

const extractId = (ref: unknown): string | undefined => {
  if (!ref) return undefined;
  if (typeof ref === "string" || typeof ref === "number") return String(ref);
  if (typeof ref === "object") {
    const obj = ref as { _id?: string; id?: string };
    return obj._id ?? obj.id ? String(obj._id ?? obj.id) : undefined;
  }
  return undefined;
};

// ===============================================================
// MAIN COMPONENT
// ===============================================================

export default function BillingWarehousePage({
  allowedWarehouseIdsProp,
  assignedWarehouseForUser,
}: {
  allowedWarehouseIdsProp?: string[];
  assignedWarehouseForUser?: string[];
}) {
  const dispatch = useAppDispatch();

  // ------------------- STORE DATA -------------------

  const inventoryItems = useAppSelector((s) => s.inventory.items) as InventoryItem[];
  const inventoryLoading = useAppSelector((s) => s.inventory.loading);

  const rawProducts = useAppSelector((s) => s.product.products ?? []) as ProductType[];
  const rawWarehouses = useAppSelector((s) => s.warehouse.list ?? []) as Warehouse[];

  const billingState = useAppSelector((s) => s.billing);

  // ------------------- STATE -------------------

  const [items, setItems] = useState<BillFormItemState[]>([
    {
      id: createRowId(),
      productSearch: "",
      selectedProduct: undefined,
      quantityBoxes: 0,
      quantityLoose: 0,
      discountType: "NONE",
      discountValue: 0,
      overridePriceForCustomer: false,
    },
  ]);

  const [customer, setCustomer] = useState<CustomerFormState>({
    name: "",
    shopName: "",
    phone: "",
    address: "",
    gstNumber: "",
  });

  const [payment, setPayment] = useState<CreateBillPaymentInput>({
    mode: "CASH",
    cashAmount: 0,
    upiAmount: 0,
    cardAmount: 0,
  });

  const [billDate, setBillDate] = useState<string>("");

  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");

  const [billSearch, setBillSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [billForEdit, setBillForEdit] = useState<Bill>();
  const [billForPreview, setBillForPreview] = useState<Bill>();
  const [billForPaymentEdit, setBillForPaymentEdit] = useState<Bill>();

  const [triggerCustomerSearch, customerSearchResultRaw] =
    useLazySearchCustomersQuery();

  const customerSearchResult = customerSearchResultRaw.data ?? {
    customers: [],
  };

  const { data: billsData, isLoading, refetch } = useListBillsQuery({
    search: billSearch,
  });

  const bills = billsData?.bills ?? [];
  const [updateBill] = useUpdateBillMutation();

  // ===============================================================
  // LOAD INVENTORY / PRODUCTS / WAREHOUSES
  // ===============================================================

  useEffect(() => {
    dispatch(fetchInventory());
    dispatch(fetchProducts());
    dispatch(fetchWarehouses());
  }, [dispatch]);

  // ===============================================================
  // ALLOWED WAREHOUSES
  // ===============================================================

  const allowedWarehouseIds = useMemo(() => {
    if (assignedWarehouseForUser?.length) return assignedWarehouseForUser;
    if (allowedWarehouseIdsProp?.length) return allowedWarehouseIdsProp;
    return [];
  }, [allowedWarehouseIdsProp, assignedWarehouseForUser]);

  // ===============================================================
  // GET PRODUCT & WAREHOUSE (memoized to remove warnings)
  // ===============================================================

  const getProduct = useCallback(
    (id?: string) => rawProducts.find((p) => String(p._id) === id),
    [rawProducts]
  );

  const getWarehouse = useCallback(
    (id?: string) => rawWarehouses.find((w) => String(w._id) === id),
    [rawWarehouses]
  );

  // ===============================================================
  // BILLING PRODUCT LIST (full typed — no anys)
  // ===============================================================

  const billingProducts = useMemo<BillingProductOption[]>(() => {
    return inventoryItems
      .map((inv: InventoryItem) => {
        const pid = extractId((inv as { product?: string }).product ?? inv.productId);
        const wid = extractId((inv as { warehouse?: string }).warehouse ?? inv.warehouseId);

        if (!pid || !wid) return undefined;
        if (allowedWarehouseIds.length > 0 && !allowedWarehouseIds.includes(wid)) {
          return undefined;
        }

        const prod = getProduct(pid);
        const wh = getWarehouse(wid);

        if (!prod) return undefined;

        return {
          id: String(inv._id),
          productId: pid,
          warehouseId: wid,
          productName: prod.name ?? "Unnamed Product",
          warehouseName: wh?.name ?? "Warehouse",
          sellingPrice: prod.sellingPrice ?? 0,
          taxPercent: prod.taxPercent ?? 0,
          itemsPerBox: prod.perBoxItem ?? 1,
          boxesAvailable: inv.boxes ?? 0,
          looseAvailable: inv.looseItems ?? 0,
        };
      })
      .filter((x): x is BillingProductOption => Boolean(x));
  }, [
    inventoryItems,
    rawProducts,
    rawWarehouses,
    allowedWarehouseIds,
    getProduct,
    getWarehouse,
  ]);

  // ===============================================================
  // CUSTOMER SEARCH
  // ===============================================================

  useEffect(() => {
    if (customerSearch.trim().length < 2) return;
    const t = setTimeout(() => triggerCustomerSearch(customerSearch), 400);
    return () => clearTimeout(t);
  }, [customerSearch, triggerCustomerSearch]);

  const onCustomerSelect = useCallback(
    (id: string) => {
      const doc = customerSearchResult.customers.find((c) => c._id === id);
      if (!doc) return;

      setSelectedCustomerId(doc._id ?? "");

      setCustomer({
        _id: doc._id,
        name: doc.name,
        shopName: doc.shopName ?? "",
        phone: doc.phone,
        address: doc.address,
        gstNumber: doc.gstNumber ?? "",
      });
    },
    [customerSearchResult]
  );

  // ===============================================================
  // TOTALS
  // ===============================================================
const totals: Totals = useMemo(() => {
    let count = 0;
    let before = 0;
    let tax = 0;
    let total = 0;
    let discountTotal = 0;

    items.forEach((it) => {
      if (!it.selectedProduct) return;
      const p = it.selectedProduct;

      const totalPieces =
        it.quantityBoxes * p.itemsPerBox + it.quantityLoose;
      if (totalPieces <= 0) return;

      const baseTotal = totalPieces * p.sellingPrice;

      let discountAmount = 0;
      if (it.discountType === "PERCENT") {
        discountAmount = (baseTotal * it.discountValue) / 100;
      } else if (it.discountType === "CASH") {
        discountAmount = it.discountValue;
      }

      discountAmount = Math.min(discountAmount, baseTotal);

      const lineTotal = baseTotal - discountAmount;

      const lineTax =
        (lineTotal * p.taxPercent) / (100 + p.taxPercent);
      const lineBeforeTax = lineTotal - lineTax;

      count += totalPieces;
      before += lineBeforeTax;
      tax += lineTax;
      total += lineTotal;
      discountTotal += discountAmount;
    });

    return {
      totalItemsCount: count,
      totalBeforeTax: before,
      totalTax: tax,
      grandTotal: total,
      discountTotal,
    };
  }, [items]);
// updated
  // ===============================================================
  // BUILD BILL ITEMS
  // ===============================================================

  const buildBillItems = (valid: BillFormItemState[]): BillItemInput[] => {
    return valid.map((it) => {
      const p = it.selectedProduct!;
      let price = p.sellingPrice;

      if (it.discountType === "CASH") price -= Number(it.discountValue);
      else if (it.discountType === "PERCENT")
        price -= (price * Number(it.discountValue)) / 100;

      return {
        stockId: p.id,
        productId: p.productId,
        warehouseId: p.warehouseId,
        productName: p.productName,
        sellingPrice: price,
        taxPercent: p.taxPercent,
        quantityBoxes: it.quantityBoxes,
        quantityLoose: it.quantityLoose,
        itemsPerBox: p.itemsPerBox,
        discountType: it.discountType,
        discountValue: Number(it.discountValue),
        overridePriceForCustomer: it.overridePriceForCustomer,
      };
    });
  };

  // ===============================================================
  // CREATE BILL
  // ===============================================================

  const createBill = async () => {
    const valid = items.filter(
      (it) => it.selectedProduct && (it.quantityBoxes > 0 || it.quantityLoose > 0)
    );

    const payload: CreateBillPayload = {
      customer: {
        _id: selectedCustomerId,
        name: customer.name,
        shopName: customer.shopName,
        phone: customer.phone,
        address: customer.address,
        gstNumber: customer.gstNumber,
      },
      companyGstNumber: COMPANY_GST_NUMBER,
      billDate: billDate || new Date().toISOString(),
      items: buildBillItems(valid),
      payment,
    };

    dispatch(clearBillingError());
    await dispatch(submitBill(payload)).unwrap();

    alert("Created ✔");

    // Reset
    setCustomer({ name: "", shopName: "", phone: "", address: "", gstNumber: "" });
    setItems([
      {
        id: createRowId(),
        productSearch: "",
        selectedProduct: undefined,
        quantityBoxes: 0,
        quantityLoose: 0,
        discountType: "NONE",
        discountValue: 0,
        overridePriceForCustomer: false,
      },
    ]);
    setPayment({ mode: "CASH", cashAmount: 0, upiAmount: 0, cardAmount: 0 });
    setSelectedCustomerId("");
    setBillDate("");

    setShowForm(false);
    refetch();
  };

  // ===============================================================
  // UPDATE BILL
  // ===============================================================

  const updateBillSubmit = async () => {
    if (!billForEdit) return;

    const valid = items.filter(
      (it) => it.selectedProduct && (it.quantityBoxes > 0 || it.quantityLoose > 0)
    );

    const payload: CreateBillPayload = {
      customer: {
        _id: billForEdit.customerInfo.customer,
        name: customer.name,
        shopName: customer.shopName,
        phone: customer.phone,
        address: customer.address,
        gstNumber: customer.gstNumber,
      },
      companyGstNumber: billForEdit.companyGstNumber,
      billDate: billDate || billForEdit.billDate,
      items: buildBillItems(valid),
      payment,
    };

    await updateBill({ id: billForEdit._id, payload }).unwrap();

    alert("Updated ✔");

    setShowForm(false);
    setBillForEdit(undefined);
    refetch();
  };

  // ===============================================================
  // UI
  // ===============================================================

  return (
    <div className="space-y-6">
      <header className="flex justify-between">
        <h1 className="text-xl font-bold">Warehouse Billing</h1>

        <div className="flex gap-2">
          <input
            className="border px-3 py-2 rounded"
            placeholder="Search bills..."
            value={billSearch}
            onChange={(e) => setBillSearch(e.target.value)}
          />

          <button
            className="bg-blue-600 text-white px-4 py-2 rounded"
            onClick={() => {
              setShowForm(!showForm);

              if (!showForm) {
                setItems([
                  {
                    id: createRowId(),
                    productSearch: "",
                    selectedProduct: undefined,
                    quantityBoxes: 0,
                    quantityLoose: 0,
                    discountType: "NONE",
                    discountValue: 0,
                    overridePriceForCustomer: false,
                  },
                ]);
                setCustomer({
                  name: "",
                  shopName: "",
                  phone: "",
                  address: "",
                  gstNumber: "",
                });
                setPayment({
                  mode: "CASH",
                  cashAmount: 0,
                  upiAmount: 0,
                  cardAmount: 0,
                });
                setBillForEdit(undefined);
              }
            }}
          >
            {showForm ? "Close" : "New Bill"}
          </button>
        </div>
      </header>

      {showForm && (
        <OrderForm
          mode={billForEdit ? "edit" : "create"}
          companyGstNumber={COMPANY_GST_NUMBER}
          billDate={billDate}
          setBillDate={setBillDate}
          customer={customer}
          setCustomer={setCustomer}
          items={items}
          setItems={setItems}
          payment={payment}
          setPayment={setPayment}
          customerSearch={customerSearch}
          setCustomerSearch={setCustomerSearch}
          selectedCustomerId={selectedCustomerId}
          customerSearchResult={customerSearchResult}
          billingProducts={billingProducts}
          inventoryLoading={inventoryLoading}
          totals={totals}
          onCustomerSelect={onCustomerSelect}
          onSubmit={billForEdit ? updateBillSubmit : createBill}
          isSubmitting={billingState.status === "loading"}
        />
      )}

      <BillList
        bills={bills}
        loading={isLoading}
        onSelectBill={setBillForPreview}
        onEditPayment={setBillForPaymentEdit}
        onEditOrder={setBillForEdit}
      />

      <BillPreview
        bill={billForPreview}
        onClose={() => setBillForPreview(undefined)}
      />

      <EditPaymentModal
        bill={billForPaymentEdit}
        onClose={() => setBillForPaymentEdit(undefined)}
        onUpdated={() => refetch()}
      />
    </div>
  );
}
