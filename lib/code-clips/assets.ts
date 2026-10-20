import DOMPurify from "dompurify"

/*
 * Images and SVGs that code clips draw (M.image, M.svg). Drawing is synchronous, so the first
 * request starts a load and returns null; the clip redraws once it's ready (and an export frame
 * waits for it). Cached across clips and frames.
 */

type Entry<T> = { value: T | null; promise: Promise<void> | null }

const images = new Map<string, Entry<ImageBitmap>>()
const svgs = new Map<string, Entry<HTMLImageElement>>()
const LIMIT = 100

function remember<T>(cache: Map<string, Entry<T>>, key: string, entry: Entry<T>) {
  if (cache.size >= LIMIT) cache.delete(cache.keys().next().value!)
  cache.set(key, entry)
}

function request<T>(
  cache: Map<string, Entry<T>>,
  key: string,
  load: () => Promise<T>,
  track: (pending: Promise<unknown>) => void
): T | null {
  let entry = cache.get(key)
  if (!entry) {
    const created: Entry<T> = { value: null, promise: null }
    created.promise = load()
      .then((value) => void (created.value = value))
      .catch(() => undefined) // a broken file just never draws
      .finally(() => void (created.promise = null))
    remember(cache, key, created)
    entry = created
  }
  if (entry.promise) track(entry.promise)
  return entry.value
}

function imagekitHosts() {
  const hosts = new Set(["ik.imagekit.io"])
  try {
    const endpoint = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT
    if (endpoint) hosts.add(new URL(endpoint).hostname)
  } catch {}
  return hosts
}

/** An ImageKit image as an ImageBitmap (other hosts are refused). Null until loaded. */
export function requestImage(url: string, track: (pending: Promise<unknown>) => void): ImageBitmap | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error("M.image needs an image URL (an ImageKit file)")
  }
  if (parsed.protocol !== "https:" || !imagekitHosts().has(parsed.hostname)) {
    throw new Error("M.image only loads images from ImageKit")
  }
  return request(images, parsed.href, async () => createImageBitmap(await (await fetch(parsed.href)).blob()), track)
}

/**
 * SVG markup as a drawable image. Sanitised with DOMPurify's SVG profile first, and only ever
 * drawn as an image, so scripts and external loads inside it never run. Null until decoded.
 */
export function requestSvg(markup: string, track: (pending: Promise<unknown>) => void): HTMLImageElement | null {
  return request(
    svgs,
    markup,
    async () => {
      const clean = DOMPurify.sanitize(markup, { USE_PROFILES: { svg: true, svgFilters: true } })
      const url = URL.createObjectURL(new Blob([clean], { type: "image/svg+xml" }))
      const image = new Image()
      image.src = url
      await image.decode()
      return image
    },
    track
  )
}
