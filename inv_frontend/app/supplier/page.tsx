"use client";

import { useCallback, useEffect, useState } from "react";

const API = "http://127.0.0.1:8000/product";

type Supplier = {
  id: number;
  supplier_name: string;
  supplier_phone: number;
  supplier_email: string;
  supplier_address: string;
  status: boolean;
  created_at: string;
};

type FormState = {
  supplier_name: string;
  supplier_phone: string;
  supplier_email: string;
  supplier_address: string;
  status: boolean;
};

const emptyForm: FormState = {
  supplier_name: "",
  supplier_phone: "",
  supplier_email: "",
  supplier_address: "",
  status: true,
};

const toForm = (s: Supplier): FormState => ({
  supplier_name: s.supplier_name,
  supplier_phone: String(s.supplier_phone),
  supplier_email: s.supplier_email,
  supplier_address: s.supplier_address,
  status: s.status,
});

const formatDate = (iso: string) => {
  const d = new Date(iso);

  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-IN", {
        dateStyle: "medium",
      });
};

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [toDelete, setToDelete] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadSuppliers = useCallback(async () => {
    try {
      setError(null);

      const res = await fetch(`${API}/get_supplier/`, {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(
          `Server responded with ${res.status}`
        );
      }

      setSuppliers(await res.json());
    } catch (e) {
      setError(
        e instanceof Error
          ? `Couldn't load suppliers. ${e.message}`
          : "Couldn't load suppliers."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm(toForm(s));
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (!saving) {
      setModalOpen(false);
    }
  };

  const setField = <K extends keyof FormState>(
    key: K,
    value: FormState[K]
  ) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = async () => {
    if (!form.supplier_name.trim()) {
      setFormError("Supplier name is required.");
      return;
    }

    const phoneDigits = form.supplier_phone.replace(/\D/g, "");

    if (!phoneDigits) {
      setFormError("Enter a valid phone number.");
      return;
    }

    if (
      form.supplier_email &&
      !/^\S+@\S+\.\S+$/.test(form.supplier_email)
    ) {
      setFormError("Enter a valid email address.");
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const url = editing
        ? `${API}/update_supplier/${editing.id}`
        : `${API}/add_supplier/`;

      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          supplier_name: form.supplier_name.trim(),
          supplier_phone: Number(phoneDigits),
          supplier_email: form.supplier_email.trim(),
          supplier_address: form.supplier_address.trim(),
          status: form.status,
        }),
      });

      if (!res.ok) {
        const text = await res.text();

        throw new Error(
          text || `Server responded with ${res.status}`
        );
      }

      setModalOpen(false);
      await loadSuppliers();
    } catch (e) {
      setFormError(
        e instanceof Error
          ? e.message
          : "Couldn't save supplier."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;

    setDeleting(true);

    try {
      const res = await fetch(
        `${API}/delete_supplier/${toDelete.id}`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) {
        throw new Error(
          `Server responded with ${res.status}`
        );
      }

      setToDelete(null);
      await loadSuppliers();
    } catch (e) {
      setError(
        e instanceof Error
          ? `Couldn't delete supplier. ${e.message} Suppliers with existing purchases may not be deletable.`
          : "Couldn't delete supplier."
      );

      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const activeCount = suppliers.filter(
    (s) => s.status
  ).length;

  return (
    <main className="min-h-screen bg-[#f6f6f6] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">

        {/* Page Header */}
        <header className="mb-6">
          <div className="rounded-2xl border border-white/80 bg-white px-5 py-5 shadow-[0_8px_30px_rgba(45,55,72,0.06)] sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-4">

              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                  Suppliers
                </h1>

                <p className="mt-0.5 text-sm text-slate-500">
                  {loading
                    ? "Loading…"
                    : `${suppliers.length} suppliers · ${activeCount} active`}
                </p>
              </div>

              <button
                onClick={openAdd}
                className="h-10 rounded-xl bg-blue-600 px-4 text-sm font-medium text-white shadow-sm shadow-blue-200 transition-all hover:bg-blue-700 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                Add supplier
              </button>

            </div>
          </div>
        </header>

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start justify-between gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-sm"
          >
            <span>{error}</span>

            <button
              onClick={loadSuppliers}
              className="font-medium underline underline-offset-2 hover:no-underline"
            >
              Reload
            </button>
          </div>
        )}

        {/* Supplier Table Card */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(45,55,72,0.06)]">

          {/* Card Header */}
          <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">

              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Supplier list
                </h2>

                <p className="mt-0.5 text-xs text-slate-500">
                  Manage your stock suppliers and contact details
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">

                <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                  {suppliers.length} suppliers
                </div>

                <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                  {activeCount} active
                </div>

              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">

              <thead className="bg-[#f8faff] text-slate-600">
                <tr>

                  <th className="whitespace-nowrap border-b border-slate-200 px-4 py-4 text-left font-medium text-slate-500">
                    ID
                  </th>

                  <th className="whitespace-nowrap border-b border-slate-200 px-4 py-4 text-left font-medium text-slate-500">
                    Supplier
                  </th>

                  <th className="whitespace-nowrap border-b border-slate-200 px-4 py-4 text-left font-medium text-slate-500">
                    Phone
                  </th>

                  <th className="whitespace-nowrap border-b border-slate-200 px-4 py-4 text-left font-medium text-slate-500">
                    Email
                  </th>

                  <th className="whitespace-nowrap border-b border-slate-200 px-4 py-4 text-left font-medium text-slate-500">
                    Address
                  </th>

                  <th className="whitespace-nowrap border-b border-slate-200 px-4 py-4 text-left font-medium text-slate-500">
                    Status
                  </th>

                  <th className="whitespace-nowrap border-b border-slate-200 px-4 py-4 text-left font-medium text-slate-500">
                    Added on
                  </th>

                  <th className="border-b border-slate-200 px-4 py-4 text-right font-medium text-slate-500">
                    Actions
                  </th>

                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">

                {!loading &&
                  suppliers.length === 0 &&
                  !error && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-14 text-center text-slate-500"
                      >
                        No suppliers yet. Use “Add supplier”
                        to add your first one.
                      </td>
                    </tr>
                  )}

                {suppliers.map((s) => (
                  <tr
                    key={s.id}
                    className="group transition-colors hover:bg-[#f7f9ff]"
                  >

                    {/* ID */}
                    <td className="px-4 py-3.5 tabular-nums text-slate-500">
                      {s.id}
                    </td>

                    {/* Supplier */}
                    <td className="px-4 py-3.5">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {s.supplier_name}
                        </p>

                        <p className="mt-0.5 text-xs text-slate-500">
                          Supplier ID: {s.id}
                        </p>
                      </div>
                    </td>

                    {/* Phone */}
                    <td className="px-4 py-3.5 tabular-nums text-slate-600">
                      {s.supplier_phone || "—"}
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3.5 text-slate-600">
                      {s.supplier_email ? (
                        <a
                          href={`mailto:${s.supplier_email}`}
                          className="text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          {s.supplier_email}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>

                    {/* Address */}
                    <td className="max-w-xs px-4 py-3.5 text-slate-600">
                      <span className="line-clamp-2">
                        {s.supplier_address || "—"}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                          s.status
                            ? "bg-blue-50 text-blue-700 ring-blue-100"
                            : "bg-slate-100 text-slate-600 ring-slate-200"
                        }`}
                      >
                        {s.status
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </td>

                    {/* Added On */}
                    <td className="whitespace-nowrap px-4 py-3.5 text-slate-600">
                      {formatDate(s.created_at)}
                    </td>

                    {/* Actions */}
                    <td className="whitespace-nowrap px-4 py-3.5 text-right">

                      <button
                        onClick={() => openEdit(s)}
                        className="rounded-lg px-2.5 py-1.5 text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => setToDelete(s)}
                        className="ml-1 rounded-lg px-2.5 py-1.5 text-red-500 transition-colors hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                      >
                        Delete
                      </button>

                    </td>

                  </tr>
                ))}

              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]"
          onClick={closeModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="supplier-modal-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >

            {/* Modal Header */}
            <div className="mb-6">
              <h2
                id="supplier-modal-title"
                className="text-lg font-semibold text-slate-900"
              >
                {editing
                  ? "Edit supplier"
                  : "Add supplier"}
              </h2>

              <p className="mt-0.5 text-xs text-slate-500">
                {editing
                  ? "Update supplier information"
                  : "Add a new supplier to your inventory"}
              </p>
            </div>

            {/* Form */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

              {/* Supplier Name */}
              <div className="sm:col-span-2">
                <Field label="Supplier name">
                  <input
                    value={form.supplier_name}
                    onChange={(e) =>
                      setField(
                        "supplier_name",
                        e.target.value
                      )
                    }
                    autoFocus
                    className={inputCls}
                  />
                </Field>
              </div>

              {/* Phone */}
              <Field label="Phone">
                <input
                  type="tel"
                  inputMode="numeric"
                  value={form.supplier_phone}
                  onChange={(e) =>
                    setField(
                      "supplier_phone",
                      e.target.value
                    )
                  }
                  className={inputCls}
                />
              </Field>

              {/* Email */}
              <Field label="Email">
                <input
                  type="email"
                  value={form.supplier_email}
                  onChange={(e) =>
                    setField(
                      "supplier_email",
                      e.target.value
                    )
                  }
                  className={inputCls}
                />
              </Field>

              {/* Address */}
              <div className="sm:col-span-2">
                <Field label="Address">
                  <textarea
                    rows={3}
                    value={form.supplier_address}
                    onChange={(e) =>
                      setField(
                        "supplier_address",
                        e.target.value
                      )
                    }
                    className={`${inputCls} h-auto min-h-20 resize-y py-2.5`}
                  />
                </Field>
              </div>

              {/* Status */}
              <div className="sm:col-span-2">
                <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-700">

                  <input
                    type="checkbox"
                    checked={form.status}
                    onChange={(e) =>
                      setField(
                        "status",
                        e.target.checked
                      )
                    }
                    className="h-4 w-4 rounded border-slate-300 accent-blue-600 focus:ring-blue-500"
                  />

                  <span className="font-medium">
                    Active supplier
                  </span>

                </label>
              </div>

            </div>

            {/* Form Error */}
            {formError && (
              <p
                role="alert"
                className="mt-4 break-words rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-800"
              >
                {formError}
              </p>
            )}

            {/* Modal Actions */}
            <div className="mt-7 flex justify-end gap-2 border-t border-slate-100 pt-5">

              <button
                onClick={closeModal}
                disabled={saving}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-blue-200 transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {saving
                  ? "Saving…"
                  : editing
                  ? "Save changes"
                  : "Add supplier"}
              </button>

            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {toDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]"
          onClick={() =>
            !deleting && setToDelete(null)
          }
        >
          <div
            role="alertdialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-white bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >

            {/* Delete Icon */}
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path
                  d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <h2 className="mt-4 text-lg font-semibold text-slate-900">
              Delete supplier?
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              <span className="font-medium text-slate-800">
                {toDelete.supplier_name}
              </span>{" "}
              will be removed. This can't be undone.
              If you only want to stop using this
              supplier, mark them as Inactive instead.
            </p>

            <div className="mt-6 flex justify-end gap-2">

              <button
                onClick={() =>
                  setToDelete(null)
                }
                disabled={deleting}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-red-200 transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {deleting
                  ? "Deleting…"
                  : "Delete supplier"}
              </button>

            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const inputCls =
  "h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-500";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-medium text-slate-700">
        {label}
      </span>

      {children}
    </label>
  );
}