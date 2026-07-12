import { beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readFounderLabels, upsertFounderLabel } from "@/lib/labeling/labels";

const testDir = path.join(os.tmpdir(), `meshimatch-labels-test-${process.pid}`);
const labelsPath = path.join(testDir, "labels.jsonl");

beforeEach(() => {
  fs.rmSync(testDir, { recursive: true, force: true });
});

describe("founder labels JSONL", () => {
  it("roundtrips a label row", () => {
    upsertFounderLabel(
      {
        external_id: "fixtures/a",
        place_id: "fixtures/a",
        name: "テストA",
        label: "good",
        memo: "席が広い",
        labeled_at: "2026-07-12T00:00:00.000Z",
      },
      labelsPath
    );

    expect(readFounderLabels(labelsPath)).toEqual([
      {
        external_id: "fixtures/a",
        place_id: "fixtures/a",
        name: "テストA",
        label: "good",
        memo: "席が広い",
        labeled_at: "2026-07-12T00:00:00.000Z",
      },
    ]);
  });

  it("overwrites by external_id when re-labeled", () => {
    upsertFounderLabel(
      {
        external_id: "fixtures/a",
        place_id: "fixtures/a",
        name: "テストA",
        label: "good",
        memo: "初回",
        labeled_at: "2026-07-12T00:00:00.000Z",
      },
      labelsPath
    );
    upsertFounderLabel(
      {
        external_id: "fixtures/a",
        place_id: "fixtures/a",
        name: "テストA",
        label: "bad",
        memo: "再評価",
        labeled_at: "2026-07-12T00:01:00.000Z",
      },
      labelsPath
    );

    const rows = readFounderLabels(labelsPath);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      external_id: "fixtures/a",
      label: "bad",
      memo: "再評価",
    });
  });
});
