"use client";

import { useCallback, useRef, useState } from "react";
import {
  Download,
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileText,
  FileVideo,
  Trash2,
  Upload,
  X,
  Eye,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatBytes, cn } from "@/lib/utils";
import { useRoomStore } from "@/stores/room-store";
import { emitFileDelete, emitFileUpload } from "@/hooks/use-socket";
import type { FileMeta } from "@/lib/types";

function fileIcon(mime: string) {
  if (mime.startsWith("image/")) return FileImage;
  if (mime.startsWith("video/")) return FileVideo;
  if (mime.startsWith("audio/")) return FileAudio;
  if (mime.includes("zip") || mime.includes("tar") || mime.includes("gzip"))
    return FileArchive;
  if (mime.includes("pdf") || mime.startsWith("text/")) return FileText;
  if (
    mime.includes("javascript") ||
    mime.includes("json") ||
    mime.includes("typescript")
  )
    return FileCode;
  return File;
}

interface UploadItem {
  id: string;
  name: string;
  progress: number;
  error?: string;
}

export function FileShare() {
  const room = useRoomStore((s) => s.room);
  const token = useRoomStore((s) => s.token);
  const files = useRoomStore((s) => s.files);
  const addFile = useRoomStore((s) => s.addFile);
  const removeFile = useRoomStore((s) => s.removeFile);

  const [dragging, setDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [preview, setPreview] = useState<FileMeta | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      if (!room || !token) return;

      const id = `${file.name}-${Date.now()}`;
      setUploads((u) => [...u, { id, name: file.name, progress: 0 }]);

      try {
        const formData = new FormData();
        formData.append("file", file);

        // XMLHttpRequest for progress
        const result = await new Promise<FileMeta>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", `/api/rooms/${room.roomCode}/files`);
          xhr.setRequestHeader("x-room-token", token);

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const progress = Math.round((e.loaded / e.total) * 100);
              setUploads((list) =>
                list.map((item) =>
                  item.id === id ? { ...item, progress } : item
                )
              );
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const data = JSON.parse(xhr.responseText);
                resolve(data.file as FileMeta);
              } catch {
                reject(new Error("Invalid response"));
              }
            } else {
              try {
                const data = JSON.parse(xhr.responseText);
                reject(new Error(data.error || "Upload failed"));
              } catch {
                reject(new Error("Upload failed"));
              }
            }
          };

          xhr.onerror = () => reject(new Error("Network error"));
          xhr.send(formData);
        });

        addFile(result);
        emitFileUpload(result);
        toast.success(`Uploaded ${result.fileName}`);
        setUploads((list) => list.filter((item) => item.id !== id));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        setUploads((list) =>
          list.map((item) =>
            item.id === id ? { ...item, error: message, progress: 0 } : item
          )
        );
        toast.error(message);
        setTimeout(() => {
          setUploads((list) => list.filter((item) => item.id !== id));
        }, 4000);
      }
    },
    [room, token, addFile]
  );

  const handleFiles = useCallback(
    (list: FileList | File[]) => {
      Array.from(list).forEach((f) => uploadFile(f));
    },
    [uploadFile]
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleDelete = async (file: FileMeta) => {
    if (!room || !token) return;
    try {
      const res = await fetch(
        `/api/rooms/${room.roomCode}/files?fileId=${file.id}`,
        {
          method: "DELETE",
          headers: { "x-room-token": token },
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Delete failed");
      }
      removeFile(file.id);
      emitFileDelete(file.id);
      toast.success("File deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const downloadAll = () => {
    files.forEach((f, i) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = f.storageUrl;
        a.download = f.fileName;
        a.target = "_blank";
        a.rel = "noopener";
        a.click();
      }, i * 200);
    });
    toast.success("Downloading all files…");
  };

  const canPreview = (mime: string) =>
    mime.startsWith("image/") ||
    mime.startsWith("video/") ||
    mime === "application/pdf" ||
    mime.startsWith("text/");

  return (
    <div className="flex h-full min-h-[420px] flex-col rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/40">
        <div>
          <h3 className="text-sm font-medium">Files</h3>
          <p className="text-xs text-muted-foreground">
            {files.length} file{files.length !== 1 ? "s" : ""} · Drag & drop or
            browse
          </p>
        </div>
        <div className="flex gap-2">
          {files.length > 0 && (
            <Button variant="outline" size="sm" onClick={downloadAll}>
              <Package className="h-3.5 w-3.5 mr-1" />
              Download all
            </Button>
          )}
          <Button size="sm" onClick={() => inputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5 mr-1" />
            Upload
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <div
        className={cn(
          "m-4 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
          dragging
            ? "border-violet-500 bg-violet-500/10"
            : "border-border hover:border-muted-foreground/40"
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
      >
        <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm font-medium">Drop files here</p>
        <p className="text-xs text-muted-foreground mt-1">
          Images, PDFs, ZIP, videos, documents & more
        </p>
      </div>

      {uploads.length > 0 && (
        <div className="px-4 pb-2 space-y-2">
          {uploads.map((u) => (
            <div
              key={u.id}
              className="rounded-lg border border-border bg-muted/30 p-3"
            >
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="truncate font-medium">{u.name}</span>
                <span className="text-muted-foreground">
                  {u.error ? (
                    <span className="text-destructive">{u.error}</span>
                  ) : (
                    `${u.progress}%`
                  )}
                </span>
              </div>
              {!u.error && <Progress value={u.progress} />}
            </div>
          ))}
        </div>
      )}

      <ScrollArea className="flex-1 px-4 pb-4">
        {files.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            No files yet
          </p>
        ) : (
          <ul className="space-y-2">
            {files.map((file) => {
              const Icon = fileIcon(file.mimeType);
              return (
                <li
                  key={file.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-background/50 p-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {file.fileName}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        {formatBytes(file.fileSize)}
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {file.mimeType.split("/")[1] || file.mimeType}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {canPreview(file.mimeType) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setPreview(file)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <a
                        href={file.storageUrl}
                        download={file.fileName}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(file)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between pr-6">
              <span className="truncate">{preview?.fileName}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => setPreview(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          {preview?.mimeType.startsWith("image/") && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview.storageUrl}
              alt={preview.fileName}
              className="max-h-[70vh] w-full object-contain rounded-lg"
            />
          )}
          {preview?.mimeType.startsWith("video/") && (
            <video
              src={preview.storageUrl}
              controls
              className="max-h-[70vh] w-full rounded-lg"
            />
          )}
          {preview?.mimeType === "application/pdf" && (
            <iframe
              src={preview.storageUrl}
              className="h-[70vh] w-full rounded-lg"
              title={preview.fileName}
            />
          )}
          {preview?.mimeType.startsWith("text/") && (
            <iframe
              src={preview.storageUrl}
              className="h-[50vh] w-full rounded-lg bg-muted"
              title={preview.fileName}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
