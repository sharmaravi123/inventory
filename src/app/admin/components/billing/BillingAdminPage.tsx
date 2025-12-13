"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  useListBillsQuery,
  useUpdateBillMutation,
  useLazySearchCustomersQuery,
  CreateBillPayload,
  CreateBillPaymentInput,
  Bill,
  Customer,
} from "@/store/billingApi";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { submitBill, clearBillingError } from "@/store/billingSlice";
import { fetchInventory, InventoryItem } from "@/store/inventorySlice";
import { fetchProducts, ProductType } from "@/store/productSlice";
import { fetchWarehouses, Warehouse } from "@/store/warehouseSlice";

import OrderForm from "./OrderForm";
import BillList from "./BillList";
import BillPreview from "./BillPreview";
import EditPaymentModal from "./EditPaymentModal";

const COMPANY_GST_NUMBER = "27ABCDE1234F1Z5";

export type CustomerFormState = {
  _id?: string;
  name: string;
  shopName?: string;
  phone: string;
  address: string;
  gstNumber?: string;
};

export type BillingProductOption = {
  id: string;
  productId: string;
  warehouseId: string;
  productName: string;
  warehouseName: string;
  sellingPrice: number;
  taxPercent: number;
  itemsPerBox: number; // FIXED: Always controlled
  boxesAvailable: number;
  looseAvailable: number;
};

export type BillFormItemState = {
  id: string;
  productSearch: string;
  selectedProduct?: BillingProductOption;
  quantityBoxes: number;
  quantityLoose: number;

  discountType: "NONE" | "PERCENT" | "CASH";
  discountValue: number;

  overridePriceForCustomer: boolean;
};

export type Totals = {
  totalItemsCount: number;
  totalBeforeTax: number;
  totalTax: number;
  grandTotal: number;
};

const randomId = () => crypto.randomUUID();

const safeNum = (v: unknown, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

// -------------------- INITIAL STATES --------------------
const initialCustomer: CustomerFormState = {
  name: "",
  shopName: "",
  phone: "",
  address: "",
  gstNumber: "",
};

const initialPayment: CreateBillPaymentInput = {
  mode: "CASH",
  cashAmount: 0,
  upiAmount: 0,
  cardAmount: 0,
};

const emptyItem = (): BillFormItemState => ({
  id: randomId(),
  productSearch: "",
  selectedProduct: undefined,
  quantityBoxes: 0,
  quantityLoose: 0,
  discountType: "NONE",
  discountValue: 0,
  overridePriceForCustomer: false,
});

const extractId = (ref: unknown): string | undefined => {
  if (typeof ref === "string") return ref;
  if (typeof ref === "object" && ref !== null) {
    const obj = ref as { _id?: string; id?: string };
    return obj._id ?? obj.id;
  }
  return undefined;
};

// =============================================================
//                   MAIN COMPONENT
// =============================================================
export default function BillingAdminPage() {
  const dispatch = useAppDispatch();

  const inventory = useAppSelector((s) => s.inventory.items);
  const inventoryLoading = useAppSelector((s) => s.inventory.loading);

  const rawProducts = useAppSelector((s) => s.product.products ?? []);
  const rawWarehouses = useAppSelector((s) => s.warehouse.list ?? []);

  const billingState = useAppSelector((s) => s.billing);

  const [customer, setCustomer] = useState<CustomerFormState>(initialCustomer);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");

  const [items, setItems] = useState<BillFormItemState[]>([emptyItem()]);

  const [customerSavedPrices, setCustomerSavedPrices] =
    useState<Record<string, number>>({});

  const [payment, setPayment] =
    useState<CreateBillPaymentInput>(initialPayment);

  const [billDate, setBillDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const [showForm, setShowForm] = useState(false);
  const [billSearch, setBillSearch] = useState("");
  const [billForEdit, setBillForEdit] = useState<Bill>();
  const [billForPreview, setBillForPreview] = useState<Bill>();
  const [billForPaymentEdit, setBillForPaymentEdit] = useState<Bill>();

  const [triggerCustomerSearch, customerSearchResult] =
    useLazySearchCustomersQuery();

  const { data: billsData, isLoading, refetch } = useListBillsQuery({
    search: billSearch,
  });

  const bills = billsData?.bills ?? [];
  const [updateBill] = useUpdateBillMutation();

  // -------------------- INITIAL LOAD --------------------
  useEffect(() => {
    dispatch(fetchInventory());
    dispatch(fetchProducts());
    dispatch(fetchWarehouses());
  }, []);

  const getProduct = (id?: string): ProductType | undefined =>
    rawProducts.find((p: ProductType) => p.id === id || p._id === id);

  const getWarehouse = (id?: string): Warehouse | undefined =>
    rawWarehouses.find((w: Warehouse) => w.id === id || w._id === id);


  // =============================================================
  //          FIXED BILLING PRODUCT MAPPING (NO ERRORS)
  // =============================================================
  const billingProducts: BillingProductOption[] = useMemo(() => {
    return inventory.map((inv: InventoryItem) => {
      const pid = extractId(inv.product) ?? "";
      const wid = extractId(inv.warehouse) ?? "";

      const prod = getProduct(pid);
      const wh = getWarehouse(wid);

      return {
        id: String(inv._id),
        productId: pid,
        warehouseId: wid,
        productName: prod?.name ?? "Unnamed Product",
        warehouseName: wh?.name ?? "Warehouse",

        sellingPrice: customerSavedPrices[pid] ?? prod?.sellingPrice ?? 0,

        taxPercent: prod?.taxPercent ?? 0,

        // FIX: perBoxItem exists in Product Model
        itemsPerBox:
          prod?.perBoxItem ??
          1, // no more inv.itemsPerBox error

        boxesAvailable: inv.boxes ?? 0,
        looseAvailable: inv.looseItems ?? 0,
      };
    });
  }, [inventory, rawProducts, rawWarehouses, customerSavedPrices]);

  // =============================================================
  //                   CUSTOMER SEARCH HANDLER
  // =============================================================
  useEffect(() => {
    if (customerSearch.length < 2) return;
    const t = setTimeout(
      () => triggerCustomerSearch(customerSearch),
      350
    );
    return () => clearTimeout(t);
  }, [customerSearch]);

  const onCustomerSelect = (id: string) => {
    const doc = customerSearchResult.data?.customers.find(
      (c) => c._id === id
    );
    if (!doc) return;

    setSelectedCustomerId(id);

    setCustomer({
      _id: doc._id,
      name: doc.name,
      shopName: doc.shopName,
      phone: doc.phone,
      address: doc.address,
      gstNumber: doc.gstNumber,
    });

    const priceMap = Object.fromEntries(
      (doc.customPrices ?? [])
        .filter((cp): cp is { product: string; price: number } =>
          typeof cp.product === "string" && typeof cp.price === "number"
        )
        .map((cp) => [cp.product, cp.price])
    );

    setCustomerSavedPrices(priceMap);

  };

  // =============================================================
  //                 TOTALS CALCULATION — FIXED
  // =============================================================
  const totals: Totals = useMemo(() => {
    let count = 0,
      before = 0,
      tax = 0,
      total = 0;

    items.forEach((it) => {
      if (!it.selectedProduct) return;
      const p = it.selectedProduct;

      const qty = it.quantityBoxes * p.itemsPerBox + it.quantityLoose;

      let price = p.sellingPrice;
      if (it.discountType === "PERCENT")
        price -= (price * it.discountValue) / 100;
      else if (it.discountType === "CASH")
        price = Math.max(0, price - it.discountValue);

      const gross = qty * price;

      const tx = (gross * p.taxPercent) / (100 + p.taxPercent);
      const bt = gross - tx;

      count += qty;
      before += bt;
      tax += tx;
      total += gross;
    });

    return {
      totalItemsCount: count,
      totalBeforeTax: before,
      totalTax: tax,
      grandTotal: total,
    };
  }, [items]);

  // =============================================================
  //                 CREATE BILL — FIXED PAYLOAD
  // =============================================================
  const createBill = async () => {
    if (!customer.name || !customer.phone) {
      alert("Customer required");
      return;
    }

    const valid = items.filter(
      (it) =>
        it.selectedProduct &&
        (it.quantityBoxes > 0 || it.quantityLoose > 0)
    );

    if (!valid.length) return alert("Add product");

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
      billDate: new Date(billDate).toISOString(),
      items: valid.map((it) => {
        const p = it.selectedProduct!;
        return {
          stockId: p.id,
          productId: p.productId,
          warehouseId: p.warehouseId,
          productName: p.productName,
          sellingPrice: p.sellingPrice,
          taxPercent: p.taxPercent,
          quantityBoxes: it.quantityBoxes,
          quantityLoose: it.quantityLoose,
          itemsPerBox: p.itemsPerBox,
          discountType: it.discountType,
          discountValue: it.discountValue,
          overridePriceForCustomer: it.overridePriceForCustomer,
        };
      }),
      payment,
    };

    dispatch(clearBillingError());

    try {
      await dispatch(submitBill(payload)).unwrap();
      alert("Bill created ✔");

      setCustomer(initialCustomer);
      setItems([emptyItem()]);
      setPayment(initialPayment);
      setBillDate(new Date().toISOString().slice(0, 10));
      setSelectedCustomerId("");
      setCustomerSavedPrices({});

      setShowForm(false);
      refetch();
    } catch {
      alert("Failed");
    }
  };

  // =============================================================
  //                 LOAD BILL FOR EDIT
  // =============================================================
  const loadBillForEdit = (bill: Bill) => {
    setBillForEdit(bill);
    setShowForm(true);

    setCustomer({
      _id: bill.customerInfo.customer,
      name: bill.customerInfo.name,
      shopName: bill.customerInfo.shopName,
      phone: bill.customerInfo.phone,
      address: bill.customerInfo.address,
      gstNumber: bill.customerInfo.gstNumber,
    });

    const mapped = bill.items.map((line) => {
      const pid = extractId(line.product);
      const wid = extractId(line.warehouse);

      const match = billingProducts.find(
        (x) => x.productId === pid && x.warehouseId === wid
      );

      return {
        id: randomId(),
        productSearch: match?.productName ?? line.productName,
        selectedProduct: match,
        quantityBoxes: line.quantityBoxes,
        quantityLoose: line.quantityLoose,
        discountType: line.discountType ?? "NONE",
        discountValue: line.discountValue ?? 0,
        overridePriceForCustomer: false,
      };
    });

    setItems(mapped);
    setPayment(bill.payment);
    setBillDate(new Date(bill.billDate).toISOString().slice(0, 10));
  };

  // =============================================================
  //                 UPDATE BILL — FIXED
  // =============================================================
  const updateBillSubmit = async () => {
    if (!billForEdit) return;

    const valid = items.filter(
      (it) =>
        it.selectedProduct &&
        (it.quantityBoxes > 0 || it.quantityLoose > 0)
    );

    if (!valid.length) return alert("Add product");

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
      billDate: new Date(billDate).toISOString(),
      items: valid.map((it) => {
        const p = it.selectedProduct!;
        return {
          stockId: p.id,
          productId: p.productId,
          warehouseId: p.warehouseId,
          productName: p.productName,
          sellingPrice: p.sellingPrice,
          taxPercent: p.taxPercent,
          quantityBoxes: it.quantityBoxes,
          quantityLoose: it.quantityLoose,
          itemsPerBox: p.itemsPerBox,
          discountType: it.discountType,
          discountValue: it.discountValue,
          overridePriceForCustomer: it.overridePriceForCustomer,
        };
      }),
      payment,
    };

    try {
      await updateBill({ id: billForEdit._id, payload }).unwrap();
      alert("Updated ✔");

      setBillForEdit(undefined);
      setShowForm(false);
      refetch();
    } catch {
      alert("Update failed");
    }
  };

  // =============================================================
  //                 RENDER UI
  // =============================================================
  return (
    <div className="space-y-6">
      <header className="flex justify-between">
        <h1 className="text-xl font-bold">Billing</h1>

        <div className="flex gap-2">
          <input
            value={billSearch}
            onChange={(e) => setBillSearch(e.target.value)}
            className="border px-3 py-2 rounded"
            placeholder="Search bills..."
          />

          <button
            className="bg-blue-600 text-white px-4 py-2 rounded"
            onClick={() => {
              setShowForm(!showForm);
              if (!showForm) {
                setBillForEdit(undefined);
                setCustomer(initialCustomer);
                setItems([emptyItem()]);
                setPayment(initialPayment);
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
          customer={customer}
          setCustomer={setCustomer}
          items={items}
          setItems={setItems}
          payment={payment}
          setPayment={setPayment}
          customerSearch={customerSearch}
          setCustomerSearch={setCustomerSearch}
          selectedCustomerId={selectedCustomerId}
          billingProducts={billingProducts}
          inventoryLoading={inventoryLoading}
          totals={totals}
          onCustomerSelect={onCustomerSelect}
          onSubmit={billForEdit ? updateBillSubmit : createBill}
          isSubmitting={billingState.status === "loading"}
          billDate={billDate}
          setBillDate={setBillDate}
        />
      )}

      <BillList
        bills={bills}
        loading={isLoading}
        onSelectBill={(b) => setBillForPreview(b)}
        onEditPayment={(b) => setBillForPaymentEdit(b)}
        onEditOrder={loadBillForEdit}
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
