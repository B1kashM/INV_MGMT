"use client";

import { useCallback, useEffect, useState } from "react";

const API = "http://127.0.0.1:8000/product";

type Platform = {
  id: number;
  platform_name: string;
  status: boolean;
};

type FormState = {
  platform_name: string;
  status: boolean;
};

const emptyForm: FormState = { platform_name: "", status: true };

export default function PlatformsPage() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Platform | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadPlatforms = useCallback(async () => {
    try {
      setError(null);

      const res = await fetch(`${API}/get_platform/`, {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`Server responded with ${res.status}`);
      }

      setPlatforms(await res.json());
    } catch (e) {
      setError(
        e instanceof Error
          ? `Couldn't load platforms. ${e.message}`
          : "Couldn't load platforms."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlatforms();
  }, [loadPlatforms]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (p: Platform) => {
    setEditing(p);
    setForm({
      platform_name: p.platform_name,
      status: p.status,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (!saving) setModalOpen(false);
  };

  const handleSave = async () => {
    if (!form.platform_name.trim()) {
      setFormError("Platform name is required.");
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      // Change "PUT" to "PATCH" if your update endpoint expects PATCH.
      const url = editing
        ? `${API}/update_platform/${editing.id}`
        : `${API}/add_platform/`;

      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          platform_name: form.platform_name.trim(),
          status: form.status,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Server responded with ${res.status}`);
      }

      setModalOpen(false);
      await loadPlatforms();
    } catch (e) {
      setFormError(
        e instanceof Error ? e.message : "Couldn't save platform."
      );
    } finally {
      setSaving(false);
    }
  };

  const activeCount = platforms.filter((p) => p.status).length;

  return (
    <main className="min-h-screen bg-[#f6f7fb] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Page Header */}
        <header className="mb-6">
          <div className="flex flex-col gap-5 rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.04)] sm:p-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 shadow-sm">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-5 w-5 text-white"
                    aria-hidden="true"
                  >
                    <path
                      d="M4 7.5A2.5 2.5 0 016.5 5h11A2.5 2.5 0 0120 7.5v9a2.5 2.5 0 01-2.5 2.5h-11A2.5 2.5 0 014 16.5v-9z"
                      stroke="currentColor"
                      strokeWidth="1.7"
                    />
                    <path
                      d="M8 9h8M8 13h5"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                    Platforms
                  </h1>

                  <p className="mt-0.5 text-sm text-slate-500">
                    {loading
                      ? "Loading…"
                      : `${platforms.length} platforms · ${activeCount} active`}
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={openAdd}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_5px_14px_rgba(79,70,229,0.22)] transition hover:from-indigo-600 hover:to-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path
                  d="M12 5v14M5 12h14"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>

              Add platform
            </button>
          </div>
        </header>

        {/* Summary Cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Total Platforms */}
          <div className="rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-500 p-5 text-white shadow-[0_8px_20px_rgba(79,70,229,0.16)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-indigo-100">
                  Total platforms
                </p>

                <p className="mt-2 text-3xl font-semibold tracking-tight">
                  {loading ? "—" : platforms.length}
                </p>

                <p className="mt-1 text-xs text-indigo-100">
                  Sales channels configured
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-5 w-5 text-white"
                  aria-hidden="true"
                >
                  <rect
                    x="4"
                    y="4"
                    width="16"
                    height="16"
                    rx="3"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  />
                  <path
                    d="M8 9h8M8 13h5M8 17h3"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Active Platforms */}
          <div className="rounded-2xl bg-gradient-to-br from-green-600 to-green-500 p-5 text-white shadow-[0_8px_20px_rgba(79,70,229,0.16)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-green-100">
                  Active platforms
                </p>

                <p className="mt-2 text-3xl font-semibold tracking-tight text-white-200">
                  {loading ? "—" : activeCount}
                </p>

                <p className="mt-1 text-xs text-green-100">
                  Currently enabled sales channels
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-5 w-5 text-emerald-600"
                  aria-hidden="true"
                >
                  <path
                    d="M20 6L9 17l-5-5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="mb-6 flex items-start justify-between gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3.5 text-sm text-red-700"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-3.5 w-3.5 text-red-600"
                  aria-hidden="true"
                >
                  <path
                    d="M12 8v5M12 16.5v.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  />
                </svg>
              </div>

              <span>{error}</span>
            </div>

            <button
              onClick={loadPlatforms}
              className="shrink-0 font-semibold underline underline-offset-2 hover:no-underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Platforms Table Card */}
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
          {/* Card Header */}
          <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Sales platforms
              </h2>

              <p className="mt-1 text-xs text-slate-400">
                Manage your connected sales channels
              </p>
            </div>

            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {activeCount} active
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#fafbfe] text-slate-500">
                <tr>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide">
                    ID
                  </th>

                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide">
                    Platform
                  </th>

                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide">
                    Status
                  </th>

                  <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {!loading && platforms.length === 0 && !error && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-5 py-16 text-center"
                    >
                      <div className="mx-auto flex max-w-md flex-col items-center">
                        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50">
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            className="h-6 w-6 text-indigo-500"
                            aria-hidden="true"
                          >
                            <rect
                              x="4"
                              y="5"
                              width="16"
                              height="14"
                              rx="3"
                              stroke="currentColor"
                              strokeWidth="1.7"
                            />
                            <path
                              d="M8 10h8M8 14h5"
                              stroke="currentColor"
                              strokeWidth="1.7"
                              strokeLinecap="round"
                            />
                          </svg>
                        </div>

                        <p className="text-sm font-semibold text-slate-800">
                          No platforms yet.
                        </p>

                        <p className="mt-1 text-sm leading-6 text-slate-500">
                          Use “Add platform” to add a sales channel like
                          Amazon or Meesho.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}

                {platforms.map((p) => (
                  <tr
                    key={p.id}
                    className="group transition-colors hover:bg-[#fafbff]"
                  >
                    {/* ID */}
                    <td className="px-5 py-4 tabular-nums text-slate-500">
                      {p.id}
                    </td>

                    {/* Platform */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition group-hover:bg-indigo-100">
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            className="h-4 w-4"
                            aria-hidden="true"
                          >
                            <path
                              d="M5 7.5A2.5 2.5 0 017.5 5h9A2.5 2.5 0 0119 7.5v9a2.5 2.5 0 01-2.5 2.5h-9A2.5 2.5 0 015 16.5v-9z"
                              stroke="currentColor"
                              strokeWidth="1.7"
                            />
                            <path
                              d="M8 9h8M8 13h6M8 16h3"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                          </svg>
                        </div>

                        <span className="font-semibold text-slate-800">
                          {p.platform_name}
                        </span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                          p.status
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            p.status
                              ? "bg-emerald-500"
                              : "bg-slate-400"
                          }`}
                        />

                        {p.status ? "Active" : "Inactive"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="whitespace-nowrap px-5 py-4 text-right">
                      <button
                        onClick={() => openEdit(p)}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          className="h-4 w-4"
                          aria-hidden="true"
                        >
                          <path
                            d="M12 20h9"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                          />
                          <path
                            d="M16.5 3.5a2.12 2.12 0 013 3L8 18l-4 1 1-4L16.5 3.5z"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>

                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Add / Edit modal */}
        {modalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]"
            onClick={closeModal}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="platform-modal-title"
              className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-[0_20px_60px_rgba(15,23,42,0.2)]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="border-b border-slate-100 bg-gradient-to-r from-indigo-50/70 to-blue-50/50 px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        className="h-5 w-5"
                        aria-hidden="true"
                      >
                        <path
                          d="M12 5v14M5 12h14"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>

                    <div>
                      <h2
                        id="platform-modal-title"
                        className="text-lg font-semibold text-slate-900"
                      >
                        {editing ? "Edit platform" : "Add platform"}
                      </h2>

                      <p className="mt-0.5 text-xs text-slate-500">
                        Manage your sales channel
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={closeModal}
                    disabled={saving}
                    aria-label="Close"
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-slate-600 disabled:opacity-50"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="h-5 w-5"
                      aria-hidden="true"
                    >
                      <path
                        d="M6 6l12 12M18 6L6 18"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6">
                <div className="space-y-5">
                  <label className="block text-sm">
                    <span className="mb-2 block font-semibold text-slate-800">
                      Platform name
                    </span>

                    <input
                      value={form.platform_name}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          platform_name: e.target.value,
                        }))
                      }
                      onKeyDown={(e) =>
                        e.key === "Enter" &&
                        !saving &&
                        handleSave()
                      }
                      autoFocus
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50"
                    />
                  </label>

                  <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div>
                      <span className="block text-sm font-semibold text-slate-800">
                        Active
                      </span>

                      <span className="mt-0.5 block text-xs text-slate-500">
                        Enable this sales platform
                      </span>
                    </div>

                    <input
                      type="checkbox"
                      checked={form.status}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          status: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded accent-indigo-600"
                    />
                  </label>
                </div>

                {formError && (
                  <p
                    role="alert"
                    className="mt-5 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-sm text-red-700"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="mt-0.5 h-4 w-4 shrink-0"
                      aria-hidden="true"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="9"
                        stroke="currentColor"
                        strokeWidth="1.7"
                      />
                      <path
                        d="M12 8v4M12 15.5v.5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>

                    <span className="break-words">{formError}</span>
                  </p>
                )}

                {/* Modal Actions */}
                <div className="mt-7 flex justify-end gap-2.5">
                  <button
                    onClick={closeModal}
                    disabled={saving}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_5px_14px_rgba(79,70,229,0.18)] transition hover:from-indigo-600 hover:to-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving
                      ? "Saving…"
                      : editing
                      ? "Save changes"
                      : "Add platform"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
