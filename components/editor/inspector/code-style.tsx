"use client"

import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import { BookmarkPlusIcon, CircleAlertIcon, LockIcon, XIcon } from "lucide-react"
import dynamic from "next/dynamic"
import { useState } from "react"
import { toast } from "sonner"

import { ColorRow, FieldRow, InspectorSection, NumberRow, SelectRow, TextRow } from "@/components/editor/inspector/fields"
import { useClipEdit } from "@/components/editor/inspector/use-clip-edit"
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { createElementMutationFn, getMediaQueryFn, queryKeys } from "@/lib/api"
import { useCodeError } from "@/lib/code-clips/errors"
import { resolveParams } from "@/lib/code-clips/params"
import { validateCode } from "@/lib/code-clips/validate"
import { guessLayout } from "@/lib/elements/place"
import { ELEMENT_CATEGORIES, type ElementCategory } from "@/lib/elements/types"
import { FONTS, fontStack } from "@/lib/fonts"
import type { CodeClip, ParamDef } from "@/lib/project/schema"
import { useEditorStore } from "@/stores/editor-store"

const CodeEditor = dynamic(() => import("@/components/editor/inspector/code-editor"), {
  ssr: false,
  loading: () => <Skeleton className="h-[120px] rounded-xl" />,
})

/** Style tab for code clips: the code (read only), its params, fonts, opacity, radius, Save as element. */
export function CodeStyle({ clip }: { clip: CodeClip }) {
  const edit = useClipEdit(clip.id)
  const runtimeError = useCodeError(clip.id)
  // Code is shown, not edited: it comes from elements and Claude, and the server validates it.
  // A problem in stored code (or while drawing) still shows here.
  const codeError = validateCode(clip.code)

  return (
    <div className="flex flex-col gap-5">
      <InspectorSection title="Code">
        <CodeEditor value={clip.code} />
        {codeError ? (
          <Problem title={`Line ${codeError.line}, column ${codeError.column}`} text={codeError.message} />
        ) : runtimeError ? (
          <Problem title="While drawing" text={runtimeError} />
        ) : (
          <p className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
            <LockIcon className="size-3 shrink-0" />
            Read only. Change how it looks with the parameters below.
          </p>
        )}
      </InspectorSection>

      {clip.paramSchema.length > 0 && (
        <InspectorSection title="Parameters">
          {clip.paramSchema.map((def) => (
            <ParamField key={def.key} clip={clip} def={def} />
          ))}
        </InspectorSection>
      )}

      <InspectorSection title="Fonts">
        <FontsField clip={clip} />
      </InspectorSection>

      <InspectorSection title="Look">
        <NumberRow
          label="Opacity"
          value={Math.round(clip.transform.opacity * 100)}
          min={0}
          max={100}
          unit="%"
          fill
          onPreview={(v) => edit.preview({ transform: { opacity: v / 100 } })}
          onCommit={(v) => edit.commit({ transform: { opacity: v / 100 } })}
        />
        <NumberRow
          label="Corner radius"
          value={clip.radius}
          min={0}
          max={Math.round(Math.min(clip.transform.width, clip.transform.height) / 2)}
          unit="px"
          fill
          onPreview={(radius) => edit.preview({ radius })}
          onCommit={(radius) => edit.commit({ radius })}
        />
      </InspectorSection>

      <InspectorSection title="Clip">
        <TextRow label="Name" value={clip.name} onCommit={(name) => edit.commit({ name })} />
        <SaveAsElement clip={clip} />
      </InspectorSection>
    </div>
  )
}

function Problem({ title, text }: { title: string; text: string }) {
  return (
    <div role="alert" className="flex gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-xs">
      <CircleAlertIcon className="mt-px size-3.5 shrink-0 text-destructive" />
      <div className="min-w-0">
        <p className="font-semibold text-destructive">{title}</p>
        <p className="mt-0.5 break-words text-foreground/80">{text}</p>
      </div>
    </div>
  )
}

// ── Params ──────────────────────────────────────────────────────────────

/** One field per ParamDef, by its type. */
function ParamField({ clip, def }: { clip: CodeClip; def: ParamDef }) {
  const edit = useClipEdit(clip.id)
  const value = resolveParams(clip.paramSchema, clip.params)[def.key]
  const patch = (next: unknown) => ({ params: { ...clip.params, [def.key]: next } })
  const projectId = useEditorStore((state) => state.projectId)
  const { data: media } = useQuery({
    queryKey: queryKeys.media(projectId),
    queryFn: () => getMediaQueryFn(projectId),
    enabled: def.type === "image" && Boolean(projectId),
  })

  switch (def.type) {
    case "number": {
      const decimals = def.step && def.step < 1 ? Math.min(3, String(def.step).split(".")[1]?.length ?? 0) : 0
      return (
        <NumberRow
          label={def.label}
          value={Number(value)}
          min={def.min}
          max={def.max}
          step={def.step ?? 1}
          decimals={decimals}
          fill={def.min !== undefined && def.max !== undefined}
          onPreview={(v) => edit.preview(patch(v))}
          onCommit={(v) => edit.commit(patch(v))}
        />
      )
    }
    case "color":
      return (
        <ColorRow
          label={def.label}
          value={String(value)}
          onPreview={(v) => edit.preview(patch(v))}
          onCommit={(v) => edit.commit(patch(v))}
        />
      )
    case "boolean":
      return (
        <FieldRow label={def.label}>
          <Switch checked={Boolean(value)} onCheckedChange={(checked) => edit.commit(patch(checked))} aria-label={def.label} />
        </FieldRow>
      )
    case "select":
      return (
        <SelectRow
          label={def.label}
          value={String(value)}
          items={(def.options ?? []).map((option) => ({ value: option, label: option }))}
          onChange={(v) => edit.commit(patch(v))}
        />
      )
    case "font":
      return (
        <SelectRow
          label={def.label}
          value={String(value)}
          items={FONTS.map((font) => ({ value: font.family, label: font.family }))}
          renderItem={(item) => <span style={{ fontFamily: fontStack(item.value) }}>{item.label}</span>}
          onChange={(family) => {
            // Make sure the font loads with the clip.
            const fonts = clip.fonts.includes(family) ? clip.fonts : [...clip.fonts, family]
            edit.commit({ ...patch(family), fonts })
          }}
        />
      )
    case "image": {
      const images = (media ?? []).filter((item) => item.kind === "image")
      return (
        <SelectRow
          label={def.label}
          value={String(value ?? "")}
          items={[{ value: "", label: "None" }, ...images.map((item) => ({ value: item.url, label: item.name }))]}
          onChange={(url) => edit.commit(patch(url))}
        />
      )
    }
    case "text": {
      const text = String(value ?? "")
      // Long values (SVG markup, paragraphs) get a text area.
      if (text.length > 60 || text.includes("\n") || text.trimStart().startsWith("<")) {
        return (
          <label className="flex flex-col gap-1.5 rounded-xl bg-muted/60 px-3.5 py-3 text-[13px]">
            <span className="text-muted-foreground">{def.label}</span>
            <textarea
              key={text}
              defaultValue={text}
              rows={4}
              spellCheck={false}
              onBlur={(event) => event.target.value !== text && edit.commit(patch(event.target.value))}
              className="resize-y bg-transparent font-mono text-xs leading-relaxed outline-none"
            />
          </label>
        )
      }
      return <TextRow label={def.label} value={text} onCommit={(v) => edit.commit(patch(v))} />
    }
  }
}

// ── Fonts ───────────────────────────────────────────────────────────────

/** The fonts the code uses: loaded before it draws (and before export frames are captured). */
function FontsField({ clip }: { clip: CodeClip }) {
  const edit = useClipEdit(clip.id)
  const available = FONTS.filter((font) => !clip.fonts.includes(font.family))

  return (
    <>
      {clip.fonts.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1">
          {clip.fonts.map((family) => (
            <span key={family} className="flex h-7 items-center gap-1 rounded-full bg-muted/60 pr-1 pl-3 text-xs" style={{ fontFamily: fontStack(family) }}>
              {family}
              <button
                type="button"
                aria-label={`Remove ${family}`}
                onClick={() => edit.commit({ fonts: clip.fonts.filter((f) => f !== family) })}
                className="grid size-5 place-items-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
              >
                <XIcon className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      {clip.fonts.length < 10 && (
        <SelectRow
          label="Add font"
          value={"" as string}
          items={[{ value: "", label: "Choose…" }, ...available.map((font) => ({ value: font.family, label: font.family }))]}
          renderItem={(item) => <span style={item.value ? { fontFamily: fontStack(item.value) } : undefined}>{item.label}</span>}
          onChange={(family) => family && edit.commit({ fonts: [...clip.fonts, family] })}
        />
      )}
    </>
  )
}

// ── Save as element ─────────────────────────────────────────────────────

function SaveAsElement({ clip }: { clip: CodeClip }) {
  const queryClient = useQueryClient()
  const width = useEditorStore((state) => state.width)
  const height = useEditorStore((state) => state.height)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(clip.name)
  const [category, setCategory] = useState<ElementCategory>("titles")

  const save = useMutation({
    mutationFn: createElementMutationFn,
    onSuccess: (element) => {
      queryClient.setQueryData(queryKeys.elements, (list: unknown[] | undefined) => [element, ...(list ?? [])])
      toast.success(`Saved "${element.name}"`, { description: "Find it under Mine in the Elements tab." })
      setOpen(false)
    },
    onError: (error) => toast.error("Couldn't save the element", { description: error.message }),
  })

  return (
    <Popover open={open} onOpenChange={(next) => (setOpen(next), next && setName(clip.name))}>
      <PopoverTrigger className="flex h-10 items-center justify-center gap-2 rounded-xl border border-dashed border-border text-[13px] font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground">
        <BookmarkPlusIcon className="size-4" />
        Save as element
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 gap-3 rounded-2xl p-3">
        <PopoverTitle className="text-sm font-semibold">Save as element</PopoverTitle>
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            save.mutate({
              name,
              category,
              layout: guessLayout(clip.transform, width, height),
              code: clip.code,
              paramSchema: clip.paramSchema,
              defaultParams: clip.params,
              fonts: clip.fonts,
              defaultDurationInFrames: clip.durationInFrames,
            })
          }}
        >
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            aria-label="Element name"
            placeholder="Name"
            className="h-10 rounded-xl bg-muted/60 px-3 text-[13px] outline-none focus:ring-2 focus:ring-ring/40"
          />
          <SelectRow
            label="Category"
            value={category}
            items={ELEMENT_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))}
            onChange={setCategory}
          />
          <button
            type="submit"
            disabled={save.isPending || !name.trim()}
            className="mt-1 h-9 rounded-xl bg-primary text-[13px] font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
          >
            {save.isPending ? "Saving…" : "Save to Mine"}
          </button>
        </form>
      </PopoverContent>
    </Popover>
  )
}
