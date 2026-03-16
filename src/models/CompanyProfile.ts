import mongoose, { Schema, Document, Model } from "mongoose";

export interface ICompanyProfile extends Document {
  name: string;
  addressLine1: string;
  addressLine2: string;
  phone: string;
  gstin: string;

  bankName: string;
  accountHolder: string;
  accountNumber: string;
  ifscCode: string;
  branch: string;

  createdAt: Date;
  updatedAt: Date;
}

const CompanyProfileSchema = new Schema<ICompanyProfile>(
  {
    name: { type: String, required: true },
    addressLine1: { type: String, required: true },
    addressLine2: { type: String, required: true },
    phone: { type: String, required: true },
    gstin: { type: String, required: true },

    bankName: { type: String, required: false, default: "" },
    accountHolder: { type: String, required: false, default: "" },
    accountNumber: { type: String, required: false, default: "" },
    ifscCode: { type: String, required: false, default: "" },
    branch: { type: String, required: false, default: "" },
  },
  { timestamps: true }
);

const CompanyProfile: Model<ICompanyProfile> =
  mongoose.models.CompanyProfile ||
  mongoose.model<ICompanyProfile>("CompanyProfile", CompanyProfileSchema);

export default CompanyProfile;
