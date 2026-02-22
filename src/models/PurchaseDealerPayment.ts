import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPurchaseDealerPayment extends Document {
  dealerId: mongoose.Types.ObjectId;
  amount: number;
  paymentMode: "CASH" | "UPI" | "CARD";
  paymentDate: Date;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PurchaseDealerPaymentSchema = new Schema<IPurchaseDealerPayment>(
  {
    dealerId: { type: Schema.Types.ObjectId, ref: "Dealer", required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    paymentMode: { type: String, enum: ["CASH", "UPI", "CARD"], default: "CASH", required: true },
    paymentDate: { type: Date, required: true, index: true },
    note: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

PurchaseDealerPaymentSchema.index({ dealerId: 1, paymentDate: -1 });

const PurchaseDealerPayment: Model<IPurchaseDealerPayment> =
  mongoose.models.PurchaseDealerPayment ||
  mongoose.model<IPurchaseDealerPayment>("PurchaseDealerPayment", PurchaseDealerPaymentSchema);

export default PurchaseDealerPayment;
