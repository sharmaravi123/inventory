import mongoose, { Document, Model, Schema } from "mongoose";

export interface IStock extends Document {
  productId: string;
  warehouseId: string;
  boxes: number;
  looseItems: number;
  totalItems: number;
  lowStockItems?: number | null;
  lowStockBoxes?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const StockSchema = new Schema<IStock>(
  {
    productId: { type: String, required: true, index: true },
    warehouseId: { type: String, required: true, index: true },

    boxes: { type: Number, required: true, default: 0 },
    looseItems: { type: Number, required: true, default: 0 },
    totalItems: { type: Number, required: true, default: 0 },

    lowStockItems: { type: Number, default: null },
    lowStockBoxes: { type: Number, default: null },
  },
  { timestamps: true }
);

// 1 stock per product + warehouse
StockSchema.index({ productId: 1, warehouseId: 1 }, { unique: true });

const Stock: Model<IStock> =
  (mongoose.models.Stock as Model<IStock>) ||
  mongoose.model<IStock>("Stock", StockSchema);

export default Stock;
