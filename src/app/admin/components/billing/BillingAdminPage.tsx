"use client";

import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import {
  useListBillsQuery,
  useUpdateBillMutation,
  useLazySearchCustomersQuery,
  CreateBillPayload,
  CreateBillPaymentInput,
  Bill,
  Customer,
  BillItemForClient,
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
type WithId = {
  id?: string;
  _id?: string;
};
export type CustomerFormState = {
  _id?: string;
  name: string;
  shopName?: string;
  phone: string;
  address: string;
  gstNumber?: string;
};

export type BillingProductOption = {
  id: string; // stockId
  productId: string;
  warehouseId: string;
  productName: string;
  warehouseName: string;
  sellingPrice: number; // price per PIECE (GST incl)
  taxPercent: number;
  itemsPerBox: number;
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
  discountTotal: number,
};

const randomId = () => crypto.randomUUID();
const safeNum = (v: unknown, fb = 0) =>
  Number.isFinite(Number(v)) ? Number(v) : fb;
const todayISO = () => new Date().toISOString().slice(0, 10);

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

export default function BillingAdminPage() {
  const dispatch = useAppDispatch();
  const inventory = useAppSelector((s) => s.inventory.items);
  const inventoryLoading = useAppSelector((s) => s.inventory.loading);
  const rawProducts = useAppSelector(
    (s) => s.product.products ?? []
  );
  const rawWarehouses = useAppSelector(
    (s) => s.warehouse.list ?? []
  );
  const billingState = useAppSelector((s) => s.billing);

  const [customer, setCustomer] =
    useState<CustomerFormState>(initialCustomer);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [items, setItems] = useState<BillFormItemState[]>([
    emptyItem(),
  ]);
  const [customerSavedPrices, setCustomerSavedPrices] = useState<
    Record<string, number>
  >({});
  const [payment, setPayment] =
    useState<CreateBillPaymentInput>(initialPayment);
  const [billDate, setBillDate] = useState(todayISO());
  const [showForm, setShowForm] = useState(false);
  const [billSearch, setBillSearch] = useState("");
  const [billForEdit, setBillForEdit] = useState<Bill>();
  const [billForPreview, setBillForPreview] = useState<Bill>();
  const [billForPaymentEdit, setBillForPaymentEdit] =
    useState<Bill>();

  const [triggerCustomerSearch, customerSearchResult] =
    useLazySearchCustomersQuery();
  const { data: billsData, isLoading, refetch } =
    useListBillsQuery({ search: billSearch });
  const bills = billsData?.bills ?? [];
  const [updateBill] = useUpdateBillMutation();

  const loadInitialData = useCallback(() => {
    dispatch(fetchInventory());
    dispatch(fetchProducts());
    dispatch(fetchWarehouses());
  }, [dispatch]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const getProduct = useCallback(
    (id?: string): ProductType | undefined => {
      if (!id) return undefined;

      return (rawProducts as (ProductType & WithId)[]).find(
        (p) => p.id === id || p._id === id
      );
    },
    [rawProducts]
  );

  const getWarehouse = useCallback(
    (id?: string): Warehouse | undefined => {
      if (!id) return undefined;

      return (rawWarehouses as (Warehouse & WithId)[]).find(
        (w) => w.id === id || w._id === id
      );
    },
    [rawWarehouses]
  );


  const billingProducts: BillingProductOption[] = useMemo(() => {
    return inventory.map((inv: InventoryItem) => {
      const invAny = inv as unknown as {
        productId?: string;
        product?: string;
        warehouseId?: string;
        warehouse?: string;
        boxes?: number;
        looseItems?: number;
        _id?: string;
      };

      const pid =
        extractId(invAny.productId) ??
        extractId(invAny.product) ??
        invAny.productId ??
        invAny.product ??
        "";

      const wid =
        extractId(invAny.warehouseId) ??
        extractId(invAny.warehouse) ??
        invAny.warehouseId ??
        invAny.warehouse ??
        "";

      const prod = getProduct(pid);
      const wh = getWarehouse(wid);

      const perPiecePrice =
        (prod?.sellingPrice as number) ?? 0;

      // yahan null‑safe cast
      const prodAny = (prod ?? {}) as {
        perBoxItem?: number;
        itemsPerBox?: number;
        taxPercent?: number;
        name?: string;
      };

      const itemsPerBox =
        Number(
          prodAny.perBoxItem ??
          prodAny.itemsPerBox ??
          1
        ) || 1;

      return {
        id: String(invAny._id ?? ""),
        productId: pid,
        warehouseId: wid,
        productName: prod?.name ?? "Unnamed Product",
        warehouseName: wh?.name ?? "Unknown Warehouse",
        sellingPrice: perPiecePrice,
        taxPercent: (prodAny.taxPercent as number) ?? 0,
        itemsPerBox,
        boxesAvailable: invAny.boxes ?? 0,
        looseAvailable: invAny.looseItems ?? 0,
      };
    });
  }, [
    inventory,
    rawProducts,
    rawWarehouses,
    customerSavedPrices,
    getProduct,
    getWarehouse,
  ]);


  useEffect(() => {
    if (customerSearch.length < 2) return;
    const t = setTimeout(
      () => triggerCustomerSearch(customerSearch),
      350
    );
    return () => clearTimeout(t);
  }, [customerSearch, triggerCustomerSearch]);

  const onCustomerSelect = useCallback(
    (id: string) => {
      const data = customerSearchResult.data;
      const customers = data?.customers as Customer[] | undefined;

      const doc = customers?.find((c) => c._id === id);
      if (!doc) return;

      setSelectedCustomerId(id);
      setCustomer({
        _id: doc._id,
        name: doc.name,
        shopName: doc.shopName ?? "",
        phone: doc.phone,
        address: doc.address ?? "",
        gstNumber: doc.gstNumber ?? "",
      });

      const priceMap = Object.fromEntries(
        (doc.customPrices ?? [])
          .filter((cp): cp is { product: string; price: number } => {
            const cpx = cp as { product?: unknown; price?: unknown };
            return (
              typeof cpx.product === "string" &&
              typeof cpx.price === "number"
            );
          })
          .map((cp) => {
            const cpx = cp as { product: string; price: number };
            return [cpx.product, cpx.price] as const;
          })
      );
      setCustomerSavedPrices(priceMap);
    },
    [customerSearchResult.data]
  );

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


  const createBill = async () => {
    if (!customer.name || !customer.phone)
      return alert("Customer required");
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
          overridePriceForCustomer:
            it.overridePriceForCustomer ?? false,
        };
      }),
      payment,
    };

    dispatch(clearBillingError());
    try {
      await dispatch(submitBill(payload)).unwrap();
      alert("Bill created ✔");
      resetForm();
      setShowForm(false);
      refetch();
    } catch {
      alert("Failed");
    }
  };

  const updateBillSubmit = async () => {
    if (!billForEdit) return;

    const validItems = items.filter(
      it => it.selectedProduct && (it.quantityBoxes > 0 || it.quantityLoose > 0)
    );

    if (!validItems.length) {
      alert("Add items");
      return;
    }

    const payload = {
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
      items: validItems.map(it => {
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
          overridePriceForCustomer: true,
        };
      }),
      payment,
    };

    const res = await fetch(`/api/billing/${billForEdit._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error);
      return;
    }

    alert("Bill updated");
    setShowForm(false);
    setBillForEdit(undefined);
    refetch();
  };

  const loadBillForEdit = (bill: Bill) => {
    setBillForEdit(bill);
    setShowForm(true);

    setCustomer({
      _id: bill.customerInfo.customer,
      name: bill.customerInfo.name,
      shopName: bill.customerInfo.shopName || "",
      phone: bill.customerInfo.phone,
      address: bill.customerInfo.address || "",
      gstNumber: bill.customerInfo.gstNumber || "",
    });

    setSelectedCustomerId(bill.customerInfo.customer || "");

    const mappedItems: BillFormItemState[] = bill.items.map((it) => {
  const matchedInventoryProduct = billingProducts.find(
    (bp) =>
      bp.productId === String(it.product) &&
      bp.warehouseId === String(it.warehouse)
  );

  if (!matchedInventoryProduct) return emptyItem();

  return {
    id: crypto.randomUUID(),
    productSearch: it.productName,

    // 🔒 PRICE COMES FROM BILL (NOT INVENTORY)
    selectedProduct: {
      ...matchedInventoryProduct,

      // ✅ THIS IS THE MOST IMPORTANT LINE
      sellingPrice: it.sellingPrice,
    },

    quantityBoxes: it.quantityBoxes,
    quantityLoose: it.quantityLoose,

    discountType: it.discountType ?? "NONE",
    discountValue: it.discountValue ?? 0,

    overridePriceForCustomer: true,
  };
});




    setItems(mappedItems.length ? mappedItems : [emptyItem()]);

    setPayment({
      mode: bill.payment.mode,
      cashAmount: bill.payment.cashAmount ?? 0,
      upiAmount: bill.payment.upiAmount ?? 0,
      cardAmount: bill.payment.cardAmount ?? 0,
    });

    setBillDate(new Date(bill.billDate).toISOString().slice(0, 10));
  };

  const resetForm = () => {
    setCustomer(initialCustomer);
    setItems([emptyItem()]);
    setPayment(initialPayment);
    setSelectedCustomerId("");
    setCustomerSavedPrices({});
    setBillDate(todayISO());
    setBillForEdit(undefined);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Billing Console
            </h1>
            <p className="text-sm text-slate-500">
              Create and manage customer bills with live inventory.
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <input
              value={billSearch}
              onChange={(e) => setBillSearch(e.target.value)}
              className="flex-1 sm:w-64 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
              placeholder="Search bills..."
            />
            <button
              className="rounded-lg bg-gradient-to-r from-sky-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-sky-200 hover:from-sky-400 hover:to-blue-400 transition"
              onClick={() => {
                setShowForm((prev) => !prev);
                if (!showForm) resetForm();
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
            customerSearchResult={customerSearchResult.data}
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

        <div className="grid gap-6">
          <div>
            <BillList
              bills={bills}
              loading={isLoading}
              onSelectBill={(b) => setBillForPreview(b)}
              onEditPayment={(b) => setBillForPaymentEdit(b)}
              onEditOrder={loadBillForEdit}
            />
          </div>
          <div className="space-y-4">
            {billForPreview && (
              <BillPreview
                bill={billForPreview}
                onClose={() => setBillForPreview(undefined)}
              />
            )}

            <EditPaymentModal
              bill={billForPaymentEdit}
              onClose={() => setBillForPaymentEdit(undefined)}
              onUpdated={() => refetch()}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
