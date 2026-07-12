# R6b Quality Scoring

Offline-only quality scoring for the MeshiMatch quality engine.

Axes are intentionally limited to:

- `hazure_risk`: internal risk that a place will disappoint the organizer.
- `group_fit_tags`: visible chip candidates for group usability.

This module does not score taste, deliciousness, cuisine quality, or personal preference.

## Bayesian Prior

Default prior: `4.0` stars over `40` reviews.

Reason: `4.0` is a decent-but-not-exceptional Google rating baseline, and `40` reviews is enough to shrink low-sample outliers such as `1 review, 5 stars` while still letting established places move the score.

Formula:

```txt
bayesian_average = (rating * review_count + prior_mean * prior_count) / (review_count + prior_count)
```

Missing or zero review counts fall back to the prior and receive low confidence.

## Stage Gate

Default evidence threshold: `300`.

Evidence is `rating * review_count`. This follows the founder's selection pattern:

- Stage 1: if evidence is above the threshold, trust the star/count signal enough to use Bayesian score plus price-band check only.
- Stage 2: if evidence is below the threshold, run deep inspection: review triage and group-fit photo/metadata analysis. In R6b these are deterministic fallbacks plus LLM/VLM stubs.

The threshold is configurable by `--evidence-threshold` in `scripts/quality/score-catalog.mjs` and is expected to be tuned after the R6c 30-label comparison. JSONL rows include `stage`, `evidence`, and `evidence_threshold` so evaluations can recover the exact gate used.

## Review Negative Weights

| category | label | severity | weight |
|---|---|---:|---:|
| `service` | 接客 | heavy | `0.24` |
| `hygiene` | 衛生 | heavy | `0.28` |
| `billing_trouble` | 会計トラブル | heavy | `0.30` |
| `crowded` | 混雑 | light | `0.08` |
| `wait_time` | 行列・待ち時間 | light | `0.07` |

The keyword fallback is deterministic and testable. The LLM adapter is a prompt/schema stub only and refuses unless `QUALITY_LLM_APPROVED=1`; even then, SDK wiring is intentionally absent in R6b.

## Group Fit

The current scorer uses metadata and review text signals such as `priceLevel`, `個室`, `席間`, `大人数`, `静か`, `賑やか`, and `大人数は確認`. The VLM adapter is a prompt/schema stub only and refuses unless `QUALITY_VLM_APPROVED=1`.
