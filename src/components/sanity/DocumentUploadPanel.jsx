"use client";

import { useState } from "react";
import JsonEditor, { validateJsonDocument } from "./JsonEditor";
import ConfirmDialog from "../ui/ConfirmDialog";
import { sanityFetch } from "@/lib/sanity/clientSettings";

export default function DocumentUploadPanel({
  jsonValue,
  onJsonChange,
  onToast,
  onDocumentCreated,
}) {
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const runCreate = async (operation) => {
    const v = validateJsonDocument(jsonValue);
    if (!v.valid) {
      onToast?.(v.error || "Invalid JSON", "error");
      return;
    }

    if (v.isArray) {
      setBusy(true);
      setLastResult(null);
      try {
        const res = await sanityFetch("/api/sanity/documents/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documents: v.parsed,
            operation: operation === "createOrReplace" ? "createOrReplace" : "create",
            stopOnError: false,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Bulk failed");
        setLastResult({ bulk: true, ...data });
        onToast?.(
          `Bulk: ${data.successCount} succeeded, ${data.failCount} failed`,
          data.failCount === 0 ? "success" : "info"
        );
        onDocumentCreated?.(data);
      } catch (err) {
        onToast?.(err.message, "error");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (
      (operation === "createOrReplace" || operation === "update") &&
      !v.parsed._id
    ) {
      onToast?.("Update / Replace requires an _id field", "error");
      return;
    }

    setBusy(true);
    setLastResult(null);
    try {
      let res;
      if (operation === "update" || operation === "createOrReplace") {
        res = await sanityFetch(
          `/api/sanity/documents/${encodeURIComponent(v.parsed._id)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              document: v.parsed,
              // "update" must fail if the document doesn't exist yet — that's
              // what distinguishes it from "Create or Replace". Only
              // createOrReplace should upsert.
              operation: operation === "update" ? "patch" : "createOrReplace",
            }),
          }
        );
      } else {
        res = await sanityFetch("/api/sanity/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            document: v.parsed,
            operation: "create",
          }),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");

      setLastResult({
        bulk: false,
        id: data.id,
        type: data.type,
        document: data.document,
      });
      onToast?.(
        operation === "create" ? `Created: ${data.id}` : `Updated: ${data.id}`,
        "success"
      );
      onDocumentCreated?.(data);
    } catch (err) {
      onToast?.(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const requestOperation = (operation) => {
    const v = validateJsonDocument(jsonValue);
    if (!v.valid) {
      onToast?.(v.error || "Invalid JSON", "error");
      return;
    }

    if (operation === "createOrReplace" || operation === "update") {
      const id = v.isArray ? "(multiple)" : v.parsed?._id;
      setConfirm({
        operation,
        title:
          operation === "createOrReplace"
            ? "Create or Replace?"
            : "Update document?",
        message:
          operation === "createOrReplace"
            ? `This will overwrite the document${id ? ` “${id}”` : ""} if it already exists. This cannot be undone.`
            : `This will replace the existing document “${id}”. Confirm?`,
      });
      return;
    }

    runCreate(operation);
  };

  const handleConfirm = () => {
    const op = confirm?.operation;
    setConfirm(null);
    if (op) runCreate(op);
  };

  const handleCopyId = async () => {
    if (!lastResult?.id) return;
    try {
      await navigator.clipboard.writeText(lastResult.id);
      onToast?.("Document ID copied", "success");
    } catch {
      onToast?.("Copy failed", "error");
    }
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-zinc-100">
          Raw JSON Document Upload
        </h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          Paste a document object or an array of documents. Structure is
          preserved exactly.
        </p>
      </div>

      <JsonEditor value={jsonValue} onChange={onJsonChange} disabled={busy} />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => requestOperation("create")}
          disabled={busy}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy ? "Working…" : "Create Document"}
        </button>
        <button
          type="button"
          onClick={() => requestOperation("update")}
          disabled={busy}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
        >
          Update Document
        </button>
        <button
          type="button"
          onClick={() => requestOperation("createOrReplace")}
          disabled={busy}
          className="rounded-lg border border-amber-600 bg-amber-900/40 px-4 py-2 text-sm font-medium text-amber-200 hover:bg-amber-800/50 disabled:opacity-50"
        >
          Create or Replace
        </button>
      </div>

      <div className="rounded-lg border border-zinc-700 bg-zinc-900/60 p-3 text-xs text-zinc-400">
        <p className="font-medium text-zinc-300">Operations</p>
        <ul className="mt-1 list-inside list-disc space-y-0.5">
          <li>
            <strong>Create</strong> – makes a brand-new document. Fails if{" "}
            <code>_id</code> already exists.
          </li>
          <li>
            <strong>Update</strong> – requires <code>_id</code> and the
            document must already exist. Fails if it doesn't.
          </li>
          <li>
            <strong>Create or Replace</strong> – doesn't check first: creates
            it if missing, overwrites it if present. Requires confirmation.
          </li>
        </ul>
      </div>

      {lastResult && (
        <div className="rounded-lg border border-emerald-800 bg-emerald-950/40 p-3 text-sm">
          {lastResult.bulk ? (
            <>
              <p className="font-medium text-emerald-300">
                Bulk result: {lastResult.successCount}/{lastResult.total}{" "}
                succeeded
              </p>
              {lastResult.results?.slice(0, 5).map((r, i) => (
                <p key={i} className="mt-1 font-mono text-xs text-zinc-400">
                  [{r.index}] {r.success ? r.id : r.error}
                </p>
              ))}
            </>
          ) : (
            <>
              <p className="font-medium text-emerald-300">
                {lastResult.type} · {lastResult.id}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                >
                  Copy Document ID
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel="Yes, proceed"
        danger
        onConfirm={handleConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
