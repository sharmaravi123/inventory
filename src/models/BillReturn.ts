// src/models/BillReturn.ts
import { Schema, model, models, Document, Types, Model } from "mongoose";

export type BillReturnItem = {
  product: Types.ObjectId;
  warehouse: Types.ObjectId;
  productName: string;
  quantityBoxes: number;
  quantityLoose: number;
  itemsPerBox: number;
  totalItems: number;
  unitPrice?: number;
  taxPercent?: number;
  lineAmount?: number;
};

export interface BillReturnDocument extends Document {
  bill: Types.ObjectId;
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
  totalAmount?: number;
  taxPercent: { type: Number, default: 0 },
  createdAt: Date;
  updatedAt: Date;
}

const BillReturnItemSchema = new Schema<BillReturnItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    warehouse: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
    },
    productName: { type: String, required: true },
    quantityBoxes: { type: Number, required: true },
    quantityLoose: { type: Number, required: true },
    itemsPerBox: { type: Number, required: true },
    totalItems: { type: Number, required: true },
    unitPrice: { type: Number },
    lineAmount: { type: Number },
  },
  { _id: false }
);

const BillReturnSchema = new Schema<BillReturnDocument>(
  {
    bill: { type: Schema.Types.ObjectId, ref: "Bill", required: false },
    customerInfo: {
      name: { type: String, required: true },
      shopName: { type: String },
      phone: { type: String, required: false , default: ""},
      address: { type: String, required: false , default: ""},
      gstNumber: { type: String },
    },
    reason: { type: String },
    note: { type: String },
    items: { type: [BillReturnItemSchema], required: true },
    totalAmount: { type: Number },
  },
  { timestamps: true }
);

const BillReturnModel: Model<BillReturnDocument> =
  (models.BillReturn as Model<BillReturnDocument>) ||
  model<BillReturnDocument>("BillReturn", BillReturnSchema);

export default BillReturnModel;
