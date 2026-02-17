import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPurchaseItem {
  productId: mongoose.Types.ObjectId;
  boxes: number;
  looseItems: number;
  perBoxItem?: number;  // Add this
  purchasePrice: number;
  discountPercent: number;
  grossAmount?: number;
  discountAmount?: number;
  taxableAmount?: number;
  taxPercent: number;
  taxAmount: number;
  totalAmount: number;
  totalQty?: number;
}

export interface IPurchase extends Document {
  dealerId: mongoose.Types.ObjectId;
  warehouseId: mongoose.Types.ObjectId;
  items: IPurchaseItem[];
  subTotal: number;
  taxTotal: number;
  grandTotal: number;
  purchaseDate?: Date;
  createdAt: Date;
}

const PurchaseSchema = new Schema<IPurchase>(
  {
    dealerId: { type: Schema.Types.ObjectId, ref: "Dealer", required: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse", required: true },
    items: [
      {
        productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
        boxes: { type: Number, required: true, default: 0 },
        looseItems: { type: Number, required: true, default: 0 },
        perBoxItem: Number,
        purchasePrice: { type: Number, required: true },
        discountPercent: { type: Number, required: true, default: 0 },
        grossAmount: Number,
        discountAmount: Number,
        taxableAmount: Number,
        taxPercent: { type: Number, required: true, default: 0 },
        taxAmount: Number,
        totalAmount: Number,
        totalQty: Number,
      },
    ],
    subTotal: Number,
    taxTotal: Number,
    grandTotal: Number,
    purchaseDate: { type: Date, default: null },
  },
  { timestamps: true }
);

PurchaseSchema.index({ createdAt: -1 });
PurchaseSchema.index({ purchaseDate: -1 });
PurchaseSchema.index({ dealerId: 1, purchaseDate: -1 });
PurchaseSchema.index({ warehouseId: 1, createdAt: -1 });

const Purchase: Model<IPurchase> =
  mongoose.models.Purchase || mongoose.model<IPurchase>("Purchase", PurchaseSchema);

export default Purchase;
