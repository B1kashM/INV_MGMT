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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-sales-title"
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 id="bulk-sales-title" className="text-lg font-semibold text-slate-900">
              Bulk upload sales
            </h2>
            <p className="text-sm text-slate-600">
              Add many sales at once from a CSV file saved from Excel. Totals are calculated and
              stock is reduced for you.
            </p>
          </div>
          <button
            onClick={close}
            disabled={uploading}
            aria-label="Close"
            className="rounded p-1 text-slate-600 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 disabled:opacity-50"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {result ? (
            /* ---------------- Result ---------------- */
            <div>
              <p className="rounded-md bg-teal-100 px-4 py-3 text-sm font-medium text-teal-800">
                {result.created} {result.created === 1 ? "sale was" : "sales were"} added.
                {result.skipped > 0 &&
                  ` ${result.skipped} ${result.skipped === 1 ? "row was" : "rows were"} skipped.`}
              </p>
              {result.issues.length > 0 && (
                <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto text-sm text-slate-700">
                  {result.issues.map((i, n) => (
                    <li key={n}>
                      <span className="font-medium text-slate-900">
                        {i.line ? `Row ${i.line}:` : "Row:"}
                      </span>{" "}
                      {i.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <>
              {/* ---------------- Step 1: choose a file ---------------- */}
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={fileInput}
                  type="file"
                  accept=".csv,.txt,text/csv"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                    e.target.value = ""; // allow choosing the same file again
                  }}
                />
                <button
                  onClick={() => fileInput.current?.click()}
                  disabled={uploading}
                  className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2 disabled:opacity-50"
                >
                  {fileName ? "Choose another file" : "Choose CSV file"}
                </button>
                <button
                  onClick={downloadTemplate}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-800 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
                >
                  Download template
                </button>
                {fileName && <span className="text-sm text-slate-700">{fileName}</span>}
              </div>

              <details className="rounded-md border border-slate-200 px-4 py-2 text-sm">
                <summary className="cursor-pointer font-medium text-slate-800">
                  What should the file look like?
                </summary>
                <p className="mt-2 text-slate-600">
                  One sale per row, with a header row. In Excel use Save As → CSV (Comma
                  delimited), CSV UTF-8, or CSV (MS-DOS). Column order doesn&apos;t matter. Any
                  total_amount column is ignored because it is always calculated.
                </p>
                <ul className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-slate-700 sm:grid-cols-2">
                  {COLUMN_HELP.map((c) => (
                    <li key={c.key}>
                      <code className="font-medium text-slate-900">{c.key}</code> — {c.note}
                    </li>
                  ))}
                </ul>
              </details>

              {parseError && (
                <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {parseError}
                </p>
              )}

              {notice && (
                <p className="rounded-md border border-amber-200 bg-amber-100 px-4 py-3 text-sm text-amber-800">
                  {notice}
                </p>
              )}

              {/* ---------------- Step 2: check and preview ---------------- */}
              {analysis && analysis.missing.length > 0 && (
                <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  These required columns are missing from the file:{" "}
                  <strong>{analysis.missing.join(", ")}</strong>. Download the template to see the
                  expected headers.
                </p>
              )}

              {analysis && analysis.ignored.length > 0 && (
                <p className="text-sm text-slate-600">
                  Ignored columns: {analysis.ignored.join(", ")}
                </p>
              )}

              {tooMany && (
                <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  This file has {analysis!.rows.length.toLocaleString("en-IN")} rows. The limit is{" "}
                  {MAX_ROWS.toLocaleString("en-IN")} per upload, so please split the file.
                </p>
              )}

              {analysis && analysis.missing.length === 0 && (
                <>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                    <span className="text-slate-700">
                      <strong className="text-slate-900">{analysis.rows.length}</strong> rows
                    </span>
                    <span className="text-teal-800">
                      <strong>{validCount}</strong> ready
                    </span>
                    <span className={invalidCount > 0 ? "text-red-700" : "text-slate-600"}>
                      <strong>{invalidCount}</strong> with problems
                    </span>
                    {products.length === 0 && (
                      <span className="text-slate-500">
                        (Products couldn&apos;t be loaded, so product and stock are checked by the
                        server.)
                      </span>
                    )}
                  </div>

                  {invalidCount > 0 && (
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-800">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={onlyProblems}
                          onChange={(e) => setOnlyProblems(e.target.checked)}
                          className="h-4 w-4 accent-teal-700"
                        />
                        Show only rows with problems
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={skipInvalid}
                          onChange={(e) => setSkipInvalid(e.target.checked)}
                          className="h-4 w-4 accent-teal-700"
                        />
                        Skip the problem rows and upload the rest
                      </label>
                    </div>
                  )}

                  <div className="max-h-80 overflow-auto rounded-md border border-slate-200">
                    <table className="min-w-full text-left text-xs">
                      <thead className="sticky top-0 border-b border-slate-200 bg-slate-50 text-slate-600">
                        <tr>
                          {["Row", "Order ID", "Product", "Platform", "Qty", "Price", "Sold on", "Status", "Check"].map(
                            (h) => (
                              <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">
                                {h}
                              </th>
                            )
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {shownRows.map((r) => (
                          <tr key={r.line} className={r.error ? "bg-red-50" : undefined}>
                            <td className="px-3 py-2 text-slate-600">{r.line}</td>
                            <td className="px-3 py-2 text-slate-800">{r.cells.order_id}</td>
                            <td className="px-3 py-2 text-slate-800">{r.productLabel}</td>
                            <td className="px-3 py-2 text-slate-800">{r.cells.platform_id}</td>
                            <td className="px-3 py-2 text-slate-800">{r.cells.quantity}</td>
                            <td className="px-3 py-2 text-slate-800">{r.cells.selling_price}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-slate-800">
                              {r.cells.Sell_date || "now"}
                            </td>
                            <td className="px-3 py-2 text-slate-800">
                              {r.cells.status || "Completed"}
                            </td>
                            <td className="min-w-[14rem] px-3 py-2">
                              {r.error ? (
                                <span className="text-red-700">{r.error}</span>
                              ) : (
                                <span className="rounded-full bg-teal-100 px-2 py-0.5 font-medium text-teal-800">
                                  OK
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {shownTotal > PREVIEW_LIMIT && (
                    <p className="text-xs text-slate-500">
                      Showing the first {PREVIEW_LIMIT} of {shownTotal} rows.
                    </p>
                  )}
                </>
              )}

              {/* ---------------- Server response ---------------- */}
              {uploadError && (
                <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  <p className="break-words">{uploadError}</p>
                  {serverIssues.length > 0 && (
                    <ul className="mt-2 max-h-48 list-disc space-y-1 overflow-y-auto pl-5">
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

        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          {result ? (
            <>
              <button
                onClick={reset}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-800 hover:bg-slate-50"
              >
                Upload another file
              </button>
              <button
                onClick={close}
                className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
              >
                Done
              </button>
            </>
          ) : (
            <>
              <button
                onClick={close}
                disabled={uploading}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!canUpload}
                className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
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