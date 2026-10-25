import { CopyButton } from "@/components/copy-button"

/** A command or key in a black terminal box: one line, scrolls sideways, with Copy. */
export function TerminalCommand({ text, prompt = true }: { text: string; prompt?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-black py-2.5 pr-3 pl-3.5 text-white">
      <code className="min-w-0 flex-1 overflow-x-auto font-mono text-[11.5px] leading-relaxed whitespace-nowrap [scrollbar-color:rgb(255_255_255/0.25)_transparent] [scrollbar-width:thin]">
        {prompt && <span className="mr-2 text-white/40 select-none">$</span>}
        {text}
      </code>
      <CopyButton text={text} className="text-xs" />
    </div>
  )
}
