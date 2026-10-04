import mongoose, { Document, Model, Schema } from "mongoose";

export interface IStock extends Document {
  productId: string;
  warehouseId: string;
  boxes: number;
  looseItems: number;
  totalItems: number;
  lowStockItems?: number | null;
  lowStockBoxes?: number | null;
  productName?: string | null;
  purchasePrice?: number | null;
  sellingPrice?: number | null;
  perBoxItem?: number | null;
  taxPercent?: number | null;
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
    productName: { type: String, default: null },
    purchasePrice: { type: Number, default: null },
    sellingPrice: { type: Number, default: null },
    perBoxItem: { type: Number, default: null },
    taxPercent: { type: Number, default: null },
  },
  { timestamps: true }
);

// 1 stock per product + warehouse
StockSchema.index({ productId: 1, warehouseId: 1 }, { unique: true });

const cachedStockModel = mongoose.models.Stock;
if (
  process.env.NODE_ENV === "development" &&
  cachedStockModel &&
  !cachedStockModel.schema.path("productName")
) {
  delete mongoose.models.Stock;
}

const Stock: Model<IStock> =
  (mongoose.models.Stock as Model<IStock>) ||
  mongoose.model<IStock>("Stock", StockSchema);

export default Stock;
