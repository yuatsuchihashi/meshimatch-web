#!/usr/bin/env node
import path from "node:path";
import { evaluateLabels, formatEvalResult, readJsonl } from "./eval-core.mjs";

function parseArgs(argv) {
  const options = {
    scores: path.join(process.cwd(), "data", "quality", "scores.jsonl"),
    labels: path.join(process.cwd(), "data", "quality", "labels.jsonl"),
    okThreshold: 0.35,
    badThreshold: 0.65,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--scores" && next) {
      options.scores = next;
      index += 1;
    } else if (arg === "--labels" && next) {
      options.labels = next;
      index += 1;
    } else if (arg === "--ok-threshold" && next) {
      options.okThreshold = Number(next);
      index += 1;
    } else if (arg === "--bad-threshold" && next) {
      options.badThreshold = Number(next);
      index += 1;
    } else if (arg === "--help") {
      console.log(
        [
          "Usage: node scripts/quality/eval-labels.mjs [flags]",
          "",
          "Flags:",
          "  --scores <path>         scores JSONL path (default data/quality/scores.jsonl)",
          "  --labels <path>         labels JSONL path (default data/quality/labels.jsonl)",
          "  --ok-threshold <num>    risk >= num buckets as ok (default 0.35)",
          "  --bad-threshold <num>   risk >= num buckets as bad (default 0.65)",
        ].join("\n")
      );
      process.exit(0);
    } else {
      throw new Error(`unknown or incomplete argument: ${arg}`);
    }
  }

  if (!Number.isFinite(options.okThreshold) || !Number.isFinite(options.badThreshold)) {
    throw new Error("thresholds must be numbers");
  }
  if (options.okThreshold < 0 || options.badThreshold > 1 || options.okThreshold >= options.badThreshold) {
    throw new Error("thresholds must satisfy 0 <= ok-threshold < bad-threshold <= 1");
  }

  return options;
}

try {
  const options = parseArgs(process.argv.slice(2));
  const scores = readJsonl(options.scores);
  const labels = readJsonl(options.labels);
  const result = evaluateLabels(scores, labels, options);
  process.stdout.write(formatEvalResult(result, options));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
