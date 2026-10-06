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

  const openEdit = (c: Category) => {
    setEditing(c);
    setForm({
      category_name: c.category_name,
      status: c.status,
    });
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
    (c) => c.status
  ).length;

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">

        {/* Header */}
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#171923]">
              Categories
            </h1>

            <p className="mt-1 text-sm text-[#858995]">
              {loading
                ? "Loading…"
                : `${categories.length} categories · ${activeCount} active`}
            </p>
          </div>

          <button
            onClick={openAdd}
            className="rounded-xl bg-[#6178eb] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#5269dc] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6178eb] focus-visible:ring-offset-2"
          >
            + Add category
          </button>
        </header>

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm"
          >
            <span>{error}</span>

            <button
              onClick={loadCategories}
              className="font-semibold underline underline-offset-2"
            >
              Reload
            </button>
          </div>
        )}

        {/* Main card */}
        <section className="overflow-hidden rounded-2xl border border-[#e9ebf2] bg-white shadow-[0_4px_20px_rgba(25,35,70,0.04)]">

          {/* Card header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eef0f5] px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-base font-semibold text-[#20222d]">
                Category list
              </h2>

              <p className="mt-0.5 text-xs text-[#9699a4]">
                Manage your product categories
              </p>
            </div>

            <div className="rounded-lg bg-[#f1f3ff] px-3 py-1.5 text-xs font-semibold text-[#6178eb]">
              {activeCount} active
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#fafbfc] text-[#9295a0]">
                <tr>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide sm:px-6">
                    ID
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide sm:px-6">
                    Category
                  </th>

                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide sm:px-6">
                    Status
                  </th>

                  <th className="whitespace-nowrap px-5 py-3.5 text-xs font-semibold uppercase tracking-wide sm:px-6">
                    Added on
                  </th>

                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide sm:px-6">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#f0f1f5]">
                {!loading &&
                  categories.length === 0 &&
                  !error && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-16 text-center text-[#858995]"
                      >
                        No categories yet. Use “Add category” to
                        create one, like T-Shirts or Jeans.
                      </td>
                    </tr>
                  )}

                {categories.map((c) => (
                  <tr
                    key={c.id}
                    className="group transition hover:bg-[#fafbff]"
                  >
                    <td className="px-5 py-4 tabular-nums text-[#858995] sm:px-6">
                      {c.id}
                    </td>

                    <td className="px-5 py-4 sm:px-6">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#eef1ff] text-[#6178eb]">
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            className="h-4 w-4"
                            aria-hidden="true"
                          >
                            <path
                              d="M4 6.5A2.5 2.5 0 016.5 4h4A2.5 2.5 0 0113 6.5v4a2.5 2.5 0 01-2.5 2.5h-4A2.5 2.5 0 014 10.5v-4zM11 13.5a2.5 2.5 0 012.5-2.5h4a2.5 2.5 0 012.5 2.5v4a2.5 2.5 0 01-2.5 2.5h-4a2.5 2.5 0 01-2.5-2.5v-4z"
                              stroke="currentColor"
                              strokeWidth="1.7"
                            />
                          </svg>
                        </div>

                        <span className="font-semibold text-[#242632]">
                          {c.category_name}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-4 sm:px-6">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                          c.status
                            ? "bg-[#e7f7f0] text-[#278766]"
                            : "bg-[#f0f1f4] text-[#777b86]"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            c.status
                              ? "bg-[#35a47d]"
                              : "bg-[#999da7]"
                          }`}
                        />

                        {c.status ? "Active" : "Inactive"}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-[#777b86] sm:px-6">
                      {formatDate(c.created_at)}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-right sm:px-6">
                      <button
                        onClick={() => openEdit(c)}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[#6178eb] transition hover:bg-[#eef1ff] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6178eb]"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => setToDelete(c)}
                        className="ml-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-[#e05d68] transition hover:bg-[#fff0f1] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e05d68]"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#182033]/40 p-4 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="category-modal-title"
            className="w-full max-w-md rounded-2xl border border-[#e9ebf2] bg-white p-6 shadow-[0_20px_60px_rgba(25,35,70,0.18)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef1ff] text-[#6178eb]">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path
                    d="M12 5v14M5 12h14"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              <div>
                <h2
                  id="category-modal-title"
                  className="text-lg font-semibold text-[#20222d]"
                >
                  {editing
                    ? "Edit category"
                    : "Add category"}
                </h2>

                <p className="mt-0.5 text-xs text-[#9295a0]">
                  {editing
                    ? "Update category information"
                    : "Create a new product category"}
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <label className="block text-sm">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#777b86]">
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
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    !saving &&
                    handleSave()
                  }
                  autoFocus
                  className="w-full rounded-xl border border-[#dfe2e9] bg-[#fafbfc] px-3.5 py-2.5 text-sm text-[#20222d] outline-none transition placeholder:text-[#a5a8b1] focus:border-[#6178eb] focus:bg-white focus:ring-4 focus:ring-[#6178eb]/10"
                />
              </label>

              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-[#e9ebf2] bg-[#fafbfc] px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-[#282a35]">
                    Active
                  </p>

                  <p className="mt-0.5 text-xs text-[#9295a0]">
                    Make this category available
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={form.status}
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      status: !prev.status,
                    }))
                  }
                  className={`relative h-6 w-11 rounded-full transition ${
                    form.status
                      ? "bg-[#6178eb]"
                      : "bg-[#d9dce4]"
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

            {formError && (
              <p
                role="alert"
                className="mt-4 break-words rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-700"
              >
                {formError}
              </p>
            )}

            <div className="mt-7 flex justify-end gap-2">
              <button
                onClick={closeModal}
                disabled={saving}
                className="rounded-xl border border-[#dfe2e9] bg-white px-4 py-2.5 text-sm font-semibold text-[#666a76] transition hover:bg-[#f8f9fb] disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl bg-[#6178eb] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#5269dc] disabled:opacity-50"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#182033]/40 p-4 backdrop-blur-sm"
          onClick={() =>
            !deleting && setToDelete(null)
          }
        >
          <div
            role="alertdialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-[#e9ebf2] bg-white p-6 shadow-[0_20px_60px_rgba(25,35,70,0.18)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#fff0f1] text-[#e05d68]">
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

            <h2 className="mt-4 text-lg font-semibold text-[#20222d]">
              Delete category?
            </h2>

            <p className="mt-2 text-sm leading-6 text-[#777b86]">
              {toDelete.category_name} will be removed.
              This can't be undone. If products still use it,
              mark the category Inactive instead.
            </p>

            <div className="mt-7 flex justify-end gap-2">
              <button
                onClick={() => setToDelete(null)}
                disabled={deleting}
                className="rounded-xl border border-[#dfe2e9] bg-white px-4 py-2.5 text-sm font-semibold text-[#666a76] transition hover:bg-[#f8f9fb] disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-xl bg-[#e05d68] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#d34f5b] disabled:opacity-50"
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
