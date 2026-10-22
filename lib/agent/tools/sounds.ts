import "server-only"

import { readFile } from "node:fs/promises"
import path from "node:path"

import type { McpServer } from "@modelcontextprotocol/server"
import { z } from "zod"

import { applyAgentEdit } from "@/lib/agent/apply"
import { addClipOps, trackChoice } from "@/lib/agent/clip-spec"
import { AgentError, agentUserId, handled, text } from "@/lib/agent/context"
import { uploadBytes } from "@/lib/agent/imagekit-upload"
import { resolveProject } from "@/lib/agent/resolve"
import { createMedia, listMedia } from "@/lib/media"
import { getUserMedia } from "@/lib/media-transcript"
import { MAX_SECONDS } from "@/lib/project/formats"
import { projectChannel, publish } from "@/lib/realtime/bus"
import { findSoundEffect, SOUND_EFFECTS } from "@/lib/sfx"
import { formatTimestamp } from "@/lib/transcript"

/** A sound the agent makes itself: small, since it's sent inside a tool call. */
const MAX_SOUND_BYTES = 2 * 1024 * 1024

const projectId = z.string().min(1).max(64).optional().describe("Defaults to the project open in the editor.")
const at = z.number().min(0).max(MAX_SECONDS).describe("Start on the timeline, in seconds.")
const volume = z.number().min(0).max(2).default(0.3).describe("0–2. Effects are levelled alike; 0.15–0.3 sits under speech, up to 0.6 on a hook.")

type Project = Awaited<ReturnType<typeof resolveProject>>

/** Where a sound goes: its start, and optionally a slice of the file and a track. */
type Placement = { at: number; volume: number; trimStart?: number; duration?: number; track?: string }

/** The file's type from its first bytes: a WAV or an MP3, or null. */
function soundType(bytes: Buffer) {
  if (bytes.subarray(0, 4).toString("latin1") === "RIFF" && bytes.subarray(8, 12).toString("latin1") === "WAVE") return "wav"
  if (bytes.subarray(0, 3).toString("latin1") === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) return "mp3"
  return null
}

/** Uploads the sound, records it as the project's media and tells open editors. */
async function addSound(userId: string, project: Project, bytes: Buffer, name: string) {
  const input = await uploadBytes(bytes, name, userId, project.id)
  if (input.kind !== "audio") throw new AgentError(`"${name}" didn't come back from ImageKit as audio.`)
  const created = await createMedia(userId, project.id, input)
  await publish(projectChannel(project.id), { type: "media", mediaId: created.id })
  return created.id
}

/** Puts an audio media file on the timeline (the bottom audio track unless told otherwise) and says where. */
async function placeSound(userId: string, project: Project, mediaId: string, place: Placement) {
  const media = await getUserMedia(userId, mediaId)
  if (!media) throw new AgentError("The sound was stored but can't be found. Try again.")
  let added = ""
  const result = await applyAgentEdit(userId, project.id, (state) => {
    const { ops, clipId } = addClipOps(
      state,
      { kind: "media", mediaId, at: place.at, volume: place.volume, trimStart: place.trimStart, duration: place.duration, track: place.track ?? "auto" },
      { width: project.width, height: project.height, newId: () => crypto.randomUUID(), media }
    )
    added = clipId
    return ops
  })
  const clip = result.data.doc.clips.find((c) => c.id === added)!
  return `audio clip ${clip.id} "${clip.name}" at ${formatTimestamp(clip.from / project.fps)}–${formatTimestamp((clip.from + clip.durationInFrames) / project.fps)} on track ${clip.trackId}, volume ${place.volume}`
}

export function registerSoundTools(server: McpServer) {
  server.registerTool(
    "list_sound_effects",
    {
      title: "List the sound effects",
      description:
        "The built-in sound effects (woosh, whoosh, riser, clicks, pops, hits, chimes, typing, shutter, recorded samples…) with their ids and lengths. Add one with add_sound_effect. When none fits, make your own with upload_sound.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    handled(async (_args: Record<string, never>) => {
      const groups = [...new Set(SOUND_EFFECTS.map((effect) => effect.group))]
      return text(
        groups
          .map((group) => `## ${group}\n${SOUND_EFFECTS.filter((e) => e.group === group).map((e) => `- \`${e.id}\` ${e.name} · ${e.length} s`).join("\n")}`)
          .join("\n\n")
      )
    })
  )

  server.registerTool(
    "add_sound_effect",
    {
      title: "Add a sound effect",
      description:
        [
          "Puts a built-in sound effect (an id from list_sound_effects) on the timeline at a second, on the bottom audio track. The file is added to the project's media the first time and reused after.",
          "Two sounds at the same moment (a whoosh and a shutter) go on separate audio tracks on their own with track \"auto\".",
          "`trimStart` and `duration` play one slice of the file: a burst of clicks (a shutter) is trimmed to one click with trimStart 0, duration 0.16.",
        ].join(" "),
      inputSchema: z.object({
        effectId: z.string().min(1).max(64),
        at,
        volume,
        trimStart: z.number().min(0).max(60).optional().describe("Seconds into the sound to start from. Default 0."),
        duration: z.number().min(0.03).max(60).optional().describe("Seconds to play. Default: the rest of the sound."),
        track: trackChoice,
        projectId,
      }),
    },
    handled(async ({ effectId, projectId, ...place }: Placement & { effectId: string; projectId?: string }, ctx) => {
      const effect = findSoundEffect(effectId)
      if (!effect) throw new AgentError(`No sound effect "${effectId}". list_sound_effects shows the ids.`)
      const userId = agentUserId(ctx)
      const project = await resolveProject(userId, projectId)

      const name = `sfx · ${effect.name}.${effect.file.split(".").pop()}`
      const existing = (await listMedia(project.id)).find((media) => media.kind === "audio" && media.name === name)
      const mediaId = existing?.id ?? (await addSound(userId, project, await readFile(path.join(process.cwd(), "public", "sfx", effect.file)), name))
      return text(`Added ${await placeSound(userId, project, mediaId, place)}.`)
    })
  )

  server.registerTool(
    "upload_sound",
    {
      title: "Add a sound you made",
      description: [
        "Adds a sound you made yourself with code: a WAV (or MP3) sent as base64, at most 2 MB and 15 s (44.1 kHz, 16-bit, mono is plenty).",
        "Use it when no built-in effect fits: write the samples with a small script (a click, pop, whoosh, riser, hit, or a beat pattern) and send the file.",
        "It's added to the project's media; pass `at` to also put it on the timeline.",
      ].join(" "),
      inputSchema: z.object({
        name: z.string().trim().min(1).max(80).describe('What it is, e.g. "soft pop".'),
        data: z.string().min(16).describe("The file's bytes in base64."),
        at: at.optional(),
        volume,
        projectId,
      }),
    },
    handled(async (input: { name: string; data: string; at?: number; volume: number; projectId?: string }, ctx) => {
      const bytes = Buffer.from(input.data, "base64")
      if (bytes.length > MAX_SOUND_BYTES) throw new AgentError(`That file is ${(bytes.length / 1024 / 1024).toFixed(1)} MB; keep it under 2 MB (shorter, mono, 44.1 kHz).`)
      const type = soundType(bytes)
      if (!type) throw new AgentError("That isn't a WAV or MP3 file. Send the file's bytes in base64, starting with its RIFF/WAVE (or ID3) header.")

      const userId = agentUserId(ctx)
      const project = await resolveProject(userId, input.projectId)
      const mediaId = await addSound(userId, project, bytes, `made · ${input.name}.${type}`)
      if (input.at === undefined) return text(`Added the sound to the project's media as ${mediaId}. Place it with add_clip (kind "media").`)
      return text(`Added ${await placeSound(userId, project, mediaId, { at: input.at, volume: input.volume })} (mediaId ${mediaId}).`)
    })
  )
}
