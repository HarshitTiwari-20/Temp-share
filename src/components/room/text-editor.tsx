"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bold,
  Copy,
  Eye,
  Heading1,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Check,
  Code2,
  Table,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRoomStore } from "@/stores/room-store";
import { emitTextUpdate, emitTyping } from "@/hooks/use-socket";
import { cn } from "@/lib/utils";

export function TextEditor() {
  const markdown = useRoomStore((s) => s.markdown);
  const setMarkdown = useRoomStore((s) => s.setMarkdown);
  const typing = useRoomStore((s) => s.typing);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLocal = useRef(markdown);
  const [mode, setMode] = useState<"edit" | "preview" | "split">("split");
  const [copied, setCopied] = useState(false);
  const [localValue, setLocalValue] = useState(markdown);
  const isFocused = useRef(false);

  // Apply remote updates only when they differ from what we last typed
  useEffect(() => {
    if (markdown === lastLocal.current) return;
    if (isFocused.current && markdown !== localValue) {
      // Remote edit while focused — still apply so collab works, preserve caret if possible
      const el = textareaRef.current;
      const start = el?.selectionStart ?? 0;
      const end = el?.selectionEnd ?? 0;
      setLocalValue(markdown);
      lastLocal.current = markdown;
      requestAnimationFrame(() => {
        if (el) {
          const max = markdown.length;
          el.setSelectionRange(Math.min(start, max), Math.min(end, max));
        }
      });
      return;
    }
    if (!isFocused.current) {
      setLocalValue(markdown);
      lastLocal.current = markdown;
    }
  }, [markdown, localValue]);

  const handleChange = useCallback(
    (value: string) => {
      lastLocal.current = value;
      setLocalValue(value);
      setMarkdown(value);
      emitTextUpdate(value);
      emitTyping("text", true);
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => emitTyping("text", false), 1200);
    },
    [setMarkdown]
  );

  const insertAround = (before: string, after = before) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = localValue.slice(start, end) || "text";
    const next =
      localValue.slice(0, start) + before + selected + after + localValue.slice(end);
    handleChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(
        start + before.length,
        start + before.length + selected.length
      );
    });
  };

  const insertLine = (prefix: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const lineStart = localValue.lastIndexOf("\n", start - 1) + 1;
    const next =
      localValue.slice(0, lineStart) + prefix + localValue.slice(lineStart);
    handleChange(next);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    toast.success("Text copied");
    setTimeout(() => setCopied(false), 1500);
  };

  const textTypers = typing.filter((t) => t.area === "text");

  return (
    <div className="flex h-[min(70vh,720px)] min-h-[420px] flex-col rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2 bg-muted/40">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => insertAround("**")}
            title="Bold"
          >
            <Bold className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => insertAround("_")}
            title="Italic"
          >
            <Italic className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => insertLine("# ")}
            title="Heading 1"
          >
            <Heading1 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => insertLine("## ")}
            title="Heading 2"
          >
            <Heading2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => insertLine("- ")}
            title="List"
          >
            <List className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => insertLine("1. ")}
            title="Ordered list"
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => insertAround("[", "](url)")}
            title="Link"
          >
            <Link2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => insertAround("`")}
            title="Inline code"
          >
            <Code2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() =>
              insertLine("| Col1 | Col2 |\n| --- | --- |\n| A | B |\n")
            }
            title="Table"
          >
            <Table className="h-3.5 w-3.5" />
          </Button>
          {textTypers.length > 0 && (
            <span className="ml-2 text-xs text-muted-foreground animate-pulse">
              {textTypers.map((t) => t.name).join(", ")} typing…
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Tabs
            value={mode}
            onValueChange={(v) => setMode(v as typeof mode)}
            className="w-auto"
          >
            <TabsList className="h-8">
              <TabsTrigger value="edit" className="text-xs px-2 h-6">
                Edit
              </TabsTrigger>
              <TabsTrigger value="split" className="text-xs px-2 h-6">
                Split
              </TabsTrigger>
              <TabsTrigger value="preview" className="text-xs px-2 h-6">
                <Eye className="h-3 w-3 mr-1" /> Preview
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopy}>
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "flex-1 min-h-0 grid",
          mode === "split" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"
        )}
      >
        {(mode === "edit" || mode === "split") && (
          <Textarea
            ref={textareaRef}
            value={localValue}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={() => {
              isFocused.current = true;
            }}
            onBlur={() => {
              isFocused.current = false;
            }}
            placeholder="Write markdown… Supports lists, tables, links, code blocks."
            className="h-full min-h-[360px] resize-none rounded-none border-0 border-r border-border focus-visible:ring-0 font-mono text-sm leading-relaxed"
          />
        )}
        {(mode === "preview" || mode === "split") && (
          <div className="h-full min-h-[360px] overflow-auto p-4 prose prose-invert prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-a:text-violet-400 prose-code:text-amber-300 prose-pre:bg-muted">
            {localValue.trim() ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {localValue}
              </ReactMarkdown>
            ) : (
              <p className="text-muted-foreground not-prose">
                Nothing to preview yet.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
