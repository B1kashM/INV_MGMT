"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import BulkUploadSalesModal from "./Bulkuploadsalesmodal";

const API = "http://127.0.0.1:8000/product";

type Sale = {
  id: number;
  order_id: string;
  quantity: number;
  selling_price: string;
  total_amount: string;
  Sell_date: string;
  status: boolean;
  platform_id: number;
  product_id: number;
};

type ProductOption = {
  id: number;
  product_id: number;
  product_name: string;
  brand_name: string;
  size: string;
  selling_price: string;
  stock_quantity: number;
};

type FormState = {
  order_id: string;
  product_id: string;
  platform_id: string;
  quantity: string;
  selling_price: string;
  Sell_date: string;
  status: boolean;
};

const emptyForm: FormState = {
  order_id: "",
  product_id: "",
  platform_id: "",
  quantity: "",
  selling_price: "",
  Sell_date: "",
  status: true,
};

const isoToLocalInput = (iso: string) => {
  const d = new Date(iso);

  if (isNaN(d.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const toForm = (s: Sale): FormState => ({
  order_id: s.order_id,
  product_id: String(s.product_id),
  platform_id: String(s.platform_id),
  quantity: String(s.quantity),
  selling_price: s.selling_price,
  Sell_date: isoToLocalInput(s.Sell_date),
  status: s.status,
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

const units = (n: number) =>
  `${n} ${n === 1 ? "unit" : "units"}`;

type SortKey =
  | "id"
  | "order_id"
  | "product"
  | "platform_id"
  | "quantity"
  | "selling_price"
  | "total_amount"
  | "Sell_date"
  | "status";

type SortDirection = "asc" | "desc";

type SortConfig = {
  key: SortKey;
  direction: SortDirection;
} | null;

/* -------------------------------------------------------------------------- */
/* Sort Icon                                                                   */
/* -------------------------------------------------------------------------- */

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

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");

  const [sortConfig, setSortConfig] =
    useState<SortConfig>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Sale | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [toDelete, setToDelete] = useState<Sale | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [toReturn, setToReturn] = useState<Sale | null>(null);
  const [returnQty, setReturnQty] = useState("1");
  const [returning, setReturning] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);

  const [bulkOpen, setBulkOpen] = useState(false);

  const existingSales = useMemo(
    () =>
      sales.map((s) => ({
        order_id: s.order_id,
        product_id: s.product_id,
      })),
    [sales]
  );

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

      const [salesRes, productsRes] = await Promise.all([
        fetch(`${API}/get_sales/`, {
          cache: "no-store",
        }),
        fetch(`${API}/get_product/`, {
          cache: "no-store",
        }),
      ]);

      if (!salesRes.ok) {
        throw new Error(
          `Sales request failed (${salesRes.status})`
        );
      }

      setSales(await salesRes.json());

      if (productsRes.ok) {
        setProducts(await productsRes.json());
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? `Couldn't load sales. ${e.message}`
          : "Couldn't load sales."
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

  const openEdit = (s: Sale) => {
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
        prev.selling_price === ""
      ) {
        next.selling_price = p.selling_price;
      }

      return next;
    });
  };

  const formTotal = useMemo(() => {
    const q = Number(form.quantity);
    const p = Number(form.selling_price);

    return q > 0 && p >= 0 ? q * p : 0;
  }, [form.quantity, form.selling_price]);

  const handleSave = async () => {
    if (
      !form.order_id.trim() ||
      !form.product_id ||
      !form.platform_id
    ) {
      setFormError(
        "Order ID, product and platform ID are required."
      );
      return;
    }

    if (!(Number(form.quantity) > 0)) {
      setFormError("Quantity must be greater than 0.");
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const payload: Record<string, unknown> = {
        order_id: form.order_id.trim(),
        product_id: Number(form.product_id),
        platform_id: Number(form.platform_id),
        quantity: Number(form.quantity),
        selling_price: form.selling_price,
        total_amount: formTotal.toFixed(2),
        status: form.status,
      };

      if (form.Sell_date) {
        payload.Sell_date = new Date(
          form.Sell_date
        ).toISOString();
      }

      const url = editing
        ? `${API}/update_sales/${editing.id}`
        : `${API}/add_sales/`;

      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();

        throw new Error(
          text || `Server responded with ${res.status}`
        );
      }

      setModalOpen(false);
      await loadAll();
    } catch (e) {
      setFormError(
        e instanceof Error
          ? e.message
          : "Couldn't save sale."
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
        `${API}/delete_sales/${toDelete.id}`,
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
          ? `Couldn't delete sale. ${e.message}`
          : "Couldn't delete sale."
      );

      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const openReturn = (s: Sale) => {
    setToReturn(s);
    setReturnQty("1");
    setReturnError(null);
  };

  const closeReturn = () => {
    if (!returning) {
      setToReturn(null);
    }
  };

  const returnQtyNum = Number(returnQty);

  const returnQtyValid =
    toReturn !== null &&
    Number.isInteger(returnQtyNum) &&
    returnQtyNum >= 1 &&
    returnQtyNum <= toReturn.quantity;

  const handleReturn = async () => {
    if (!toReturn) return;

    if (!returnQtyValid) {
      setReturnError(
        `Enter a whole number between 1 and ${toReturn.quantity}.`
      );
      return;
    }

    setReturning(true);
    setReturnError(null);

    try {
      const res = await fetch(
        `${API}/return_sales/${toReturn.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            number: returnQtyNum,
          }),
        }
      );

      if (!res.ok) {
        let message = `Server responded with ${res.status}`;

        try {
          const json = await res.json();

          if (json?.error) {
            message = String(json.error);
          }
        } catch {
          if (res.status === 404) {
            message =
              "Return endpoint not found (404). Check the return_sales URL.";
          }
        }

        throw new Error(message);
      }

      setToReturn(null);
      await loadAll();
    } catch (e) {
      setReturnError(
        e instanceof Error
          ? e.message
          : "Couldn't return items."
      );
    } finally {
      setReturning(false);
    }
  };

  const visibleSales = useMemo(
    () => sales.filter((s) => s.quantity > 0),
    [sales]
  );

  const filteredSales = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return visibleSales;

    return visibleSales.filter((s) =>
      s.order_id.toLowerCase().includes(q)
    );
  }, [visibleSales, search]);

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

  const sortedSales = useMemo(() => {
    if (!sortConfig) return filteredSales;

    const sorted = [...filteredSales];

    sorted.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortConfig.key) {
        case "id":
          aValue = a.id;
          bValue = b.id;
          break;

        case "order_id":
          aValue = a.order_id.toLowerCase();
          bValue = b.order_id.toLowerCase();
          break;

        case "product": {
          const productA = productById.get(a.product_id);
          const productB = productById.get(b.product_id);

          aValue = productA
            ? productLabel(productA).toLowerCase()
            : `product #${a.product_id}`.toLowerCase();

          bValue = productB
            ? productLabel(productB).toLowerCase()
            : `product #${b.product_id}`.toLowerCase();

          break;
        }

        case "platform_id":
          aValue = a.platform_id;
          bValue = b.platform_id;
          break;

        case "quantity":
          aValue = a.quantity;
          bValue = b.quantity;
          break;

        case "selling_price":
          aValue = Number(a.selling_price);
          bValue = Number(b.selling_price);
          break;

        case "total_amount":
          aValue = Number(a.total_amount);
          bValue = Number(b.total_amount);
          break;

        case "Sell_date":
          aValue = new Date(a.Sell_date).getTime();
          bValue = new Date(b.Sell_date).getTime();
          break;

        case "status":
          aValue = a.status ? "completed" : "cancelled";
          bValue = b.status ? "completed" : "cancelled";
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
  }, [filteredSales, sortConfig, productById]);

  const revenue = useMemo(
    () =>
      visibleSales
        .filter((s) => s.status)
        .reduce(
          (sum, s) => sum + Number(s.total_amount),
          0
        ),
    [visibleSales]
  );

  /* ------------------------------------------------------------------------ */
  /* Sortable Header                                                          */
  /* ------------------------------------------------------------------------ */

  const SortableHeader = ({
    label,
    sortKey,
  }: {
    label: string;
    sortKey: SortKey;
  }) => {
    const active = sortConfig?.key === sortKey;

    const direction = active
      ? sortConfig?.direction
      : undefined;

    const ariaSort = active
      ? direction === "asc"
        ? "ascending"
        : "descending"
      : "none";

    const ariaLabel = active
      ? `Sorted by ${label}, ${
          direction === "asc"
            ? "ascending"
            : "descending"
        }. Click to reverse.`
      : `Sort by ${label}`;

    return (
      <th
        aria-sort={ariaSort}
        className="whitespace-nowrap border-b border-slate-200 px-4 py-4 text-left font-medium text-slate-500 transition-colors hover:bg-blue-50/60"
      >
        <button
          type="button"
          onClick={() => handleSort(sortKey)}
          className="group flex w-full items-center gap-1.5 rounded text-left font-medium select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
          aria-label={ariaLabel}
          title={ariaLabel}
        >
          <span>{label}</span>

          <span
            className={`transition-colors ${
              active
                ? "text-blue-600"
                : "text-slate-400 group-hover:text-slate-600"
            }`}
          >
            <SortIcon
              active={active}
              direction={direction}
            />
          </span>
        </button>
      </th>
    );
  };

  return (
    <main className="min-h-screen bg-[#f6f6f6] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6">
          <div className="rounded-2xl border border-white/80 bg-white px-5 py-5 shadow-[0_8px_30px_rgba(45,55,72,0.06)] sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                  Sales
                </h1>

                <p className="mt-0.5 text-sm text-slate-500">
                  {loading
                    ? "Loading…"
                    : `${visibleSales.length} orders · ${money(
                        revenue
                      )} in completed sales`}
                </p>
              </div>

              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by order ID"
                    aria-label="Search sales by order ID"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
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
                  Add sale
                </button>
              </div>
            </div>
          </div>
        </header>

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

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(45,55,72,0.06)]">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#f8faff] text-slate-600">
                <tr>
                  <SortableHeader
                    label="ID"
                    sortKey="id"
                  />

                  <SortableHeader
                    label="Order ID"
                    sortKey="order_id"
                  />

                  <SortableHeader
                    label="Product"
                    sortKey="product"
                  />

                  <SortableHeader
                    label="Platform"
                    sortKey="platform_id"
                  />

                  <SortableHeader
                    label="Qty"
                    sortKey="quantity"
                  />

                  <SortableHeader
                    label="Unit price"
                    sortKey="selling_price"
                  />

                  <SortableHeader
                    label="Total"
                    sortKey="total_amount"
                  />

                  <SortableHeader
                    label="Sold on"
                    sortKey="Sell_date"
                  />

                  <SortableHeader
                    label="Status"
                    sortKey="status"
                  />

                  <th className="border-b border-slate-200 px-4 py-4 text-right font-medium text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {!loading &&
                  sortedSales.length === 0 &&
                  !error && (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-4 py-14 text-center text-slate-500"
                      >
                        {search.trim()
                          ? `No sales found for order ID “${search.trim()}”.`
                          : "No sales recorded. Use “Add sale” to record your first order."}
                      </td>
                    </tr>
                  )}

                {sortedSales.map((s) => {
                  const p = productById.get(s.product_id);

                  return (
                    <tr
                      key={s.id}
                      className="group transition-colors hover:bg-[#f7f9ff]"
                    >
                      <td className="px-4 py-3.5 text-slate-500">
                        {s.id}
                      </td>

                      <td className="px-4 py-3.5 font-medium text-slate-700">
                        {s.order_id}
                      </td>

                      <td className="px-4 py-3.5 font-semibold text-slate-900">
                        {p
                          ? productLabel(p)
                          : `Product #${s.product_id}`}
                      </td>

                      <td className="px-4 py-3.5 text-slate-600">
                        {s.platform_id}
                      </td>

                      <td className="px-4 py-3.5 tabular-nums text-slate-600">
                        {s.quantity}
                      </td>

                      <td className="px-4 py-3.5 tabular-nums text-slate-600">
                        {money(s.selling_price)}
                      </td>

                      <td className="px-4 py-3.5 tabular-nums font-medium text-slate-800">
                        {money(s.total_amount)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3.5 text-slate-600">
                        {formatDate(s.Sell_date)}
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            s.status
                              ? "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-100"
                              : "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200"
                          }`}
                        >
                          {s.status
                            ? "Completed"
                            : "Cancelled"}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3.5 text-right">
                        {s.status && (
                          <button
                            onClick={() => openReturn(s)}
                            className="rounded-lg px-2.5 py-1.5 text-amber-600 transition-colors hover:bg-amber-50 hover:text-amber-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                          >
                            Return
                          </button>
                        )}

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
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add / Edit Sale Modal */}

        {modalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]"
            onClick={closeModal}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="sale-modal-title"
              className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2
                id="sale-modal-title"
                className="mb-6 text-lg font-semibold text-slate-900"
              >
                {editing ? "Edit sale" : "Add sale"}
              </h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Order ID">
                  <input
                    value={form.order_id}
                    onChange={(e) =>
                      setField(
                        "order_id",
                        e.target.value
                      )
                    }
                    className={inputCls}
                  />
                </Field>

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
                      placeholder="Product id"
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

                <Field label="Platform ID">
                  <input
                    type="number"
                    value={form.platform_id}
                    onChange={(e) =>
                      setField(
                        "platform_id",
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

                <Field label="Selling price (per unit)">
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

                <Field label="Sold on (optional)">
                  <input
                    type="datetime-local"
                    value={form.Sell_date}
                    onChange={(e) =>
                      setField(
                        "Sell_date",
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

                  Completed
                </label>

                <p className="self-center text-sm text-slate-600 sm:text-right">
                  Total:{" "}
                  <span className="font-semibold text-slate-900">
                    {money(formTotal)}
                  </span>
                </p>
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
                    : "Add sale"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Upload */}

        <BulkUploadSalesModal
          open={bulkOpen}
          onClose={() => setBulkOpen(false)}
          products={products}
          existingSales={existingSales}
          onUploaded={loadAll}
        />

        {/* Return Modal */}

        {toReturn && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]"
            onClick={closeReturn}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="return-modal-title"
              className="w-full max-w-md rounded-2xl border border-white bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2
                id="return-modal-title"
                className="text-lg font-semibold text-slate-900"
              >
                Return items
              </h2>

              <dl className="mt-3 space-y-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">
                    Sale ID
                  </dt>

                  <dd className="font-medium text-slate-900">
                    {toReturn.id}
                  </dd>
                </div>

                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">
                    Product
                  </dt>

                  <dd className="text-right text-slate-900">
                    {(() => {
                      const p = productById.get(
                        toReturn.product_id
                      );

                      return p
                        ? productLabel(p)
                        : `Product #${toReturn.product_id}`;
                    })()}
                  </dd>
                </div>

                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">
                    Units sold
                  </dt>

                  <dd className="font-medium text-slate-900">
                    {toReturn.quantity}
                  </dd>
                </div>
              </dl>

              <div className="mt-4">
                <label className="block text-sm">
                  <span className="mb-1.5 block font-medium text-slate-700">
                    Number of units to return
                  </span>

                  <input
                    type="number"
                    min={1}
                    max={toReturn.quantity}
                    step={1}
                    value={returnQty}
                    onChange={(e) =>
                      setReturnQty(e.target.value)
                    }
                    onKeyDown={(e) =>
                      e.key === "Enter" &&
                      !returning &&
                      handleReturn()
                    }
                    autoFocus
                    className={inputCls}
                  />
                </label>

                <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    Between 1 and {toReturn.quantity}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setReturnQty(
                        String(toReturn.quantity)
                      )
                    }
                    className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    Return all
                  </button>
                </div>
              </div>

              {returnQtyValid && (
                <p className="mt-3 text-sm text-slate-600">
                  {units(returnQtyNum)} will go back to stock.
                  This sale will have{" "}
                  {units(
                    toReturn.quantity - returnQtyNum
                  )}{" "}
                  left.
                </p>
              )}

              {returnError && (
                <p
                  role="alert"
                  className="mt-3 break-words rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-800"
                >
                  {returnError}
                </p>
              )}

              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={closeReturn}
                  disabled={returning}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  onClick={handleReturn}
                  disabled={
                    returning || !returnQtyValid
                  }
                  className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-amber-200 transition-colors hover:bg-amber-700 disabled:opacity-50"
                >
                  {returning
                    ? "Returning…"
                    : "Confirm return"}
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
              <h2 className="text-lg font-semibold text-slate-900">
                Delete sale?
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Order {toDelete.order_id} (
                {money(toDelete.total_amount)}) will be removed.
                This can't be undone.
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
                    : "Delete sale"}
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