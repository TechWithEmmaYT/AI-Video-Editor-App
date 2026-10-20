import type { NextRequest } from "next/server"

import { notFound } from "@/lib/api-route"
import type { StreamStatus } from "@/lib/export/types"
import { checkStream, getSharedExport } from "@/lib/exports"

/**
 * Public (no sign-in, like the share page): whether ImageKit's HLS streams for a shared export are
 * ready. The first call starts preparing them; the share page calls again every few seconds while
 * it says "processing", and the Export menu calls once when a link is copied, to get a head start.
 */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/share/[exportId]/stream">) {
  const { exportId } = await ctx.params
  const shared = await getSharedExport(exportId)
  if (!shared) return notFound("This video isn't available.")

  return Response.json((await checkStream(shared.hlsUrl)) satisfies StreamStatus, { headers: { "Cache-Control": "no-store" } })
}
