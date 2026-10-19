import Link from "next/link"

import { CopyButton } from "@/components/copy-button"
import { APP_NAME } from "@/lib/brand"
import { mcpAddCommand } from "@/lib/claude"

export function ConnectClaudeCard() {
  const command = mcpAddCommand()

  return (
    <section className="rounded-[28px] border border-border bg-(--card-raised) p-7 sm:p-9">
      <h2 className="font-(family-name:--font-display) text-[32px] leading-tight font-extrabold tracking-[-0.035em]">
        Connect Claude Code.
      </h2>
      <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-muted-foreground">
        One command adds {APP_NAME} as a tool. Claude uses your API key and only sees your projects. Open a project
        first, and “this” means the selected layer.
      </p>

      <div className="mt-8 flex items-start gap-4">
        <div className="flex min-w-0 flex-1 gap-3 font-mono text-[14px] leading-relaxed">
          <span className="text-muted-foreground select-none">$</span>
          <code className="min-w-0 break-all">{command}</code>
        </div>
        <CopyButton text={command} />
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        Swap <code className="font-mono text-foreground">&lt;your-api-key&gt;</code> for a key from{" "}
        <Link href="/app/settings" className="font-medium text-foreground hover:underline">
          Claude &amp; keys
        </Link>
        .
      </p>
    </section>
  )
}
