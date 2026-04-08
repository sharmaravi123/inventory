import mongoose, { Schema, Document, Model } from "mongoose";

export interface IDealer extends Document {
  name: string;
  phone?: string;
  gstin?: string;
  fassiNumber?: string;
  address?: string;
  isActive?: boolean;
  inactiveAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const DealerSchema = new Schema<IDealer>(
  {
    name: { type: String, required: true, index: true },
    phone: { type: String },
    gstin: { type: String },
    fassiNumber: { type: String },
    address: { type: String },
    isActive: { type: Boolean, default: true, index: true },
    inactiveAt: { type: Date, default: null },
  },
  { timestamps: true }
);

DealerSchema.index({ createdAt: -1 });

const Dealer: Model<IDealer> =
  mongoose.models.Dealer ||
  mongoose.model<IDealer>("Dealer", DealerSchema);

export default Dealer;
