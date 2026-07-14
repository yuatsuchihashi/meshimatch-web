import { GENRES, type GenreCode } from "@/lib/restaurant-taxonomy";

export type InstantConsensusMood = "light" | "hearty";
export type InstantConsensusStyle = "share" | "own";

export interface ConsensusAxisOption<TValue extends string> {
  value: TValue;
  label: string;
}

export interface ConsensusMoodAxis {
  id: "mood";
  questionKey: string;
  options: readonly ConsensusAxisOption<InstantConsensusMood>[];
}

export interface ConsensusSecondaryAxis<TStyle extends string> {
  id: "style";
  questionKey: string;
  options: readonly ConsensusAxisOption<TStyle>[];
  genreMapByMood: Record<InstantConsensusMood, Record<TStyle, readonly GenreCode[]>>;
}

export interface GenreAttributeFlags {
  heavy: boolean;
  spicy: boolean;
}

export interface InstantConsensusConfig<TStyle extends string = InstantConsensusStyle> {
  moodAxis: ConsensusMoodAxis;
  secondaryAxis: ConsensusSecondaryAxis<TStyle>;
  genreAttributes: Record<GenreCode, GenreAttributeFlags>;
  taxonomyOrder: readonly GenreCode[];
}

export const INSTANT_CONSENSUS_CONFIG: InstantConsensusConfig = {
  moodAxis: {
    id: "mood",
    questionKey: "instant.consensus.mood",
    options: [
      { value: "light", label: "軽め・さっぱり" },
      { value: "hearty", label: "しっかり満足" },
    ],
  },
  secondaryAxis: {
    id: "style",
    questionKey: "instant.consensus.style",
    options: [
      { value: "share", label: "シェアしたい" },
      { value: "own", label: "自分の一皿がいい" },
    ],
    genreMapByMood: {
      light: {
        own: ["G004", "G009", "G014", "G015"],
        share: ["G009", "G010", "G002"],
      },
      hearty: {
        own: ["G013", "G009", "G005", "G015"],
        share: ["G008", "G007", "G017", "G006", "G001"],
      },
    },
  },
  genreAttributes: {
    G001: { heavy: true, spicy: false },
    G002: { heavy: false, spicy: false },
    G003: { heavy: false, spicy: false },
    G004: { heavy: false, spicy: false },
    G005: { heavy: true, spicy: false },
    G006: { heavy: true, spicy: false },
    G007: { heavy: true, spicy: true },
    G008: { heavy: true, spicy: false },
    G009: { heavy: false, spicy: true },
    G010: { heavy: false, spicy: false },
    G011: { heavy: false, spicy: false },
    G012: { heavy: false, spicy: false },
    G013: { heavy: true, spicy: false },
    G014: { heavy: false, spicy: false },
    G015: { heavy: false, spicy: false },
    G016: { heavy: true, spicy: false },
    G017: { heavy: true, spicy: true },
  },
  taxonomyOrder: GENRES.map((genre) => genre.code),
} as const;
