#!/usr/bin/env node
// R6b offline quality scoring. Default input is the R6a fixture catalog.
// This script does not call Google, LLM, VLM, or any external API.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_EVIDENCE_THRESHOLD, scoreCatalog } from "../../src/lib/quality/index.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const defaultInput = path.join(repoRoot, "src/lib/places/__fixtures__/ebisu-restaurants.json");
const defaultOutput = path.join(repoRoot, "data/quality/scores.jsonl");

function readArg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value.`);
  }
  return value;
}

function hasArg(name) {
  return process.argv.includes(name);
}

function usage() {
  return [
    "Usage: node scripts/quality/score-catalog.mjs [--dry-run] [--input catalog.json] [--output scores.jsonl] [--computed-at ISO] [--evidence-threshold N]",
    "",
    "Default mode is fixture-backed dry-run input and writes data/quality/scores.jsonl.",
    "Accepted input shapes:",
    "- R6a fixture: { _fixture: true, places: [...] }",
    "- seed-ebisu-catalog output: { rows: { placesCache: [{ raw_details: ... }] } }",
  ].join("\n");
}

function extractPlaces(catalog) {
  if (Array.isArray(catalog?.places)) return catalog.places;
  if (Array.isArray(catalog?.rows?.placesCache)) {
    return catalog.rows.placesCache.map((row) => row.raw_details).filter(Boolean);
  }
  throw new Error("Unsupported catalog shape. Expected fixture.places or rows.placesCache[].raw_details.");
}

if (hasArg("--help") || hasArg("-h")) {
  console.log(usage());
  process.exit(0);
}

if (hasArg("--live")) {
  console.error("Live scoring is intentionally unavailable in R6b. Use fixture or recorded catalog JSON input.");
  process.exit(1);
}

const inputPath = path.resolve(repoRoot, readArg("--input", defaultInput));
const outputPath = path.resolve(repoRoot, readArg("--output", defaultOutput));
const computedAt = readArg("--computed-at", new Date().toISOString());
const evidenceThreshold = Number(readArg("--evidence-threshold", String(DEFAULT_EVIDENCE_THRESHOLD)));
const dryRun = hasArg("--dry-run") || inputPath === defaultInput;

if (!Number.isFinite(evidenceThreshold) || evidenceThreshold < 0) {
  throw new Error("--evidence-threshold must be a non-negative number.");
}

const catalog = JSON.parse(fs.readFileSync(inputPath, "utf-8"));
if (dryRun && catalog._fixture !== true && !Array.isArray(catalog?.rows?.placesCache)) {
  throw new Error("Dry-run mode expects the marked fixture or seed-ebisu-catalog output.");
}

const places = extractPlaces(catalog);
const rows = scoreCatalog(places, { computedAt, evidenceThreshold });
const jsonl = `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, jsonl);

console.log(
  JSON.stringify(
    {
      dryRun,
      input: path.relative(repoRoot, inputPath),
      output: path.relative(repoRoot, outputPath),
      count: rows.length,
      evidence_threshold: evidenceThreshold,
      engine_version: rows[0]?.engine_version ?? null,
    },
    null,
    2
  )
);
