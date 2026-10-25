import { getUploadAuthParams } from "@imagekit/next/server"

import { getRequestSession, unauthorized } from "@/lib/api-route"
import { envConfig } from "@/lib/env"
import type { ImagekitAuthResponse } from "@/types/api"

export async function GET(request: Request) {
  // Only signed-in users can upload
  const session = await getRequestSession(request)
  if (!session) return unauthorized()

  const { publicKey } = envConfig.imagekit

  // One-time token + expiry + signature, signed with the private key (server only)
  const { token, expire, signature } = getUploadAuthParams({
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY as string,
    publicKey,
  })

  return Response.json({
    token,
    expire,
    signature,
    publicKey,
    folder: `/motion/${session.user.id}/`, // the upload hook adds the project ID
  } satisfies ImagekitAuthResponse)
}
