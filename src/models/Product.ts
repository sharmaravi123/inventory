import mongoose, { Schema, Document } from "mongoose";

export interface IProduct extends Document {
  name: string;
  sku: string;
  categoryId: mongoose.Types.ObjectId;
  purchasePrice: number;
  sellingPrice: number;
  description?: string;
  createdByAdminId?: string;
  createdByWarehouseId?: string;
  taxRate?: number;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true },
    sku: { type: String, required: true, unique: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    purchasePrice: { type: Number, required: true },
    sellingPrice: { type: Number, required: true },
    description: { type: String },
    createdByAdminId: { type: String },
    createdByWarehouseId: { type: String },
    taxRate: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.models.Product || mongoose.model<IProduct>("Product", ProductSchema);
