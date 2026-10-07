"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const API = "http://127.0.0.1:8000/product";
const MAX_ROWS = 2000; // keep in sync with MAX_ROWS in the Django view
const PREVIEW_LIMIT = 300; // rows drawn in the preview table
const MAX_INT = 2147483647; // PositiveIntegerField limit

/* ----------------------------- Columns ----------------------------- */

// Columns written into the template file
const COLUMNS = [
  "order_id",
  "platform_id",
  "product_id",
  "quantity",
  "selling_price",
  "Sell_date",
  "status",
] as const;

// Accepted in a file but not in the template: the business product code,
// used only when product_id is blank
type ColumnKey = (typeof COLUMNS)[number] | "product_code";
const ALL_COLUMNS: ColumnKey[] = [...COLUMNS, "product_code"];

// Sell_date and status can be left out of the file; product_id can be replaced by product_code
const REQUIRED: ColumnKey[] = ["order_id", "platform_id", "quantity", "selling_price"];

// Other header names that are accepted (after lower-casing and replacing spaces with "_")
const ALIASES: Record<string, ColumnKey> = {
  order: "order_id",
  orderid: "order_id",
  platform: "platform_id",
  platformid: "platform_id",
  productid: "product_id",
  product: "product_id",
  code: "product_code",
  productcode: "product_code",
  qty: "quantity",
  units: "quantity",
  price: "selling_price",
  sell_price: "selling_price",
  sale_price: "selling_price",
  selling: "selling_price",
  sell_date: "Sell_date",
  selldate: "Sell_date",
  sale_date: "Sell_date",
  sold_on: "Sell_date",
  date: "Sell_date",
  completed: "status",
  is_completed: "status",
};

const COLUMN_HELP: { key: string; note: string }[] = [
  { key: "order_id", note: "text, e.g. AMZ-1001" },
  { key: "platform_id", note: "ID of an existing platform" },
  { key: "product_id", note: "database ID of the product (the ID column on the Products page)" },
  { key: "quantity", note: "whole number, at least 1" },
  { key: "selling_price", note: "price per unit, up to 2 decimals" },
  { key: "Sell_date", note: "optional, e.g. 2026-10-05 10:30 (blank = now)" },
  { key: "status", note: "optional: TRUE/FALSE or Completed/Cancelled (blank = Completed)" },
  { key: "product_code", note: "optional extra column: the business Product ID, used only when product_id is blank" },
];

/* ------------------------------ Types ------------------------------ */

type ProductInfo = {
  id: number;
  product_id: number;
  product_name: string;
  brand_name: string;
  size: string;
  stock_quantity?: number;
};

type ExistingSale = { order_id: string; product_id: number };

type Payload = {
  order_id: string;
  platform_id: number;
  product_id: number;
  quantity: number;
  selling_price: string;
  Sell_date?: string;
  status: boolean;
};

type ParsedRow = {
  line: number; // row number in the spreadsheet (header = 1)
  cells: Record<ColumnKey, string>;
  productLabel: string;
  payload: Payload | null;
  error: string | null;
};

type RowIssue = { line: number | null; message: string };
type Result = { created: number; skipped: number; issues: RowIssue[] };

/* ----------------------------- CSV reading ----------------------------- */

async function readFileText(file: File): Promise<{ text: string; notice: string | null }> {
  const buffer = await file.arrayBuffer();
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    return { text, notice: null };
  } catch {
    // Not valid UTF-8: typical for Excel's "CSV (MS-DOS)" and plain "CSV" exports
    const text = new TextDecoder("windows-1252").decode(buffer);
    return {
      text,
      notice:
        "This file isn't UTF-8 (probably Excel's “CSV (MS-DOS)” or plain “CSV”), so it was read as Windows-1252. " +
        "Plain English text and numbers are unaffected, but accented letters or symbols like ₹ may look wrong. " +
        "If they do, save the file as “CSV UTF-8” instead.",
    };
  }
}

function detectDelimiter(text: string) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const counts = [",", ";", "\t"].map((d) => ({ d, n: firstLine.split(d).length - 1 }));
  counts.sort((a, b) => b.n - a.n);
  return counts[0].n > 0 ? counts[0].d : ",";
}

// Small CSV parser: quoted fields, "" escapes, commas/newlines inside quotes, CRLF or LF
function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"' && field === "") {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Ignore completely blank lines (Excel often adds empty rows at the end)
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/* ----------------------------- Validation ----------------------------- */

const normalizeHeader = (h: string) =>
  h.replace(/^﻿/, "").trim().toLowerCase().replace(/[\s\-.]+/g, "_");

function parseWhole(s: string): number | null {
  const t = s.replace(/[,\s]/g, "");
  if (!/^\d+(\.0+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) && n <= MAX_INT ? n : null;
}

function parseMoney(s: string): { value: string } | { error: string } {
  const t = s.replace(/[₹$,\s]/g, "");
  if (t === "") return { error: "is required" };
  if (!/^\d+(\.\d+)?$/.test(t)) return { error: "must be a number" };
  const [int, dec = ""] = t.split(".");
  if (dec.length > 2 && /[1-9]/.test(dec.slice(2))) {
    return { error: "can have at most 2 decimal places" };
  }
  if (int.length > 15) return { error: "is too large" };
  return { value: `${int}.${dec.slice(0, 2).padEnd(2, "0")}` };
}

function parseStatus(s: string): boolean | null {
  const t = s.trim().toLowerCase();
  if (t === "") return true; // blank means Completed
  if (["true", "yes", "y", "1", "completed", "complete"].includes(t)) return true;
  if (["false", "no", "n", "0", "cancelled", "canceled"].includes(t)) return false;
  return null;
}

function parseDate(s: string): { value: string | null } | { error: string } {
  if (s === "") return { value: null }; // blank means "now" (the server fills it in)
  const d = new Date(s);
  if (isNaN(d.getTime())) return { error: "Sell_date isn't a valid date (try 2026-10-05 10:30)" };
  return { value: d.toISOString() };
}

const productText = (p: ProductInfo) => `${p.product_name} · ${p.brand_name} · ${p.size}`;

function analyze(table: string[][], products: ProductInfo[], existing: ExistingSale[]) {
  const [headerRow, ...dataRows] = table;

  const headerMap = new Map<ColumnKey, number>();
  const ignored: string[] = [];
  headerRow.forEach((h, i) => {
    const norm = normalizeHeader(h);
    if (!norm) return;
    const exact = ALL_COLUMNS.find((c) => c.toLowerCase() === norm);
    const key = exact ?? ALIASES[norm];
    if (key && !headerMap.has(key)) headerMap.set(key, i);
    else ignored.push(h.trim());
  });
  const missing: string[] = REQUIRED.filter((k) => !headerMap.has(k));
  if (!headerMap.has("product_id") && !headerMap.has("product_code")) {
    missing.push("product_id");
  }

  const haveProducts = products.length > 0;
  const byId = new Map(products.map((p) => [p.id, p]));
  const byCode = new Map(products.map((p) => [p.product_id, p]));
  const existingKeys = new Set(existing.map((s) => `${s.order_id}|${s.product_id}`));
  const seen = new Map<string, number>(); // order+product -> first row it appeared in
  const remaining = new Map<number, number>(); // running stock per product

  const rows: ParsedRow[] = dataRows.map((r, i) => {
    const cells = {} as Record<ColumnKey, string>;
    ALL_COLUMNS.forEach((k) => {
      const idx = headerMap.get(k);
      cells[k] = idx === undefined ? "" : (r[idx] ?? "").trim();
    });
    return { line: i + 2, cells, productLabel: "", payload: null, error: null };
  });

  rows.forEach((row) => {
    const c = row.cells;
    const errs: string[] = [];

    // order_id
    if (!c.order_id) errs.push("order_id is required");
    else if (c.order_id.length > 200) errs.push("order_id is too long (max 200 characters)");

    // platform_id (the server checks that it exists)
    const platformId = parseWhole(c.platform_id);
    if (platformId === null) errs.push("platform_id must be a whole number");

    // product: product_id wins, product_code is the fallback
    let product: ProductInfo | null = null;
    row.productLabel = c.product_id || (c.product_code ? `code ${c.product_code}` : "");
    if (c.product_id !== "") {
      const pid = parseWhole(c.product_id);
      if (pid === null) errs.push("product_id must be a whole number");
      else if (haveProducts) {
        product = byId.get(pid) ?? null;
        if (!product) errs.push(`product ${pid} doesn't exist`);
      } else {
        product = { id: pid, product_id: pid, product_name: "", brand_name: "", size: "" };
      }
    } else if (c.product_code !== "") {
      const code = parseWhole(c.product_code);
      if (code === null) errs.push("product_code must be a whole number");
      else if (!haveProducts) errs.push("products couldn't be loaded, so use product_id instead");
      else {
        product = byCode.get(code) ?? null;
        if (!product) errs.push(`no product has product_code ${code}`);
      }
    } else {
      errs.push("product_id is required");
    }
    if (product && product.product_name) row.productLabel = `${product.id} · ${productText(product)}`;

    // quantity
    const quantity = parseWhole(c.quantity);
    if (quantity === null || quantity < 1) errs.push("quantity must be a whole number of at least 1");

    // selling_price
    const price = parseMoney(c.selling_price);
    if ("error" in price) errs.push(`selling_price ${price.error}`);

    // Sell_date
    const date = parseDate(c.Sell_date);
    if ("error" in date) errs.push(date.error);

    // status
    const status = parseStatus(c.status);
    if (status === null) errs.push("status must be TRUE/FALSE or Completed/Cancelled");

    // Same checks the server makes, in the same order. Rows that already have a
    // problem don't count against stock or duplicates, just like on the server.
    let key: string | null = null;
    if (errs.length === 0 && product && quantity !== null) {
      key = `${c.order_id}|${product.id}`;
      if (existingKeys.has(key)) {
        errs.push("a sale with this order_id and product already exists");
      } else if (seen.has(key)) {
        errs.push(`this order_id and product are repeated (see row ${seen.get(key)})`);
      } else if (typeof product.stock_quantity === "number") {
        const left = remaining.get(product.id) ?? product.stock_quantity;
        if (quantity > left) {
          errs.push(`not enough stock: ${left} left, ${quantity} needed`);
        } else {
          remaining.set(product.id, left - quantity);
        }
      }
      if (errs.length === 0) seen.set(key, row.line);
    }

    if (
      errs.length === 0 &&
      product &&
      platformId !== null &&
      quantity !== null &&
      status !== null &&
      !("error" in price) &&
      !("error" in date)
    ) {
      row.payload = {
        order_id: c.order_id,
        platform_id: platformId,
        product_id: product.id,
        quantity,
        selling_price: price.value,
        ...(date.value ? { Sell_date: date.value } : {}),
        status,
      };
    } else {
      row.error = errs.join("; ");
    }
  });

  return { missing, ignored, rows };
}

function downloadTemplate() {
  // The BOM makes Excel open the file as UTF-8
  const blob = new Blob(["﻿" + COLUMNS.join(",") + "\r\n"], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sales_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------ Component ------------------------------ */

export default function BulkUploadSalesModal({
  open,
  onClose,
  products,
  existingSales,
  onUploaded,
}: {
  open: boolean;
  onClose: () => void;
  products: ProductInfo[];
  existingSales: ExistingSale[];
  onUploaded: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [table, setTable] = useState<string[][] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const [skipInvalid, setSkipInvalid] = useState(false);
  const [onlyProblems, setOnlyProblems] = useState(true);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [serverIssues, setServerIssues] = useState<RowIssue[]>([]);
  const [result, setResult] = useState<Result | null>(null);

  const analysis = useMemo(
    () => (table && table.length > 0 ? analyze(table, products, existingSales) : null),
    [table, products, existingSales]
  );

  const validCount = analysis ? analysis.rows.filter((r) => r.payload).length : 0;
  const invalidCount = analysis ? analysis.rows.length - validCount : 0;
  const tooMany = analysis ? analysis.rows.length > MAX_ROWS : false;

  const reset = () => {
    setFileName(null);
    setNotice(null);
    setTable(null);
    setParseError(null);
    setSkipInvalid(false);
    setOnlyProblems(true);
    setUploadError(null);
    setServerIssues([]);
    setResult(null);
  };

  const close = () => {
    if (uploading) return;
    reset();
    onClose();
  };

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !uploading) {
        reset();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, uploading, onClose]);

  const handleFile = async (file: File) => {
    reset();
    setFileName(file.name);
    try {
      const { text, notice } = await readFileText(file);
      const parsed = parseCsv(text, detectDelimiter(text));
      if (parsed.length === 0) {
        setParseError("The file is empty.");
        return;
      }
      if (parsed.length === 1) {
        setParseError("The file has a header row but no sales.");
        return;
      }
      setNotice(notice);
      setTable(parsed);
    } catch {
      setParseError("Couldn't read that file. Make sure it is a CSV file.");
    }
  };

  const mapIssues = (list: unknown, sent: ParsedRow[]): RowIssue[] =>
    Array.isArray(list)
      ? list.map((e) => {
          const item = e as { row?: number; message?: string };
          const line = typeof item.row === "number" ? sent[item.row - 1]?.line ?? null : null;
          return { line, message: String(item.message ?? "Invalid row") };
        })
      : [];

  const handleUpload = async () => {
    if (!analysis) return;
    const sent = analysis.rows.filter((r) => r.payload);
    if (sent.length === 0) return;

    setUploading(true);
    setUploadError(null);
    setServerIssues([]);
    try {
      const res = await fetch(
        `${API}/bulk_add_sales/${skipInvalid ? "?skip_invalid=true" : ""}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sent.map((r) => r.payload)),
        }
      );

      let body: Record<string, unknown> | null = null;
      try {
        body = await res.json();
      } catch {
        /* response wasn't JSON */
      }

      if (!res.ok) {
        setServerIssues(mapIssues(body?.errors, sent));
        const message = body?.message ?? body?.error;
        setUploadError(
          message
            ? String(message)
            : res.status === 404
            ? "The bulk_add_sales endpoint wasn't found (404). Check your urls.py."
            : `Server responded with ${res.status}`
        );
        return;
      }

      const notSent: RowIssue[] = analysis.rows
        .filter((r) => r.error)
        .map((r) => ({ line: r.line, message: r.error as string }));
      setResult({
        created: Number(body?.created ?? sent.length),
        skipped: Number(body?.skipped ?? 0) + notSent.length,
        issues: [...notSent, ...mapIssues(body?.errors, sent)],
      });
      onUploaded(); // refresh the sales table (and stock) behind the popup
    } catch (e) {
      setUploadError(
        e instanceof Error ? `Couldn't reach the server. ${e.message}` : "Couldn't reach the server."
      );
    } finally {
      setUploading(false);
    }
  };

  if (!open) return null;

  const canUpload =
    !!analysis &&
    analysis.missing.length === 0 &&
    !tooMany &&
    validCount > 0 &&
    (skipInvalid || invalidCount === 0) &&
    !uploading;

  const shownRows = analysis
    ? (onlyProblems && invalidCount > 0
        ? analysis.rows.filter((r) => r.error)
        : analysis.rows
      ).slice(0, PREVIEW_LIMIT)
    : [];
  const shownTotal = analysis
    ? onlyProblems && invalidCount > 0
      ? invalidCount
      : analysis.rows.length
    : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-sales-title"
        className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                className="h-6 w-6"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 16V4m0 0L8 8m4-4 4 4M5 14v3a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-3"
                />
              </svg>
            </div>

            <div>
              <h2 id="bulk-sales-title" className="text-xl font-bold tracking-tight text-slate-900">
                Bulk upload sales
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Import multiple sales records quickly using a CSV file.
              </p>
            </div>
          </div>

          <button
            onClick={close}
            disabled={uploading}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-5 overflow-y-auto bg-slate-50/70 px-6 py-6">
          {result ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center">
              <div className="w-full max-w-xl rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    className="h-8 w-8"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 4 4L19 6" />
                  </svg>
                </div>

                <h3 className="mt-5 text-xl font-bold text-slate-900">Upload completed</h3>
                <p className="mt-2 text-sm text-slate-500">
                  Your sales data has been processed successfully.
                </p>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-emerald-50 px-4 py-4">
                    <p className="text-2xl font-bold text-emerald-700">{result.created}</p>
                    <p className="mt-1 text-xs font-medium text-emerald-700">Sales added</p>
                  </div>
                  <div className="rounded-xl bg-amber-50 px-4 py-4">
                    <p className="text-2xl font-bold text-amber-700">{result.skipped}</p>
                    <p className="mt-1 text-xs font-medium text-amber-700">Rows skipped</p>
                  </div>
                </div>

                {result.issues.length > 0 && (
                  <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-left">
                    <p className="text-sm font-semibold text-red-800">Rows requiring attention</p>
                    <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto text-sm text-red-700">
                      {result.issues.map((i, n) => (
                        <li key={n}>
                          <span className="font-semibold">
                            {i.line ? `Row ${i.line}:` : "Row:"}
                          </span>{" "}
                          {i.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Step 1 */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    1
                  </span>
                  <div>
                    <h3 className="font-semibold text-slate-900">Select CSV file</h3>
                    <p className="text-sm text-slate-500">
                      Upload a CSV exported from Excel or another spreadsheet.
                    </p>
                  </div>
                </div>

                <input
                  ref={fileInput}
                  type="file"
                  accept=".csv,.txt,text/csv"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                    e.target.value = "";
                  }}
                />

                <div className="rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/50 p-6 transition hover:border-blue-300 hover:bg-blue-50">
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm ring-1 ring-blue-100">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.8}
                        className="h-6 w-6"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 16V4m0 0L8 8m4-4 4 4M5 14v3a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-3"
                        />
                      </svg>
                    </div>

                    <p className="mt-3 text-sm font-semibold text-slate-800">
                      {fileName ? fileName : "Choose a CSV file to get started"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      CSV, CSV UTF-8, or CSV (MS-DOS)
                    </p>

                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      <button
                        onClick={() => fileInput.current?.click()}
                        disabled={uploading}
                        className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50"
                      >
                        {fileName ? "Choose another file" : "Choose CSV file"}
                      </button>

                      <button
                        onClick={downloadTemplate}
                        className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        <span className="inline-flex items-center gap-2">
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1.8}
                            className="h-4 w-4"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 4v11m0 0 4-4m-4 4-4-4M5 20h14"
                            />
                          </svg>
                          Download template
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                  <summary className="cursor-pointer select-none font-semibold text-slate-700">
                    What should the file look like?
                  </summary>

                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    One sale per row with a header row. In Excel use Save As → CSV (Comma delimited),
                    CSV UTF-8, or CSV (MS-DOS). Column order does not matter. Any total_amount column
                    is ignored because it is always calculated.
                  </p>

                  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {COLUMN_HELP.map((c) => (
                      <div key={c.key} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <code className="font-semibold text-blue-700">{c.key}</code>
                        <span className="ml-2 text-slate-500">— {c.note}</span>
                      </div>
                    ))}
                  </div>
                </details>
              </div>

              {parseError && (
                <div
                  role="alert"
                  className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                >
                  <span className="mt-0.5 font-bold">!</span>
                  <p>{parseError}</p>
                </div>
              )}

              {notice && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <span className="mt-0.5 font-bold">!</span>
                  <p>{notice}</p>
                </div>
              )}

              {/* Step 2 */}
              {analysis && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-5 flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                      2
                    </span>
                    <div>
                      <h3 className="font-semibold text-slate-900">Review imported data</h3>
                      <p className="text-sm text-slate-500">
                        Check validation results before uploading.
                      </p>
                    </div>
                  </div>

                  {analysis.missing.length > 0 && (
                    <div
                      role="alert"
                      className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                    >
                      These required columns are missing:{" "}
                      <strong>{analysis.missing.join(", ")}</strong>. Download the template to see
                      the expected headers.
                    </div>
                  )}

                  {analysis.ignored.length > 0 && (
                    <div className="mb-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      <span className="font-medium text-slate-700">Ignored columns:</span>{" "}
                      {analysis.ignored.join(", ")}
                    </div>
                  )}

                  {tooMany && (
                    <div
                      role="alert"
                      className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                    >
                      This file has {analysis.rows.length.toLocaleString("en-IN")} rows. The limit
                      is {MAX_ROWS.toLocaleString("en-IN")} per upload, so please split the file.
                    </div>
                  )}

                  {analysis.missing.length === 0 && (
                    <>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            Total rows
                          </p>
                          <p className="mt-1 text-2xl font-bold text-slate-900">
                            {analysis.rows.length.toLocaleString("en-IN")}
                          </p>
                        </div>

                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                          <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                            Ready to upload
                          </p>
                          <p className="mt-1 text-2xl font-bold text-emerald-700">
                            {validCount.toLocaleString("en-IN")}
                          </p>
                        </div>

                        <div
                          className={`rounded-xl px-4 py-4 ${
                            invalidCount > 0
                              ? "border border-red-200 bg-red-50"
                              : "border border-slate-200 bg-slate-50"
                          }`}
                        >
                          <p
                            className={`text-xs font-medium uppercase tracking-wide ${
                              invalidCount > 0 ? "text-red-700" : "text-slate-500"
                            }`}
                          >
                            Rows with problems
                          </p>
                          <p
                            className={`mt-1 text-2xl font-bold ${
                              invalidCount > 0 ? "text-red-700" : "text-slate-900"
                            }`}
                          >
                            {invalidCount.toLocaleString("en-IN")}
                          </p>
                        </div>
                      </div>

                      {products.length === 0 && (
                        <p className="mt-3 text-xs text-slate-500">
                          Products could not be loaded, so product and stock validation will be
                          handled by the server.
                        </p>
                      )}

                      {invalidCount > 0 && (
                        <div className="mt-5 flex flex-wrap gap-3">
                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50">
                            <input
                              type="checkbox"
                              checked={onlyProblems}
                              onChange={(e) => setOnlyProblems(e.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 accent-blue-600 focus:ring-blue-500"
                            />
                            Show only problem rows
                          </label>

                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50">
                            <input
                              type="checkbox"
                              checked={skipInvalid}
                              onChange={(e) => setSkipInvalid(e.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 accent-blue-600 focus:ring-blue-500"
                            />
                            Skip problem rows and upload the rest
                          </label>
                        </div>
                      )}

                      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
                        <div className="max-h-80 overflow-auto">
                          <table className="min-w-full text-left text-xs">
                            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 text-slate-600">
                              <tr>
                                {[
                                  "Row",
                                  "Order ID",
                                  "Product",
                                  "Platform",
                                  "Qty",
                                  "Price",
                                  "Sold on",
                                  "Status",
                                  "Check",
                                ].map((h) => (
                                  <th
                                    key={h}
                                    className="whitespace-nowrap px-3 py-3 font-semibold"
                                  >
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-100 bg-white">
                              {shownRows.map((r) => (
                                <tr
                                  key={r.line}
                                  className={r.error ? "bg-red-50/70" : "transition hover:bg-slate-50"}
                                >
                                  <td className="px-3 py-2.5 font-medium text-slate-500">{r.line}</td>
                                  <td className="px-3 py-2.5 font-medium text-slate-800">
                                    {r.cells.order_id}
                                  </td>
                                  <td className="max-w-[16rem] truncate px-3 py-2.5 text-slate-700">
                                    {r.productLabel}
                                  </td>
                                  <td className="px-3 py-2.5 text-slate-700">{r.cells.platform_id}</td>
                                  <td className="px-3 py-2.5 text-slate-700">{r.cells.quantity}</td>
                                  <td className="px-3 py-2.5 text-slate-700">{r.cells.selling_price}</td>
                                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">
                                    {r.cells.Sell_date || "now"}
                                  </td>
                                  <td className="px-3 py-2.5 text-slate-700">
                                    {r.cells.status || "Completed"}
                                  </td>
                                  <td className="min-w-[14rem] px-3 py-2.5">
                                    {r.error ? (
                                      <span className="inline-flex rounded-md bg-red-100 px-2 py-1 font-medium text-red-700">
                                        {r.error}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-1 font-semibold text-emerald-700">
                                        <span>✓</span> OK
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {shownTotal > PREVIEW_LIMIT && (
                        <p className="mt-2 text-xs text-slate-500">
                          Showing the first {PREVIEW_LIMIT} of {shownTotal} rows.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Server response */}
              {uploadError && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800"
                >
                  <p className="break-words font-medium">{uploadError}</p>
                  {serverIssues.length > 0 && (
                    <ul className="mt-3 max-h-48 list-disc space-y-1 overflow-y-auto pl-5">
                      {serverIssues.map((i, n) => (
                        <li key={n}>
                          {i.line ? `Row ${i.line}: ` : ""}
                          {i.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
          {result ? (
            <>
              <button
                onClick={reset}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                Upload another file
              </button>
              <button
                onClick={close}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                Done
              </button>
            </>
          ) : (
            <>
              <button
                onClick={close}
                disabled={uploading}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={handleUpload}
                disabled={!canUpload}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
              >
                {uploading
                  ? "Uploading…"
                  : validCount > 0
                  ? `Upload ${validCount} ${validCount === 1 ? "sale" : "sales"}`
                  : "Upload"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}