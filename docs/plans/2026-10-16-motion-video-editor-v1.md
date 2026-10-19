# motion v1 — implementation plan

- **Date:** 2026-10-16
- **Status:** approved spec → implementation
- **Designs:** `_designs/` (home-screen, create-project-dialog + frames, editor-screen, settings). Where a screenshot and this plan disagree, **this plan wins**; the screenshots set the look (dark, orange accent, rounded cards, heavy display headings).

---

## 1. Product summary

A browser video editor. The user builds a video on a multi-track timeline; their **own Claude Code** connects over MCP with an API key and edits the same project live. No built-in chat.

**Flow:** sign up → dashboard → New project modal (name, format, length) → editor. No prompt/setup step.

### In v1
| Area | Scope |
|---|---|
| Auth | Email + password only (Better Auth). Sessions stored in Neon, **7-day expiry** (`updateAge` 1 day). |
| Nav | Logo, Projects (works), **Autopilot / Guide = plain text, not clickable**, Claude & keys (works), theme toggle, New project, avatar menu. |
| Home `/app` | Greeting, "Your projects", stats (`N projects`, `N seconds of video`), "How it works" button (inert), project grid or empty state ("Open the demo" inert), Connect Claude Code card with copy command, side cards (Open the demo – inert, API keys → settings, The guide – inert). |
| New project modal | Name + Format (16:9 / 9:16 / 1:1) only — **no length picker** (decided 2026-10-17). Projects start at 15 s (`DEFAULT_SECONDS`); the API/MCP still accept `durationSeconds` (≤ 300 s). Format UI copies `frames.png` (segmented control, preview tile, title + resolution line). Create → editor. |
| Settings `/app/settings` | Account (name, email, Sign out), Connect Claude (command + copy), API keys (create / list / revoke). No plans, sounds, or data export. |
| Editor | Top bar, left panel, canvas (Remotion Player), timeline. Details in §6. |
| Claude | MCP server at `/api/mcp`, API-key bearer auth, tools in §8. |
| Export | Trigger.dev task → Remotion render → MP4 to ImageKit → MP4 + HLS links. |

### Out of v1
Billing/plans, Autopilot, Guide, demo project, Google sign-in, email verification/reset emails, **keyframes** (Motion = static values), repo connection / prompt / song / narrator / references / model pickers, "Edit this" pill, interface sounds, data download/account deletion, teams/sharing, concurrent-edit handling, 4:5 format, activity feed.

---

## 2. Stack & packages

Pin every `remotion` / `@remotion/*` package to **the same exact version**. Check React 19.3 / Next 16.4 compatibility as each package is installed.

| Concern | Packages |
|---|---|
| Framework | `next@16.4.2`, `react@19.3` (installed). **Next 16 rules:** `proxy.ts` replaces middleware; route `params` are Promises. **`cacheComponents` is on:** never await the session, `params` or `searchParams` at the top of a layout/page; read them in a component inside `<Suspense>` (see `node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md`). Read `node_modules/next/dist/docs/` before writing routes. |
| UI | shadcn (`base-nova`, Base UI — installed), `lucide-react`, `next-themes`, `sonner`. **Animate UI is used only for Tabs** (Base UI variant, from the Animate UI shadcn registry; brings `motion`). |
| State | `zustand` + `immer` |
| Data fetching | `@tanstack/react-query` + `axios`. **Every client data function lives in `lib/api.ts`** (`getProjectsQueryFn`, `createProjectMutationFn`, `signInMutationFn`, … plus `queryKeys`); components import them into `useQuery`/`useMutation`. App routes go through the axios instance; auth goes through the Better Auth client. Shared request/response types live in `types/` (`types/project.ts`, `types/api.ts`). |
| DB | `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless` (+ `ws` for the Pool in Node) |
| Auth | `better-auth`, `@better-auth/api-key` (server `apiKey()`, client `apiKeyClient()` from `@better-auth/api-key/client`) |
| Preview/render | `remotion`, `@remotion/player`, `@remotion/google-fonts`, Remotion's recommended `<Video>/<Audio>` for the pinned version, `@remotion/bundler` (build script), `@remotion/renderer` (Trigger task) |
| Media | `@imagekit/next` (client `upload()`, server `getUploadAuthParams` from `@imagekit/next/server`), `@imagekit/nodejs` (server-side upload in the task / from URL) |
| Jobs | `@trigger.dev/sdk`, `@trigger.dev/build`, `trigger.dev` CLI (dev) |
| MCP | `mcp-handler@^2` + peer `@modelcontextprotocol/server@^2`, `zod@^4.2` (Streamable HTTP, stateless, **no Redis needed for MCP**) |
| Realtime (prod) | `redis` (node-redis, TCP `REDIS_URL` — Vercel Marketplace Redis / Upstash) |
| Code clips | `acorn`, `acorn-walk`, `magic-string`, `@uiw/react-codemirror` + `@codemirror/lang-javascript` |
| Misc | `nanoid`, `vitest` |

### Env vars (`.env.local`, Vercel, Trigger.dev)
```
DATABASE_URL=                 # Neon pooled
DATABASE_URL_UNPOOLED=        # migrations
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=              # http://localhost:3000 / prod URL
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY=
NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT=
IMAGEKIT_PRIVATE_KEY=
TRIGGER_SECRET_KEY=
INTERNAL_CALLBACK_SECRET=     # HMAC for task → app callbacks
REDIS_URL=                    # PRODUCTION ONLY. Unset locally ⇒ in-memory bus
```
Trigger.dev env (synced): `DATABASE_URL`, `IMAGEKIT_*`, `APP_URL`, `INTERNAL_CALLBACK_SECRET`.

---

## 3. Folder layout

```
proxy.ts                               # optimistic auth redirect (cookie check only)
drizzle.config.ts
trigger.config.ts
db/
  schema.ts  auth-schema.ts  index.ts  # db (neon-http) + withTx() (neon-serverless Pool)
app/
  page.tsx                             # / = landing page (hero from _designs/image.png)
  brand.css                            # brand tokens; imported after globals.css (survives shadcn rewrites)
  (auth)/sign-in/page.tsx  sign-up/page.tsx
  app/page.tsx                         # /app = home (dashboard)
  app/settings/page.tsx                # /app/settings = Claude & keys
  app/editor/[projectId]/page.tsx      # /app/editor/:id = full-screen editor, no nav
  api/auth/[...all]/route.ts
  api/mcp/route.ts
  api/projects/[id]/ops/route.ts
  api/projects/[id]/events/route.ts    # SSE
  api/projects/[id]/media/route.ts
  api/projects/[id]/exports/route.ts
  api/imagekit/auth/route.ts
  api/editor-state/route.ts
  api/internal/exports/route.ts        # Trigger callback (HMAC)
types/   project.ts api.ts                # shared TS types (client + server)
lib/
  api.ts                               # axios instance, queryKeys, every queryFn/mutationFn
  api-route.ts                         # route-handler helpers (session, error responses)
  projects.ts                          # server-only data access for projects
  auth.ts  auth-client.ts  session.ts
  media-drag.ts                        # drag contract: media card → timeline
  project/  schema.ts ops.ts (reducer + inverses) drop.ts placement.ts edit.ts snap.ts timecode.ts formats.ts validation.ts
  realtime/ bus.ts memory-bus.ts redis-bus.ts sse.ts use-project-events.ts
  code-clips/ validate.ts instrument.ts compile.ts helpers.ts params.ts
  elements/ builtin/*.ts index.ts
  mcp/ tools.ts resolve.ts
  imagekit.ts fonts.ts colors.ts
remotion/
  index.ts Root.tsx Main.tsx ClipLayer.tsx
  clips/ VideoClip.tsx ImageClip.tsx AudioClip.tsx TextClip.tsx CodeClip.tsx
trigger/render-video.ts
scripts/bundle-remotion.ts
stores/editor-store.ts
components/
  ui/ (shadcn + animate-ui tabs; never hand-edit, they get regenerated)
  brand/ pill-button.tsx logo.tsx filled-input.tsx   # design-specific variants live here, not in ui/
  nav/  dashboard/  new-project/  settings/
  editor/ top-bar.tsx canvas.tsx playback-bar.tsx export-menu.tsx
  editor/panels/ media.tsx text.tsx elements.tsx claude.tsx
  editor/inspector/ style-*.tsx motion.tsx
  timeline/ timeline.tsx toolbar.tsx ruler.tsx playhead.tsx sections-row.tsx track-header.tsx track-lane.tsx clip-item.tsx
```

---

## 4. Data model (Drizzle / Neon)

**Better Auth tables** (generated with the Better Auth CLI, Drizzle adapter, provider `pg`): `user`, `session`, `account`, `verification`, `apikey`.

```ts
project      { id text pk, userId fk, name, format '16:9'|'9:16'|'1:1', width, height, fps int default 30,
               durationInFrames int, doc jsonb, version int default 0, thumbnailUrl?, createdAt, updatedAt }
               index(userId, updatedAt)
media        { id, projectId fk cascade, userId, kind 'video'|'image'|'audio', name, mime, size,
               imagekitFileId, filePath, url, thumbnailUrl?, width?, height?, durationSec?, createdAt }
element      { id, userId, name, category, code text, paramSchema jsonb, defaultParams jsonb, fonts jsonb,
               defaultDurationInFrames, createdBy 'user'|'claude', createdAt, updatedAt }   # "Mine" only; built-ins live in code
export       { id, projectId fk cascade, userId, status 'queued'|'rendering'|'uploading'|'done'|'failed',
               progress real, triggerRunId?, mp4Url?, hlsUrl?, imagekitFileId?, error?, createdAt, finishedAt? }
editor_state { userId pk, projectId?, selectedClipId?, updatedAt }       # lets Claude resolve "this"
claude_status{ userId pk, lastSeenAt }                                   # updated on each MCP request
```

Neon is **never polled**. It stores auth sessions and app data. Live fan-out goes through the event bus (§5.3).

### Formats (`lib/project/formats.ts`)
| Format | Size | Label |
|---|---|---|
| 16:9 | 1920×1080 | Landscape · YouTube, web |
| 9:16 | 1080×1920 | Vertical · Reels, TikTok, Shorts |
| 1:1 | 1080×1080 | Square · Feed posts |

---

## 5. Project document, ops, realtime

### 5.1 Document (`lib/project/schema.ts`, zod, shared client/server/MCP/render)
```ts
Doc      = { tracks: Track[]; clips: Clip[]; sections: Section[] }
Track    = { id; name? }                 // array order: index 0 = TOP row = draws on top
Section  = { id; name; from; to; color }  // frames
ClipBase = { id; trackId; type; name; color; from; durationInFrames;
             transform: { x; y; width; height; scale; rotation; opacity } }   // composition px; Motion tab edits this
VideoClip = ClipBase & { type:'video'; mediaId; src; trimStartFrames; volume; fit:'cover'|'contain'|'fill' }
ImageClip = ClipBase & { type:'image'; mediaId; src; fit; radius }
AudioClip = ClipBase & { type:'audio'; mediaId; src; trimStartFrames; volume; fadeInFrames; fadeOutFrames }
TextClip  = ClipBase & { type:'text'; text; fontFamily; fontWeight; fontSize; color; align; letterSpacing; lineHeight }
CodeClip  = ClipBase & { type:'code'; code; params; paramSchema: ParamDef[]; fonts: string[]; radius; elementId? }
ParamDef  = { key; label; type:'number'|'color'|'text'|'select'|'boolean'|'font'|'image'; default; min?; max?; step?; options? }
```
Times are integer **frames** at 30 fps. The UI shows `m:ss.f`.

### 5.2 Ops (`lib/project/ops.ts`)
This is a pure reducer (immer), shared by the browser, the ops route and the MCP tools. Ops are a zod discriminated union:
`addTrack, removeTrack, moveTrack, addClip, updateClip(patch), removeClip, moveClip(trackId, from), trimClip, splitClip(atFrame), addSection, updateSection, removeSection, updateProject(name|format|durationInFrames)`.
- `inverse.ts` computes the inverse op for undo.
- `placement.ts` handles placement:
  - **auto-create track on drop.** A drop above the first track, below the last, or onto a free gap creates a track.
  - **audio goes to the bottom.** A new track for an audio clip is appended at the end. A new track for a visual clip is inserted at the top or at the drop position.
  - "Any clip on any track" stays allowed.
- `removeTrack` runs automatically when a track becomes empty (assumption, keeps the timeline tidy).

**Server apply (`lib/project/apply.ts`)**
1. `withTx`, using the neon-serverless Pool: `SELECT doc, version … WHERE id=$1 AND user_id=$2 FOR UPDATE`.
2. Reduce the ops.
3. Validate the doc with zod. **Run the code-clip validator on any changed code** (§7).
4. `UPDATE` the doc with `version+1`.
5. `bus.publish('project:'+id, { type:'ops', ops, version, source, clientId })`.

The row lock serialises Claude's parallel tool calls. Otherwise **the last write wins**, with no conflict handling.

**Browser sync**
- Zustand `dispatch(op)` applies the op locally, pushes `{op, inverse}` to history, and POSTs `/api/projects/:id/ops` with `clientId`.
- Drags preview locally and commit **one op on pointer-up**.
- Incoming SSE `ops` events with this tab's `clientId` are ignored.
- If `version` jumps by more than 1, the client refetches the doc.
- Undo/redo covers local ops only and sends the inverse as a normal op. It is skipped if the target clip is gone.

### 5.3 Realtime: SSE with an EventBus (Vercel's documented pattern)
```ts
interface EventBus {
  publish(channel: string, event: AppEvent): Promise<string>                  // returns event id
  subscribe(channel: string, lastEventId: string | null, on: (id, e) => void): Promise<() => void>
}
```
- **Local (`REDIS_URL` unset): `memory-bus.ts`.** `Map<channel, Set<listener>>` plus a ring buffer of the last 200 events per channel for `Last-Event-ID` replay. Stored on `globalThis` so it survives HMR. The Trigger dev worker reaches it via the HTTP callback (§9), so a single process is enough.
- **Production (`REDIS_URL` set): `redis-bus.ts`**, following Vercel's realtime guide:
  - publish: `XADD stream:{channel} MAXLEN ~ 200 * e <json>` then `PUBLISH {channel} <id>`.
  - subscribe: `XRANGE` after `lastEventId` for replay, then one shared subscriber connection per instance, ref-counted per channel, fanning out to local listeners.
- **Channels:**
  - `project:{id}`: ops, media added, export progress.
  - `user:{id}`: Claude status/activity, element saved, selection echo.
- **SSE route `GET /api/projects/[id]/events`:**
  - Node runtime with `maxDuration = 300`.
  - Checks ownership, then subscribes to both channels.
  - Writes `id:/event:/data:` frames, with a `: ping` heartbeat every 15 s.
  - **Closes itself at ~290 s.** `EventSource` reconnects with `Last-Event-ID` and the replay fills the gap.
- Event types: `ops`, `media`, `export`, `claude`, `element`.

---

## 6. Editor UI

Layout follows `editor-screen.png`: a top bar, then the left panel and canvas side by side, then a resizable timeline.

**Top bar:** ‹ Projects · project name (inline rename) · theme toggle · format chip (`16:9`), which opens the Format & length sheet · **Export** button with a dropdown (§9).

**Left panel:** Animate UI Tabs.
- **No selection:** `Media | Text | Elements | Claude`
  - **Media.** Drop zone or file picker, filtered to the allowed types and ≤ 500 MB.
    1. Instant local preview via `URL.createObjectURL`. For video, the poster frame and duration are probed with `<video>`.
    2. `GET /api/imagekit/auth`, then `upload()` with `onProgress`, which drives the **progress ring**. Cancel via `AbortController`.
    3. On success, `POST /api/projects/:id/media` saves the row.
    4. The card only becomes **draggable after the upload finishes**.

    Thumbnails come from ImageKit (`tr=w-320`; video `…/ik-thumbnail.jpg`). Upload folder: `/motion/{userId}/{projectId}/`.
  - **Text.** Presets: Title, Subtitle, Body, Caption, Label, Quote. Each card is rendered in its font. Click adds at the playhead, or drag onto the timeline.
  - **Elements.**
    - Search, plus category chips: All · Titles · Lower thirds · Logos · Backgrounds · Transitions · Callouts · Mine.
    - **2-column grid.** Cards show a still at `u=0.5`; **hover plays the code live on a small canvas**.
    - Click adds at the playhead on the top free track. Drag drops at a position.
    - "Mine" shows a small Claude badge on elements Claude saved.
  - **Claude.**
    - The connect command (with a "Create key" shortcut).
    - A status dot: *Not connected* / *Connected · seen 2m ago* / *Working…*, which pulses when a `claude` event arrived in the last 10 s.
    - What "this" currently means (open project and selected clip).
- **Clip selected:** `Style | Motion`. The panel header shows the clip name, its type, duplicate and delete.
  - **Style:**
    - **code:** CodeMirror editor (validated as you type, errors inline), params form generated from `paramSchema`, fonts multi-select, opacity, radius, "Save as element".
    - **text:** content, font, weight, size, colour, alignment, letter spacing, line height.
    - **video:** name, ImageKit source with Replace (opens a media picker or upload), fit, starts at (`trimStartFrames`), volume.
    - **image:** source and Replace, fit, radius.
    - **audio:** source and Replace, volume, fade in, fade out.
  - **Motion:** position x/y, scale, rotation, opacity. Static values only.
- Pressing Escape or clicking an empty canvas or timeline spot deselects and returns to the main tabs.

**Canvas:**
- Remotion `<Player>` with `controls={false}`, on a dotted background.
- Zoom −/＋, a % readout, and Fit.
- **Playback bar where the "Edit this" pill was:** previous frame or section, play/pause, next, and the timecode.
- The selected clip gets an outline only. There's no drag or resize on the canvas in v1.

**Timeline:**
- **Toolbar:** select tool, split tool (scissors), timecode `0:04.5`, |◀ ▶ ▶|, total time, undo/redo, **snap** toggle (the layers icon in the design), zoom −/slider/＋, collapse.
- **Ruler:** click or drag to scrub. The playhead is synced with the Player (`seekTo` and `frameupdate`).
- **Sections row:** drag on empty space to create a section, rename inline, drag edges to resize, colour menu, delete. The ♫ › control is inert.
- **Track headers:** a colour chip per clip, showing the clip type's icon in its colour, with `+N` overflow.
- **Clip colours:** code = teal, text = purple, video = orange, image = blue, audio = green.
- **Clips:**
  - Drag to move, within or across tracks.
  - Trim handles on both edges.
  - With snap on, clips snap to clip edges, the playhead, section edges and whole seconds.
  - Split at the playhead with the S key or the scissors tool.
  - Backspace deletes.
- **Keys:** space plays/pauses, ←/→ step one frame, Cmd/Ctrl+Z undoes, Shift+Cmd/Ctrl+Z redoes, Ctrl+wheel zooms.
- Dropping media, text presets or elements auto-creates tracks (§5.2). The top track renders on top.

**Remotion composition (`remotion/Main.tsx`):**
- `Main` renders tracks in reverse order, so track 0 is drawn last and ends up on top.
- Each clip is wrapped as `<Sequence from durationInFrames layout="none"><ClipLayer>`.
- `ClipLayer` positions the box from `transform` (translate, scale, rotate, opacity).
- Audio fades use a volume callback.
- Fonts load through `@remotion/google-fonts`, with a curated list of about 20 in `lib/fonts.ts`.
- **The same composition is used by the Player and the export render.**

---

## 7. Code clips (+ how AI-written code is checked)

**Contract**
```js
// body of: function (ctx, t, u, w, h, p, M) { ... }
// t = seconds since clip start, u = progress 0–1, w/h = clip box px, p = params, M = helpers
```
The wrapper (`remotion/clips/CodeClip.tsx`) works like this:
- It sizes a canvas to the clip box (× devicePixelRatio in the Player, ×1 when rendering).
- Each frame it runs `ctx.setTransform(…)`, `clearRect`, then the function inside `try/catch`.
- Layout comes from `ClipLayer`. Opacity and radius come from CSS on the wrapper (`opacity`, `border-radius` + `overflow:hidden`). **The code only draws.**
- Declared `fonts` are awaited with `delayRender` and `document.fonts.load`.
- Errors draw a red error box on the clip and appear in the Style tab. The rest of the preview keeps running.

**Helpers `M`** (frozen, null-prototype object):
- **math:** `lerp`, `clamp`, `map`, `ease.{inOut,outCubic,outBack,inOutQuint,…}`, `spring(u, opts)`, `rand(seed)`, `noise2(x, y)`
- **drawing:** `roundRect`, `fitText(ctx, text, maxW, size)`, `font(family, weight, size)`, `mix(c1, c2, k)`, `alpha(c, a)`
- **images:** `image(mediaIdOrUrl)` returns a preloaded `ImageBitmap`, ImageKit host only
- **SVG:** `svg(markup)` turns SVG markup into an image, and `path(d)` returns a `Path2D`

**Checking AI code, in layers.** This follows the guidance to allow-list the AST rather than the text, deny by default, and pair static checks with runtime guards.

1. **Static validation (`validate.ts`, acorn + acorn-walk).** It runs **on the server for every write** (ops route, MCP tools, element save) and again in the browser before compiling.
   - **Allowed nodes only.** No `import()`, `import.meta`, `with`, `this`, `async/await`, generators, `class`, tagged templates, getters/setters or labels.
   - **Free identifiers** must be a parameter (`ctx t u w h p M`), a local, or a safe global: `Math Number String Boolean Array Object JSON Path2D isFinite isNaN parseFloat parseInt NaN Infinity undefined`. This blocks `window`, `document`, `globalThis`, `self`, `fetch`, `eval`, `Function`, `localStorage`, `setTimeout` and the rest.
   - **Banned property names** (dot or literal): `constructor __proto__ prototype caller callee arguments __defineGetter__ __defineSetter__ __lookupGetter__ __lookupSetter__ canvas ownerDocument defaultView`. `ctx.canvas` is the path back to `window`.
   - `new` is only allowed on `Path2D`, `Array`, `Float32Array` and `Uint8ClampedArray`.
   - `Object.*` is limited to `keys values entries assign freeze`.
   - Code is capped at 20 KB.
   - Errors return `{ message, line, column }`, so **Claude can fix and retry**.
2. **Instrumentation (`instrument.ts`, magic-string).**
   - Computed access `a[b]` is rewritten to `__g(a, b)`, and assignment to `__s(a, b, v)`. These throw on banned keys at runtime, which closes `p['con'+'structor']`.
   - `__tick()` is injected at the top of every loop body and function body. It throws when one frame goes past **200k ticks or 50 ms**, so infinite loops can't freeze the tab or the render.
3. **Compile (`compile.ts`).** `new Function('ctx','t','u','w','h','p','M','__g','__s','__tick', '"use strict";' + code)`. The result is cached by code hash. `p` is passed as a frozen copy.
4. **SVG** is only ever drawn as an image (`<img>`-style decoding blocks scripts and external loads) after a DOMPurify SVG-profile pass. SVG path data goes through `Path2D`.
5. **Tests** (§11) include known escape attempts.

**Elements:**
- **Built-ins** live in `lib/elements/builtin/` (~15). A unit test checks that every built-in passes the validator.
  - Titles: Big Title, Kinetic Words, Typewriter
  - Lower thirds: Bar Lower Third, Pill Name Tag
  - Logos: SVG Logo Reveal, Logo Spin
  - Backgrounds: Gradient Mesh, Dot Grid, Noise Waves
  - Transitions: Wipe, Circle Reveal
  - Callouts: Arrow Pointer, Highlight Box, Badge Pop
- **"Mine"** is the `element` table. The user can save from the Style tab, and Claude can save via MCP.

---

## 8. MCP (Claude Code)

- **Route `app/api/mcp/route.ts`.** `createMcpHandler(initialize, options)` wrapped in `withMcpAuth(verifyToken)`, exported as `GET`/`POST`. It uses stateless Streamable HTTP.
- **`verifyToken`** reads `Authorization: Bearer <key>` and calls `auth.api.verifyApiKey({ body: { key } })`. It returns `authInfo` with `extra.userId`, upserts `claude_status.lastSeenAt`, and publishes a `claude` event on `user:{id}`. Handlers read `ctx.http?.authInfo`.
- **Connect command** (dashboard, settings and the Claude tab):
  `claude mcp add --scope user --transport http motion {APP_URL}/api/mcp --header "Authorization: Bearer <API_KEY>"`
- **API keys** are created in Settings, with a name and an expiry of **7 days (default)**, 30 days or never. The key is shown once. Each row lists name, start, created, last used and expires, and can be revoked.
- **Tools** (zod inputs; every mutation goes through `applyOps(..., { source: 'claude' })`):
  - **Projects:**
    - `list_projects`
    - `get_project(projectId?)`, which returns the doc plus a compact summary
    - `create_project(name, format, seconds)`
    - `update_project(name?, format?, seconds?)`
  - **Selection:**
    - `get_selection()` returns the open project and the selected clip, i.e. what "this" means
  - **Tracks and clips:**
    - `add_track(position?)`
    - `add_clip(clip, trackId? | "new-top" | "new-bottom")`
    - `update_clip(clipId | "this", patch)`
    - `delete_clip(clipId | "this")`
    - `split_clip(clipId, atSeconds)`
  - **Sections:**
    - `add_section` / `update_section` / `delete_section`
  - **Media:**
    - `list_media(projectId?)`
    - `add_media_from_url(url, name?)`, which uploads to ImageKit server-side and publishes a `media` event
  - **Elements:**
    - `list_elements(category?, query?)`, built-in plus mine
    - `get_element(id)`, returns the code and params schema
    - `save_element(name, category, code, paramSchema, defaultParams, fonts)` with `createdBy:'claude'`
    - `add_element(elementId, at?, params?)`
  - **Code help:**
    - `validate_code(code)`, a dry run of the validator
    - `get_code_clip_guide()`, which returns the `ctx,t,u,w,h,p,M` contract, the `M` reference, the allowed globals and an example
  - **Export:**
    - `export_project(projectId?)`
    - `get_export_status(exportId)`
- `projectId` defaults to the project open in the editor (`editor_state`). If none is open and none is given, the tool returns a clear error: "Open a project first, or pass projectId."
- **Editor reports state:** `POST /api/editor-state` runs on project open and on selection change (debounced 300 ms) and upserts `editor_state`.

---

## 9. Export (Trigger.dev + Remotion + ImageKit)

1. `POST /api/projects/:id/exports` inserts an `export` row (`queued`), runs `tasks.trigger('render-video', { exportId })`, and stores `triggerRunId`. The queue uses a `concurrencyKey` of `userId`, so each user has at most 1 render at a time.
2. **`trigger/render-video.ts`:**
   - Loads the export and project from Neon.
   - `selectComposition({ serveUrl: <bundle dir>, id: 'Main', inputProps })`, then `renderMedia({ codec: 'h264', outputLocation: '/tmp/<id>.mp4', browserExecutable: process.env.PUPPETEER_EXECUTABLE_PATH ?? null, onProgress })`.
   - Progress is throttled to about one update per second and sent as a callback.
   - Uploads to ImageKit with `@imagekit/nodejs` (folder `/motion/{userId}/exports/`).
   - `mp4Url` is the file URL plus `?ik-attachment=true` for download. `hlsUrl` is `{url}/ik-master.m3u8?tr=sr-240_360_480_720_1080`.
   - Marks the row `done`, or `failed` with the error.
3. **Callback `POST /api/internal/exports`** checks the HMAC (`INTERNAL_CALLBACK_SECRET`), updates the row and publishes an `export` event. This works in both local dev (the separate `trigger dev` process calls localhost) and production.
4. **Build:**
   - `scripts/bundle-remotion.ts` (`@remotion/bundler`) writes `.remotion-bundle/`.
   - `trigger.config.ts` uses the extensions `puppeteer()` (installs Chrome on deploy and sets `PUPPETEER_EXECUTABLE_PATH`) and `additionalFiles({ files: ['.remotion-bundle/**'] })`.
   - Remotion ships its own ffmpeg, so add `ffmpeg()` only if the spike shows it's needed.
   - Locally, Remotion downloads chrome-headless-shell itself.
   - Machine: start at a large preset, `maxDuration` about 900 s.
5. **Export menu** in the editor top bar:
   - Export now.
   - The running export with a progress bar.
   - A list of past exports with **Download MP4**, **Copy HLS link** and Retry for failed ones.
   - Output: 30 fps, 1080 px on the short side, up to 300 s.

---

## Progress (2026-10-18)

- **Done:** auth, home/new-project, project doc schema + ops reducer (`lib/project/schema.ts`, `ops.ts`), `POST /api/projects/[id]/ops` (version-checked save), editor store (`stores/editor-store.ts`), editor shell, canvas (Player, zoom/fit), timeline (ruler/scrub, playhead, sections, tracks, move/trim/split, snapping with Shift to bypass, undo/redo, shortcuts, resizable height), media drop.
- **Media tab:** UI only (react-dropzone zone + empty state). ImageKit upload, `/api/imagekit/auth`, `/api/projects/[id]/media` and the media cards are built by hand, outside this plan's automation. `media` table migration `0002_media.sql` is generated, not yet applied.
- **Not yet:** live updates (SSE), Style/Motion inspectors, Text/Elements/Claude tabs, code clips, MCP, export.
- **Media drag contract:** cards call `setMediaDragData(e, media)` from `lib/media-drag.ts` (type `application/x-motion-media`, payload `{ id, kind, name, url, thumbnailUrl, width, height, durationSec }`). The timeline turns a drop into ops with `planMediaDrop` (`lib/project/drop.ts`, unit-tested): clip at the drop frame, length from `durationSec` (images 5 s), audio to the bottom audio track, new tracks as needed, project grows to fit.
- **Remotion:** follow the `remotion-best-practices` skill — `<Video>`/`<Audio>` from `@remotion/media`, `<CanvasImage>` for stills, keep per-frame state out of the component that renders `<Player>`.

## 10. Phases

Each phase ends with `npm run typecheck && npm run lint` (add a `typecheck` script: `tsc --noEmit`) passing, plus the listed checks.

### Phase 0 — Foundations
- Install packages (§2). Add `typecheck` and `test` scripts and the Vitest config.
- Theme tokens in `globals.css` from the designs:
  - dark is the default (`next-themes`)
  - background ≈ `#18181a`, card ≈ `#242426`, raised ≈ `#2c2c2f`
  - accent orange ≈ `#F2622E`
  - large radii
  - heavy display font for headings, Inter for body
  - light theme supported
- `motion` wordmark (`components/brand/logo.tsx`, Fredoka 700). Name lives in `lib/brand.ts`.
- shadcn components: dialog, input, label, dropdown-menu, popover, slider, select, switch, tooltip, scroll-area, separator, avatar, sonner, toggle-group, textarea. **Animate UI Tabs** (Base UI variant) from its registry.
- Update the `layout.tsx` metadata.
- ✅ The app boots with dark theme tokens.

### Phase 1 — Database and auth
- Drizzle config, `db/index.ts` (neon-http `db` + Pool-based `withTx`), Better Auth with the Drizzle adapter:
  - `emailAndPassword: { enabled: true, autoSignIn: true }`
  - session `expiresIn: 7d`, `updateAge: 1d`
  - `apiKey()` plugin
- Generate the auth schema and write the app schema (§4). Run `drizzle-kit generate` and `migrate`.
- `app/api/auth/[...all]/route.ts`, `lib/auth-client.ts` (with `apiKeyClient()`).
- `proxy.ts`: optimistic cookie redirect for `/app/*`. Real checks happen in server components and routes via `getSession()`. Read `16-proxy.md` first.
- Sign-in and sign-up pages: centred dark card with name, email and password, plus errors.
- ✅ Sign up, sign out, sign in. The session row is in Neon. Visiting `/app` signed out redirects.

### Phase 2 — Dashboard, new project, settings
- Nav per the designs: Autopilot and Guide are `<span>`s, not links.
- Dashboard:
  - Greeting computed on the client from local time.
  - Stats query: count and the sum of `durationInFrames/fps`.
  - Project cards: thumbnail or gradient placeholder, name, format, length, updated. Menu with rename and delete.
  - Empty state, Connect card with copy, side cards.
- **New project modal:**
  - Name field.
  - Format & length section that copies `frames.png` (segmented 16:9 / 9:16 / 1:1, preview tile with outline in the aspect ratio, title + "1080×1920 · Reels, TikTok, Shorts", length chips, Custom number input).
  - Server action creates the project with an empty doc and redirects to the editor.
- Settings: account card, Connect Claude, API keys section.
- ✅ Projects appear, the stats are correct, keys can be created and revoked, the command copies with the key filled in.

### Phase 3 — Doc, ops, realtime
- `schema.ts`, `ops.ts`, `inverse.ts`, `placement.ts`, `apply.ts`.
- `POST /api/projects/[id]/ops`, `GET /api/projects/[id]` (doc).
- `memory-bus.ts`, `redis-bus.ts` and `bus.ts`, which picks between them from `REDIS_URL`.
- SSE route (§5.3), `use-project-events` hook with reconnect.
- `POST /api/editor-state`.
- ✅ Unit tests for the reducer and inverses. Two browser tabs on one project see each other's ops live. A curl op shows up in the tab.

### Phase 4 — Editor shell and preview
- Editor page: loads the project server-side and hydrates the Zustand store (doc, version, selection, playhead, zoom, snap, tool, history).
- Top bar, panel shell with tab switching on selection, canvas with the Player, zoom/fit, playback bar.
- Remotion `Main` with every clip type except code, plus `ClipLayer`, fonts and audio fades.
- ✅ A hand-written doc with video, image, text and audio clips previews correctly, and the track order controls the stacking.

### Phase 5 — Timeline
- Toolbar, ruler and scrubbing, playhead sync, sections row, track headers with chips, lanes, clips (move, trim, split, delete), snapping, zoom, keyboard shortcuts, undo/redo, auto-created tracks on drop, audio placed at the bottom.
- ✅ Every interaction commits exactly one op and survives a reload. Undo and redo round-trip.

### Phase 6 — Code clips
- `validate.ts`, `instrument.ts`, `compile.ts`, `helpers.ts` (`M`), `params.ts` (form from schema).
- `CodeClip` component with error overlay.
- Code Style tab: CodeMirror, live validation, params form, fonts, opacity, radius, Save as element.
- About 15 built-in elements.
- ✅ Validator tests pass (§11). Every built-in renders. An infinite loop shows an error and doesn't freeze the page.

### Phase 7 — Left panels and inspectors
- Media panel with the full ImageKit flow, `/api/imagekit/auth`, media route, Replace source.
- Text presets.
- Elements panel: search, chips, 2-column grid, hover preview, click or drag to add, Mine.
- Claude panel: command, status, current "this".
- Style inspectors for each type. Motion inspector.
- ✅ Upload shows a local preview and progress ring, and the card is only draggable when the upload finishes. Every Style and Motion field updates the preview and persists.

### Phase 8 — MCP
- `/api/mcp` with `withMcpAuth`, every tool in §8, the `"this"` resolver, the `claude` status events.
- ✅ From a real Claude Code session with the command: list projects, add a text clip to "this" project, write a code clip (and see a validator error, then fix it), save an element, add media from a URL. Each change appears live in the open editor, and the Claude tab shows *Working…*.

### Phase 9 — Export
- **Spike first:** deploy a minimal `render-video` that renders a 3-second test composition on Trigger.dev cloud with `puppeteer()`. Confirm the Chrome path, that no ffmpeg extension is needed, and the render time.
- Then build the full task, bundle script, callback route and export menu.
- ✅ Exporting a 15-second 16:9 project produces a playable MP4 download link and an HLS link that plays. Progress shows live, and failures show the error and a Retry button.

### Phase 10 — Deploy and QA
- Vercel project with env vars, Redis from the Vercel Marketplace (`REDIS_URL`), Neon production branch, migrations, `trigger deploy`.
- Run the QA checklist (§12) in production.
- ✅ Every item passes on the production URL.

---

## 11. Testing (Vitest)
- **Ops reducer:** every op, `inverse(op)` round-trips, placement rules (new track position for audio vs visual, track 0 on top).
- **Doc schema:** rejects bad clips and accepts every preset and built-in element.
- **Code validator and instrumenter.** Must accept all built-ins and sample Claude code.

  Must reject:
  - `window`, `document`, `globalThis`, `fetch`, `eval`, `Function`
  - `this`, `import('x')`
  - `ctx.canvas`, `(()=>0).constructor`, `p.__proto__`
  - `async` and generators

  At runtime, `p['con'+'structor']` must throw, and `while(true){}` must throw the tick-limit error.
- **Event bus (memory):** publish/subscribe, `Last-Event-ID` replay, unsubscribe.
- **MCP tool handlers:** run against an in-memory doc store and memory bus: `"this"` resolution, a missing project error, ownership checks, validator errors passed back to Claude.

## 12. QA checklist (definition of done)
- [ ] Sign up → dashboard shows the greeting, 0/0 stats, the empty state and the connect card.
- [ ] New project (each format, a preset length and Custom) opens the editor with the correct canvas size.
- [ ] Upload video, image and audio: local preview, then progress ring, then draggable. Drop creates tracks, and audio lands at the bottom.
- [ ] Text preset and element added by click and by drag. Element hover preview animates.
- [ ] Select a clip → Style/Motion, edit fields, preview updates, reload keeps the changes.
- [ ] Timeline: move, trim, split, delete, snap, zoom, sections, undo/redo, keyboard shortcuts.
- [ ] Claude Code connected with an API key: live edits appear, "this" resolves to the selected clip, Claude saves an element that shows in Mine.
- [ ] Export → MP4 download and an HLS link that plays.
- [ ] Revoking the key makes Claude's next call fail with 401.
- [ ] Typecheck, lint and tests are green, and the app is deployed on Vercel.

## 13. Remaining risks (closed items noted)
- **Closed:**
  - Remotion licence: individual creator, YouTube project, free licence.
  - ImageKit limits: accepted.
  - Database polling: removed. Neon only stores data and auth sessions, and live updates use Redis in production and memory locally.
- **Remotion on Trigger.dev** is verified only at the docs level (the `puppeteer()` extension installs Chrome). Phase 9 starts with a spike. Videos are short, so render time and cost should be small.
- **Code clips run on the app origin.** The layered checks in §7 cover the realistic attack paths. If an escape is ever found, the fallback is rendering code clips inside a sandboxed iframe.
- **SSE reconnects every ~290 s** on Vercel. The replay buffer (200 events per channel) has to cover the reconnect gap.
- **New libraries** (`mcp-handler` 2.x, `@better-auth/api-key`, Animate UI Base tabs, `@remotion/*` on React 19.3) may have API drift. Check each one's docs when installing it.
