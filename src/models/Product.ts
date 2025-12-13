import mongoose, { Schema, Document } from "mongoose";

export interface IProduct extends Document {
  name: string;
  sku: string;
  categoryId: mongoose.Types.ObjectId;
  purchasePrice: number;
  sellingPrice: number;
  description?: string | null;
  taxPercent?: number | null;
  perBoxItem?: number;
  hsnCode?: string | null; 
  createdByAdminId?: string | null;
  createdByWarehouseId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, unique: true, trim: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    purchasePrice: { type: Number, required: true, default: 0 },
    sellingPrice: { type: Number, required: true, default: 0 },
    description: { type: String, default: null },
    taxPercent: { type: Number, default: 0 },
    perBoxItem: { type: Number, default: 1 },
    hsnCode: { type: String, default: null, trim: true }, 
    createdByAdminId: { type: String, default: null },
    createdByWarehouseId: { type: String, default: null },
  },
  { timestamps: true }
);

const Product =
  mongoose.models.Product || mongoose.model<IProduct>("Product", ProductSchema);
export default Product;
