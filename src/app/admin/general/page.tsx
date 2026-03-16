"use client";

import React, { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchCompanyProfile,
  updateCompanyProfile,
} from "@/store/companyProfileSlice";
import Swal from "sweetalert2";

export default function GeneralSetting() {
  const dispatch = useAppDispatch();

  const { data, loading } = useAppSelector(
    (state) => state.companyProfile
  );

  const [form, setForm] = useState({
    name: "",
    addressLine1: "",
    addressLine2: "",
    phone: "",
    gstin: "",
    bankName: "",
    accountHolder: "",
    accountNumber: "",
    ifscCode: "",
    branch: "",
  });

  /* LOAD PROFILE */
  useEffect(() => {
    dispatch(fetchCompanyProfile());
  }, [dispatch]);

  /* FILL FORM */
  useEffect(() => {
    if (!data) return;

    setForm({
      name: data.name || "",
      addressLine1: data.addressLine1 || "",
      addressLine2: data.addressLine2 || "",
      phone: data.phone || "",
      gstin: data.gstin || "",
      bankName: data.bankName || "",
      accountHolder: data.accountHolder || "",
      accountNumber: data.accountNumber || "",
      ifscCode: data.ifscCode || "",
      branch: data.branch || "",
    });
  }, [data]);

  const onChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

  const onSave = async () => {
    await dispatch(updateCompanyProfile(form)).unwrap();

    Swal.fire({
      icon: "success",
      title: "Profile Updated",
      text: "Settings saved successfully.",
      timer: 2000,
      showConfirmButton: false,
    });

  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* PAGE HEADER */}
        <div className="mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">General Settings</h1>
          <p className="text-lg text-gray-600">
            Configure your company profile and banking details
          </p>
        </div>

        <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">

          {/* COMPANY INFORMATION */}
          <div className="border-b border-gray-200">
            <div className="px-6 py-8 border-b border-gray-100 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900">Company Information</h2>
              <p className="text-sm text-gray-500 mt-1">Basic company details for billing and invoices</p>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Name *
                  </label>
                  <input
                    name="name"
                    value={form.name}
                    onChange={onChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                    placeholder="Enter company name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    name="phone"
                    value={form.phone}
                    onChange={onChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                    placeholder="+91 98765 43210"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    GSTIN
                  </label>
                  <input
                    name="gstin"
                    value={form.gstin}
                    onChange={onChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                    placeholder="22AAAAA0000A1Z5"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address Line 1 *
                  </label>
                  <textarea
                    name="addressLine1"
                    value={form.addressLine1}
                    onChange={onChange}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200 resize-vertical"
                    placeholder="Street address, city, state"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address Line 2
                  </label>
                  <textarea
                    name="addressLine2"
                    value={form.addressLine2}
                    onChange={onChange}
                    rows={2}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200 resize-vertical"
                    placeholder="Additional address details (optional)"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* BANK DETAILS */}
          <div className="border-b border-gray-200">
            <div className="px-6 py-8 border-b border-gray-100 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900">Bank Details</h2>
              <p className="text-sm text-gray-500 mt-1">Banking information for payments and settlements</p>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bank Name
                  </label>
                  <input
                    name="bankName"
                    value={form.bankName}
                    onChange={onChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                    placeholder="State Bank of India"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Branch
                  </label>
                  <input
                    name="branch"
                    value={form.branch}
                    onChange={onChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                    placeholder="Main Branch"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Account Holder Name
                  </label>
                  <input
                    name="accountHolder"
                    value={form.accountHolder}
                    onChange={onChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Account Number
                  </label>
                  <input
                    name="accountNumber"
                    value={form.accountNumber}
                    onChange={onChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                    placeholder="123456789012"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    IFSC Code
                  </label>
                  <input
                    name="ifscCode"
                    value={form.ifscCode.toUpperCase()}
                    onChange={onChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200 font-mono tracking-wider uppercase"
                    placeholder="SBIN0001234"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SAVE BUTTON */}
          <div className="px-6 py-8 bg-gray-50">
            <button
              disabled={loading}
              onClick={onSave}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-4 px-6 rounded-lg transition duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed"
            >
              {loading ? "Saving Changes..." : "Save All Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
