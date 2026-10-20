"use client"

import { javascript } from "@codemirror/lang-javascript"
import CodeMirror, { EditorView } from "@uiw/react-codemirror"
import { ChevronDownIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { useState } from "react"
import { cn } from "cn"

const extensions = [
  javascript(),
  EditorView.lineWrapping,
  EditorView.theme({
    "&": { fontSize: "11.5px", backgroundColor: "transparent" },
    // No scrolling inside the box: it's either clipped (short) or shown in full.
    ".cm-scroller": { overflow: "hidden !important" },
    ".cm-gutters": { backgroundColor: "transparent", border: "none" },
    ".cm-content": { fontFamily: "var(--font-geist-mono), ui-monospace, monospace" },
  }),
]

const SHORT = 168

/**
 * A code clip's code, read-only (CodeMirror, JavaScript highlighting). It's shown, not edited here:
 * code comes from elements and Claude. Short by default with a fade; "Show all" expands it.
 * Loaded only in the browser.
 */
export default function CodeEditor({ value }: { value: string }) {
  const { resolvedTheme } = useTheme()
  const [expanded, setExpanded] = useState(false)
  const lines = value.split("\n").length
  const long = lines > 9

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-[#111114] opacity-80 dark:bg-black/40">
      <div className="overflow-hidden" style={{ maxHeight: expanded || !long ? undefined : SHORT }}>
        <CodeMirror
          value={value}
          readOnly
          editable={false}
          extensions={extensions}
          theme={resolvedTheme === "light" ? "light" : "dark"}
          basicSetup={{ foldGutter: false, highlightActiveLine: false, highlightActiveLineGutter: false, autocompletion: false }}
          aria-label="Code (read only)"
          className="cursor-default py-1 [&_.cm-cursor]:hidden"
        />
      </div>
      {long && (
        <>
          {!expanded && <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-[#111114] to-transparent dark:from-black/80" />}
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="relative flex w-full items-center justify-center gap-1 border-t border-border/60 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {expanded ? "Show less" : `Show all ${lines} lines`}
            <ChevronDownIcon className={cn("size-3 transition-transform", expanded && "rotate-180")} />
          </button>
        </>
      )}
    </div>
  )
}
