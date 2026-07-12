import { describe, expect, it } from "vitest";

import { decodeSubtitleBuffer, parseSubtitleText } from "./subtitles";

describe("parseSubtitleText", () => {
  it("parses multiple LRC timestamps without inventing plain-text timing", () => {
    expect(parseSubtitleText("[00:01.50][00:03.00] hello", "track.lrc")).toEqual([
      { start: 1.5, end: 3, text: "hello" },
      { start: 3, end: 11, text: "hello" },
    ]);
    expect(parseSubtitleText("an untimed transcript", "track.txt")).toEqual([]);
  });

  it("parses SRT and WebVTT timing blocks", () => {
    const srt = "1\n00:00:01,250 --> 00:00:02,500\n<b>Hello</b>\n\n";
    expect(parseSubtitleText(srt, "track.srt")).toEqual([
      { start: 1.25, end: 2.5, text: "Hello" },
    ]);

    const vtt = "WEBVTT\n\n00:01.000 --> 00:03.000 position:50%\nWorld";
    expect(parseSubtitleText(vtt, "track.vtt")).toEqual([
      { start: 1, end: 3, text: "World" },
    ]);
  });

  it("parses ASS dialogue and strips override tags", () => {
    const ass = "Dialogue: 0,0:00:02.00,0:00:04.50,Default,,0,0,0,,{\\i1}First\\NSecond";
    expect(parseSubtitleText(ass, "track.ass")).toEqual([
      { start: 2, end: 4.5, text: "First\nSecond" },
    ]);
  });
});

describe("decodeSubtitleBuffer", () => {
  it("decodes UTF-16LE subtitles with a byte-order mark", () => {
    const source = new Uint8Array([0xff, 0xfe, 0x41, 0x00, 0x42, 0x00]);
    expect(decodeSubtitleBuffer(source.buffer)).toBe("AB");
  });
});
