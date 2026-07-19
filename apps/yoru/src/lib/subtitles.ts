export type SubtitleCue = {
  start: number;
  end: number;
  text: string;
};

const DEFAULT_LAST_CUE_DURATION = 8;

export function parseSubtitleText(raw: string, name = ""): SubtitleCue[] {
  const text = raw.replace(/^\uFEFF/, "").trim();
  if (!text) {
    return [];
  }

  const extension = name.split(".").pop()?.toLowerCase();
  if (extension === "lrc" || /^\s*\[\d{1,3}:\d{2}(?:[.:]\d+)?\]/m.test(text)) {
    return parseLrc(text);
  }
  if (extension === "ass" || extension === "ssa" || /^Dialogue\s*:/im.test(text)) {
    return parseAss(text);
  }
  if (extension === "srt" || extension === "vtt" || /-->/m.test(text)) {
    return parseTimedBlocks(text);
  }

  // Untimed text cannot be synchronized reliably, so do not invent cue times.
  return [];
}

export function decodeSubtitleBuffer(buffer: ArrayBuffer, contentType = "") {
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  }

  const declaredCharset = contentType.match(/charset\s*=\s*["']?([^;"'\s]+)/i)?.[1];
  const encodings = [declaredCharset, "utf-8", "gb18030", "shift_jis"].filter(Boolean) as string[];
  for (const encoding of encodings) {
    try {
      return new TextDecoder(encoding, { fatal: encoding === "utf-8" }).decode(bytes);
    } catch {
      // Try the next plausible subtitle encoding.
    }
  }
  return new TextDecoder().decode(bytes);
}

function parseLrc(text: string): SubtitleCue[] {
  const points: Array<{ start: number; text: string }> = [];
  let offset = 0;
  for (const line of text.split(/\r?\n/)) {
    const offsetMatch = line.match(/^\[offset:([+-]?\d+)\]/i);
    if (offsetMatch) {
      offset = Number(offsetMatch[1]) / 1000;
      continue;
    }
    const timestamps = [...line.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    if (timestamps.length === 0) {
      continue;
    }
    const cueText = cleanCueText(line.replace(/\[[^\]]+\]/g, ""));
    if (!cueText) {
      continue;
    }
    for (const match of timestamps) {
      const fraction = match[3] ? Number(`0.${match[3]}`) : 0;
      points.push({
        start: Math.max(0, Number(match[1]) * 60 + Number(match[2]) + fraction + offset),
        text: cueText,
      });
    }
  }
  points.sort((a, b) => a.start - b.start);
  return points.map((point, index) => ({
    start: point.start,
    end: points[index + 1]?.start ?? point.start + DEFAULT_LAST_CUE_DURATION,
    text: point.text,
  }));
}

function parseTimedBlocks(text: string): SubtitleCue[] {
  const normalized = text
    .replace(/^WEBVTT[^\n]*\r?\n/i, "")
    .replace(/^NOTE(?:\s[^\n]*)?\r?\n(?:.|\r?\n)*?(?=\r?\n\r?\n|$)/gim, "");
  const cues: SubtitleCue[] = [];
  for (const block of normalized.split(/\r?\n\s*\r?\n/)) {
    const lines = block.split(/\r?\n/).map((line) => line.trim());
    const timingIndex = lines.findIndex((line) => line.includes("-->"));
    if (timingIndex < 0) {
      continue;
    }
    const timing = lines[timingIndex].match(/([^\s]+)\s*-->\s*([^\s]+)/);
    if (!timing) {
      continue;
    }
    const start = parseClockTime(timing[1]);
    const end = parseClockTime(timing[2]);
    const cueText = cleanCueText(lines.slice(timingIndex + 1).join("\n"));
    if (start == null || end == null || end <= start || !cueText) {
      continue;
    }
    cues.push({ start, end, text: cueText });
  }
  return cues.sort((a, b) => a.start - b.start);
}

function parseAss(text: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!/^Dialogue\s*:/i.test(line)) {
      continue;
    }
    const fields = line.replace(/^Dialogue\s*:\s*/i, "").split(",");
    if (fields.length < 10) {
      continue;
    }
    const start = parseClockTime(fields[1]);
    const end = parseClockTime(fields[2]);
    const cueText = cleanCueText(fields.slice(9).join(",").replace(/\\[Nn]/g, "\n"));
    if (start == null || end == null || end <= start || !cueText) {
      continue;
    }
    cues.push({ start, end, text: cueText });
  }
  return cues.sort((a, b) => a.start - b.start);
}

function parseClockTime(value: string) {
  const normalized = value.trim().replace(",", ".");
  const parts = normalized.split(":");
  if (parts.length < 2 || parts.length > 3) {
    return null;
  }
  const seconds = Number(parts.pop());
  const minutes = Number(parts.pop());
  const hours = parts.length ? Number(parts.pop()) : 0;
  if (![hours, minutes, seconds].every(Number.isFinite)) {
    return null;
  }
  return hours * 3600 + minutes * 60 + seconds;
}

function cleanCueText(value: string) {
  return value
    .replace(/\{\\[^}]+\}/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}
