"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

const API = "http://127.0.0.1:8000/product";
// Used when a product has no reorder_level set
const LOW_STOCK_DEFAULT = 10;

type Product = {
  id: number;
  product_name: string;
  brand_name: string;
  size: string;
  color: string;
  stock_quantity: number;
  reorder_level: number | null;
  status: boolean;
};
type Sale = {
  id: number;
  order_id: string;
  quantity: number;
  total_amount: string;
  Sell_date: string;
  status: boolean;
  platform_id: number;
  product_id: number; // references Product.id
};
type Purchase = {
  id: number;
  quantity: number;
  total_amount: string;
  purchase_date: string;
  supplier_id: number;
  product_id: number; // references Product.id
};
type Category = { id: number; status: boolean };
type Supplier = { id: number; supplier_name: string; status: boolean };
type Platform = { id: number; platform_name: string; status: boolean };

type Key = "products" | "sales" | "purchases" | "categories" | "suppliers" | "platforms";
const ENDPOINTS: Record<Key, string> = {
  products: "get_product",
  sales: "get_sales",
  purchases: "get_purchase",
  categories: "get_category",
  suppliers: "get_supplier",
  platforms: "get_platform",
};

const money = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const formatDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { dateStyle: "medium" });
};
const byDateDesc = (a: string, b: string) => new Date(b).getTime() - new Date(a).getTime();

// Number(null) is 0, so treat null/undefined/"" as "missing" instead
const toNumber = (v: unknown) => (v === null || v === undefined || v === "" ? NaN : Number(v));

function StatCard({
  label,
  value,
  note,
  href,
  accent = "text-slate-900",
}: {
  label: string;
  value: string;
  note?: string;
  href: string;
  accent?: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-slate-200 bg-white p-5 hover:border-teal-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
    >
      <p className="text-sm text-slate-600">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${accent}`}>{value}</p>
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
    </Link>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: { label: string; href: string };
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {action && (
          <Link href={action.href} className="text-xs font-medium text-teal-700 hover:underline">
            {action.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

const Empty = ({ children }: { children: ReactNode }) => (
  <p className="py-8 text-center text-sm text-slate-500">{children}</p>
);

export default function DashboardPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string[]>([]);
  const [saleQuantity, setSaleQuantity] = useState<number | null>(null);
  const [returnQuantity, setReturnQuantity] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const keys = Object.keys(ENDPOINTS) as Key[];

    const [results, summary] = await Promise.all([
      Promise.allSettled(
        keys.map(async (k) => {
          const res = await fetch(`${API}/${ENDPOINTS[k]}/`, { cache: "no-store" });
          if (!res.ok) throw new Error(String(res.status));
          return res.json();
        })
      ),
      // get_summary returns { data: { sale_quantity, return_quantity } }
      fetch(`${API}/get_summary/`, { cache: "no-store" })
        .then((res) => {
          if (!res.ok) throw new Error(String(res.status));
          return res.json();
        })
        .then((json) => ({
          ok: true,
          sold: toNumber(json?.data?.sale_quantity),
          returned: toNumber(json?.data?.return_quantity),
        }))
        .catch(() => ({ ok: false, sold: NaN, returned: NaN })),
    ]);

    const out = {} as Record<Key, unknown[]>;
    const bad: string[] = [];
    results.forEach((r, i) => {
      if (r.status === "fulfilled" && Array.isArray(r.value)) out[keys[i]] = r.value;
      else {
        out[keys[i]] = [];
        bad.push(keys[i]);
      }
    });

    setSaleQuantity(Number.isFinite(summary.sold) ? summary.sold : null);
    setReturnQuantity(Number.isFinite(summary.returned) ? summary.returned : null);
    if (!summary.ok) bad.push("summary");
    else {
      if (!Number.isFinite(summary.sold)) bad.push("sale_quantity");
      if (!Number.isFinite(summary.returned)) bad.push("return_quantity");
    }

    setProducts(out.products as Product[]);
    setSales(out.sales as Sale[]);
    setPurchases(out.purchases as Purchase[]);
    setCategories(out.categories as Category[]);
    setSuppliers(out.suppliers as Supplier[]);
    setPlatforms(out.platforms as Platform[]);
    setFailed(bad);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const d = useMemo(() => {
    const productById = new Map(products.map((p) => [p.id, p]));
    const platformById = new Map(platforms.map((p) => [p.id, p.platform_name]));
    const supplierById = new Map(suppliers.map((s) => [s.id, s.supplier_name]));
    const productName = (id: number) => {
      const p = productById.get(id);
      return p ? `${titleCase(p.product_name)} (${titleCase(p.color)}, ${p.size})` : `Product #${id}`;
    };

    // Only completed sales (status = true) count toward totals
    const completed = sales.filter((s) => s.status);
    const salesTotal = completed.reduce((t, s) => t + Number(s.total_amount || 0), 0);
    const purchasesTotal = purchases.reduce((t, p) => t + Number(p.total_amount || 0), 0);

    const lowStock = products
      .filter((p) => p.status && p.stock_quantity <= (p.reorder_level ?? LOW_STOCK_DEFAULT))
      .sort((a, b) => a.stock_quantity - b.stock_quantity);

    const platformTotals = new Map<number, number>();
    completed.forEach((s) =>
      platformTotals.set(s.platform_id, (platformTotals.get(s.platform_id) ?? 0) + Number(s.total_amount))
    );
    const platformRows = Array.from(platformTotals.entries())
      .map(([id, value]) => ({ name: platformById.get(id) ?? `Platform #${id}`, value }))
      .sort((a, b) => b.value - a.value);

    return {
      productName,
      platformById,
      supplierById,
      salesTotal,
      purchasesTotal,
      stockUnits: products.reduce((t, p) => t + p.stock_quantity, 0),
      activeProducts: products.filter((p) => p.status).length,
      lowStock,
      platformRows,
      platformMax: Math.max(1, ...platformRows.map((r) => r.value)),
      recentSales: [...sales].sort((a, b) => byDateDesc(a.Sell_date, b.Sell_date)).slice(0, 5),
      recentPurchases: [...purchases]
        .sort((a, b) => byDateDesc(a.purchase_date, b.purchase_date))
        .slice(0, 5),
    };
  }, [products, sales, purchases, suppliers, platforms]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-600">A live summary of your inventory data.</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {failed.length > 0 && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          Couldn&apos;t load: {failed.join(", ")}. Check that your backend is running; the numbers
          below may be incomplete.
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-busy="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-slate-200" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Products"
              value={String(products.length)}
              note={`${d.activeProducts} active · ${categories.length} categories`}
              href="/home"
            />
            <StatCard
              label="Units in stock"
              value={d.stockUnits.toLocaleString("en-IN")}
              note="Across all products"
              href="/home"
            />
            <StatCard
              label="Low stock items"
              value={String(d.lowStock.length)}
              note={d.lowStock.length > 0 ? "Need restocking" : "All good"}
              href="/home"
              accent={d.lowStock.length > 0 ? "text-red-600" : "text-slate-900"}
            />
            <StatCard
              label="Total sold items"
              value={saleQuantity === null ? "—" : saleQuantity.toLocaleString("en-IN")}
              note="From sales summary"
              href="/sales"
            />
            <StatCard label="Total sales" value={money(d.salesTotal)} href="/sales" />
            <StatCard label="Total purchases" value={money(d.purchasesTotal)} href="/purchase" />
            <StatCard
              label="Suppliers"
              value={String(suppliers.length)}
              note={`${suppliers.filter((s) => s.status).length} active`}
              href="/suppliers"
            />
            <StatCard
              label="Returns"
              value={returnQuantity === null ? "—" : returnQuantity.toLocaleString("en-IN")}
              note="Total units returned"
              href="/sales"
              accent={returnQuantity !== null && returnQuantity > 0 ? "text-amber-600" : "text-slate-900"}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Panel title="Sales by platform">
              {d.platformRows.length === 0 ? (
                <Empty>No completed sales yet.</Empty>
              ) : (
                <ul className="space-y-4">
                  {d.platformRows.map((r) => (
                    <li key={r.name}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="font-medium text-slate-800">{r.name}</span>
                        <span className="tabular-nums text-slate-600">
                          {money(r.value)}
                          {d.salesTotal > 0 && ` · ${Math.round((r.value / d.salesTotal) * 100)}%`}
                        </span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-teal-600"
                          style={{ width: `${(r.value / d.platformMax) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Low stock" action={{ label: "View products", href: "/home" }}>
              {d.lowStock.length === 0 ? (
                <Empty>Nothing is running low.</Empty>
              ) : (
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs text-slate-600">
                    <tr>
                      <th className="pb-2 font-medium">Product</th>
                      <th className="pb-2 font-medium">Size</th>
                      <th className="pb-2 text-right font-medium">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {d.lowStock.slice(0, 5).map((p) => (
                      <tr key={p.id}>
                        <td className="py-2 text-slate-800">
                          {titleCase(p.product_name)}
                          <span className="ml-2 text-xs text-slate-500">
                            {titleCase(p.brand_name)}
                          </span>
                        </td>
                        <td className="py-2 text-slate-700">{p.size}</td>
                        <td className="py-2 text-right font-medium tabular-nums text-red-600">
                          {p.stock_quantity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Panel title="Recent sales" action={{ label: "View all", href: "/sales" }}>
              {d.recentSales.length === 0 ? (
                <Empty>No sales recorded yet.</Empty>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-xs text-slate-600">
                      <tr>
                        <th className="pb-2 font-medium">Order</th>
                        <th className="pb-2 font-medium">Product</th>
                        <th className="pb-2 text-right font-medium">Qty</th>
                        <th className="pb-2 text-right font-medium">Amount</th>
                        <th className="pb-2 pl-4 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {d.recentSales.map((s) => (
                        <tr key={s.id}>
                          <td className="whitespace-nowrap py-2 font-medium text-slate-900">
                            {s.order_id}
                            {!s.status && (
                              <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs font-normal text-slate-700">
                                Cancelled
                              </span>
                            )}
                          </td>
                          <td className="py-2 text-slate-700">
                            {d.productName(s.product_id)}
                            <span className="block text-xs text-slate-500">
                              {d.platformById.get(s.platform_id) ?? `Platform #${s.platform_id}`}
                            </span>
                          </td>
                          <td className="py-2 text-right tabular-nums text-slate-700">{s.quantity}</td>
                          <td className="whitespace-nowrap py-2 text-right tabular-nums text-slate-900">
                            {money(Number(s.total_amount))}
                          </td>
                          <td className="whitespace-nowrap py-2 pl-4 text-slate-600">
                            {formatDate(s.Sell_date)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel title="Recent purchases" action={{ label: "View all", href: "/purchase" }}>
              {d.recentPurchases.length === 0 ? (
                <Empty>No purchases recorded yet.</Empty>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-xs text-slate-600">
                      <tr>
                        <th className="pb-2 font-medium">Product</th>
                        <th className="pb-2 text-right font-medium">Qty</th>
                        <th className="pb-2 text-right font-medium">Amount</th>
                        <th className="pb-2 pl-4 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {d.recentPurchases.map((p) => (
                        <tr key={p.id}>
                          <td className="py-2 text-slate-700">
                            {d.productName(p.product_id)}
                            <span className="block text-xs text-slate-500">
                              {d.supplierById.get(p.supplier_id) ?? `Supplier #${p.supplier_id}`}
                            </span>
                          </td>
                          <td className="py-2 text-right tabular-nums text-slate-700">{p.quantity}</td>
                          <td className="whitespace-nowrap py-2 text-right tabular-nums text-slate-900">
                            {money(Number(p.total_amount))}
                          </td>
                          <td className="whitespace-nowrap py-2 pl-4 text-slate-600">
                            {formatDate(p.purchase_date)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>
        </div>
      )}
    </main>
  );
}