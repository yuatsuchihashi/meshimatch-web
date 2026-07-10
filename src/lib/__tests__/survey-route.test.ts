import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/groups/survey/route";

const mocks = vi.hoisted(() => ({
  authUserId: null as string | null,
  verifiedProfileIds: new Set<string>(),
  upsertPayloads: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: mocks.authUserId ? { id: mocks.authUserId } : null,
        },
      })),
    },
  })),
  createServiceClient: vi.fn(async () => ({
    from: (table: string) => {
      if (table === "official_verification_grants") {
        return {
          select: () => ({
            eq: (_column: string, value: string) => ({
              maybeSingle: async () => ({
                data: mocks.verifiedProfileIds.has(value)
                  ? { profile_id: value }
                  : null,
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "survey_responses") {
        return {
          upsert: (payload: Record<string, unknown>) => {
            mocks.upsertPayloads.push(payload);
            return {
              select: () => ({
                single: async () => ({ data: payload, error: null }),
              }),
            };
          },
        };
      }

      if (table === "group_members") {
        return {
          update: () => ({
            eq: async () => ({ data: null, error: null }),
          }),
        };
      }

      throw new Error(`unexpected table: ${table}`);
    },
  })),
}));

function surveyRequest() {
  return new Request("http://localhost/api/groups/survey", {
    method: "POST",
    body: JSON.stringify({
      groupId: "group-1",
      memberId: "member-1",
      suggestedRestaurants: [
        { id: "restaurant-1", name: "店A", showName: true, pr: true },
      ],
    }),
  });
}

function storedSuggestionPr() {
  const payload = mocks.upsertPayloads.at(-1);
  const suggestions = payload?.suggested_restaurants as
    | { pr?: boolean }[]
    | undefined;
  return suggestions?.[0]?.pr;
}

describe("survey route PR disclosure guard", () => {
  beforeEach(() => {
    mocks.authUserId = null;
    mocks.verifiedProfileIds = new Set<string>();
    mocks.upsertPayloads = [];
  });

  it("forces submitted PR suggestions to false for guests", async () => {
    const response = await POST(surveyRequest() as Parameters<typeof POST>[0]);

    expect(response.status).toBe(201);
    expect(storedSuggestionPr()).toBe(false);
  });

  it("forces submitted PR suggestions to false for non-verified users", async () => {
    mocks.authUserId = "regular-user";

    const response = await POST(surveyRequest() as Parameters<typeof POST>[0]);

    expect(response.status).toBe(201);
    expect(storedSuggestionPr()).toBe(false);
  });

  it("keeps submitted PR suggestions for verified users", async () => {
    mocks.authUserId = "official-user";
    mocks.verifiedProfileIds.add("official-user");

    const response = await POST(surveyRequest() as Parameters<typeof POST>[0]);

    expect(response.status).toBe(201);
    expect(storedSuggestionPr()).toBe(true);
  });
});
