"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Sidebar from "../components/navbar";

const API = `${process.env.NEXT_PUBLIC_BACKEND_URL}/product`;
// Used when a product has no reorder_level set
const LOW_STOCK_DEFAULT = 10;

// ---- Colour theme -----------------------------------------------------------
// Bento cards on a blue-grey page: white cards plus coloured blocks.
// Change the hex codes here to recolour the whole page.
const GREEN = "#0a9f58";
const LIGHT_GREEN = "#dcefc3";
const ORANGE = "#f0400f";
const BLUE = "#1f6cff";
const RED = "#d92d2d"; // Returns card
const WHITE = "#ffffff"; // Items sold card

const CARD = "rounded-[28px] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_14px_30px_-20px_rgba(15,23,42,0.25)]";
const TINTS = [
  "bg-emerald-100 text-emerald-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
  "bg-white-100 text-white-700",
  "bg-rose-100 text-rose-700",
];
const HATCH = {
  backgroundColor: "#f3f3f3",
  backgroundImage: "repeating-linear-gradient(135deg, rgba(0,0,0,0.045) 0 2px, transparent 2px 8px)",
};
// ---------------------------------------------------------------------------

type Product = {
  id: number;
  product_id: number; // ProductDetails.product_id (unique, shown on /home)
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
type Return = {
  id: number;
  sales_id: number; // references Sale.id
  quantity: number;
  return_date: string;
};
type Category = { id: number; status: boolean };
type Supplier = { id: number; supplier_name: string; status: boolean };
type Platform = { id: number; platform_name: string; status: boolean };

type Key = "products" | "sales" | "purchases" | "returns" | "categories" | "suppliers" | "platforms";
const ENDPOINTS: Record<Key, string> = {
  products: "get_product",
  sales: "get_sales",
  purchases: "get_purchase",
  // NOTE: change this if your list-returns endpoint has a different name
  returns: "get_returns",
  categories: "get_category",
  suppliers: "get_supplier",
  platforms: "get_platform",
};

// ---- Period filter ---------------------------------------------------------
type Period = "this_month" | "last_month" | "this_year" | "all_time";
const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "this_year", label: "This year" },
  { value: "all_time", label: "All time" },
];

type Range = { start: Date; end: Date };

// Returns [start, end) of the selected period in the browser's local time
function getRange(period: Period): Range {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (period === "this_month") return { start: new Date(y, m, 1), end: new Date(y, m + 1, 1) };
  if (period === "last_month") return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
  if (period === "all_time") return { start: new Date(-8.64e15), end: new Date(8.64e15) };
  return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1) };
}

// The period right before the selected one (used for the +/- change chips)
function getPrevRange(period: Period): { range: Range; label: string } | null {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (period === "this_month") return { range: getRange("last_month"), label: "vs last month" };
  if (period === "last_month")
    return { range: { start: new Date(y, m - 2, 1), end: new Date(y, m - 1, 1) }, label: "vs month before" };
  if (period === "this_year")
    return { range: { start: new Date(y - 1, 0, 1), end: new Date(y, 0, 1) }, label: "vs last year" };
  return null;
}

function periodLabel(period: Period) {
  if (period === "all_time") return "All time";
  const { start } = getRange(period);
  return period === "this_year"
    ? String(start.getFullYear())
    : start.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

const inRange = (iso: string, r: Range) => {
  const t = new Date(iso).getTime();
  return !isNaN(t) && t >= r.start.getTime() && t < r.end.getTime();
};
// ---------------------------------------------------------------------------

const money = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const formatDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { dateStyle: "medium" });
};
const byDateDesc = (a: string, b: string) => new Date(b).getTime() - new Date(a).getTime();
const initials = (s: string) =>
  s
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";
const pctChange = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);

// ---- Small UI pieces -------------------------------------------------------

const ICONS = {
  arrow: "M6 14L14 6M7.5 6H14v6.5",
  sales: "M3 14l4.5-4.5 3 3L17 6M12.5 6H17v4.5",
  purchase: "M4.5 7h11l-1 9h-9l-1-9zM7.5 7a2.5 2.5 0 015 0",
  product: "M3.5 6.5L10 3l6.5 3.5v7L10 17l-6.5-3.5v-7zM3.5 6.5L10 10l6.5-3.5M10 10v7",
} as const;

function Icon({ d, className = "h-4 w-4" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d={d} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Round arrow button in the top-right corner of a card
function ArrowLink({ href, label, tone = "light" }: { href: string; label: string; tone?: "light" | "dark" }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
        tone === "dark" ? "bg-white/20 text-white hover:bg-white/30 focus-visible:ring-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      <Icon d={ICONS.arrow} />
    </Link>
  );
}

// Solid pill with the change vs the previous period (green = up, red-orange = down)
function Chip({ pct, show, title }: { pct: number | null; show: boolean; title?: string }) {
  if (!show) return null;
  if (pct === null)
    return (
      <span title="No earlier data to compare" className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
        —
      </span>
    );
  const up = pct >= 0;
  return (
    <span
      title={title}
      className="rounded-full px-3 py-1 text-xs font-bold tabular-nums text-white"
      style={{ backgroundColor: up ? GREEN : ORANGE }}
    >
      {up ? "+" : "−"}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

// Custom dropdown (native <select> menus can't be styled)
function Select<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value) ?? options[0];

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-w-[9rem] items-center justify-between gap-3 rounded-full bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm transition hover:shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
      >
        <span className="truncate">{current.label}</span>
        <svg
          viewBox="0 0 20 20"
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path d="M5 7.5l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 z-30 mt-2 w-[min(15rem,calc(100vw-3rem))] overflow-hidden rounded-3xl bg-white p-1.5 shadow-[0_18px_40px_-12px_rgba(15,23,42,0.35)]"
        >
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <li key={o.value} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                    selected ? "bg-slate-100" : "hover:bg-slate-50"
                  }`}
                >
                  <span className="flex-1">
                    <span className="block text-sm font-medium text-slate-900">{o.label}</span>
                    {o.hint && <span className="block text-xs text-slate-500">{o.hint}</span>}
                  </span>
                  {selected && (
                    <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-slate-900" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M4.5 10.5l3.5 3.5 7.5-8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const Empty = ({ children }: { children: ReactNode }) => (
  <p className="py-6 text-center text-sm text-slate-500">{children}</p>
);

// ---- Global search (product name / product id / order id) -------------------
const MAX_PER_GROUP = 5;

function SearchBox({
  products,
  sales,
  productName,
  platformById,
}: {
  products: Product[];
  sales: Sale[];
  productName: (id: number) => string;
  platformById: Map<number, string>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const needle = query.trim().toLowerCase();

  // Searches ALL products and ALL sales (not limited by the period filter)
  const results = useMemo(() => {
    if (!needle) return { products: [] as Product[], orders: [] as Sale[], productTotal: 0, orderTotal: 0 };
    const p = products.filter(
      (x) => x.product_name.toLowerCase().includes(needle) || String(x.product_id).includes(needle)
    );
    const o = sales
      .filter((s) => s.order_id.toLowerCase().includes(needle))
      .sort((a, b) => byDateDesc(a.Sell_date, b.Sell_date));
    return {
      products: p.slice(0, MAX_PER_GROUP),
      orders: o.slice(0, MAX_PER_GROUP),
      productTotal: p.length,
      orderTotal: o.length,
    };
  }, [needle, products, sales]);

  // Where each match redirects to. The ?search= param lets those pages pre-filter if they support it.
  // Both pages receive exactly what was typed in the dashboard search box
  const typed = encodeURIComponent(query.trim());
  const productHref = (_p: Product) => `/home?search=${typed}`;
  const orderHref = (_s: Sale) => `/sales?search=${typed}`;

  const firstHref = results.products[0]
    ? productHref(results.products[0])
    : results.orders[0]
      ? orderHref(results.orders[0])
      : null;

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const showPopup = open && needle.length > 0;
  const noMatches = results.productTotal === 0 && results.orderTotal === 0;

  return (
    <div ref={wrapRef} className="relative min-w-0 flex-1 sm:w-72 sm:flex-none">
      <label className="relative block">
        <span className="sr-only">Search products, product IDs or order IDs</span>
        <svg
          viewBox="0 0 20 20"
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <circle cx="9" cy="9" r="5.5" />
          <path d="M13.5 13.5L17 17" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && firstHref) {
              router.push(firstHref);
              close();
            }
          }}
          placeholder="Search product, product ID, order ID…"
          autoComplete="off"
          className="w-full rounded-full bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
        />
      </label>

      {showPopup && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-40 mt-2 max-h-[70vh] w-[min(26rem,calc(100vw-1.5rem))] overflow-y-auto rounded-3xl bg-white p-2 shadow-[0_18px_40px_-12px_rgba(15,23,42,0.35)] ring-1 ring-slate-100"
        >
          {noMatches ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">
              No product or order matches &ldquo;{query.trim()}&rdquo;.
            </p>
          ) : (
            <>
              {results.products.length > 0 && (
                <div>
                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Products · {results.productTotal}
                  </p>
                  <ul>
                    {results.products.map((p) => {
                      const low = p.stock_quantity <= (p.reorder_level ?? LOW_STOCK_DEFAULT);
                      return (
                        <li key={`p-${p.id}`} role="option" aria-selected="false">
                          <Link
                            href={productHref(p)}
                            onClick={close}
                            className="flex items-center gap-3 rounded-2xl px-3 py-2.5 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                              <Icon d={ICONS.product} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-slate-900">
                                {titleCase(p.product_name)}
                              </span>
                              <span className="block truncate text-xs text-slate-500">
                                ID {p.product_id} · {titleCase(p.brand_name)} · {titleCase(p.color)}, {p.size}
                              </span>
                            </span>
                            <span
                              className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums text-white"
                              style={{ backgroundColor: low ? ORANGE : GREEN }}
                              title="Stock quantity"
                            >
                              {p.stock_quantity} in stock
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                  {results.productTotal > MAX_PER_GROUP && (
                    <Link
                      href={`/home?search=${encodeURIComponent(query.trim())}`}
                      onClick={close}
                      className="block px-3 py-1.5 text-xs font-medium text-slate-600 hover:underline"
                    >
                      See all {results.productTotal} products
                    </Link>
                  )}
                </div>
              )}

              {results.orders.length > 0 && (
                <div className={results.products.length > 0 ? "mt-1 border-t border-slate-100 pt-1" : ""}>
                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Orders · {results.orderTotal}
                  </p>
                  <ul>
                    {results.orders.map((s) => (
                      <li key={`s-${s.id}`} role="option" aria-selected="false">
                        <Link
                          href={orderHref(s)}
                          onClick={close}
                          className="flex items-center gap-3 rounded-2xl px-3 py-2.5 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                            <Icon d={ICONS.sales} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-slate-900">
                              {s.order_id}
                              {!s.status && (
                                <span
                                  className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                                  style={{ backgroundColor: ORANGE }}
                                >
                                  Cancelled
                                </span>
                              )}
                            </span>
                            <span className="block truncate text-xs text-slate-500">
                              {productName(s.product_id)} · {platformById.get(s.platform_id) ?? `Platform #${s.platform_id}`}
                            </span>
                            <span className="block truncate text-xs text-slate-500">
                              Qty {s.quantity} · {formatDate(s.Sell_date)}
                            </span>
                          </span>
                          <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
                            {money(Number(s.total_amount || 0))}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {results.orderTotal > MAX_PER_GROUP && (
                    <Link
                      href={`/sales?search=${encodeURIComponent(query.trim())}`}
                      onClick={close}
                      className="block px-3 py-1.5 text-xs font-medium text-slate-600 hover:underline"
                    >
                      See all {results.orderTotal} orders
                    </Link>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Sales (green line chart) ----------------------------------------------
type ChartRange = "7d" | "1m" | "6m" | "12m";
const CHART_OPTIONS: { value: ChartRange; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "1m", label: "1 month" },
  { value: "6m", label: "6 months" },
  { value: "12m", label: "12 months" },
];

function buildBuckets(range: ChartRange, sales: Sale[]) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const day = now.getDate();
  const buckets: { label: string; start: Date; end: Date; value: number }[] = [];

  if (range === "7d" || range === "1m") {
    const days = range === "7d" ? 7 : 30;
    for (let i = days - 1; i >= 0; i--) {
      const start = new Date(y, m, day - i);
      const end = new Date(y, m, day - i + 1);
      buckets.push({
        label: range === "7d"
          ? start.toLocaleDateString("en-IN", { weekday: "short" })
          : start.toLocaleDateString("en-IN", { day: "numeric" }),
        start,
        end,
        value: 0,
      });
    }
  } else {
    const n = range === "6m" ? 6 : 12;
    for (let i = n - 1; i >= 0; i--) {
      const start = new Date(y, m - i, 1);
      const end = new Date(y, m - i + 1, 1);
      buckets.push({ label: start.toLocaleDateString("en-IN", { month: "short" }), start, end, value: 0 });
    }
  }

  sales.forEach((s) => {
    if (!s.status) return;
    const t = new Date(s.Sell_date).getTime();
    if (isNaN(t)) return;
    const b = buckets.find((x) => t >= x.start.getTime() && t < x.end.getTime());
    if (b) b.value += Number(s.total_amount || 0);
  });
  return buckets;
}

// Smooth curve through the points (Catmull-Rom converted to cubic beziers)
function smoothPath(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function StatisticsCard({ sales }: { sales: Sale[] }) {
  const [range, setRange] = useState<ChartRange>("7d");
  const [hover, setHover] = useState<number | null>(null);

  const buckets = useMemo(() => buildBuckets(range, sales), [range, sales]);
  const n = buckets.length;
  const max = Math.max(1, ...buckets.map((b) => b.value));
  const total = buckets.reduce((t, b) => t + b.value, 0);
  // Highest point is highlighted by default (the last point if everything is zero)
  const peak = total > 0 ? buckets.findIndex((b) => b.value === max) : n - 1;
  const active = hover ?? peak;
  const pts = buckets.map((b, i) => ({
    x: ((i + 0.5) / n) * 100,
    y: b.value > 0 ? 85 - (b.value / max) * 65 : 85,
  }));
  const rangeLabel = CHART_OPTIONS.find((o) => o.value === range)!.label;

  return (
    <section className="rounded-[28px] p-5 text-white shadow-[0_14px_30px_-18px_rgba(10,159,88,0.8)]" style={{ backgroundColor: GREEN }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Sales</h2>
          <p className="mt-3 text-4xl font-medium tracking-tight tabular-nums">{money(total)}</p>
          <p className="mt-1 text-xs">Completed sales · last {rangeLabel}</p>
        </div>
        <ArrowLink href="/sales" label="Open sales" tone="dark" />
      </div>

      <div className="relative mt-12 h-40" onMouseLeave={() => setHover(null)}>
        <div className="absolute inset-0 flex border-r border-white/25">
          {buckets.map((b, i) => {
            const isActive = i === active;
            return (
              <button
                key={`${b.label}-${i}`}
                type="button"
                aria-label={`${b.label}: ${money(b.value)}`}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                className="relative h-full flex-1 border-l border-white/25 outline-none focus-visible:bg-white/10"
              >
                {isActive && (
                  <>
                    <span
                      className="absolute left-1/2 w-3.5 -translate-x-1/2 rounded-full bg-gradient-to-b from-white/70 to-white/10"
                      style={{ top: `${pts[i].y}%`, bottom: 0 }}
                    />
                    <span
                      className="absolute left-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
                      style={{ top: `${pts[i].y}%` }}
                    />
                    <span
                      className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-900 shadow"
                      style={{ top: `${pts[i].y}%`, transform: "translate(-50%, calc(-100% - 12px))" }}
                    >
                      {money(b.value)}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d={smoothPath(pts)} fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>

      <div className="mt-2 flex text-[11px]">
        {buckets.map((b, i) => (
          <span key={`${b.label}-${i}`} className="flex-1 text-center">
            {n > 8 && i % 2 === 1 ? "" : b.label}
          </span>
        ))}
      </div>

      <div className="mt-4 flex gap-2" role="group" aria-label="Sales chart range">
        {CHART_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => {
              setRange(o.value);
              setHover(null);
            }}
            aria-pressed={range === o.value}
            className={`rounded-full px-3 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${
              range === o.value ? "bg-white text-slate-900" : "bg-white/20 text-white hover:bg-white/30"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </section>
  );
}

// ---- Page ------------------------------------------------------------------
export default function DashboardPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [returns, setReturns] = useState<Return[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string[]>([]);
  const [period, setPeriod] = useState<Period>("this_month");

  const load = useCallback(async () => {
    setLoading(true);
    const keys = Object.keys(ENDPOINTS) as Key[];

    const results = await Promise.allSettled(
      keys.map(async (k) => {
        const res = await fetch(`${API}/${ENDPOINTS[k]}/`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
    );

    const out = {} as Record<Key, unknown[]>;
    const bad: string[] = [];
    results.forEach((r, i) => {
      if (r.status === "fulfilled" && Array.isArray(r.value)) out[keys[i]] = r.value;
      else {
        out[keys[i]] = [];
        bad.push(keys[i]);
      }
    });

    setProducts(out.products as Product[]);
    setSales(out.sales as Sale[]);
    setPurchases(out.purchases as Purchase[]);
    setReturns(out.returns as Return[]);
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
    const range = getRange(period);
    const prev = getPrevRange(period);
    const productById = new Map(products.map((p) => [p.id, p]));
    const platformById = new Map(platforms.map((p) => [p.id, p.platform_name]));
    const supplierById = new Map(suppliers.map((s) => [s.id, s.supplier_name]));
    const productName = (id: number) => {
      const p = productById.get(id);
      return p ? `${titleCase(p.product_name)} (${titleCase(p.color)}, ${p.size})` : `Product #${id}`;
    };

    // Period-filtered data (sales by Sell_date, purchases by purchase_date, returns by return_date)
    const salesInPeriod = sales.filter((s) => inRange(s.Sell_date, range));
    const purchasesInPeriod = purchases.filter((p) => inRange(p.purchase_date, range));
    const returnsInPeriod = returns.filter((r) => inRange(r.return_date, range));

    // Only completed sales (status = true) count toward totals
    const completed = salesInPeriod.filter((s) => s.status);
    const salesTotal = completed.reduce((t, s) => t + Number(s.total_amount || 0), 0);
    const soldQuantity = completed.reduce((t, s) => t + Number(s.quantity || 0), 0);
    const purchasesTotal = purchasesInPeriod.reduce((t, p) => t + Number(p.total_amount || 0), 0);
    const returnQuantity = returnsInPeriod.reduce((t, r) => t + Number(r.quantity || 0), 0);

    // Previous period totals, for the change chips
    let salesPct: number | null = null;
    let purchasesPct: number | null = null;
    let soldPct: number | null = null;
    if (prev) {
      const prevCompleted = sales.filter((s) => s.status && inRange(s.Sell_date, prev.range));
      const prevSales = prevCompleted.reduce((t, s) => t + Number(s.total_amount || 0), 0);
      const prevSold = prevCompleted.reduce((t, s) => t + Number(s.quantity || 0), 0);
      const prevPurchases = purchases
        .filter((p) => inRange(p.purchase_date, prev.range))
        .reduce((t, p) => t + Number(p.total_amount || 0), 0);
      salesPct = pctChange(salesTotal, prevSales);
      soldPct = pctChange(soldQuantity, prevSold);
      purchasesPct = pctChange(purchasesTotal, prevPurchases);
    }

    const lowStock = products
      .filter((p) => p.status && p.stock_quantity <= (p.reorder_level ?? LOW_STOCK_DEFAULT))
      .sort((a, b) => a.stock_quantity - b.stock_quantity);

    const platformTotals = new Map<number, number>();
    completed.forEach((s) =>
      platformTotals.set(s.platform_id, (platformTotals.get(s.platform_id) ?? 0) + Number(s.total_amount))
    );
    const platformRows = Array.from(platformTotals.entries())
      .map(([id, value]) => ({
        id,
        name: platformById.get(id) ?? `Platform #${id}`,
        value,
        share: salesTotal > 0 ? Math.round((value / salesTotal) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value);

    return {
      label: periodLabel(period),
      compareLabel: prev?.label,
      hasCompare: Boolean(prev),
      productName,
      platformById,
      supplierById,
      salesTotal,
      salesPct,
      soldQuantity,
      soldPct,
      purchasesTotal,
      purchasesPct,
      returnQuantity,
      stockUnits: products.reduce((t, p) => t + p.stock_quantity, 0),
      activeSuppliers: suppliers.filter((s) => s.status).length,
      lowStockCount: lowStock.length,
      lowStock,
      platformRows,
      recentSales: salesInPeriod
        .sort((a, b) => byDateDesc(a.Sell_date, b.Sell_date))
        .slice(0, 5),
      recentPurchases: purchasesInPeriod
        .sort((a, b) => byDateDesc(a.purchase_date, b.purchase_date))
        .slice(0, 5),
    };
  }, [period, products, sales, purchases, returns, suppliers, platforms]);

  const returnsFailed = failed.includes("returns");
  const periodOptions = PERIOD_OPTIONS.map((o) => ({
    ...o,
    hint: o.value === "all_time" ? "Every record so far" : periodLabel(o.value),
  }));

  // Platform pills: best sellers first; falls back to the platform list when nothing sold yet
  const pillSource = d.platformRows.length
    ? d.platformRows.slice(0, 4)
    : platforms.slice(0, 4).map((p) => ({ id: p.id, name: p.platform_name, value: 0, share: 0 }));
  const topThree = d.platformRows.slice(0, 3);

  return (
    <div className="min-h-screen min-w-0 flex-1 bg-[#eaf2ff] p-3 sm:p-6">
      <main className="mx-auto max-w-[1320px]">
        {/* Extra bottom margin keeps the cards clear of the header */}
        <header className="relative z-20 mb-10 flex flex-wrap items-center justify-between gap-3 sm:mb-14">
          <h1 className="text-3xl font-semibold text-slate-900">Dashboard</h1>
          <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:flex-nowrap">
            <SearchBox
              products={products}
              sales={sales}
              productName={d.productName}
              platformById={d.platformById}
            />
            <Select value={period} options={periodOptions} onChange={setPeriod} />
            <button
              onClick={load}
              disabled={loading}
              className="shrink-0 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-[0_8px_20px_-8px_rgba(0,0,0,0.5)] transition hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 disabled:opacity-50"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </header>

        {failed.length > 0 && (
          <div role="alert" className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">
            Couldn&apos;t load: {failed.join(", ")}. Check that your backend is running; the numbers
            below may be incomplete.
          </div>
        )}

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
            {[0, 1, 2, 3].map((c) => (
              <div key={c} className="space-y-4">
                <div className="h-44 animate-pulse rounded-[28px] bg-white/60" />
                <div className="h-64 animate-pulse rounded-[28px] bg-white/60" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-16">
            {/* First view: only the cards, vertically centred in the visible area */}
            <div className="flex flex-col justify-center lg:min-h-[calc(100vh-12rem)]">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* ---------- Column 1: inventory + purchases ---------- */}
                <div className="min-w-0 space-y-4">
                  <Link
                    href="/home"
                    className="block rounded-[28px] p-5 text-white shadow-[0_14px_30px_-18px_rgba(31,108,255,0.45)] transition hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
                    style={{ backgroundColor: BLUE }}
                  >
                    <p className="text-lg font-bold tracking-wide">Inventory</p>
                    <p className="mt-4 text-sm">Units in stock</p>
                    <p className="mt-1 text-4xl font-medium tracking-tight tabular-nums">
                      {d.stockUnits.toLocaleString("en-IN")}
                    </p>
                    <div className="mt-6 flex items-center justify-between text-sm">
                      <span>{products.length} products</span>
                      <span>{categories.length} categories</span>
                    </div>
                  </Link>

                  <section className={CARD}>
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-sm font-medium text-slate-900">Purchases</h2>
                      <Chip pct={d.purchasesPct} show={d.hasCompare} title={d.compareLabel} />
                    </div>
                    <p className="mt-10 text-4xl font-medium tracking-tight tabular-nums text-slate-900">
                      {money(d.purchasesTotal)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{d.label}</p>
                    <div className="mt-6 rounded-3xl bg-[#f7f7f7] p-4 ring-1 ring-slate-100">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-slate-900">Suppliers</p>
                          <p className="text-xs text-slate-500">{d.activeSuppliers} active</p>
                        </div>
                        <ArrowLink href="/supplier" label="Open suppliers" />
                      </div>
                      <div className="mt-6 flex items-center">
                        {suppliers.length === 0 ? (
                          <p className="text-xs text-slate-500">No suppliers yet.</p>
                        ) : (
                          <>
                            {suppliers.slice(0, 3).map((s, i) => (
                              <span
                                key={s.id}
                                title={s.supplier_name}
                                className={`-ml-3 flex h-12 w-12 items-center justify-center rounded-full border-2 border-white text-sm font-bold first:ml-0 ${TINTS[i % TINTS.length]}`}
                              >
                                {initials(s.supplier_name)}
                              </span>
                            ))}
                            {suppliers.length > 3 && (
                              <span
                                className="-ml-3 flex h-12 w-12 items-center justify-center rounded-full border-2 border-white text-sm font-bold text-white"
                                style={{ backgroundColor: GREEN }}
                              >
                                +{suppliers.length - 3}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </section>
                </div>

                {/* ---------- Column 2: items sold + analytics + top platforms ---------- */}
                <div className="min-w-0 space-y-4">
                  <section
                    className="flex items-center justify-between gap-3 rounded-[28px] p-5 text-slate-900 shadow-[0_14px_30px_-18px_rgba(0,0,0,0.18)]"
                    style={{ backgroundColor: WHITE }}
                  >
                    <div>
                      <h2 className="text-sm font-medium text-slate-800">Items sold</h2>
                      <p className="mt-1 text-2xl font-semibold tabular-nums">
                        {d.soldQuantity.toLocaleString("en-IN")} units
                      </p>
                    </div>
                    <Chip pct={d.soldPct} show={d.hasCompare} title={d.compareLabel} />
                  </section>

                  <section className={CARD}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-medium text-slate-900">Analytics</h2>
                        <p className="mt-3 text-4xl font-medium tracking-tight tabular-nums text-slate-900">
                          {money(d.salesTotal)}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <Chip pct={d.salesPct} show={d.hasCompare} title={d.compareLabel} />
                          <span className="text-xs text-slate-500">{d.compareLabel ?? d.label}</span>
                        </div>
                      </div>
                      <ArrowLink href="/sales" label="Open sales" />
                    </div>

                    {topThree.length === 0 ? (
                      <Empty>No completed sales in this period.</Empty>
                    ) : (
                      <div className="mt-5 grid grid-cols-2 gap-3">
                        {topThree.map((r, i) => (
                          <div key={r.id} className="min-w-0">
                            <div className="relative h-32 overflow-hidden rounded-2xl" style={HATCH}>
                              <div
                                className="absolute inset-x-0 bottom-0 rounded-2xl transition-all"
                                style={{
                                  height: `${Math.max(r.share, r.value > 0 ? 8 : 0)}%`,
                                  backgroundColor: i === 0 ? GREEN : LIGHT_GREEN,
                                }}
                              >
                                <span
                                  className={`absolute left-3 top-3 text-sm font-semibold ${i === 0 ? "text-white" : "text-slate-900"}`}
                                >
                                  {r.share}%
                                </span>
                              </div>
                            </div>
                            <p className="mt-2 truncate text-xs font-medium text-slate-700">{r.name}</p>
                            <p className="truncate text-xs tabular-nums text-slate-500">{money(r.value)}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-5 border-t border-slate-100 pt-4">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-medium text-slate-900">Top platforms</h3>
                        <ArrowLink href="/platforms" label="Open platforms" />
                      </div>
                      {pillSource.length === 0 ? (
                        <Empty>No platforms yet.</Empty>
                      ) : (
                        <ul className="mt-3 grid grid-cols-2 gap-2">
                          {pillSource.map((r, i) => (
                            <li
                              key={r.id}
                              className="flex min-w-0 items-center gap-2 rounded-2xl border border-slate-200 px-2.5 py-2"
                            >
                              <span
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${TINTS[i % TINTS.length]}`}
                                aria-hidden="true"
                              >
                                {initials(r.name)}
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-xs font-medium text-slate-900">{r.name}</span>
                                <span className="block truncate text-[10px] text-slate-500">
                                  {r.value > 0 ? `${money(r.value)} · ${r.share}%` : "No sales yet"}
                                </span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </section>
                </div>

                {/* ---------- Column 3: statistics + quick links ---------- */}
                <div className="min-w-0 space-y-4">
                  <StatisticsCard sales={sales} />

                  <section className={CARD}>
                    <h2 className="text-sm font-medium text-slate-900">Quick links</h2>
                    <p className="text-xs text-slate-500">Jump to a page</p>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {[
                        { href: "/sales", label: "Sales", icon: ICONS.sales },
                        { href: "/purchase", label: "Purchases", icon: ICONS.purchase },
                        { href: "/home", label: "Products", icon: ICONS.product },
                      ].map((q) => (
                        <Link
                          key={q.href}
                          href={q.href}
                          className="flex h-24 flex-col items-center justify-center gap-2 rounded-2xl bg-[#eaf2ff] text-xs font-medium text-slate-800 ring-1 ring-slate-100 transition hover:bg-white hover:ring-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                        >
                          <Icon d={q.icon} className="h-5 w-5 text-slate-700" />
                          {q.label}
                        </Link>
                      ))}
                    </div>
                  </section>
                </div>

                {/* ---------- Column 4: returns + low stock ---------- */}
                <div className="min-w-0 space-y-4">
                  <Link
                    href="/returns"
                    className="block rounded-[28px] p-5 text-white shadow-[0_14px_30px_-18px_rgba(217,45,45,0.9)] transition hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
                    style={{ backgroundColor: ORANGE }}
                  >
                    <p className="text-sm text-white/85">Returns</p>
                    <p className="mt-1 text-3xl font-semibold tabular-nums">
                      {returnsFailed ? "—" : d.returnQuantity.toLocaleString("en-IN")}
                    </p>
                    <p className="mt-1 text-xs text-white/85">Units returned · {d.label}</p>
                  </Link>

                  <section className={CARD}>
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex" aria-hidden="true">
                        <span className="h-8 w-8 rounded-full" style={{ backgroundColor: ORANGE }} />
                        <span className="-ml-3 h-8 w-8 rounded-full bg-blue-400 mix-blend-multiply" />
                      </span>
                      <Link href="/home" className="text-xs font-medium text-slate-700 hover:underline">
                        View products
                      </Link>
                    </div>
                    <p className="mt-4 text-sm text-slate-500">Low stock items</p>
                    <p className="mt-1 text-4xl font-medium tracking-tight tabular-nums text-slate-900">
                      {d.lowStockCount}
                    </p>
                    <p className="text-xs text-slate-500">{d.lowStockCount > 0 ? "Need restocking" : "All good"}</p>

                    {d.lowStock.length > 0 && (
                      <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
                        {d.lowStock.slice(0, 5).map((p) => (
                          <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-slate-900">
                                {titleCase(p.product_name)}
                              </span>
                              <span className="block truncate text-xs text-slate-500">
                                {titleCase(p.brand_name)} · {p.size}
                              </span>
                            </span>
                            <span
                              className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums text-white"
                              style={{ backgroundColor: ORANGE }}
                            >
                              {p.stock_quantity}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>
              </div>
            </div>

            {/* ---------- Tables (below the fold: appear on scroll) ---------- */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <section className={CARD}>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-slate-900">Recent sales</h2>
                  <Link href="/sales" className="text-sm font-medium text-slate-700 hover:underline">
                    View all
                  </Link>
                </div>
                {d.recentSales.length === 0 ? (
                  <Empty>No sales recorded in this period.</Empty>
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
                                <span
                                  className="ml-2 rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
                                  style={{ backgroundColor: ORANGE }}
                                >
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
              </section>

              <section className={CARD}>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-slate-900">Recent purchases</h2>
                  <Link href="/purchase" className="text-sm font-medium text-slate-700 hover:underline">
                    View all
                  </Link>
                </div>
                {d.recentPurchases.length === 0 ? (
                  <Empty>No purchases recorded in this period.</Empty>
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
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}