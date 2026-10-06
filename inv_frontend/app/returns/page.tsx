"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const API = "http://127.0.0.1:8000/product";

// Shape returned by ReturnsSerializer (assumes fields = "__all__").
// The ForeignKey `sales_id` is serialized as the related sale's primary key.
type ReturnRecord = {
  id: number;
  sales_id: number; // references Sale.id
  quantity: number;
  return_date: string;
};

// Only the sales fields this page needs (from get_sales)
type Sale = {
  id: number;
  order_id: string;
  product_id: number; // references Product.id (not Product.product_id)
};

// Only the product fields this page needs (from get_product)
type ProductOption = {
  id: number;
  product_name: string;
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
};

const units = (n: number) => `${n} ${n === 1 ? "unit" : "units"}`;

export default function ReturnsPage() {
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search by order ID or sale ID
  const [search, setSearch] = useState("");

  // sale.id -> sale (used to get the order_id and product of each return)
  const saleById = useMemo(() => {
    const m = new Map<number, Sale>();
    sales.forEach((s) => m.set(s.id, s));
    return m;
  }, [sales]);

  // product.id -> product (used to get the product_name of each sale)
  const productById = useMemo(() => {
    const m = new Map<number, ProductOption>();
    products.forEach((p) => m.set(p.id, p));
    return m;
  }, [products]);

  const loadAll = useCallback(async () => {
    try {
      setError(null);
      const [returnsRes, salesRes, productsRes] = await Promise.all([
        fetch(`${API}/get_returns/`, { cache: "no-store" }),
        fetch(`${API}/get_sales/`, { cache: "no-store" }),
        fetch(`${API}/get_product/`, { cache: "no-store" }),
      ]);
      if (!returnsRes.ok) throw new Error(`Returns request failed (${returnsRes.status})`);
      setReturns(await returnsRes.json());
      // Sales and products are only used for order IDs and names; don't fail the page without them.
      if (salesRes.ok) setSales(await salesRes.json());
      if (productsRes.ok) setProducts(await productsRes.json());
    } catch (e) {
      setError(
        e instanceof Error ? `Couldn't load returns. ${e.message}` : "Couldn't load returns."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // The view returns Returns.objects.all() unordered, so show the newest first here.
  const sortedReturns = useMemo(
    () =>
      [...returns].sort(
        (a, b) => new Date(b.return_date).getTime() - new Date(a.return_date).getTime()
      ),
    [returns]
  );

  // Rows shown in the table: matches on the sale's order_id (case-insensitive) or the sale ID
  const filteredReturns = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedReturns;
    return sortedReturns.filter((r) => {
      const orderId = (saleById.get(r.sales_id)?.order_id ?? "").toLowerCase();
      return orderId.includes(q) || String(r.sales_id).includes(q);
    });
  }, [sortedReturns, search, saleById]);

  const totalUnits = useMemo(
    () => returns.reduce((sum, r) => sum + r.quantity, 0),
    [returns]
  );

  return (
    <main className="min-h-screen bg-[#f6f6f6] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6">
          <div className="rounded-2xl border border-white/80 bg-white px-5 py-5 shadow-[0_8px_30px_rgba(45,55,72,0.06)] sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                  Returns
                </h1>
                <p className="mt-0.5 text-sm text-slate-500">
                  {loading
                    ? "Loading…"
                    : `${returns.length} returns · ${units(totalUnits)} returned`}
                </p>
              </div>
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <div className="relative w-full sm:w-72">
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by order ID or sale ID"
                    aria-label="Search returns by order ID or sale ID"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                </div>
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
                  {["ID", "Sale ID", "Order ID", "Product name", "Quantity", "Return date"].map(
                    (h) => (
                      <th
                        key={h}
                        className="whitespace-nowrap border-b border-slate-200 px-4 py-4 text-left font-medium text-slate-500"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!loading && filteredReturns.length === 0 && !error && (
                  <tr>
                    <td colSpan={6} className="px-4 py-14 text-center text-slate-500">
                      {search.trim()
                        ? `No returns found for “${search.trim()}”.`
                        : "No returns recorded. Use “Return” on the Sales page to record one."}
                    </td>
                  </tr>
                )}
                {filteredReturns.map((r) => {
                  const s = saleById.get(r.sales_id);
                  const p = s ? productById.get(s.product_id) : undefined;
                  return (
                    <tr
                      key={r.id}
                      className="group transition-colors hover:bg-[#f7f9ff]"
                    >
                      <td className="px-4 py-3.5 text-slate-500">{r.id}</td>
                      <td className="px-4 py-3.5 font-medium text-slate-700">
                        {r.sales_id}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-900">
                        {s ? s.order_id : "—"}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {p ? p.product_name : s ? `Product #${s.product_id}` : "—"}
                      </td>
                      <td className="px-4 py-3.5 tabular-nums text-slate-600">
                        {r.quantity}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-slate-600">
                        {formatDate(r.return_date)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}