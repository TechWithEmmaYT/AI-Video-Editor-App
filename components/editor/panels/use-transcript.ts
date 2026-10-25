"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import {
  generateTranscriptMutationFn,
  queryKeys,
  removeTranscriptMutationFn,
  saveTranscriptMutationFn,
} from "@/lib/api"
import { parsePastedTranscript, parseSubtitleFile, type Transcript } from "@/lib/transcript"
import type { Media } from "@/types/project"

/** How often, and how long, to ask again while ImageKit is still transcribing. */
const POLL_MS = 5000
const POLL_LIMIT = 36 // 3 minutes

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Extension units ImageKit charges to transcribe this file: 2 per minute (rounded up). */
export function transcriptionUnits(durationSec: number | null) {
  return Math.max(1, Math.ceil((durationSec ?? 60) / 60)) * 2
}

/** Add / remove a media file's transcript, keeping the Media tab's list in step. */
export function useTranscript(projectId: string, media: Media) {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const ids = { projectId, mediaId: media.id }

  function setSource(transcriptSource: Media["transcriptSource"]) {
    queryClient.setQueryData<Media[]>(queryKeys.media(projectId), (list) =>
      list?.map((item) => (item.id === media.id ? { ...item, transcriptSource } : item))
    )
  }

  async function run(label: string, task: () => Promise<Media["transcriptSource"]>) {
    setBusy(true)
    const toastId = toast.loading(label)
    try {
      const source = await task()
      setSource(source)
      toast.success(source ? `Transcript added to "${media.name}"` : `Transcript removed from "${media.name}"`, { id: toastId })
    } catch (error) {
      toast.error("Couldn't update the transcript", { id: toastId, description: (error as Error).message })
    } finally {
      setBusy(false)
    }
  }

  async function save(transcript: Transcript) {
    const result = await saveTranscriptMutationFn({ ...ids, transcript })
    return result.status === "ready" ? result.transcriptSource : null
  }

  return {
    busy,

    /** ImageKit AI transcription; asks again while ImageKit answers "processing". */
    generate: () =>
      run(`Transcribing "${media.name}" with ImageKit…`, async () => {
        for (let attempt = 0; attempt < POLL_LIMIT; attempt++) {
          const result = await generateTranscriptMutationFn(ids)
          if (result.status === "ready") return result.transcriptSource
          await wait(POLL_MS)
        }
        throw new Error("ImageKit is still working on it. Try again in a minute.")
      }),

    /** An .srt or .vtt file. */
    fromFile: (file: File) =>
      run(`Reading ${file.name}…`, async () => {
        if (file.size > 5 * 1024 * 1024) throw new Error("Subtitle files can be up to 5 MB.")
        const transcript = parseSubtitleFile(await file.text())
        if (!transcript) throw new Error(`No timed lines found in ${file.name}. Use an .srt or .vtt file.`)
        return save(transcript)
      }),

    /** Pasted timed text. Throws (for the dialog to show) when there are no timestamps. */
    fromText: async (input: string) => {
      const transcript = parsePastedTranscript(input, media.durationSec)
      if (!transcript) throw new Error('Start each line with a time, like "0:07 So the first thing…", or paste SRT/VTT.')
      await run("Saving transcript…", () => save(transcript))
    },

    remove: () =>
      run("Removing transcript…", async () => {
        await removeTranscriptMutationFn(ids)
        return null
      }),
  }
}
