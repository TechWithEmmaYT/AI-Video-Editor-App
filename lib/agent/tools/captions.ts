import "server-only"

import type { McpServer } from "@modelcontextprotocol/server"
import { z } from "zod"

import { applyAgentEdit } from "@/lib/agent/apply"
import { markEmphasis, splitPhrases, wordsIn } from "@/lib/agent/captions"
import { addClipOps } from "@/lib/agent/clip-spec"
import { AgentError, agentUserId, handled, text } from "@/lib/agent/context"
import { resolveProject } from "@/lib/agent/resolve"
import { captionSafeBox } from "@/lib/agent/frames"
import { findBuiltinElement } from "@/lib/elements/builtin"
import { getUserMedia } from "@/lib/media-transcript"
import { MAX_SECONDS } from "@/lib/project/formats"
import { applyOps, type Op } from "@/lib/project/ops"
import { formatTimestamp } from "@/lib/transcript"

/** How many captions one call will lay down, so a long file can't fill the timeline by accident. */
const MAX_PHRASES = 240

/** Each `look` and the caption element that draws it. The Modern looks come first. */
const CAPTION_LOOKS = {
  crisp: "crisp-caption",
  "lead-in": "lead-in-caption",
  accent: "accent-caption",
  "heavy-fill": "heavy-caption",
  kinetic: "kinetic-caption",
} as const

type CaptionLook = keyof typeof CAPTION_LOOKS

export function registerCaptionTools(server: McpServer) {
  server.registerTool(
    "add_captions",
    {
      title: "Caption a whole stretch of speech",
      description: [
        "Lays a caption clip for every phrase in a media file's transcript, with each word's time filled in — the whole caption track in one call, instead of one add_clip per phrase.",
        "Needs a transcript on the media file (get_media_transcript shows whether there is one).",
        "`look` picks the caption element. The Modern looks, for Reels, TikTok and Shorts: \"crisp\" (the default for 9:16: Montserrat Bold, lowercase and a little tight, white with the key word in a warm accent, a soft shadow, words popping in on their timings, in the caption safe zone), \"lead-in\" (a small faint line of the lesser words over the key word, big on a red box), \"accent\" (white Poppins with the key word in purple and a line drawing on under it), \"heavy-fill\" (huge tight heavy type in a soft pink wash filling the width, the key word in solid red). Then \"kinetic\", the Kinetic Caption, the default for 16:9 and 1:1.",
        "`style` overrides that element's params, set the same on every caption. Pick the accent colours from the video and your reference (emphasisColor for the key word, accentColor for the rare ~punch~ word), never just the defaults. get_guide({ topic: \"briefs\" }) gives the style for an edit.",
        "Returns how many captions it added and the range they cover.",
      ].join(" "),
      inputSchema: z.object({
        mediaId: z.string().min(1).max(64).describe("The speaker's media file (a clip's mediaId)."),
        clipId: z
          .string()
          .min(1)
          .max(64)
          .optional()
          .describe("The clip playing that file, used to turn source time into timeline time. Default: the first clip using this media."),
        from: z.number().min(0).optional().describe("Start of the stretch to caption, in seconds of the source file. Default: the beginning."),
        to: z.number().min(0).optional().describe("End of the stretch, in seconds of the source file. Default: the end."),
        maxWords: z.number().int().min(1).max(12).default(4).describe("Most words in one caption. Phrases also break at sentence ends and pauses."),
        linesPerPhrase: z.number().int().min(1).max(3).default(1).describe('Lines stacked in one caption clip (for mode "lines").'),
        pauseSeconds: z.number().min(0.05).max(2).default(0.45).describe("A gap this long or longer always ends a phrase."),
        emphasis: z.boolean().default(true).describe("Mark one word per phrase as the emphasis word."),
        look: z
          .enum(["crisp", "lead-in", "accent", "heavy-fill", "kinetic"])
          .optional()
          .describe('Modern: "crisp", "lead-in", "accent", "heavy-fill". Classic: "kinetic". Default: "crisp" for 9:16, "kinetic" otherwise.'),
        style: z.record(z.string(), z.unknown()).default({}).describe("Caption params to override: font, weight, color, mode, highlight, animation…"),
        box: z
          .object({ x: z.number(), y: z.number(), width: z.number().positive(), height: z.number().positive() })
          .partial()
          .optional()
          .describe("Where the captions sit. Default: crisp in the caption safe zone (x 6%, y 53%, width 88%, height 21%: clear of the face and of the app's buttons), the other Modern looks mid-screen, kinetic the top third."),
        track: z.union([z.enum(["auto", "new-top"]), z.string().min(1).max(64)]).default("new-top").describe("All the captions go on this one track."),
        projectId: z.string().min(1).max(64).optional().describe("Defaults to the project open in the editor."),
      }),
    },
    handled(
      async (
        input: {
          mediaId: string
          clipId?: string
          from?: number
          to?: number
          maxWords: number
          linesPerPhrase: number
          pauseSeconds: number
          emphasis: boolean
          look?: CaptionLook
          style: Record<string, unknown>
          box?: { x?: number; y?: number; width?: number; height?: number }
          track: string
          projectId?: string
        },
        ctx
      ) => {
        const userId = agentUserId(ctx)
        const project = await resolveProject(userId, input.projectId)

        const media = await getUserMedia(userId, input.mediaId)
        if (!media || media.projectId !== project.id) {
          throw new AgentError(`No media file "${input.mediaId}" in this project. list_media shows them.`)
        }
        if (!media.transcript) {
          throw new AgentError(
            `"${media.name}" has no transcript yet, so there are no word times to caption with. Ask the user to add one from its card in the Media tab: Generate with ImageKit, Upload .srt/.vtt, or Paste.`
          )
        }

        // The clip decides where a source second lands on the timeline.
        const speaker = input.clipId
          ? project.doc.clips.find((clip) => clip.id === input.clipId)
          : project.doc.clips.find((clip) => "mediaId" in clip && clip.mediaId === input.mediaId)
        if (!speaker) throw new AgentError(`No clip in this project plays "${media.name}" yet. Add it first, then caption it.`)
        const trimStart = "trimStartFrames" in speaker ? speaker.trimStartFrames : 0

        // By default only what the clip plays: words cut away by its trim would land outside it.
        const playedFrom = trimStart / project.fps
        const from = input.from ?? playedFrom
        const to = input.to ?? playedFrom + speaker.durationInFrames / project.fps
        const words = wordsIn(media.transcript, from, to)
        if (words.length === 0) throw new AgentError(`The transcript has nothing between ${formatTimestamp(from)} and ${formatTimestamp(to)}.`)

        const phrases = splitPhrases(words, {
          maxWords: input.maxWords,
          pauseSeconds: input.pauseSeconds,
          linesPerPhrase: input.linesPerPhrase,
        }).map((phrase) => (input.emphasis ? markEmphasis(phrase) : phrase))

        if (phrases.length > MAX_PHRASES) {
          throw new AgentError(
            `That stretch would make ${phrases.length} captions, past the ${MAX_PHRASES} one call adds. Caption it in parts with from/to.`
          )
        }

        const look = input.look ?? (project.format === "9:16" ? "crisp" : "kinetic")
        const element = findBuiltinElement(CAPTION_LOOKS[look])
        if (!element) throw new AgentError(`The caption element for the "${look}" look is missing.`)

        // Crisp sits in the caption safe zone; the other Modern looks mid-screen, with the height for a
        // big key word (heavy fill the most).
        const tall = look === "heavy-fill" ? 0.3 : 0.24
        const box =
          input.box ??
          (look === "crisp"
            ? captionSafeBox(project.width, project.height)
            : look === "kinetic"
              ? undefined
              : {
                  x: Math.round(project.width * 0.06),
                  y: Math.round(project.height * (0.48 - tall / 2)),
                  width: Math.round(project.width * 0.88),
                  height: Math.round(project.height * tall),
                })

        // Source second → timeline second, through the clip that plays the file.
        const onTimeline = (sourceSeconds: number) => (speaker.from - trimStart) / project.fps + sourceSeconds

        let added = 0
        let track = input.track
        await applyAgentEdit(userId, project.id, (state) => {
          added = 0
          track = input.track
          const ops: Op[] = []
          // Each caption is placed against the project as the ones before it left it, so the
          // track the first one makes exists for the rest.
          let working = state
          for (const [index, phrase] of phrases.entries()) {
            const next = phrases[index + 1]
            // A caption holds until the next one starts, or a beat past its last word at a pause.
            const until = next ? Math.min(next.start, phrase.end + 0.3) : phrase.end + 0.3
            const at = onTimeline(phrase.start)
            // At least 0.6 s on screen, but never into the next caption on the same track; the frame
            // taken off keeps rounding to frames from making the two touch.
            const room = next ? next.start - phrase.start - 1 / project.fps : Infinity
            const duration = Math.min(room, Math.max(0.6, until - phrase.start))
            if (at + duration > MAX_SECONDS) break

            const result = addClipOps(
              working,
              {
                kind: "element",
                elementId: element.id,
                at,
                duration,
                params: { ...input.style, text: phrase.text, times: phrase.times },
                box,
                // Every caption lands on the same track: the first makes it, the rest join it.
                track,
                animateIn: undefined,
                animateInFrames: undefined,
                animateOut: undefined,
                animateOutFrames: undefined,
              },
              { width: project.width, height: project.height, newId: () => crypto.randomUUID(), element }
            )
            ops.push(...result.ops)
            working = applyOps(working, result.ops)
            const addTrack = result.ops.find((op) => op.type === "addTrack")
            if (addTrack && "track" in addTrack) track = addTrack.track.id
            added++
          }
          return ops
        })

        if (added === 0) throw new AgentError(`Those captions would start past the ${MAX_SECONDS} s a project can run.`)
        const first = onTimeline(phrases[0].start)
        const last = onTimeline(phrases[added - 1].end)
        return text(
          `Added ${added} captions from ${formatTimestamp(first)} to ${formatTimestamp(last)}, ${input.maxWords} words at most each. Check them with get_project.`
        )
      }
    )
  )
}
