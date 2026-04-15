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
    phone: {
      type: String,
      set: (value: unknown) => {
        if (typeof value !== "string") return undefined;
        const normalized = value.trim();
        return normalized || undefined;
      },
    },
    address: { type: String, required: true },
    gstNumber: { type: String },
    customPrices: { type: [CustomerPriceSchema], default: [] }, // <-- NEW
  },
  { timestamps: true }
);

customerSchema.index(
  { phone: 1 },
  {
    unique: true,
    partialFilterExpression: {
      phone: { $exists: true, $type: "string" },
    },
  }
);
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

let customerPhoneIndexPromise: Promise<void> | null = null;

export async function ensureCustomerPhoneIndex(): Promise<void> {
  if (!customerPhoneIndexPromise) {
    customerPhoneIndexPromise = (async () => {
      const indexes = await CustomerModel.collection.indexes();
      const phoneIndex = indexes.find((index) => index.name === "phone_1");
      const hasExpectedIndex =
        phoneIndex?.unique === true &&
        phoneIndex?.partialFilterExpression?.phone?.$exists === true &&
        phoneIndex?.partialFilterExpression?.phone?.$type === "string";

      if (hasExpectedIndex) return;

      if (phoneIndex) {
        await CustomerModel.collection.dropIndex("phone_1");
      }

      await CustomerModel.collection.createIndex(
        { phone: 1 },
        {
          name: "phone_1",
          unique: true,
          partialFilterExpression: {
            phone: { $exists: true, $type: "string" },
          },
        }
      );
    })().catch((error) => {
      customerPhoneIndexPromise = null;
      throw error;
    });
  }

  await customerPhoneIndexPromise;
}

export default CustomerModel;
