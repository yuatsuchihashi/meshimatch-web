"use client";

import { useState, useEffect, useCallback } from "react";
import type { MeshiGroup } from "@/lib/types";

interface UseGroupsResult {
  groups: MeshiGroup[];
  loading: boolean;
  refresh: () => void;
  deleteGroup: (id: string) => void;
  leaveGroup: (id: string) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toMeshiGroup(raw: any): MeshiGroup {
  return {
    id: raw.id,
    name: raw.name,
    inviteCode: raw.invite_code ?? "",
    status: raw.status ?? "active",
    members: (raw.group_members ?? []).map((m: any) => ({
      id: m.id,
      displayName: m.display_name ?? "メンバー",
      role: m.role ?? "member",
      hasSurvey: m.has_survey ?? false,
    })),
    surveyResponses: (raw.survey_responses ?? []).map((s: any) => ({
      id: s.id,
      memberName: s.member_id ?? "",
      memberId: s.member_id,
      tierS: s.tier_s ?? [],
      tierA: s.tier_a ?? [],
      tierB: s.tier_b ?? [],
      disliked: s.disliked ?? [],
      preferredAreas: s.preferred_areas ?? [],
      departureStation: "",
      preferredArea: null,
      submittedAt: new Date(s.submitted_at),
    })),
    resolvedAreas: raw.resolved_areas ?? [],
    decidedRestaurant: raw.decisions?.[0]?.restaurant_name,
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
      { id: "s1", memberName: "田中", tierS: ["izakaya"], tierA: ["yakiniku"], tierB: [], departureStation: "渋谷", preferredArea: "渋谷", submittedAt: new Date() },
      { id: "s2", memberName: "鈴木", tierS: ["yakiniku"], tierA: ["izakaya"], tierB: [], departureStation: "渋谷", preferredArea: "渋谷", submittedAt: new Date() },
      { id: "s3", memberName: "佐藤", tierS: ["izakaya"], tierA: [], tierB: ["ramen"], departureStation: "渋谷", preferredArea: "渋谷", submittedAt: new Date() },
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
      { id: "s4", memberName: "伊藤", tierS: ["ramen"], tierA: ["curry"], tierB: [], departureStation: "新宿", preferredArea: "新宿", submittedAt: new Date() },
      { id: "s5", memberName: "渡辺", tierS: ["curry"], tierA: ["ramen"], tierB: [], departureStation: "新宿", preferredArea: "新宿", submittedAt: new Date() },
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

  return { groups, loading, refresh, deleteGroup, leaveGroup };
}
