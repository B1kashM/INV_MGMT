"use client";

import { useCallback, useEffect, useState } from "react";

const API = "http://127.0.0.1:8000/product";

type Category = {
  id: number;
  category_name: string;
  status: boolean;
  created_at: string;
};

type FormState = {
  category_name: string;
  status: boolean;
};

const emptyForm: FormState = {
  category_name: "",
  status: true,
};

const formatDate = (iso: string) => {
  const d = new Date(iso);

  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-IN", {
        dateStyle: "medium",
      });
};

const inputCls =
  "h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-500";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [toDelete, setToDelete] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadCategories = useCallback(async () => {
    try {
      setError(null);

      const res = await fetch(`${API}/get_category/`, {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`Server responded with ${res.status}`);
      }

      setCategories(await res.json());
    } catch (e) {
      setError(
        e instanceof Error
          ? `Couldn't load categories. ${e.message}`
          : "Couldn't load categories."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (category: Category) => {
    setEditing(category);

    setForm({
      category_name: category.category_name,
      status: category.status,
    });

    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (!saving) {
      setModalOpen(false);
    }
  };

  const handleSave = async () => {
    if (!form.category_name.trim()) {
      setFormError("Category name is required.");
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const url = editing
        ? `${API}/update_category/${editing.id}`
        : `${API}/add_category/`;

      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          category_name: form.category_name.trim(),
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
      await loadCategories();
    } catch (e) {
      setFormError(
        e instanceof Error
          ? e.message
          : "Couldn't save category."
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
        `${API}/delete_category/${toDelete.id}`,
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
      await loadCategories();
    } catch (e) {
      setError(
        e instanceof Error
          ? `Couldn't delete category. ${e.message} Categories that still have products may not be deletable.`
          : "Couldn't delete category."
      );

      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const activeCount = categories.filter(
    (category) => category.status
  ).length;

  return (
    <main className="min-h-screen bg-[#f6f6f6] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/80 bg-white px-5 py-5 shadow-[0_8px_30px_rgba(45,55,72,0.06)] sm:px-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Categories
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              {loading
                ? "Loading…"
                : `${categories.length} categories · ${activeCount} active`}
            </p>
          </div>

          <button
            onClick={openAdd}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            + Add category
          </button>
        </header>

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            <span>{error}</span>

            <button
              onClick={loadCategories}
              className="font-medium underline underline-offset-2"
            >
              Reload
            </button>
          </div>
        )}

        {/* Main card */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(45,55,72,0.06)]">

          {/* Card header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Category list
              </h2>

              <p className="mt-0.5 text-xs text-slate-500">
                Manage your product categories
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                {categories.length} categories
              </span>

              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                {activeCount} active
              </span>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#f8faff] text-slate-600">
                <tr>
                  <th className="border-b border-slate-200 px-4 py-4 font-medium text-slate-500">
                    ID
                  </th>

                  <th className="border-b border-slate-200 px-4 py-4 font-medium text-slate-500">
                    Category
                  </th>

                  <th className="border-b border-slate-200 px-4 py-4 font-medium text-slate-500">
                    Status
                  </th>

                  <th className="whitespace-nowrap border-b border-slate-200 px-4 py-4 font-medium text-slate-500">
                    Added on
                  </th>

                  <th className="border-b border-slate-200 px-4 py-4 text-right font-medium text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {!loading &&
                  categories.length === 0 &&
                  !error && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-16 text-center text-sm text-slate-500"
                      >
                        No categories yet. Use “Add category”
                        to create one, like T-Shirts or Jeans.
                      </td>
                    </tr>
                  )}

                {categories.map((category) => (
                  <tr
                    key={category.id}
                    className="group transition-colors hover:bg-[#f7f9ff]"
                  >
                    {/* ID */}
                    <td className="px-4 py-3.5 tabular-nums text-slate-500">
                      {category.id}
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3.5">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {category.category_name}
                        </p>

                        <p className="mt-0.5 text-xs text-slate-500">
                          Category ID: {category.id}
                        </p>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                          category.status
                            ? "bg-blue-50 text-blue-700 ring-blue-100"
                            : "bg-slate-100 text-slate-600 ring-slate-200"
                        }`}
                      >
                        {category.status
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </td>

                    {/* Added date */}
                    <td className="whitespace-nowrap px-4 py-3.5 text-slate-600">
                      {formatDate(category.created_at)}
                    </td>

                    {/* Actions */}
                    <td className="whitespace-nowrap px-4 py-3.5 text-right">
                      <button
                        onClick={() => openEdit(category)}
                        className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-blue-600 transition hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => setToDelete(category)}
                        className="ml-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-red-500 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Add / Edit modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]"
          onClick={closeModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="category-modal-title"
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="mb-6">
              <h2
                id="category-modal-title"
                className="text-lg font-semibold text-slate-900"
              >
                {editing
                  ? "Edit category"
                  : "Add category"}
              </h2>

              <p className="mt-0.5 text-xs text-slate-500">
                {editing
                  ? "Update category information"
                  : "Create a new product category"}
              </p>
            </div>

            <div className="space-y-5">
              {/* Category name */}
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-slate-700">
                  Category name
                </span>

                <input
                  value={form.category_name}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      category_name: e.target.value,
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !saving) {
                      handleSave();
                    }
                  }}
                  autoFocus
                  disabled={saving}
                  placeholder="Enter category name"
                  className={inputCls}
                />
              </label>

              {/* Status */}
              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    Active
                  </p>

                  <p className="mt-0.5 text-xs text-slate-500">
                    Make this category available
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={form.status}
                  disabled={saving}
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      status: !prev.status,
                    }))
                  }
                  className={`relative h-6 w-11 rounded-full transition ${
                    form.status
                      ? "bg-blue-600"
                      : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition ${
                      form.status
                        ? "left-6"
                        : "left-1"
                    }`}
                  />
                </button>
              </label>
            </div>

            {/* Form error */}
            {formError && (
              <p
                role="alert"
                className="mt-4 break-words rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-800"
              >
                {formError}
              </p>
            )}

            {/* Modal actions */}
            <div className="mt-7 flex justify-end gap-2 border-t border-slate-100 pt-5">
              <button
                onClick={closeModal}
                disabled={saving}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700 disabled:opacity-50"
              >
                {saving
                  ? "Saving…"
                  : editing
                  ? "Save changes"
                  : "Add category"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
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
            {/* Delete icon */}
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path
                  d="M4 7h16M9 7V4h6v3m-9 0l1 13h10l1-13M10 11v5m4-5v5"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <h2 className="mt-4 text-lg font-semibold text-slate-900">
              Delete category?
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              <span className="font-medium text-slate-700">
                {toDelete.category_name}
              </span>{" "}
              will be removed. This can't be undone. If
              products still use it, mark the category
              Inactive instead.
            </p>

            <div className="mt-7 flex justify-end gap-2 border-t border-slate-100 pt-5">
              <button
                onClick={() => setToDelete(null)}
                disabled={deleting}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {deleting
                  ? "Deleting…"
                  : "Delete category"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}