"use client";

import { useCallback, useRef, useState } from "react";
import FileUploadQueue from "./FileUploadQueue";
import AssetPreview from "./AssetPreview";
import { sanityFetch } from "@/lib/sanity/clientSettings";

const IMAGE_ACCEPT =
  "image/jpeg,image/jpg,image/png,image/webp,image/gif,image/svg+xml";
const FILE_ACCEPT =
  ".pdf,.zip,.mp4,.mp3,.txt,.csv,.json,.docx,.doc,.xlsx,.xls,.ppt,.pptx,application/*,text/*,video/*,audio/*";

function createQueueItem(file) {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
    file,
    name: file.name,
    type: file.type,
    size: file.size,
    status: "pending",
    progress: 0,
    error: null,
    asset: null,
  };
}

export default function AssetUploadPanel({ onAssetUploaded, onInsertRef, onToast }) {
  const [queue, setQueue] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [recentAssets, setRecentAssets] = useState([]);
  const [dragOver, setDragOver] = useState(false);

  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const addFiles = useCallback((fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    setQueue((prev) => {
      const existingKeys = new Set(
        prev.map((i) => `${i.file?.name}-${i.file?.size}-${i.file?.lastModified}`)
      );
      const newItems = files
        .filter((f) => !existingKeys.has(`${f.name}-${f.size}-${f.lastModified}`))
        .map(createQueueItem);
      return [...prev, ...newItems];
    });
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      const items = e.dataTransfer?.items;
      if (items) {
        const files = [];
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.kind === "file") {
            const entry = item.webkitGetAsEntry?.();
            if (entry?.isDirectory) {
              // Browser support for directory drop is limited; fall back to files
              onToast?.("Folder drop may be limited by the browser. Prefer Select Folder.", "info");
            }
            const f = item.getAsFile();
            if (f) files.push(f);
          }
        }
        addFiles(files);
      } else if (e.dataTransfer?.files) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles, onToast]
  );

  const updateItem = (id, patch) => {
    setQueue((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const uploadOne = async (item) => {
    updateItem(item.id, { status: "uploading", progress: 20, error: null });

    const formData = new FormData();
    formData.append("file", item.file);
    const isImage = item.file.type?.startsWith("image/");
    formData.append("assetType", isImage ? "image" : "file");

    try {
      const res = await sanityFetch("/api/sanity/assets", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Upload failed (${res.status})`);
      }

      updateItem(item.id, {
        status: "uploaded",
        progress: 100,
        asset: data.asset,
      });
      setRecentAssets((prev) => [data.asset, ...prev].slice(0, 20));
      onAssetUploaded?.(data.asset);
      if (data.replacedExisting) {
        onToast?.(`Replaced existing asset: ${data.asset.originalFilename}`, "success");
      } else if (data.replaceWarning) {
        onToast?.(data.replaceWarning, "info");
      } else {
        onToast?.(`Uploaded: ${data.asset.originalFilename}`, "success");
      }
      return data.asset;
    } catch (err) {
      updateItem(item.id, {
        status: "failed",
        progress: 0,
        error: err.message || "Upload failed",
      });
      onToast?.(err.message || "Upload failed", "error");
      return null;
    }
  };

  const handleUploadAll = async () => {
    const pending = queue.filter((i) => i.status === "pending" || i.status === "failed");
    if (pending.length === 0) return;

    setIsUploading(true);
    for (const item of pending) {
      await uploadOne(item);
    }
    setIsUploading(false);
  };

  const handleRetry = async (id) => {
    const item = queue.find((i) => i.id === id);
    if (!item) return;
    setIsUploading(true);
    await uploadOne(item);
    setIsUploading(false);
  };

  const handleRemove = (id) => {
    setQueue((prev) => prev.filter((i) => i.id !== id));
  };

  const handleClearCompleted = () => {
    setQueue((prev) => prev.filter((i) => i.status !== "uploaded"));
    setRecentAssets([]);
  };

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      onToast?.("Copied to clipboard", "success");
    } catch {
      onToast?.("Copy failed", "error");
    }
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-zinc-100">Asset Upload</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          Upload images &amp; files to Sanity. Assets appear as references you can insert into documents.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
          dragOver
            ? "border-sky-500 bg-sky-950/40"
            : "border-zinc-700 bg-zinc-900/50 hover:border-zinc-600"
        }`}
      >
        <p className="text-sm text-zinc-400">
          Drag &amp; drop files here, or use the buttons below
        </p>
        <p className="mt-1 text-xs text-zinc-600">
          Images: JPG, PNG, WEBP, GIF, SVG · Files: PDF, ZIP, MP4, etc.
        </p>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700"
          >
            Select Images
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700"
          >
            Select Files
          </button>
          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            className="rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700"
          >
            Select Folder
          </button>
        </div>

        <input
          ref={imageInputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept={FILE_ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={folderInputRef}
          type="file"
          // webkitdirectory is the standard way browsers expose folder selection
          webkitdirectory=""
          directory=""
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* Queue */}
      <div>
        <h3 className="mb-2 text-sm font-medium text-zinc-300">Upload Queue</h3>
        <FileUploadQueue
          items={queue}
          onRemove={handleRemove}
          onRetry={handleRetry}
          onUploadAll={handleUploadAll}
          onClearCompleted={handleClearCompleted}
          isUploading={isUploading}
        />
      </div>

      {/* Recent uploaded assets */}
      {recentAssets.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-zinc-300">
            Uploaded Assets ({recentAssets.length})
          </h3>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {recentAssets.map((asset) => (
              <AssetPreview
                key={asset._id}
                asset={asset}
                onCopy={handleCopy}
                onInsertRef={onInsertRef}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
