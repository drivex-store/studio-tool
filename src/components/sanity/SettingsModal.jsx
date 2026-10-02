"use client";

import { useEffect, useState } from "react";
import {
  EMPTY_SETTINGS,
  clearSettings,
  loadSettings,
  saveSettings,
} from "@/lib/sanity/clientSettings";

const inputCls =
  "mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-sky-600 focus:outline-none";

export default function SettingsModal({ open, onClose, onSaved, onToast }) {
  const [form, setForm] = useState(EMPTY_SETTINGS);
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(loadSettings());
      setShowToken(false);
    }
  }, [open]);

  if (!open) return null;

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const handleSave = (e) => {
    e.preventDefault();
    saveSettings(form);
    onToast?.("Settings saved", "success");
    onSaved?.();
    onClose?.();
  };

  const handleClear = () => {
    clearSettings();
    setForm(EMPTY_SETTINGS);
    onToast?.("Saved settings cleared", "info");
    onSaved?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form
        onSubmit={handleSave}
        className="w-full max-w-lg rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl"
      >
        <h3 className="text-lg font-semibold text-zinc-100">Sanity Settings</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Fill these in here instead of setting Environment Variables on deploy.
          Empty fields fall back to the server&apos;s env vars (if any).
        </p>

        <div className="mt-4 space-y-3">
          <label className="block text-xs text-zinc-400">
            Project ID
            <input
              type="text"
              value={form.projectId}
              onChange={set("projectId")}
              placeholder="e.g. abc123xy"
              className={inputCls}
              autoComplete="off"
            />
          </label>

          <label className="block text-xs text-zinc-400">
            Dataset
            <input
              type="text"
              value={form.dataset}
              onChange={set("dataset")}
              placeholder="e.g. production"
              className={inputCls}
              autoComplete="off"
            />
          </label>

          <label className="block text-xs text-zinc-400">
            API Version <span className="text-zinc-600">(optional)</span>
            <input
              type="text"
              value={form.apiVersion}
              onChange={set("apiVersion")}
              placeholder="2024-01-01"
              className={inputCls}
              autoComplete="off"
            />
          </label>

          <label className="block text-xs text-zinc-400">
            Write Token
            <div className="flex gap-2">
              <input
                type={showToken ? "text" : "password"}
                value={form.token}
                onChange={set("token")}
                placeholder="sk..."
                className={inputCls}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                className="mt-1 shrink-0 rounded border border-zinc-600 px-3 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                {showToken ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          <label className="flex items-center gap-2 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={form.remember}
              onChange={set("remember")}
              className="h-4 w-4 accent-sky-600"
            />
            Remember on this device (otherwise cleared when the tab closes)
          </label>
        </div>

        <p className="mt-4 rounded border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-300">
          The token is stored in this browser only and sent to this app&apos;s own
          API over HTTPS. Don&apos;t use this on shared computers, and don&apos;t
          leave the deployed URL public — anyone who can open it can use the tool.
        </p>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-red-400 hover:underline"
          >
            Clear saved settings
          </button>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
            >
              Save
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
