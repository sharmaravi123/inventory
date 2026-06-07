import mongoose, {
  Schema,
  InferSchemaType,
  Model,
  Types,
} from "mongoose";

const invoiceCounterSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

export type InvoiceCounterDocument =
  InferSchemaType<typeof invoiceCounterSchema> & {
    _id: Types.ObjectId;
  };

const InvoiceCounterModel: Model<InvoiceCounterDocument> =
  (mongoose.models.InvoiceCounter as Model<InvoiceCounterDocument>) ||
  mongoose.model<InvoiceCounterDocument>(
    "InvoiceCounter",
    invoiceCounterSchema
  );

export default InvoiceCounterModel;
