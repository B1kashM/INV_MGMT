"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Sidebar from "../components/navbar";

const API = "https://inv-mgmt-oq6c.onrender.com/product";
// Used when a product has no reorder_level set
const LOW_STOCK_DEFAULT = 10;

// Colour theme (soft indigo-blue accents on a light grey page, white rounded cards)
const BAR_COLORS = ["bg-[#6b83f2]", "bg-[#88ddf2]", "bg-[#b57fd9]"];

// Gradient themes for the stat cards (change the hex codes here to recolour a card)
const CARD_THEMES = {
  // Stocks: blue  #4a63e8 -> #6a80f2
  blue: {
    box: "bg-gradient-to-br from-[#4a63e8] to-[#6a80f2]",
    label: "text-white",
    value: "text-white",
    note: "text-white",
  },
  // Sales: green  #15803d -> #2f9e5b
  green: {
    box: "bg-gradient-to-br from-[#15803d] to-[#2f9e5b]",
    label: "text-white",
    value: "text-white",
    note: "text-white",
  },
  // Returns: red  #b91c1c -> #ef4444
  red: {
    box: "bg-gradient-to-br from-[#b91c1c] to-[#ef4444]",
    label: "text-white",
    value: "text-white",
    note: "text-white",
  },
  // Low stock: faded red  #fecaca -> #fee2e2 (dark text so it stays readable)
  fadedRed: {
    box: "bg-gradient-to-br from-[#fecaca] to-[#fee2e2]",
    label: "text-red-900",
    value: "text-red-800",
    note: "text-red-800",
  },
} as const;
type CardTheme = keyof typeof CARD_THEMES;

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
  theme,
}: {
  label: string;
  value: string;
  note?: string;
  href: string;
  accent?: string;
  theme?: CardTheme;
}) {
  const t = theme ? CARD_THEMES[theme] : null;
  return (
    <Link
      href={href}
      className={`block rounded-2xl p-6 shadow-sm transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4a63e8] focus-visible:ring-offset-2 ${
        t ? t.box : "bg-white hover:ring-1 hover:ring-[#6b83f2]/50"
      }`}
    >
      <p className={`text-sm font-medium ${t ? t.label : "text-slate-700"}`}>{label}</p>
      <p className={`mt-2 text-3xl font-semibold tabular-nums ${t ? t.value : accent}`}>
        {value}
      </p>
      {note && <p className={`mt-1 text-xs ${t ? t.note : "text-slate-500"}`}>{note}</p>}
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
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
        {action && (
          <Link href={action.href} className="text-sm font-semibold text-[#4a63e8] hover:underline">
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
    <div className="min-h-screen min-w-0 flex-1 bg-[#f6f6f6]">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Dashboard</h1>
            <p className="text-sm text-slate-600">A live summary of your inventory data.</p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4a63e8] disabled:opacity-50"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </header>

        {failed.length > 0 && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            Couldn&apos;t load: {failed.join(", ")}. Check that your backend is running; the numbers
            below may be incomplete.
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-busy="true">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200/70" />
            ))}
          </div>
        ) : (
          <div className="space-y-5">
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
                theme="blue"
              />
              <StatCard
                label="Low stock items"
                value={String(d.lowStock.length)}
                note={d.lowStock.length > 0 ? "Need restocking" : "All good"}
                href="/home"
                theme={d.lowStock.length > 0 ? "fadedRed" : undefined}
              />
              <StatCard
                label="Total sold items"
                value={saleQuantity === null ? "—" : saleQuantity.toLocaleString("en-IN")}
                note="From sales summary"
                href="/sales"
              />
              <StatCard label="Total sales" value={money(d.salesTotal)} href="/sales" theme="green" />
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
                href="/returns"
                theme="red"
              />
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <Panel title="Sales by platform">
                {d.platformRows.length === 0 ? (
                  <Empty>No completed sales yet.</Empty>
                ) : (
                  <ul className="space-y-4">
                    {d.platformRows.map((r, i) => (
                      <li key={r.name}>
                        <div className="mb-1 flex justify-between text-sm">
                          <span className="font-medium text-slate-800">{r.name}</span>
                          <span className="tabular-nums text-slate-600">
                            {money(r.value)}
                            {d.salesTotal > 0 && ` · ${Math.round((r.value / d.salesTotal) * 100)}%`}
                          </span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${BAR_COLORS[i % BAR_COLORS.length]}`}
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
                    <thead className="border-b border-slate-200 text-xs text-slate-500">
                      <tr>
                        <th className="pb-3 font-medium">Product</th>
                        <th className="pb-3 font-medium">Size</th>
                        <th className="pb-3 text-right font-medium">Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {d.lowStock.slice(0, 5).map((p) => (
                        <tr key={p.id}>
                          <td className="py-3 text-slate-800">
                            {titleCase(p.product_name)}
                            <span className="ml-2 text-xs text-slate-500">
                              {titleCase(p.brand_name)}
                            </span>
                          </td>
                          <td className="py-3 text-slate-700">{p.size}</td>
                          <td className="py-3 text-right font-medium tabular-nums text-red-600">
                            {p.stock_quantity}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Panel>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <Panel title="Recent sales" action={{ label: "View all", href: "/sales" }}>
                {d.recentSales.length === 0 ? (
                  <Empty>No sales recorded yet.</Empty>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="border-b border-slate-200 text-xs text-slate-500">
                        <tr>
                          <th className="pb-3 font-medium">Order</th>
                          <th className="pb-3 font-medium">Product</th>
                          <th className="pb-3 text-right font-medium">Qty</th>
                          <th className="pb-3 text-right font-medium">Amount</th>
                          <th className="pb-3 pl-4 font-medium">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {d.recentSales.map((s) => (
                          <tr key={s.id}>
                            <td className="whitespace-nowrap py-3 font-medium text-slate-900">
                              {s.order_id}
                              {!s.status && (
                                <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-normal text-slate-700">
                                  Cancelled
                                </span>
                              )}
                            </td>
                            <td className="py-3 text-slate-700">
                              {d.productName(s.product_id)}
                              <span className="block text-xs text-slate-500">
                                {d.platformById.get(s.platform_id) ?? `Platform #${s.platform_id}`}
                              </span>
                            </td>
                            <td className="py-3 text-right tabular-nums text-slate-700">{s.quantity}</td>
                            <td className="whitespace-nowrap py-3 text-right tabular-nums text-slate-900">
                              {money(Number(s.total_amount))}
                            </td>
                            <td className="whitespace-nowrap py-3 pl-4 text-slate-600">
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
                      <thead className="border-b border-slate-200 text-xs text-slate-500">
                        <tr>
                          <th className="pb-3 font-medium">Product</th>
                          <th className="pb-3 text-right font-medium">Qty</th>
                          <th className="pb-3 text-right font-medium">Amount</th>
                          <th className="pb-3 pl-4 font-medium">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {d.recentPurchases.map((p) => (
                          <tr key={p.id}>
                            <td className="py-3 text-slate-700">
                              {d.productName(p.product_id)}
                              <span className="block text-xs text-slate-500">
                                {d.supplierById.get(p.supplier_id) ?? `Supplier #${p.supplier_id}`}
                              </span>
                            </td>
                            <td className="py-3 text-right tabular-nums text-slate-700">{p.quantity}</td>
                            <td className="whitespace-nowrap py-3 text-right tabular-nums text-slate-900">
                              {money(Number(p.total_amount))}
                            </td>
                            <td className="whitespace-nowrap py-3 pl-4 text-slate-600">
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
    </div>
  );
}