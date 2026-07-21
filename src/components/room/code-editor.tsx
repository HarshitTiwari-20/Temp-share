"use client";

import { useEffect, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import { useTheme } from "next-themes";
import {
  Copy,
  Download,
  Maximize2,
  Minimize2,
  Search,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SUPPORTED_LANGUAGES } from "@/lib/utils";
import { useRoomStore } from "@/stores/room-store";
import {
  emitCodeCursor,
  emitCodeLanguage,
  emitCodeUpdate,
  emitTyping,
} from "@/hooks/use-socket";

/**
 * Monaco is kept uncontrolled for local typing (defaultValue + imperative setValue).
 * Controlled `value={code}` fights keystrokes and makes the editor feel read-only.
 */
export function CodeEditor() {
  const { resolvedTheme } = useTheme();
  const code = useRoomStore((s) => s.code);
  const language = useRoomStore((s) => s.language);
  const setCode = useRoomStore((s) => s.setCode);
  const setLanguage = useRoomStore((s) => s.setLanguage);
  const isFullscreen = useRoomStore((s) => s.isFullscreen);
  const setFullscreen = useRoomStore((s) => s.setFullscreen);
  const cursors = useRoomStore((s) => s.cursors);
  const self = useRoomStore((s) => s.self);
  const typing = useRoomStore((s) => s.typing);

  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const applyingRemote = useRef(false);
  const lastEmitted = useRef(code);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const languageRef = useRef(language);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const decorationsRef = useRef<string[]>([]);
  // Snapshot initial content once so remounts don't wipe mid-session
  const initialCode = useRef(code);

  languageRef.current = language;

  // Apply remote (or store) updates without fighting local keystrokes
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !mounted) return;

    const current = editor.getValue();
    // Only push into the editor when store diverges (remote update / rejoin)
    if (current === code) {
      lastEmitted.current = code;
      return;
    }
    // If this change originated from us, skip
    if (code === lastEmitted.current) return;

    applyingRemote.current = true;
    const pos = editor.getPosition();
    const scroll = editor.getScrollTop();
    editor.setValue(code);
    if (pos) editor.setPosition(pos);
    editor.setScrollTop(scroll);
    lastEmitted.current = code;
    // setValue is sync; clear on next microtask so model listeners settle
    queueMicrotask(() => {
      applyingRemote.current = false;
    });
  }, [code, mounted]);

  // Remote cursor decorations (non-intrusive)
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !mounted) return;

    const monaco = (
      window as unknown as { monaco?: typeof import("monaco-editor") }
    ).monaco;
    if (!monaco) return;

    const newDecorations: MonacoEditor.IModelDeltaDecoration[] = [];

    Object.values(cursors).forEach((cursor) => {
      if (self && cursor.userId === self.id) return;

      newDecorations.push({
        range: new monaco.Range(
          cursor.line,
          cursor.column,
          cursor.line,
          cursor.column
        ),
        options: {
          className: "remote-cursor",
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          beforeContentClassName: "remote-cursor-caret",
          hoverMessage: { value: `**${cursor.name}**` },
          overviewRuler: {
            color: cursor.color,
            position: monaco.editor.OverviewRulerLane.Center,
          },
        },
      });

      if (cursor.selection) {
        const { startLine, startColumn, endLine, endColumn } = cursor.selection;
        if (startLine !== endLine || startColumn !== endColumn) {
          newDecorations.push({
            range: new monaco.Range(startLine, startColumn, endLine, endColumn),
            options: {
              className: "remote-selection",
              stickiness:
                monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
            },
          });
        }
      }
    });

    decorationsRef.current = editor.deltaDecorations(
      decorationsRef.current,
      newDecorations
    );
  }, [cursors, self, mounted]);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    // Expose monaco for decorations
    (window as unknown as { monaco: typeof monaco }).monaco = monaco;

    editor.updateOptions({
      readOnly: false,
      domReadOnly: false,
      fontSize: 14,
      fontFamily:
        "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
      fontLigatures: true,
      minimap: { enabled: true, scale: 0.8 },
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      cursorBlinking: "smooth",
      cursorSmoothCaretAnimation: "on",
      padding: { top: 12 },
      lineNumbers: "on",
      renderLineHighlight: "all",
      automaticLayout: true,
      tabSize: 2,
      wordWrap: "on",
      bracketPairColorization: { enabled: true },
      // Avoid stealing focus in a way that blocks input on some browsers
      ariaLabel: "Collaborative code editor",
    });

    // Ensure latest store content is shown (defaultValue may be stale if join was slow)
    const latest = useRoomStore.getState().code;
    if (editor.getValue() !== latest) {
      applyingRemote.current = true;
      editor.setValue(latest);
      lastEmitted.current = latest;
      queueMicrotask(() => {
        applyingRemote.current = false;
      });
    }

    editor.onDidChangeModelContent(() => {
      if (applyingRemote.current) return;
      const next = editor.getValue();
      lastEmitted.current = next;
      setCode(next);
      emitCodeUpdate(next, languageRef.current);
      emitTyping("code", true);
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => emitTyping("code", false), 1200);
    });

    editor.onDidChangeCursorPosition((e) => {
      const sel = editor.getSelection();
      emitCodeCursor({
        line: e.position.lineNumber,
        column: e.position.column,
        selection: sel
          ? {
              startLine: sel.startLineNumber,
              startColumn: sel.startColumn,
              endLine: sel.endLineNumber,
              endColumn: sel.endColumn,
            }
          : undefined,
      });
    });

    // Focus + force layout so the editor is interactive (0-height parents break input)
    requestAnimationFrame(() => {
      editor.layout();
      editor.focus();
    });

    setMounted(true);
  };

  // Re-layout when entering fullscreen or window resizes
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !mounted) return;
    const id = requestAnimationFrame(() => editor.layout());
    const onResize = () => editor.layout();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", onResize);
    };
  }, [isFullscreen, mounted]);

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    emitCodeLanguage(lang);
  };

  const handleCopy = async () => {
    const text = editorRef.current?.getValue() ?? code;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Code copied");
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownload = () => {
    const text = editorRef.current?.getValue() ?? code;
    const lang = SUPPORTED_LANGUAGES.find((l) => l.id === language);
    const ext = lang?.ext ?? "txt";
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `share.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded");
  };

  const openFind = () => {
    editorRef.current?.getAction("actions.find")?.run();
  };

  const codeTypers = typing.filter((t) => t.area === "code");
  const editorTheme = resolvedTheme === "light" ? "light" : "vs-dark";

  return (
    <div
      className={`flex flex-col rounded-xl border border-border bg-card overflow-hidden ${
        isFullscreen
          ? "fixed inset-0 z-50 rounded-none"
          : "h-[min(70vh,720px)] min-h-[420px]"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2 bg-muted/40 shrink-0">
        <div className="flex items-center gap-2">
          <Select value={language} onValueChange={handleLanguageChange}>
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_LANGUAGES.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {codeTypers.length > 0 && (
            <span className="text-xs text-muted-foreground animate-pulse">
              {codeTypers.map((t) => t.name).join(", ")} typing…
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={openFind}>
            <Search className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopy}>
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleDownload}
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setFullscreen(!isFullscreen)}
          >
            {isFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
      <div className="relative flex-1 min-h-0 w-full">
        <Editor
          height="100%"
          defaultLanguage={language === "cpp" ? "cpp" : language}
          language={language === "cpp" ? "cpp" : language}
          theme={editorTheme}
          defaultValue={initialCode.current}
          onMount={handleMount}
          loading={
            <div className="flex h-full min-h-[360px] items-center justify-center text-sm text-muted-foreground">
              Loading editor…
            </div>
          }
          options={{
            automaticLayout: true,
            readOnly: false,
            domReadOnly: false,
          }}
        />
      </div>
    </div>
  );
}
