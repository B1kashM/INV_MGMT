"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import BulkUploadModal from "./BulkUploadModal";

const API = "http://127.0.0.1:8000/product";

type Product = {
  id: number;
  product_id: number;
  product_name: string;
  brand_name: string;
  sku: string;
  size: string;
  color: string;
  purchase_price: string;
  selling_price: string;
  stock_quantity: number;
  reorder_level: number | string | null;
  status: boolean;
  created_at: string;
  updated_at: string;
  category_id: number;
};

type FormState = {
  product_id: string;
  product_name: string;
  brand_name: string;
  sku: string;
  size: string;
  color: string;
  purchase_price: string;
  selling_price: string;
  stock_quantity: string;
  reorder_level: string;
  category_id: string;
  status: boolean;
};

const emptyForm: FormState = {
  product_id: "",
  product_name: "",
  brand_name: "",
  sku: "",
  size: "",
  color: "",
  purchase_price: "",
  selling_price: "",
  stock_quantity: "",
  reorder_level: "",
  category_id: "",
  status: true,
};

const toForm = (p: Product): FormState => ({
  product_id: String(p.product_id),
  product_name: p.product_name,
  brand_name: p.brand_name,
  sku: p.sku,
  size: p.size,
  color: p.color,
  purchase_price: p.purchase_price,
  selling_price: p.selling_price,
  stock_quantity: String(p.stock_quantity),
  reorder_level:
    p.reorder_level === null ? "" : String(p.reorder_level),
  category_id: String(p.category_id),
  status: p.status,
});

const toPayload = (f: FormState) => ({
  product_id: Number(f.product_id),
  product_name: f.product_name.trim(),
  brand_name: f.brand_name.trim(),
  sku: f.sku.trim(),
  size: f.size.trim(),
  color: f.color.trim(),
  purchase_price: f.purchase_price,
  selling_price: f.selling_price,
  stock_quantity: Number(f.stock_quantity),
  reorder_level:
    f.reorder_level === "" ? null : Number(f.reorder_level),
  category_id: Number(f.category_id),
  status: f.status,
});

function describeError(err: unknown): string {
  if (typeof err === "string") return err;

  if (err && typeof err === "object") {
    const parts = Object.entries(
      err as Record<string, unknown>
    ).map(
      ([field, msg]) =>
        `${field}: ${
          Array.isArray(msg) ? msg.join(" ") : String(msg)
        }`
    );

    if (parts.length) return parts.join("; ");
  }

  return "Something went wrong.";
}

async function readError(res: Response): Promise<string> {
  try {
    const json = await res.json();

    if (
      json &&
      typeof json === "object" &&
      "error" in json
    ) {
      return describeError(json.error);
    }

    return describeError(json);
  } catch {
    return res.status === 404
      ? "Endpoint not found (404). Check the URL."
      : `Server responded with ${res.status}`;
  }
}

type SortKey =
  | "id"
  | "product_id"
  | "product_name"
  | "brand_name"
  | "sku"
  | "size"
  | "color"
  | "purchase_price"
  | "selling_price"
  | "stock_quantity"
  | "status";

type SortDirection = "asc" | "desc";

type SortConfig = {
  key: SortKey;
  direction: SortDirection;
} | null;

function SortIcon({
  active,
  direction,
}: {
  active: boolean;
  direction?: SortDirection;
}) {
  if (!active) {
    return (
      ""
    );
  }

  if (direction === "asc") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        className="h-4 w-4 text-blue-600"
      >
        <path
          d="M10 15V5M6 9l4-4 4 4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4 text-blue-600"
    >
      <path
        d="M10 5v10m4-4-4 4-4-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SortableHeader({
  label,
  sortKey,
  sortConfig,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  sortConfig: SortConfig;
  onSort: (key: SortKey) => void;
}) {
  const active = sortConfig?.key === sortKey;

  return (
    <th
      onClick={() => onSort(sortKey)}
      className="cursor-pointer whitespace-nowrap border-b border-slate-200 px-4 py-4 text-left font-medium text-slate-500 select-none transition-colors hover:bg-blue-50/60"
      title={`Sort by ${label}`}
      aria-sort={
        active
          ? sortConfig.direction === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
    >
      <div className="flex items-center gap-1.5">
        <span>{label}</span>

        <SortIcon
          active={active}
          direction={
            active ? sortConfig.direction : undefined
          }
        />
      </div>
    </th>
  );
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(
    null
  );

  const [toDelete, setToDelete] = useState<Product | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);

  const [bulkOpen, setBulkOpen] = useState(false);

  const [search, setSearch] = useState("");
  const query = search.trim();

  const [sortConfig, setSortConfig] =
    useState<SortConfig>(null);

  const existingProductIds = useMemo(
    () => products.map((p) => p.product_id),
    [products]
  );

  const visibleProducts = useMemo(() => {
    if (query === "") return products;

    const q = query.toLowerCase();

    return products.filter((p) =>
      p.product_name.toLowerCase().includes(q)
    );
  }, [products, query]);

  const handleSort = (key: SortKey) => {
    setSortConfig((current) => {
      if (!current || current.key !== key) {
        return {
          key,
          direction: "asc",
        };
      }

      return {
        key,
        direction:
          current.direction === "asc" ? "desc" : "asc",
      };
    });
  };

  const sortedProducts = useMemo(() => {
    if (!sortConfig) return visibleProducts;

    const sorted = [...visibleProducts];

    sorted.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortConfig.key) {
        case "id":
          aValue = a.id;
          bValue = b.id;
          break;

        case "product_id":
          aValue = a.product_id;
          bValue = b.product_id;
          break;

        case "product_name":
          aValue = a.product_name.toLowerCase();
          bValue = b.product_name.toLowerCase();
          break;

        case "brand_name":
          aValue = a.brand_name.toLowerCase();
          bValue = b.brand_name.toLowerCase();
          break;

        case "sku":
          aValue = a.sku.toLowerCase();
          bValue = b.sku.toLowerCase();
          break;

        case "size":
          aValue = a.size.toLowerCase();
          bValue = b.size.toLowerCase();
          break;

        case "color":
          aValue = a.color.toLowerCase();
          bValue = b.color.toLowerCase();
          break;

        case "purchase_price":
          aValue = Number(a.purchase_price);
          bValue = Number(b.purchase_price);
          break;

        case "selling_price":
          aValue = Number(a.selling_price);
          bValue = Number(b.selling_price);
          break;

        case "stock_quantity":
          aValue = a.stock_quantity;
          bValue = b.stock_quantity;
          break;

        case "status":
          aValue = a.status ? "active" : "inactive";
          bValue = b.status ? "active" : "inactive";
          break;

        default:
          return 0;
      }

      if (aValue < bValue) {
        return sortConfig.direction === "asc" ? -1 : 1;
      }

      if (aValue > bValue) {
        return sortConfig.direction === "asc" ? 1 : -1;
      }

      return 0;
    });

    return sorted;
  }, [visibleProducts, sortConfig]);

  const loadProducts = useCallback(async () => {
    try {
      setError(null);

      const res = await fetch(`${API}/get_product/`, {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(
          `Server responded with ${res.status}`
        );
      }

      setProducts(await res.json());
    } catch (e) {
      setError(
        e instanceof Error
          ? `Couldn't load products. ${e.message}`
          : "Couldn't load products."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm(toForm(p));
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (!saving) setModalOpen(false);
  };

  const setField = <K extends keyof FormState>(
    key: K,
    value: FormState[K]
  ) =>
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));

  const handleSave = async () => {
    setSaving(true);
    setFormError(null);

    try {
      const url = editing
        ? `${API}/update_product/${editing.product_id}`
        : `${API}/add_product/`;

      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(toPayload(form)),
      });

      if (!res.ok) {
        throw new Error(await readError(res));
      }

      const body = await res.json().catch(() => null);

      if (
        body &&
        typeof body === "object" &&
        "error" in body
      ) {
        throw new Error(
          describeError(
            (body as { error: unknown }).error
          )
        );
      }

      setModalOpen(false);
      await loadProducts();
    } catch (e) {
      setFormError(
        e instanceof Error
          ? e.message
          : "Couldn't save product."
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
        `${API}/delete_product/${toDelete.product_id}`,
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
      await loadProducts();
    } catch (e) {
      setError(
        e instanceof Error
          ? `Couldn't delete product. ${e.message}`
          : "Couldn't delete product."
      );

      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const isLow = (p: Product) => {
    if (
      p.reorder_level === null ||
      p.reorder_level === ""
    ) {
      return false;
    }

    const level = Number(p.reorder_level);

    return (
      Number.isFinite(level) &&
      p.stock_quantity <= level
    );
  };

  return (
    <main className="min-h-screen bg-[#f6f6f6] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Page Header */}
        <header className="mb-6">
          <div className="rounded-2xl border border-white/80 bg-white px-5 py-5 shadow-[0_8px_30px_rgba(45,55,72,0.06)] sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 shadow-sm shadow-blue-200">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="h-5 w-5 text-white"
                      aria-hidden="true"
                    >
                      <path
                        d="M4 7.5L12 3l8 4.5v9L12 21l-8-4.5v-9Z"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M4.5 7.5L12 12l7.5-4.5M12 12v9"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>

                  <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                      Products
                    </h1>

                    <p className="mt-0.5 text-sm text-slate-500">
                      {loading
                        ? "Loading…"
                        : query
                        ? `${visibleProducts.length} of ${products.length} match “${query}”`
                        : `${products.length} in inventory`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                {/* Search */}
                <div className="relative w-full sm:w-64">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.7}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  >
                    <path d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>

                  <input
                    type="text"
                    value={search}
                    onChange={(e) =>
                      setSearch(e.target.value)
                    }
                    onKeyDown={(e) =>
                      e.key === "Escape" && setSearch("")
                    }
                    placeholder="Search by product name"
                    aria-label="Search products by product name"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-9 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />

                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      aria-label="Clear search"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.8}
                        strokeLinecap="round"
                        className="h-4 w-4"
                        aria-hidden="true"
                      >
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setBulkOpen(true)}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                >
                  Bulk upload
                </button>

                <button
                  onClick={openAdd}
                  className="h-10 rounded-xl bg-blue-600 px-4 text-sm font-medium text-white shadow-sm shadow-blue-200 transition-all hover:bg-blue-700 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                >
                  Add product
                </button>
              </div>
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
              onClick={loadProducts}
              className="font-medium underline underline-offset-2 hover:no-underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Products Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(45,55,72,0.06)]">
          <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Product inventory
                </h2>

                <p className="mt-0.5 text-xs text-slate-500">
                  Manage and organize your products
                </p>
              </div>

              <div className="hidden rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 sm:block">
                {products.length} products
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#f8faff] text-slate-600">
                <tr>
                  <SortableHeader
                    label="ID"
                    sortKey="id"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />

                  <SortableHeader
                    label="Product ID"
                    sortKey="product_id"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />

                  <SortableHeader
                    label="Name"
                    sortKey="product_name"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />

                  <SortableHeader
                    label="Brand"
                    sortKey="brand_name"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />

                  <SortableHeader
                    label="SKU"
                    sortKey="sku"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />

                  <SortableHeader
                    label="Size"
                    sortKey="size"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />

                  <SortableHeader
                    label="Color"
                    sortKey="color"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />

                  <SortableHeader
                    label="Cost"
                    sortKey="purchase_price"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />

                  <SortableHeader
                    label="Price"
                    sortKey="selling_price"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />

                  <SortableHeader
                    label="Stock"
                    sortKey="stock_quantity"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />

                  <SortableHeader
                    label="Status"
                    sortKey="status"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />

                  <th className="border-b border-slate-200 px-4 py-4 text-right font-medium text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {!loading &&
                  products.length === 0 &&
                  !error && (
                    <tr>
                      <td
                        colSpan={12}
                        className="px-4 py-14 text-center text-slate-500"
                      >
                        No products yet. Use “Add product” or
                        “Bulk upload” to create your first ones.
                      </td>
                    </tr>
                  )}

                {!loading &&
                  products.length > 0 &&
                  visibleProducts.length === 0 && (
                    <tr>
                      <td
                        colSpan={12}
                        className="px-4 py-14 text-center text-slate-500"
                      >
                        No product name contains “{query}”.{" "}
                        <button
                          onClick={() => setSearch("")}
                          className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          Clear search
                        </button>
                      </td>
                    </tr>
                  )}

                {sortedProducts.map((p) => (
                  <tr
                    key={p.id}
                    className="group transition-colors hover:bg-[#f7f9ff]"
                  >
                    <td className="px-4 py-3.5 text-slate-500">
                      {p.id}
                    </td>

                    <td className="px-4 py-3.5 font-medium text-slate-700">
                      {p.product_id}
                    </td>

                    <td className="px-4 py-3.5 font-semibold text-slate-900">
                      {p.product_name}
                    </td>

                    <td className="px-4 py-3.5 text-slate-600">
                      {p.brand_name}
                    </td>

                    <td className="px-4 py-3.5 text-slate-600">
                      {p.sku}
                    </td>

                    <td className="px-4 py-3.5 text-slate-600">
                      {p.size}
                    </td>

                    <td className="px-4 py-3.5 text-slate-600">
                      {p.color}
                    </td>

                    <td className="px-4 py-3.5 tabular-nums text-slate-600">
                      ₹
                      {Number(
                        p.purchase_price
                      ).toLocaleString("en-IN")}
                    </td>

                    <td className="px-4 py-3.5 tabular-nums font-medium text-slate-800">
                      ₹
                      {Number(
                        p.selling_price
                      ).toLocaleString("en-IN")}
                    </td>

                    <td className="px-4 py-3.5 tabular-nums">
                      <div className="flex items-center">
                        <span
                          className={
                            isLow(p)
                              ? "font-semibold text-amber-600"
                              : "text-slate-700"
                          }
                        >
                          {p.stock_quantity}
                        </span>

                        {isLow(p) && (
                          <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-100">
                            Low
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                          p.status
                            ? "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-100"
                            : "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200"
                        }`}
                      >
                        {p.status ? "Active" : "Inactive"}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-4 py-3.5 text-right">
                      <button
                        onClick={() => openEdit(p)}
                        className="rounded-lg px-2.5 py-1.5 text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => setToDelete(p)}
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

        {/* Bulk upload */}
        <BulkUploadModal
          open={bulkOpen}
          onClose={() => setBulkOpen(false)}
          existingProductIds={existingProductIds}
          onUploaded={loadProducts}
        />

        {/* Add / Edit modal */}
        {modalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]"
            onClick={closeModal}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="product-modal-title"
              className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
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

                <h2
                  id="product-modal-title"
                  className="text-lg font-semibold text-slate-900"
                >
                  {editing ? "Edit product" : "Add product"}
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Product ID">
                  <input
                    type="number"
                    value={form.product_id}
                    onChange={(e) =>
                      setField(
                        "product_id",
                        e.target.value
                      )
                    }
                    disabled={!!editing}
                    className={inputCls}
                  />
                </Field>

                <Field label="Product name">
                  <input
                    value={form.product_name}
                    onChange={(e) =>
                      setField(
                        "product_name",
                        e.target.value
                      )
                    }
                    className={inputCls}
                  />
                </Field>

                <Field label="Brand">
                  <input
                    value={form.brand_name}
                    onChange={(e) =>
                      setField(
                        "brand_name",
                        e.target.value
                      )
                    }
                    className={inputCls}
                  />
                </Field>

                <Field label="SKU">
                  <input
                    value={form.sku}
                    onChange={(e) =>
                      setField("sku", e.target.value)
                    }
                    className={inputCls}
                  />
                </Field>

                <Field label="Size">
                  <input
                    value={form.size}
                    onChange={(e) =>
                      setField("size", e.target.value)
                    }
                    className={inputCls}
                  />
                </Field>

                <Field label="Color">
                  <input
                    value={form.color}
                    onChange={(e) =>
                      setField("color", e.target.value)
                    }
                    className={inputCls}
                  />
                </Field>

                <Field label="Purchase price">
                  <input
                    type="number"
                    step="0.01"
                    value={form.purchase_price}
                    onChange={(e) =>
                      setField(
                        "purchase_price",
                        e.target.value
                      )
                    }
                    className={inputCls}
                  />
                </Field>

                <Field label="Selling price">
                  <input
                    type="number"
                    step="0.01"
                    value={form.selling_price}
                    onChange={(e) =>
                      setField(
                        "selling_price",
                        e.target.value
                      )
                    }
                    className={inputCls}
                  />
                </Field>

                <Field label="Stock quantity">
                  <input
                    type="number"
                    value={form.stock_quantity}
                    onChange={(e) =>
                      setField(
                        "stock_quantity",
                        e.target.value
                      )
                    }
                    className={inputCls}
                  />
                </Field>

                <Field label="Reorder level (optional)">
                  <input
                    type="number"
                    value={form.reorder_level}
                    onChange={(e) =>
                      setField(
                        "reorder_level",
                        e.target.value
                      )
                    }
                    className={inputCls}
                  />
                </Field>

                <Field label="Category ID">
                  <input
                    type="number"
                    value={form.category_id}
                    onChange={(e) =>
                      setField(
                        "category_id",
                        e.target.value
                      )
                    }
                    className={inputCls}
                  />
                </Field>

                <label className="flex items-center gap-3 self-end rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.status}
                    onChange={(e) =>
                      setField(
                        "status",
                        e.target.checked
                      )
                    }
                    className="h-4 w-4 rounded accent-blue-600"
                  />
                  Active
                </label>
              </div>

              {formError && (
                <p
                  role="alert"
                  className="mt-4 break-words rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-800"
                >
                  {formError}
                </p>
              )}

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
                    : "Add product"}
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
                Delete product?
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                {toDelete.product_name} (
                {toDelete.brand_name}, {toDelete.size}) will be
                removed from your inventory. This can't be
                undone.
              </p>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={() => setToDelete(null)}
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
                    : "Delete product"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
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
