"use client";

import { useCallback, useEffect, useState } from "react";
import ConfirmDialog from "../ui/ConfirmDialog";
import { sanityFetch } from "@/lib/sanity/clientSettings";

export default function DocumentExplorer({ onLoadDocument, onToast }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter.trim()) params.set("type", typeFilter.trim());
      if (search.trim()) params.set("q", search.trim());
      params.set("limit", "30");

      const res = await sanityFetch(`/api/sanity/documents?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fetch failed");
      setDocuments(data.documents || []);
    } catch (err) {
      onToast?.(err.message, "error");
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, search, onToast]);

  useEffect(() => {
    fetchDocs();
  }, []); // initial load only

  const handleLoad = async (id) => {
    try {
      const res = await sanityFetch(`/api/sanity/documents/${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Load failed");
      onLoadDocument?.(data.document);
      onToast?.(`Loaded ${id}`, "success");
    } catch (err) {
      onToast?.(err.message, "error");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget;
    setDeleteTarget(null);
    try {
      const res = await sanityFetch(`/api/sanity/documents/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      onToast?.(`Deleted ${id}`, "success");
      fetchDocs();
    } catch (err) {
      onToast?.(err.message, "error");
    }
  };

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-100">Document Explorer</h3>
        <button
          type="button"
          onClick={fetchDocs}
          disabled={loading}
          className="rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Filter by type (e.g. project)"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-sky-600 focus:outline-none"
        />
        <input
          type="text"
          placeholder="Search ID / URL / title / filename"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") fetchDocs();
          }}
          className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-sky-600 focus:outline-none"
        />
        <button
          type="button"
          onClick={fetchDocs}
          className="rounded bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700"
        >
          Search
        </button>
      </div>

      <div className="mt-3 max-h-64 overflow-y-auto">
        {loading && documents.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">Loading…</p>
        ) : documents.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">
            No documents found. Try a different type or search.
          </p>
        ) : (
          <ul className="space-y-1">
            {documents.map((doc) => (
              <li
                key={doc._id}
                className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs text-zinc-300">
                    {doc._id}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {doc._type}
                    {doc.title || doc.name || doc.originalFilename
                      ? ` · ${doc.title || doc.name || doc.originalFilename}`
                      : ""}
                    {doc._updatedAt
                      ? ` · ${new Date(doc._updatedAt).toLocaleDateString()}`
                      : ""}
                  </p>
                  {doc.url && (
                    <p className="truncate font-mono text-[11px] text-zinc-600">{doc.url}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => handleLoad(doc._id)}
                    className="rounded px-2 py-1 text-xs text-sky-400 hover:bg-zinc-800"
                  >
                    Load
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(doc._id)}
                    className="rounded px-2 py-1 text-xs text-red-400 hover:bg-zinc-800"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete document?"
        message={`Permanently delete "${deleteTarget}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}