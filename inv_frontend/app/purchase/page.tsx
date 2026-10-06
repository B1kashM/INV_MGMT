"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const API = "http://127.0.0.1:8000/product";

type Purchase = {
  id: number;
  quantity: number;
  purchase_price: string;
  total_amount: string;
  purchase_date: string;
  supplier_id: number;
  product_id: number;
};

type ProductOption = {
  id: number;
  product_name: string;
  brand_name: string;
  size: string;
  purchase_price: string;
};

type FormState = {
  product_id: string;
  supplier_id: string;
  quantity: string;
  purchase_price: string;
  purchase_date: string;
};

const emptyForm: FormState = {
  product_id: "",
  supplier_id: "",
  quantity: "",
  purchase_price: "",
  purchase_date: "",
};

const isoToLocalInput = (iso: string) => {
  const d = new Date(iso);

  if (isNaN(d.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const toForm = (p: Purchase): FormState => ({
  product_id: String(p.product_id),
  supplier_id: String(p.supplier_id),
  quantity: String(p.quantity),
  purchase_price: p.purchase_price,
  purchase_date: isoToLocalInput(p.purchase_date),
});

const formatDate = (iso: string) => {
  const d = new Date(iso);

  return isNaN(d.getTime())
    ? iso
    : d.toLocaleString("en-IN", {
        dateStyle: "medium",
      });
};

const money = (v: string | number) =>
  `₹${Number(v).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
  })}`;

async function readError(res: Response) {
  try {
    const json = await res.json();
    const msg = json?.error ?? json?.detail ?? json?.message;

    return msg
      ? String(msg)
      : JSON.stringify(json).slice(0, 200);
  } catch {
    return res.status === 404
      ? "Endpoint not found (404). Check the URL."
      : `Server responded with ${res.status}`;
  }
}

type SortKey =
  | "id"
  | "product"
  | "supplier_id"
  | "quantity"
  | "purchase_price"
  | "total_amount"
  | "purchase_date";

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

export default function PurchasePage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sortConfig, setSortConfig] =
    useState<SortConfig>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Purchase | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(
    null
  );

  const [toDelete, setToDelete] = useState<Purchase | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);

  const productById = useMemo(() => {
    const m = new Map<number, ProductOption>();

    products.forEach((p) => m.set(p.id, p));

    return m;
  }, [products]);

  const productLabel = (p: ProductOption) =>
    `${p.product_name} · ${p.brand_name} · ${p.size}`;

  const loadAll = useCallback(async () => {
    try {
      setError(null);

      const [purchaseRes, productsRes] = await Promise.all([
        fetch(`${API}/get_purchase/`, {
          cache: "no-store",
        }),
        fetch(`${API}/get_product/`, {
          cache: "no-store",
        }),
      ]);

      if (!purchaseRes.ok) {
        throw new Error(
          `Purchase request failed (${purchaseRes.status})`
        );
      }

      setPurchases(await purchaseRes.json());

      if (productsRes.ok) {
        setProducts(await productsRes.json());
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? `Couldn't load purchases. ${e.message}`
          : "Couldn't load purchases."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (p: Purchase) => {
    setEditing(p);
    setForm(toForm(p));
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

  const onProductChange = (value: string) => {
    setForm((prev) => {
      const next = {
        ...prev,
        product_id: value,
      };

      const p = productById.get(Number(value));

      if (
        !editing &&
        p &&
        prev.purchase_price === ""
      ) {
        next.purchase_price = p.purchase_price;
      }

      return next;
    });
  };

  const formTotal = useMemo(() => {
    const q = Number(form.quantity);
    const p = Number(form.purchase_price);

    return q > 0 && p >= 0 ? q * p : 0;
  }, [form.quantity, form.purchase_price]);

  const handleSave = async () => {
    if (!form.product_id || !form.supplier_id) {
      setFormError(
        "Product and supplier ID are required."
      );
      return;
    }

    if (!(Number(form.quantity) > 0)) {
      setFormError("Quantity must be greater than 0.");
      return;
    }

    if (
      form.purchase_price === "" ||
      !(Number(form.purchase_price) >= 0)
    ) {
      setFormError("Enter a valid purchase price.");
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const payload: Record<string, unknown> = {
        product_id: Number(form.product_id),
        supplier_id: Number(form.supplier_id),
        quantity: Number(form.quantity),
        purchase_price: Number(
          form.purchase_price
        ).toFixed(2),
        total_amount: formTotal.toFixed(2),
      };

      if (editing && form.purchase_date) {
        payload.purchase_date = new Date(
          form.purchase_date
        ).toISOString();
      }

      const url = editing
        ? `${API}/update_purchase/${editing.id}`
        : `${API}/purchase_product/`;

      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(await readError(res));
      }

      setModalOpen(false);
      await loadAll();
    } catch (e) {
      setFormError(
        e instanceof Error
          ? e.message
          : "Couldn't save purchase."
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
        `${API}/delete_purchase/${toDelete.id}`,
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
      await loadAll();
    } catch (e) {
      setError(
        e instanceof Error
          ? `Couldn't delete purchase. ${e.message}`
          : "Couldn't delete purchase."
      );

      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

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
          current.direction === "asc"
            ? "desc"
            : "asc",
      };
    });
  };

  const sortedPurchases = useMemo(() => {
    if (!sortConfig) return purchases;

    const sorted = [...purchases];

    sorted.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortConfig.key) {
        case "id":
          aValue = a.id;
          bValue = b.id;
          break;

        case "product": {
          const productA = productById.get(a.product_id);
          const productB = productById.get(b.product_id);

          aValue = productA
            ? productLabel(productA).toLowerCase()
            : String(a.product_id);

          bValue = productB
            ? productLabel(productB).toLowerCase()
            : String(b.product_id);

          break;
        }

        case "supplier_id":
          aValue = a.supplier_id;
          bValue = b.supplier_id;
          break;

        case "quantity":
          aValue = a.quantity;
          bValue = b.quantity;
          break;

        case "purchase_price":
          aValue = Number(a.purchase_price);
          bValue = Number(b.purchase_price);
          break;

        case "total_amount":
          aValue = Number(a.total_amount);
          bValue = Number(b.total_amount);
          break;

        case "purchase_date":
          aValue = new Date(
            a.purchase_date
          ).getTime();

          bValue = new Date(
            b.purchase_date
          ).getTime();

          break;

        default:
          return 0;
      }

      if (aValue < bValue) {
        return sortConfig.direction === "asc"
          ? -1
          : 1;
      }

      if (aValue > bValue) {
        return sortConfig.direction === "asc"
          ? 1
          : -1;
      }

      return 0;
    });

    return sorted;
  }, [purchases, sortConfig, productById]);

  const totalSpend = useMemo(
    () =>
      purchases.reduce(
        (sum, p) =>
          sum + Number(p.total_amount),
        0
      ),
    [purchases]
  );

  const totalQuantity = useMemo(
    () =>
      purchases.reduce(
        (sum, p) => sum + Number(p.quantity),
        0
      ),
    [purchases]
  );

  const SortableHeader = ({
    label,
    sortKey,
  }: {
    label: string;
    sortKey: SortKey;
  }) => {
    const active = sortConfig?.key === sortKey;

    return (
      <th
        onClick={() => handleSort(sortKey)}
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
              active
                ? sortConfig.direction
                : undefined
            }
          />
        </div>
      </th>
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

                  {/* Purchase Icon */}
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 shadow-sm shadow-blue-200">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="h-5 w-5 text-white"
                      aria-hidden="true"
                    >
                      <path
                        d="M4 7.5A2.5 2.5 0 016.5 5h11A2.5 2.5 0 0120 7.5v9a2.5 2.5 0 01-2.5 2.5h-11A2.5 2.5 0 014 16.5v-9Z"
                        stroke="currentColor"
                        strokeWidth="1.7"
                      />

                      <path
                        d="M8 5V3.5M16 5V3.5M4 9h16"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                      />

                      <path
                        d="M8 13h8M8 16h5"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>

                  <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                      Purchases
                    </h1>

                    <p className="mt-0.5 text-sm text-slate-500">
                      {loading
                        ? "Loading…"
                        : `${purchases.length} purchases · ${money(
                            totalSpend
                          )} spent`}
                    </p>
                  </div>

                </div>
              </div>

              <button
                onClick={openAdd}
                className="h-10 rounded-xl bg-blue-600 px-4 text-sm font-medium text-white shadow-sm shadow-blue-200 transition-all hover:bg-blue-700 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                Add purchase
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
              onClick={loadAll}
              className="font-medium underline underline-offset-2 hover:no-underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Purchase Table Card */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(45,55,72,0.06)]">

          {/* Card Header */}
          <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">

              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Purchase list
                </h2>

                <p className="mt-0.5 text-xs text-slate-500">
                  Manage and organize your stock purchases
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">

                <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                  {totalQuantity} units
                </div>

                <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                  {money(totalSpend)} spent
                </div>

                <div className="hidden rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 sm:block">
                  {purchases.length} purchases
                </div>

              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">

              <thead className="bg-[#f8faff] text-slate-600">
                <tr>

                  <SortableHeader
                    label="ID"
                    sortKey="id"
                  />

                  <SortableHeader
                    label="Product"
                    sortKey="product"
                  />

                  <SortableHeader
                    label="Supplier"
                    sortKey="supplier_id"
                  />

                  <SortableHeader
                    label="Qty"
                    sortKey="quantity"
                  />

                  <SortableHeader
                    label="Unit cost"
                    sortKey="purchase_price"
                  />

                  <SortableHeader
                    label="Total"
                    sortKey="total_amount"
                  />

                  <SortableHeader
                    label="Purchased on"
                    sortKey="purchase_date"
                  />

                  <th className="border-b border-slate-200 px-4 py-4 text-right font-medium text-slate-500">
                    Actions
                  </th>

                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">

                {!loading &&
                  purchases.length === 0 &&
                  !error && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-14 text-center text-slate-500"
                      >
                        No purchases recorded. Use
                        {" “Add purchase” "}to log your
                        first stock order.
                      </td>
                    </tr>
                  )}

                {sortedPurchases.map((p) => {
                  const prod = productById.get(
                    p.product_id
                  );

                  return (
                    <tr
                      key={p.id}
                      className="group transition-colors hover:bg-[#f7f9ff]"
                    >

                      {/* ID */}
                      <td className="px-4 py-3.5 text-slate-500">
                        {p.id}
                      </td>

                      {/* Product */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">

                          <div>
                            <p className="font-semibold text-slate-900">
                              {prod
                                ? productLabel(prod)
                                : `${p.product_id}`}
                            </p>

                            {prod && (
                              <p className="mt-0.5 text-xs text-slate-500">
                                Product ID: {p.product_id}
                              </p>
                            )}
                          </div>

                        </div>
                      </td>

                      {/* Supplier */}
                      <td className="px-4 py-3.5 text-slate-600">
                        <p className="font-semibold text-slate-500">
                          {p.supplier_id}
                        </p>
                      </td>

                      {/* Quantity */}
                      <td className="px-4 py-3.5 tabular-nums font-medium text-slate-700">
                        {p.quantity}
                      </td>

                      {/* Unit Cost */}
                      <td className="px-4 py-3.5 tabular-nums text-slate-600">
                        {money(p.purchase_price)}
                      </td>

                      {/* Total */}
                      <td className="px-4 py-3.5 tabular-nums font-semibold text-slate-900">
                        {money(p.total_amount)}
                      </td>

                      {/* Date */}
                      <td className="whitespace-nowrap px-4 py-3.5 text-slate-600">
                        {formatDate(p.purchase_date)}
                      </td>

                      {/* Actions */}
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
                  );
                })}

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
            aria-labelledby="purchase-modal-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >

            {/* Modal Header */}
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

              <div>
                <h2
                  id="purchase-modal-title"
                  className="text-lg font-semibold text-slate-900"
                >
                  {editing
                    ? "Edit purchase"
                    : "Add purchase"}
                </h2>

                <p className="mt-0.5 text-xs text-slate-500">
                  {editing
                    ? "Update purchase information"
                    : "Record a new stock purchase"}
                </p>
              </div>

            </div>

            {/* Form */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

              <Field label="Product">
                {products.length > 0 ? (
                  <select
                    value={form.product_id}
                    onChange={(e) =>
                      onProductChange(
                        e.target.value
                      )
                    }
                    className={inputCls}
                  >
                    <option value="">
                      Select a product
                    </option>

                    {products.map((p) => (
                      <option
                        key={p.id}
                        value={p.id}
                      >
                        {productLabel(p)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="number"
                    placeholder="Product ID"
                    value={form.product_id}
                    onChange={(e) =>
                      setField(
                        "product_id",
                        e.target.value
                      )
                    }
                    className={inputCls}
                  />
                )}
              </Field>

              <Field label="Supplier ID">
                <input
                  type="number"
                  value={form.supplier_id}
                  onChange={(e) =>
                    setField(
                      "supplier_id",
                      e.target.value
                    )
                  }
                  className={inputCls}
                />
              </Field>

              <Field label="Quantity">
                <input
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={(e) =>
                    setField(
                      "quantity",
                      e.target.value
                    )
                  }
                  className={inputCls}
                />
              </Field>

              <Field label="Purchase price (per unit)">
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

              {editing && (
                <Field label="Purchased on (optional)">
                  <input
                    type="datetime-local"
                    value={form.purchase_date}
                    onChange={(e) =>
                      setField(
                        "purchase_date",
                        e.target.value
                      )
                    }
                    className={inputCls}
                  />
                </Field>
              )}

              {/* Total */}
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:col-span-2">
                <div>
                  <p className="text-xs font-medium text-slate-500">
                    Total amount
                  </p>

                  <p className="mt-0.5 text-lg font-semibold text-slate-900">
                    {money(formTotal)}
                  </p>
                </div>

                <div className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">
                  {form.quantity || 0} units
                </div>
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
                  : "Add purchase"}
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
              Delete purchase?
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              {toDelete.quantity} units (
              {money(toDelete.total_amount)}) will be
              removed from your purchase records. This
              can't be undone.
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
                  : "Delete purchase"}
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
