import { describe, expect, it } from "vitest"

import {
  formatTimestamp,
  fromImageKit,
  parsePastedTranscript,
  parseSubtitleFile,
  parseTimestamp,
  transcriptSchema,
  transcriptToText,
} from "@/lib/transcript"

describe("timestamps", () => {
  it("parses SRT, VTT and short forms", () => {
    expect(parseTimestamp("00:01:07,500")).toBe(67.5)
    expect(parseTimestamp("01:07.250")).toBe(67.25)
    expect(parseTimestamp("1:02:03")).toBe(3723)
    expect(parseTimestamp("0:07")).toBe(7)
    expect(parseTimestamp("hello")).toBeNull()
  })

  it("formats as m:ss.s (h:mm:ss.s past an hour)", () => {
    expect(formatTimestamp(67.25)).toBe("1:07.2")
    expect(formatTimestamp(3723.5)).toBe("1:02:03.5")
  })
})

describe("parsers", () => {
  it("reads SRT", () => {
    const srt = "1\r\n00:00:01,000 --> 00:00:03,500\r\nHello <i>there</i>\r\n\r\n2\r\n00:00:04,000 --> 00:00:06,000\r\nSecond line\r\nwraps\r\n"
    expect(parseSubtitleFile(srt)?.segments).toEqual([
      { start: 1, end: 3.5, text: "Hello there" },
      { start: 4, end: 6, text: "Second line wraps" },
    ])
  })

  it("reads WebVTT, skipping the header and notes", () => {
    const vtt = "WEBVTT\n\nNOTE made by hand\n\n00:00.560 --> 00:03.880 align:start\n<v Rahul>Hi, I'm Rahul\n"
    expect(parseSubtitleFile(vtt)?.segments).toEqual([{ start: 0.56, end: 3.88, text: "Hi, I'm Rahul" }])
  })

  it("reads pasted lines, each ending where the next starts", () => {
    const pasted = "0:00 Intro\n[0:07.5] So the first thing\nyou do is open it\n1:02 - Wrap up"
    expect(parsePastedTranscript(pasted, 70)?.segments).toEqual([
      { start: 0, end: 7.5, text: "Intro" },
      { start: 7.5, end: 62, text: "So the first thing you do is open it" },
      { start: 62, end: 70, text: "Wrap up" },
    ])
    expect(parsePastedTranscript("no timestamps here")).toBeNull()
  })

  it("reads ImageKit's transcript JSON and chapters", () => {
    const json = {
      transcript: [
        { transcript: "Hi, I'm Rahul", start: 0.56, end: 3.88, confidence: 0.98, words: [{ word: "Hi,", start: 0.56, end: 0.9 }] },
        { transcript: "   ", start: 4, end: 5 },
      ],
    }
    const chapters = "WEBVTT\n\n00:00:00.000 --> 00:02:26.470\nOverview\n\n00:02:26.470 --> 00:05:02.140\nOptimisation\n"
    const transcript = fromImageKit(json, chapters)!
    expect(transcript).toEqual({
      source: "imagekit",
      segments: [{ start: 0.56, end: 3.88, text: "Hi, I'm Rahul", words: [{ start: 0.56, end: 0.9, text: "Hi," }] }],
      chapters: [
        { start: 0, title: "Overview" },
        { start: 146.47, title: "Optimisation" },
      ],
    })
    expect(transcriptSchema.safeParse(transcript).success).toBe(true)
    expect(fromImageKit({ nope: true })).toBeNull()
  })
})

describe("transcriptToText", () => {
  const transcript = parsePastedTranscript("0:00 Intro\n0:07 Middle\n0:20 End", 30)!

  it("prints compact timed lines for Claude", () => {
    expect(transcriptToText(transcript)).toBe("[0:00.0–0:07.0] Intro\n[0:07.0–0:20.0] Middle\n[0:20.0–0:30.0] End")
  })

  it("can print just a range", () => {
    expect(transcriptToText(transcript, { from: 8, to: 19 })).toBe("[0:07.0–0:20.0] Middle")
  })
})
