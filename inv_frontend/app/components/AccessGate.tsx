"use client";

import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";

// ---- Change this code to whatever you want ---------------------------------
const ACCESS_CODE = "ABC-1234";
// ---------------------------------------------------------------------------

const STORAGE_KEY = "access_code_ok";

// Optional: call this (e.g. from a "Lock" button) to ask for the code again
export function lockAccess() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  window.location.reload();
}

export default function AccessGate({ children }: { children: ReactNode }) {
  // null = still checking storage (avoids a flash of the form)
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    try {
      setUnlocked(sessionStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setUnlocked(false);
    }
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (code === ACCESS_CODE) {
      try {
        sessionStorage.setItem(STORAGE_KEY, "1");
      } catch {
        /* ignore */
      }
      setUnlocked(true);
    } else {
      setError(true);
      setCode("");
    }
  };

  if (unlocked === null) return null;

  // Children are only mounted after the correct code, so no data is fetched before that
  if (unlocked) return <>{children}</>;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#eaf2ff] p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-[28px] bg-white p-7 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_14px_30px_-20px_rgba(15,23,42,0.25)]"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
            <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.7" />
            <path d="M8 11V8a4 4 0 018 0v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </div>

        <h1 className="mt-4 text-lg font-semibold text-slate-900">Enter access code</h1>
        <p className="mt-1 text-sm text-slate-500">This page is protected. Enter the code to view its data.</p>

        <input
          type="password"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError(false);
          }}
          autoFocus
          autoComplete="off"
          placeholder="Access code"
          aria-label="Access code"
          aria-invalid={error}
          className="mt-5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
        />

        {error && (
          <p role="alert" className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">
            Incorrect code. Try again.
          </p>
        )}

        <button
          type="submit"
          disabled={code === ""}
          className="mt-5 h-11 w-full rounded-xl bg-blue-600 text-sm font-medium text-white shadow-sm shadow-blue-200 transition-all hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50"
        >
          Unlock
        </button>
      </form>
    </main>
  );
}