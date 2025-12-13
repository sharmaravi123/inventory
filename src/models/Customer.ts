import mongoose, { Schema, InferSchemaType, Model, Types } from "mongoose";

/**
 * Customer model — existing fields kept, add customPrices for customer-specific product prices.
 * customPrices: [{ product: ObjectId, price: Number }]
 */

const CustomerPriceSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const customerSchema = new Schema(
  {
    name: { type: String, required: true },
    shopName: { type: String },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    gstNumber: { type: String },
    customPrices: { type: [CustomerPriceSchema], default: [] }, // <-- NEW
  },
  { timestamps: true }
);

customerSchema.index({ phone: 1 }, { unique: true });
customerSchema.index({ name: 1 });
customerSchema.index({ shopName: 1 });

export type CustomerPrice = {
  product: Types.ObjectId;
  price: number;
};

export type CustomerDocument = InferSchemaType<typeof customerSchema> & {
  _id: Types.ObjectId;
  customPrices?: CustomerPrice[];
};

const CustomerModel: Model<CustomerDocument> =
  (mongoose.models.Customer as Model<CustomerDocument>) ||
  mongoose.model<CustomerDocument>("Customer", customerSchema);

export default CustomerModel;
