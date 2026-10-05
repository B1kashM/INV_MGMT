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
      const res = await fetch(`${API}/get_platform/`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
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
    setForm({ platform_name: p.platform_name, status: p.status });
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
        headers: { "Content-Type": "application/json" },
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
      setFormError(e instanceof Error ? e.message : "Couldn't save platform.");
    } finally {
      setSaving(false);
    }
  };

  const activeCount = platforms.filter((p) => p.status).length;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Platforms</h1>
          <p className="text-sm text-slate-600">
            {loading
              ? "Loading…"
              : `${platforms.length} platforms · ${activeCount} active`}
          </p>
        </div>
        <button
          onClick={openAdd}
          className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
        >
          Add platform
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-4 flex items-start justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <span>{error}</span>
          <button onClick={loadPlatforms} className="font-medium underline">
            Try again
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Platform</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!loading && platforms.length === 0 && !error && (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-slate-600">
                  No platforms yet. Use “Add platform” to add a sales channel like Amazon or
                  Meesho.
                </td>
              </tr>
            )}
            {platforms.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 tabular-nums text-slate-700">{p.id}</td>
                <td className="px-4 py-3 font-medium text-slate-900">
                  {p.platform_name}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.status
                        ? "bg-teal-100 text-teal-800"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {p.status ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <button
                    onClick={() => openEdit(p)}
                    className="rounded px-2 py-1 text-teal-800 hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add / Edit modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="platform-modal-title"
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="platform-modal-title"
              className="mb-4 text-lg font-semibold text-slate-900"
            >
              {editing ? "Edit platform" : "Add platform"}
            </h2>

            <div className="space-y-4">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-800">
                  Platform name
                </span>
                <input
                  value={form.platform_name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, platform_name: e.target.value }))
                  }
                  onKeyDown={(e) => e.key === "Enter" && !saving && handleSave()}
                  autoFocus
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                />
              </label>

              <label className="flex items-center gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  checked={form.status}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, status: e.target.checked }))
                  }
                  className="h-4 w-4 accent-teal-700"
                />
                Active
              </label>
            </div>

            {formError && (
              <p
                role="alert"
                className="mt-4 break-words rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
              >
                {formError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={closeModal}
                disabled={saving}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {saving ? "Saving…" : editing ? "Save changes" : "Add platform"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}