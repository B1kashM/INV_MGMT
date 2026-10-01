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

const emptyForm: FormState = { category_name: "", status: true };

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-IN", { dateStyle: "medium" });
};

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
      const res = await fetch(`${API}/get_category/`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
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

  const openEdit = (c: Category) => {
    setEditing(c);
    setForm({ category_name: c.category_name, status: c.status });
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (!saving) setModalOpen(false);
  };

  const handleSave = async () => {
    if (!form.category_name.trim()) {
      setFormError("Category name is required.");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      // Change "PUT" to "PATCH" if your update endpoint expects PATCH.
      const url = editing
        ? `${API}/update_category/${editing.id}`
        : `${API}/add_category/`;
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category_name: form.category_name.trim(),
          status: form.status,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Server responded with ${res.status}`);
      }
      setModalOpen(false);
      await loadCategories();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Couldn't save category.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API}/delete_category/${toDelete.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
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

  const activeCount = categories.filter((c) => c.status).length;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Categories</h1>
          <p className="text-sm text-slate-600">
            {loading
              ? "Loading…"
              : `${categories.length} categories · ${activeCount} active`}
          </p>
        </div>
        <button
          onClick={openAdd}
          className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
        >
          Add category
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-4 flex items-start justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <span>{error}</span>
          <button onClick={loadCategories} className="font-medium underline">
            Reload
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">Added on</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!loading && categories.length === 0 && !error && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-600">
                  No categories yet. Use “Add category” to create one, like T-Shirts or
                  Jeans.
                </td>
              </tr>
            )}
            {categories.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 tabular-nums text-slate-700">{c.id}</td>
                <td className="px-4 py-3 font-medium text-slate-900">
                  {c.category_name}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      c.status
                        ? "bg-teal-100 text-teal-800"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {c.status ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                  {formatDate(c.created_at)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <button
                    onClick={() => openEdit(c)}
                    className="rounded px-2 py-1 text-teal-800 hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setToDelete(c)}
                    className="ml-1 rounded px-2 py-1 text-red-700 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add / Edit modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="category-modal-title"
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="category-modal-title"
              className="mb-4 text-lg font-semibold text-slate-900"
            >
              {editing ? "Edit category" : "Add category"}
            </h2>

            <div className="space-y-4">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-800">
                  Category name
                </span>
                <input
                  value={form.category_name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, category_name: e.target.value }))
                  }
                  onKeyDown={(e) => e.key === "Enter" && !saving && handleSave()}
                  autoFocus
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                />
              </label>

              <label className="flex items-center gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  checked={form.status}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, status: e.target.checked }))
                  }
                  className="h-4 w-4 accent-teal-700"
                />
                Active
              </label>
            </div>

            {formError && (
              <p
                role="alert"
                className="mt-4 break-words rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
              >
                {formError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={closeModal}
                disabled={saving}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {saving ? "Saving…" : editing ? "Save changes" : "Add category"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {toDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !deleting && setToDelete(null)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-slate-900">Delete category?</h2>
            <p className="mt-2 text-sm text-slate-700">
              {toDelete.category_name} will be removed. This can't be undone. If products
              still use it, mark the category Inactive instead.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setToDelete(null)}
                disabled={deleting}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete category"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}