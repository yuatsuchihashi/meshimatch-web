"use client";

import { useState, useEffect, useCallback } from "react";
import { mapSurveyResponseRow, normalizePreferredAreas } from "@/lib/session-data";
import type { MeshiGroup } from "@/lib/types";

interface UseGroupsResult {
  groups: MeshiGroup[];
  loading: boolean;
  refresh: () => void;
  deleteGroup: (id: string) => void;
  archiveGroup: (id: string) => void;
  leaveGroup: (id: string) => void;
}

interface RawGroupMember {
  id: string;
  profile_id?: string | null;
  display_name?: string;
  role?: "owner" | "member";
  has_survey?: boolean;
}

interface RawSurveyResponse {
  id: string;
  member_id?: string;
  member_name?: string;
  preferred_areas?: string[];
  preferred_area?: string | null;
  departure_area?: string | null;
  departure_station?: string | null;
  budget_ideal_yen?: number | null;
  budget_max_yen?: number | null;
  budget_priority?: "must" | "prefer" | "optional" | null;
  genre_preferences?: unknown[];
  dietary_restrictions?: unknown[];
  response_version?: number;
  submitted_at: string;
}

interface RawGroup {
  id: string;
  name: string;
  invite_code?: string;
  scheduled_at?: string | null;
  group_size?: number | null;
  session_atmosphere?: "casual" | "polished" | "lively" | "calm" | null;
  session_focus?: "drink_centered" | "food_centered" | "balanced" | null;
  status?: MeshiGroup["status"];
  group_members?: RawGroupMember[];
  survey_responses?: RawSurveyResponse[];
  resolved_areas?: string[];
  decisions?: {
    restaurant_name?: string;
    restaurant_id?: string | null;
    decided_at?: string | null;
  }[];
}

function toMeshiGroup(raw: RawGroup): MeshiGroup {
  const memberNameById = new Map(
    (raw.group_members ?? []).map((member) => [
      member.id,
      member.display_name ?? "メンバー",
    ])
  );

  return {
    id: raw.id,
    name: raw.name,
    inviteCode: raw.invite_code ?? "",
    scheduledAt: raw.scheduled_at ? new Date(raw.scheduled_at) : null,
    groupSize: raw.group_size ?? null,
    sessionAtmosphere: raw.session_atmosphere ?? null,
    sessionFocus: raw.session_focus ?? null,
    status: raw.status ?? "active",
    members: (raw.group_members ?? []).map((m) => ({
      id: m.id,
      profileId: m.profile_id ?? null,
      displayName: m.display_name ?? "メンバー",
      role: m.role ?? "member",
      hasSurvey: m.has_survey ?? false,
    })),
    surveyResponses: (raw.survey_responses ?? []).map((s) =>
      mapSurveyResponseRow(
        {
          ...s,
          preferred_areas: normalizePreferredAreas(
            s.preferred_areas,
            s.preferred_area ?? null
          ),
        },
        s.member_name ?? memberNameById.get(s.member_id ?? "")
      )
    ),
    resolvedAreas: raw.resolved_areas ?? [],
    decidedRestaurant: raw.decisions?.[0]?.restaurant_name,
    decidedRestaurantId: raw.decisions?.[0]?.restaurant_id ?? null,
    decidedAt: raw.decisions?.[0]?.decided_at
      ? new Date(raw.decisions[0].decided_at)
      : null,
  };
}

// ページ遷移をまたいで削除済みグループIDを保持（フルリロード時はリセットされる）
const _removedGroupIds = new Set<string>();

const MOCK_GROUPS: MeshiGroup[] = [
  {
    id: "1",
    name: "ゼミ飲み会",
    inviteCode: "ZEMI01",
    status: "decided",
    members: [
      { id: "m1", displayName: "田中", role: "owner", hasSurvey: true },
      { id: "m2", displayName: "鈴木", role: "member", hasSurvey: true },
      { id: "m3", displayName: "佐藤", role: "member", hasSurvey: true },
      { id: "m4", displayName: "山田", role: "member", hasSurvey: false },
    ],
    surveyResponses: [
      { id: "s1", memberName: "田中", genrePreferences: [{ genreId: "izakaya", priority: "prefer" }, { genreId: "yakiniku", priority: "optional" }], preferredAreas: ["渋谷"], departureStation: "渋谷", preferredArea: "渋谷", submittedAt: new Date() },
      { id: "s2", memberName: "鈴木", genrePreferences: [{ genreId: "yakiniku", priority: "prefer" }, { genreId: "izakaya", priority: "optional" }], preferredAreas: ["渋谷"], departureStation: "渋谷", preferredArea: "渋谷", submittedAt: new Date() },
      { id: "s3", memberName: "佐藤", genrePreferences: [{ genreId: "izakaya", priority: "prefer" }, { genreId: "ramen", priority: "optional" }], preferredAreas: ["渋谷"], departureStation: "渋谷", preferredArea: "渋谷", submittedAt: new Date() },
    ],
    resolvedAreas: ["渋谷"],
    decidedRestaurant: "炭焼きや 渋谷店",
  },
  {
    id: "2",
    name: "会社チームランチ",
    inviteCode: "LUNCH1",
    status: "all_responded",
    members: [
      { id: "m5", displayName: "伊藤", role: "owner", hasSurvey: true },
      { id: "m6", displayName: "渡辺", role: "member", hasSurvey: true },
    ],
    surveyResponses: [
      { id: "s4", memberName: "伊藤", genrePreferences: [{ genreId: "ramen", priority: "prefer" }, { genreId: "curry", priority: "optional" }], preferredAreas: ["新宿"], departureStation: "新宿", preferredArea: "新宿", submittedAt: new Date() },
      { id: "s5", memberName: "渡辺", genrePreferences: [{ genreId: "curry", priority: "prefer" }, { genreId: "ramen", priority: "optional" }], preferredAreas: ["新宿"], departureStation: "新宿", preferredArea: "新宿", submittedAt: new Date() },
    ],
    resolvedAreas: ["新宿"],
  },
  {
    id: "3",
    name: "誕生日ディナー",
    inviteCode: "BDAY01",
    status: "completed",
    members: [
      { id: "m7", displayName: "小林", role: "owner", hasSurvey: true },
      { id: "m8", displayName: "加藤", role: "member", hasSurvey: true },
      { id: "m9", displayName: "吉田", role: "member", hasSurvey: true },
      { id: "m10", displayName: "中村", role: "member", hasSurvey: true },
      { id: "m11", displayName: "松本", role: "member", hasSurvey: true },
      { id: "m12", displayName: "井上", role: "member", hasSurvey: true },
    ],
    surveyResponses: [],
    resolvedAreas: ["恵比寿"],
  },
];

export function useGroups(userId: string | null): UseGroupsResult {
  const [groups, setGroups] = useState<MeshiGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const deleteGroup = useCallback((id: string) => {
    _removedGroupIds.add(id);
    setGroups((prev) => prev.filter((g) => g.id !== id));
  }, []);

  const archiveGroup = useCallback((id: string) => {
    setGroups((prev) =>
      prev.map((group) =>
        group.id === id ? { ...group, status: "archived" } : group
      )
    );
  }, []);

  const leaveGroup = useCallback((id: string) => {
    _removedGroupIds.add(id);
    setGroups((prev) => prev.filter((g) => g.id !== id));
  }, []);

  useEffect(() => {
    if (!userId) {
      setGroups(MOCK_GROUPS.filter((g) => !_removedGroupIds.has(g.id)));
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/groups?profile_id=${userId}`);
        const json = await res.json();
        if (!cancelled) {
          setGroups((json.groups ?? []).map(toMeshiGroup));
        }
      } catch {
        if (!cancelled) setGroups([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId, tick]);

  return { groups, loading, refresh, deleteGroup, archiveGroup, leaveGroup };
}
