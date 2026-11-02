import { MAX_GROUP_ID_LENGTH } from "./constants";

const CONTROL_CHARACTERS = /[\p{Cc}\p{Cf}]/gu;
const IMAGE_PATH = /^\/[A-Za-z0-9/_.-]+$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const GROUP_ID = /^[A-Za-z0-9_-]+$/;

export type RawRecord = Record<string, unknown>;

/** Bounded, control-character-free text for public DTOs and upstream queries. */
export function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== "string" || maxLength <= 0) return "";

  // Prevent a hostile value from making us allocate a very large array.
  const bounded = value.slice(0, Math.max(1, maxLength * 4));
  const normalized = bounded
    .replace(CONTROL_CHARACTERS, " ")
    .replace(/\s+/g, " ")
    .normalize("NFC")
    .trim();

  return Array.from(normalized).slice(0, maxLength).join("");
}

export function hasControlCharacters(value: string): boolean {
  CONTROL_CHARACTERS.lastIndex = 0;
  return CONTROL_CHARACTERS.test(value);
}

export function asRecord(value: unknown): RawRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RawRecord)
    : {};
}

export function asRecordArray(value: unknown): RawRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is RawRecord => item !== null && typeof item === "object")
    : [];
}

export function asNumber(value: unknown, fallback = 0): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function asInteger(value: unknown, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const parsed = asNumber(value, Number.NaN);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

export function asRounded(value: unknown, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const parsed = asNumber(value, fallback);
  const bounded = Math.min(max, Math.max(min, parsed));
  return Math.round(bounded * 100) / 100;
}

export function asBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

export function asNumberArray(value: unknown, maxLength = 30): number[] {
  if (!Array.isArray(value)) return [];
  const numbers: number[] = [];
  for (const item of value.slice(0, maxLength)) {
    const parsed = asNumber(item, Number.NaN);
    if (Number.isFinite(parsed) && parsed >= 0) numbers.push(Math.trunc(parsed));
  }
  return numbers;
}

export function safeDate(value: unknown): string {
  const text = cleanText(value, 10);
  if (!ISO_DATE.test(text)) return "";
  const parsed = Date.parse(`${text}T00:00:00Z`);
  return Number.isNaN(parsed) ? "" : text;
}

export function safeImagePath(value: unknown): string | null {
  const text = cleanText(value, 200);
  if (!IMAGE_PATH.test(text) || text.includes("..")) return null;
  return text;
}

export function safeGroupId(value: unknown): string | null {
  const text = cleanText(value, MAX_GROUP_ID_LENGTH);
  if (!text || text.length > MAX_GROUP_ID_LENGTH || !GROUP_ID.test(text)) return null;
  return text;
}

/** Length-checked, mostly constant-time comparison for the optional app key. */
export function safeStringEqual(left: string, right: string): boolean {
  const a = Array.from(left);
  const b = Array.from(right);
  let mismatch = a.length ^ b.length;
  const max = Math.max(a.length, b.length);
  for (let index = 0; index < max; index += 1) {
    mismatch |= (a[index]?.codePointAt(0) ?? 0) ^ (b[index]?.codePointAt(0) ?? 0);
  }
  return mismatch === 0;
}

const SECRET_PLACEHOLDERS = ["your_", "placeholder", "changeme", "dummy", "example"];

/** Reads a server-only secret without accepting example values from env files. */
export function cleanSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length < 12 || trimmed.length > 1_024) return null;
  const lower = trimmed.toLowerCase();
  if (SECRET_PLACEHOLDERS.some((placeholder) => lower.includes(placeholder))) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}
