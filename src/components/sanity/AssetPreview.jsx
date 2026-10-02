"use client";

function formatBytes(bytes) {
  if (bytes == null || isNaN(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function AssetPreview({ asset, onInsertRef, onCopy }) {
  if (!asset) return null;

  const isImage = asset._type === "sanity.imageAsset" || asset.mimeType?.startsWith("image/");

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800/60 p-3">
      <div className="flex gap-3">
        {isImage && asset.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.url}
            alt={asset.originalFilename || "asset"}
            className="h-16 w-16 shrink-0 rounded object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded bg-zinc-700 text-xs text-zinc-400">
            FILE
          </div>
        )}
        <div className="min-w-0 flex-1 text-sm">
          <p className="truncate font-medium text-zinc-100">
            {asset.originalFilename || asset._id}
          </p>
          <p className="text-zinc-400">
            {asset.mimeType || "—"} · {formatBytes(asset.size)}
          </p>
          {asset.dimensions && (
            <p className="text-zinc-500">
              {asset.dimensions.width}×{asset.dimensions.height}
            </p>
          )}
          <p className="mt-1 truncate font-mono text-xs text-zinc-500">{asset._id}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onCopy?.(asset._id)}
          className="rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
        >
          Copy ID
        </button>
        <button
          type="button"
          onClick={() => onCopy?.(asset.url)}
          className="rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
        >
          Copy URL
        </button>
        <button
          type="button"
          onClick={() =>
            onCopy?.(
              JSON.stringify(
                isImage
                  ? {
                      _type: "image",
                      asset: { _type: "reference", _ref: asset._id },
                    }
                  : {
                      _type: "file",
                      asset: { _type: "reference", _ref: asset._id },
                    },
                null,
                2
              )
            )
          }
          className="rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
        >
          Copy Field
        </button>
        {onInsertRef && (
          <button
            type="button"
            onClick={() =>
              onInsertRef(
                isImage
                  ? {
                      _type: "image",
                      asset: { _type: "reference", _ref: asset._id },
                    }
                  : {
                      _type: "file",
                      asset: { _type: "reference", _ref: asset._id },
                    }
              )
            }
            className="rounded bg-sky-700 px-2 py-1 text-xs text-white hover:bg-sky-600"
          >
            Insert into JSON
          </button>
        )}
      </div>
    </div>
  );
}
