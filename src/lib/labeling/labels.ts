import fs from "node:fs";
import path from "node:path";

export type FounderLabel = "good" | "ok" | "bad";

export type FounderLabelRow = {
  external_id: string;
  place_id: string;
  name: string;
  label: FounderLabel;
  memo: string;
  labeled_at: string;
};

export type FounderLabelInput = Omit<FounderLabelRow, "labeled_at"> & {
  labeled_at?: string;
};

const labelValues = new Set<FounderLabel>(["good", "ok", "bad"]);

export function resolveLabelsPath(explicitPath = process.env.MESHIMATCH_LABELS_PATH): string {
  return explicitPath ?? path.join(process.cwd(), "data", "quality", "labels.jsonl");
}

export function parseJsonlRows<T>(content: string): T[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

export function readFounderLabels(filePath = resolveLabelsPath()): FounderLabelRow[] {
  if (!fs.existsSync(filePath)) return [];
  return parseJsonlRows<FounderLabelRow>(fs.readFileSync(filePath, "utf-8"));
}

export function writeFounderLabels(rows: FounderLabelRow[], filePath = resolveLabelsPath()) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const content = rows.map((row) => JSON.stringify(row)).join("\n");
  fs.writeFileSync(filePath, content ? `${content}\n` : "", "utf-8");
}

export function upsertFounderLabel(input: FounderLabelInput, filePath = resolveLabelsPath()): FounderLabelRow {
  const externalId = input.external_id.trim();
  if (!externalId) throw new Error("external_id is required");
  if (!labelValues.has(input.label)) throw new Error("label must be good, ok, or bad");

  const row: FounderLabelRow = {
    external_id: externalId,
    place_id: input.place_id.trim(),
    name: input.name.trim(),
    label: input.label,
    memo: input.memo.trim(),
    labeled_at: input.labeled_at ?? new Date().toISOString(),
  };

  const rows = readFounderLabels(filePath);
  const nextRows = rows.filter((existing) => existing.external_id !== row.external_id);
  nextRows.push(row);
  writeFounderLabels(nextRows, filePath);
  return row;
}
