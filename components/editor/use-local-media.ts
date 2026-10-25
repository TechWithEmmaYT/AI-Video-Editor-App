"use client"

import { useQuery } from "@tanstack/react-query"
import { useEffect } from "react"

import { getMediaQueryFn, queryKeys } from "@/lib/api"
import { readLocalMedia, saveLocalMedia } from "@/lib/local-media"
import { originalMediaUrl } from "@/lib/media-url"
import { useLocalMediaStore } from "@/stores/local-media-store"
import type { Media } from "@/types/project"

/*
 * The preview plays video and audio from copies kept in this browser. A file uploaded here is
 * kept as it's uploaded; any other (added by the agent, uploaded elsewhere, or evicted) is
 * downloaded once in the background, one at a time, and plays from ImageKit until then.
 */

const loading = new Map<string, Promise<void>>()

function playsLocally(media: Media) {
  return media.kind === "video" || media.kind === "audio"
}

/** Mount once in the editor: finds or fetches a local copy of each of the project's files. */
export function useLocalMedia(projectId: string) {
  const { data: media } = useQuery({
    queryKey: queryKeys.media(projectId),
    queryFn: () => getMediaQueryFn(projectId),
  })

  useEffect(() => {
    useLocalMediaStore.getState().open(projectId)
    return () => useLocalMediaStore.getState().close()
  }, [projectId])

  useEffect(() => {
    if (!media) return
    let stopped = false

    async function loadMissing(list: Media[]) {
      for (const item of list) {
        if (stopped) return
        if (!playsLocally(item) || useLocalMediaStore.getState().sources[item.url]) continue
        await loadOnce(item.id, () => loadLocalCopy(projectId, item))
      }
    }

    loadMissing(media)
    return () => {
      stopped = true
    }
  }, [projectId, media])
}

/** Right after an upload: play the file from disk straight away, and keep a copy for next time. */
export function keepUploadedCopy(projectId: string, media: Media, file: File) {
  if (!playsLocally(media)) return
  useLocalMediaStore.getState().add(projectId, media.id, media.url, file)
  loadOnce(media.id, async () => {
    await storeCopy(media.id, file)
  })
}

function loadOnce(mediaId: string, load: () => Promise<void>) {
  const running = loading.get(mediaId)
  if (running) return running
  const next = load().finally(() => loading.delete(mediaId))
  loading.set(mediaId, next)
  return next
}

async function loadLocalCopy(projectId: string, media: Media) {
  const stored = await readCopy(media.id)
  if (stored === "unavailable") return
  const blob = stored ?? (await downloadCopy(media))
  if (blob) useLocalMediaStore.getState().add(projectId, media.id, media.url, blob)
}

async function downloadCopy(media: Media) {
  const downloaded = await download(media)
  if (!downloaded || !(await storeCopy(media.id, downloaded))) return null
  // Play the copy read back from IndexedDB, which is on disk; the download is held in memory.
  const stored = await readCopy(media.id)
  return stored === "unavailable" ? null : stored
}

// IndexedDB is a real boundary: it's missing in some private windows and refuses space when the
// disk is full. Either way the preview plays from ImageKit, as it did before.

async function readCopy(mediaId: string) {
  try {
    return await readLocalMedia(mediaId)
  } catch (error) {
    console.warn("Local media copies are unavailable in this browser; the preview streams from ImageKit.", error)
    return "unavailable"
  }
}

async function storeCopy(mediaId: string, blob: Blob) {
  try {
    await saveLocalMedia(mediaId, blob, new Set(useLocalMediaStore.getState().mediaIds))
    return true
  } catch (error) {
    console.warn(`Couldn't keep a local copy of ${mediaId}; it streams from ImageKit.`, error)
    return false
  }
}

async function download(media: Media) {
  try {
    const response = await fetch(originalMediaUrl(media.url))
    if (!response.ok) throw new Error(`ImageKit answered ${response.status}.`)
    return await response.blob()
  } catch (error) {
    console.warn(`Couldn't download "${media.name}"; it streams from ImageKit.`, error)
    return null
  }
}
