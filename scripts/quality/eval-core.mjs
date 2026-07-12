import fs from "node:fs";

export const LABELS = ["good", "ok", "bad"];
export const BUCKETS = ["good", "ok", "bad"];

export function parseJsonl(content) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return parseJsonl(fs.readFileSync(filePath, "utf-8"));
}

export function bucketRisk(risk, { okThreshold, badThreshold }) {
  if (risk >= badThreshold) return "bad";
  if (risk >= okThreshold) return "ok";
  return "good";
}

export function evaluateLabels(scores, labels, options) {
  const scoresByExternalId = new Map(scores.map((row) => [row.external_id, row]));
  const matrix = {
    good: { good: 0, ok: 0, bad: 0 },
    ok: { good: 0, ok: 0, bad: 0 },
    bad: { good: 0, ok: 0, bad: 0 },
  };
  const disagreements = [];
  const missingScores = [];
  let matched = 0;
  let badDetected = 0;
  let badTotal = 0;

  for (const labelRow of labels) {
    const scoreRow = scoresByExternalId.get(labelRow.external_id);
    if (!scoreRow) {
      missingScores.push(labelRow);
      continue;
    }

    matched += 1;
    const bucket = bucketRisk(scoreRow.hazure_risk, options);
    matrix[labelRow.label][bucket] += 1;

    if (labelRow.label === "bad") {
      badTotal += 1;
      if (bucket === "bad") badDetected += 1;
    }

    if (labelRow.label !== bucket) {
      disagreements.push({
        external_id: labelRow.external_id,
        place_id: labelRow.place_id,
        name: labelRow.name,
        label: labelRow.label,
        risk_bucket: bucket,
        hazure_risk: scoreRow.hazure_risk,
        negatives: scoreRow.negatives ?? [],
      });
    }
  }

  return {
    matrix,
    badRecall: badTotal === 0 ? null : badDetected / badTotal,
    badDetected,
    badTotal,
    disagreements,
    missingScores,
    matched,
  };
}

export function formatEvalResult(result, options) {
  const lines = [
    `thresholds: ok>=${options.okThreshold}, bad>=${options.badThreshold}`,
    "",
    "confusion matrix (label rows x risk bucket columns)",
    "label\\bucket\tgood\tok\tbad",
    ...LABELS.map((label) => {
      const row = result.matrix[label];
      return `${label}\t${BUCKETS.map((bucket) => row[bucket]).join("\t")}`;
    }),
    "",
    `bad recall: ${result.badRecall === null ? "n/a" : result.badRecall.toFixed(3)} (${result.badDetected}/${result.badTotal})`,
    `matched labels: ${result.matched}`,
  ];

  if (result.missingScores.length > 0) {
    lines.push("", "missing scores");
    for (const row of result.missingScores) lines.push(`- ${row.name} (${row.external_id})`);
  }

  lines.push("", "disagreements");
  if (result.disagreements.length === 0) {
    lines.push("- none");
  } else {
    for (const item of result.disagreements) {
      const reasons = item.negatives.length > 0 ? item.negatives.join(", ") : "no negatives";
      lines.push(
        `- ${item.name} (${item.external_id}): label=${item.label}, bucket=${item.risk_bucket}, risk=${item.hazure_risk.toFixed(2)}, reasons=${reasons}`
      );
    }
  }

  return `${lines.join("\n")}\n`;
}
