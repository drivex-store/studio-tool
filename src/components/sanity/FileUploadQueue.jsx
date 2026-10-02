"use client";

function formatBytes(bytes) {
  if (bytes == null || isNaN(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const STATUS_STYLES = {
  pending: "bg-zinc-700 text-zinc-300",
  uploading: "bg-sky-800 text-sky-200",
  uploaded: "bg-emerald-800 text-emerald-200",
  failed: "bg-red-800 text-red-200",
};

export default function FileUploadQueue({
  items,
  onRemove,
  onRetry,
  onUploadAll,
  onClearCompleted,
  isUploading,
}) {
  if (!items || items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-700 px-4 py-8 text-center text-sm text-zinc-500">
        No files in queue. Select images, files, or a folder to begin.
      </div>
    );
  }

  const pendingCount = items.filter((i) => i.status === "pending" || i.status === "failed").length;
  const completedCount = items.filter((i) => i.status === "uploaded").length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onUploadAll}
          disabled={isUploading || pendingCount === 0}
          className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isUploading ? "Uploading…" : `Upload All (${pendingCount})`}
        </button>
        <button
          type="button"
          onClick={onClearCompleted}
          disabled={completedCount === 0}
          className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
        >
          Clear Completed
        </button>
        <span className="text-xs text-zinc-500">
          {items.length} file{items.length !== 1 ? "s" : ""}
        </span>
      </div>

      <ul className="max-h-72 space-y-2 overflow-y-auto">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-100">
                  {item.file?.name || item.name}
                </p>
                <p className="text-xs text-zinc-500">
                  {item.file?.type || item.type || "—"} ·{" "}
                  {formatBytes(item.file?.size ?? item.size)}
                </p>
              </div>
              <span
                className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${
                  STATUS_STYLES[item.status] || STATUS_STYLES.pending
                }`}
              >
                {item.status}
              </span>
            </div>

            {item.status === "uploading" && (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-700">
                <div
                  className="h-full bg-sky-500 transition-all"
                  style={{ width: `${item.progress ?? 30}%` }}
                />
              </div>
            )}

            {item.error && (
              <p className="mt-1 text-xs text-red-400">{item.error}</p>
            )}

            {item.asset && (
              <p className="mt-1 truncate font-mono text-xs text-emerald-400">
                {item.asset._id}
              </p>
            )}

            <div className="mt-2 flex gap-2">
              {(item.status === "failed" || item.status === "pending") && (
                <button
                  type="button"
                  onClick={() => onRetry?.(item.id)}
                  disabled={isUploading}
                  className="text-xs text-sky-400 hover:underline disabled:opacity-50"
                >
                  Retry
                </button>
              )}
              <button
                type="button"
                onClick={() => onRemove?.(item.id)}
                className="text-xs text-zinc-500 hover:text-red-400"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
