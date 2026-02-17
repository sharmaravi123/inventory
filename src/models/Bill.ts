import mongoose, {
  Schema,
  InferSchemaType,
  Model,
  Types,
} from "mongoose";

const billItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    warehouse: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
    },
    productName: { type: String, required: true },
    sellingPrice: { type: Number, required: true }, // per piece (GST included)
    taxPercent: { type: Number, required: true },

    quantityBoxes: { type: Number, required: true, min: 0 },
    quantityLoose: { type: Number, required: true, min: 0 },
    itemsPerBox: { type: Number, required: true, min: 1 },

    totalItems: { type: Number, required: true, min: 0 },
    totalBeforeTax: { type: Number, required: true, min: 0 },
    taxAmount: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },

    // 🔥 Added missing Discount Fields
    discountType: {
      type: String,
      enum: ["NONE", "PERCENT", "CASH"],
      default: "NONE",
    },
    discountValue: { type: Number, default: 0 },

    // 🔥 To store custom price override for customer
    overridePriceForCustomer: { type: Boolean, default: false },
  },
  { _id: false }
);

const paymentSchema = new Schema(
  {
    mode: {
      type: String,
      enum: ["CASH", "UPI", "CARD", "SPLIT"],
      required: true,
    },
    cashAmount: { type: Number, default: 0 },
    upiAmount: { type: Number, default: 0 },
    cardAmount: { type: Number, default: 0 },
  },
  { _id: false }
);

const customerSnapshotSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: "Customer" },
    name: { type: String, required: true },
    shopName: { type: String },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    gstNumber: { type: String },
  },
  { _id: false }
);

const billSchema = new Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    billDate: { type: Date, required: true },

    customerInfo: { type: customerSnapshotSchema, required: true },

    companyGstNumber: { type: String },
    hsnCode: {
      type: String, // ya Number, jo use kar rahe ho
      required: false,
    },
    items: { type: [billItemSchema], required: true },

    totalItems: { type: Number, required: true, min: 0 },
    totalBeforeTax: { type: Number, required: true, min: 0 },
    totalTax: { type: Number, required: true, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },

    payment: { type: paymentSchema, required: true },

    driver: { type: Schema.Types.ObjectId, ref: "User" },
    vehicleNumber: { type: String },

    amountCollected: { type: Number, required: true, default: 0 },
    balanceAmount: { type: Number, required: true },

    status: {
      type: String,
      enum: ["PENDING", "OUT_FOR_DELIVERY", "DELIVERED", "PARTIALLY_PAID"],
      required: true,
      default: "PENDING",
    },
  },
  { timestamps: true }
);

billSchema.index({ createdAt: -1 });
billSchema.index({ billDate: -1 });
billSchema.index({ status: 1, createdAt: -1 });
billSchema.index({ "customerInfo.phone": 1 });

export type BillItem = InferSchemaType<typeof billItemSchema>;
export type PaymentInfo = InferSchemaType<typeof paymentSchema>;
export type CustomerSnapshot = InferSchemaType<typeof customerSnapshotSchema>;

export type BillDocument = InferSchemaType<typeof billSchema> & {
  _id: Types.ObjectId;
};

const BillModel: Model<BillDocument> =
  (mongoose.models.Bill as Model<BillDocument>) ||
  mongoose.model<BillDocument>("Bill", billSchema);

export default BillModel;
