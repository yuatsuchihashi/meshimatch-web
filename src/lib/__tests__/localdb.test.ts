import { beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  executeLocalQuery,
  localSignIn,
  localSignUp,
  resetLocalDb,
} from "@/lib/localdb/engine";
import { resolveZoneForStation } from "@/lib/areas";
import type { DbQuery } from "@/lib/localdb/builder";

const testDbPath = path.join(os.tmpdir(), `meshimatch-test-${process.pid}`, "db.json");
process.env.MESHIMATCH_LOCALDB_PATH = testDbPath;

function q(partial: Partial<DbQuery> & { table: string }): DbQuery {
  return {
    action: "select",
    select: null,
    filters: [],
    order: null,
    single: null,
    onConflict: null,
    ...partial,
  };
}

function insert(table: string, values: Record<string, unknown>) {
  const result = executeLocalQuery(
    q({ table, action: "insert", values, select: "*", single: "single" })
  );
  expect(result.error).toBeNull();
  return result.data as Record<string, unknown>;
}

function writeLegacyDb(values: Record<string, unknown>) {
  fs.mkdirSync(path.dirname(testDbPath), { recursive: true });
  fs.writeFileSync(testDbPath, JSON.stringify(values), "utf-8");
  const future = new Date(Date.now() + 1000);
  fs.utimesSync(testDbPath, future, future);
}

beforeEach(() => {
  fs.rmSync(path.dirname(testDbPath), { recursive: true, force: true });
  resetLocalDb();
});

describe("localdb engine", () => {
  it("inserts with defaults and selects by eq", () => {
    const group = insert("groups", { name: "飲み会", invite_code: "ABC12345" });
    expect(group.id).toBeTruthy();
    expect(group.mode).toBe("planned");
    expect(group.status).toBe("active");
    expect(group.session_focus).toBe("balanced");

    const result = executeLocalQuery(
      q({
        table: "groups",
        filters: [{ op: "eq", column: "invite_code", value: "ABC12345" }],
        single: "single",
      })
    );
    expect(result.error).toBeNull();
    expect((result.data as Record<string, unknown>).name).toBe("飲み会");
  });

  it("returns PGRST116 for single() with no rows and null for maybeSingle()", () => {
    const single = executeLocalQuery(
      q({
        table: "groups",
        filters: [{ op: "eq", column: "id", value: "missing" }],
        single: "single",
      })
    );
    expect(single.error?.code).toBe("PGRST116");

    const maybe = executeLocalQuery(
      q({
        table: "groups",
        filters: [{ op: "eq", column: "id", value: "missing" }],
        single: "maybe",
      })
    );
    expect(maybe.error).toBeNull();
    expect(maybe.data).toBeNull();
  });

  it("resolves child embeds (groups -> group_members) as arrays", () => {
    const group = insert("groups", { name: "G", invite_code: "CODE0001" });
    insert("group_members", {
      group_id: group.id,
      display_name: "ホスト",
      role: "owner",
    });
    insert("group_members", { group_id: group.id, display_name: "ゲスト" });

    const result = executeLocalQuery(
      q({
        table: "groups",
        select: `id, name, group_members (id, display_name, role, has_survey)`,
        filters: [{ op: "eq", column: "id", value: group.id }],
        single: "single",
      })
    );
    const data = result.data as { group_members: { display_name: string }[] };
    expect(data.group_members).toHaveLength(2);
    expect(data.group_members.map((m) => m.display_name)).toContain("ホスト");
  });

  it("resolves parent embeds with !inner (survey_responses -> group_members)", () => {
    const group = insert("groups", { name: "G", invite_code: "CODE0002" });
    const member = insert("group_members", {
      group_id: group.id,
      display_name: "たろう",
    });
    insert("survey_responses", { group_id: group.id, member_id: member.id });

    const result = executeLocalQuery(
      q({
        table: "survey_responses",
        select: `*, group_members!inner (id, display_name, profile_id)`,
        filters: [{ op: "eq", column: "group_id", value: group.id }],
      })
    );
    const rows = result.data as { group_members: { display_name: string } }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].group_members.display_name).toBe("たろう");
  });

  it("resolves aliased FK-hint embeds (inviter:profiles!invitations_inviter_id_fkey)", () => {
    const inviter = insert("profiles", { display_name: "ゆあ" });
    const invitee = insert("profiles", { display_name: "たろう" });
    const group = insert("groups", { name: "G", invite_code: "CODE0003" });
    insert("invitations", {
      group_id: group.id,
      inviter_id: inviter.id,
      invitee_id: invitee.id,
    });

    const result = executeLocalQuery(
      q({
        table: "invitations",
        select: `*, groups!inner (name), inviter:profiles!invitations_inviter_id_fkey (display_name)`,
        filters: [
          { op: "eq", column: "invitee_id", value: invitee.id },
          { op: "eq", column: "status", value: "pending" },
        ],
      })
    );
    const rows = result.data as {
      groups: { name: string };
      inviter: { display_name: string };
    }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].groups.name).toBe("G");
    expect(rows[0].inviter.display_name).toBe("ゆあ");
  });

  it("upserts on composite conflict (survey_responses group_id,member_id)", () => {
    const group = insert("groups", { name: "G", invite_code: "CODE0004" });
    const member = insert("group_members", {
      group_id: group.id,
      display_name: "たろう",
    });

    const first = executeLocalQuery(
      q({
        table: "survey_responses",
        action: "upsert",
        values: { group_id: group.id, member_id: member.id, budget_ideal_yen: 3000 },
        onConflict: "group_id,member_id",
        select: "*",
        single: "single",
      })
    );
    const second = executeLocalQuery(
      q({
        table: "survey_responses",
        action: "upsert",
        values: { group_id: group.id, member_id: member.id, budget_ideal_yen: 5000 },
        onConflict: "group_id,member_id",
        select: "*",
        single: "single",
      })
    );

    expect((second.data as Record<string, unknown>).budget_ideal_yen).toBe(5000);
    expect((second.data as Record<string, unknown>).id).toBe(
      (first.data as Record<string, unknown>).id
    );

    const all = executeLocalQuery(q({ table: "survey_responses" }));
    expect(all.data as unknown[]).toHaveLength(1);
  });

  it("update flips flags and delete removes matching rows", () => {
    const group = insert("groups", { name: "G", invite_code: "CODE0005" });
    const member = insert("group_members", {
      group_id: group.id,
      display_name: "たろう",
    });

    executeLocalQuery(
      q({
        table: "group_members",
        action: "update",
        values: { has_survey: true },
        filters: [{ op: "eq", column: "id", value: member.id }],
      })
    );
    const updated = executeLocalQuery(
      q({
        table: "group_members",
        filters: [{ op: "eq", column: "id", value: member.id }],
        single: "single",
      })
    );
    expect((updated.data as Record<string, unknown>).has_survey).toBe(true);

    executeLocalQuery(
      q({
        table: "group_members",
        action: "delete",
        filters: [{ op: "eq", column: "group_id", value: group.id }],
      })
    );
    const remaining = executeLocalQuery(q({ table: "group_members" }));
    expect(remaining.data as unknown[]).toHaveLength(0);
  });

  it("filters with in / neq / not_is_null and orders descending", () => {
    const p1 = insert("profiles", { display_name: "A" });
    insert("profiles", { display_name: "B" });
    const group = insert("groups", { name: "G", invite_code: "CODE0006" });
    insert("group_members", {
      group_id: group.id,
      profile_id: p1.id,
      display_name: "A",
    });
    insert("group_members", { group_id: group.id, display_name: "ゲスト" });

    const withProfile = executeLocalQuery(
      q({
        table: "group_members",
        filters: [
          { op: "in", column: "group_id", value: [group.id] },
          { op: "not_is_null", column: "profile_id" },
          { op: "neq", column: "profile_id", value: "nobody" },
        ],
      })
    );
    expect(withProfile.data as unknown[]).toHaveLength(1);

    insert("invitations", { group_id: group.id, created_at: "2026-01-01T00:00:00Z" });
    insert("invitations", { group_id: group.id, created_at: "2026-06-01T00:00:00Z" });
    const ordered = executeLocalQuery(
      q({
        table: "invitations",
        order: { column: "created_at", ascending: false },
      })
    );
    const rows = ordered.data as { created_at: string }[];
    expect(rows[0].created_at).toBe("2026-06-01T00:00:00Z");
  });

  it("enforces unique invite_code and signs up/in locally", () => {
    insert("groups", { name: "G1", invite_code: "SAME0000" });
    const dup = executeLocalQuery(
      q({
        table: "groups",
        action: "insert",
        values: { name: "G2", invite_code: "SAME0000" },
        select: "*",
        single: "single",
      })
    );
    expect(dup.error?.code).toBe("23505");

    const signup = localSignUp("yua@example.com", "pass1234", "ゆあ");
    expect(signup.error).toBeNull();
    expect(localSignUp("yua@example.com", "x", "y").error).toBeTruthy();
    expect(localSignIn("yua@example.com", "pass1234").userId).toBe(signup.userId);
    expect(localSignIn("yua@example.com", "wrong").error).toBeTruthy();

    const profile = executeLocalQuery(
      q({
        table: "profiles",
        filters: [{ op: "eq", column: "id", value: signup.userId }],
        single: "single",
      })
    );
    expect((profile.data as Record<string, unknown>).display_name).toBe("ゆあ");
  });

  it("backfills legacy groups to planned mode on load", () => {
    writeLegacyDb({
      groups: [{ id: "legacy-group", name: "Legacy", invite_code: "LEGACY01" }],
    });

    const result = executeLocalQuery(
      q({
        table: "groups",
        filters: [{ op: "eq", column: "id", value: "legacy-group" }],
        single: "single",
      })
    );

    expect(result.error).toBeNull();
    expect((result.data as Record<string, unknown>).mode).toBe("planned");
  });

  it("roundtrips raw nullable departure_station values", () => {
    const group = insert("groups", { name: "G", invite_code: "CODE0007" });
    const member = insert("group_members", {
      group_id: group.id,
      display_name: "たろう",
    });

    const response = insert("survey_responses", {
      group_id: group.id,
      member_id: member.id,
      departure_station: "渋谷駅",
    });

    expect(response.departure_station).toBe("渋谷駅");

    const group2 = insert("groups", { name: "G2", invite_code: "CODE0008" });
    const member2 = insert("group_members", {
      group_id: group2.id,
      display_name: "じろう",
    });
    const empty = insert("survey_responses", {
      group_id: group2.id,
      member_id: member2.id,
    });

    expect(empty.departure_station).toBeNull();
  });

  it("roundtrips profile default departure station", () => {
    const profile = insert("profiles", {
      display_name: "ゆあ",
      usual_departure_station: "渋谷駅",
    });

    expect(profile.usual_departure_station).toBe("渋谷駅");

    const empty = insert("profiles", { display_name: "たろう" });
    expect(empty.usual_departure_station).toBeNull();
  });

  it("defaults restaurant source pr to false", () => {
    const profile = insert("profiles", { display_name: "ゆあ" });
    const restaurant = insert("restaurants", { name: "テスト食堂" });

    const source = insert("restaurant_sources", {
      restaurant_id: restaurant.id,
      source_type: "user_favorite",
      added_by: profile.id,
    });

    expect(source.pr).toBe(false);
  });

  it("roundtrips R6a catalog provenance and places cache rows", () => {
    const restaurant = insert("restaurants", {
      name: "恵比寿テスト食堂A",
      place_id: "fixtures/ebisu-test-a",
      external_id: "place:fixtures/ebisu-test-a",
      catalog_source: "catalog",
    });
    const source = insert("restaurant_sources", {
      restaurant_id: restaurant.id,
      source_type: "catalog",
      visibility: "private",
      added_by: null,
    });
    const cache = insert("places_cache", {
      place_id: "fixtures/ebisu-test-a",
      raw_details: { id: "fixtures/ebisu-test-a", displayName: { text: "fixture" } },
      fetched_at: "2026-07-12T00:00:00.000Z",
      expires_at: "2026-08-11T00:00:00.000Z",
      source: "fixture",
    });

    expect(restaurant.catalog_source).toBe("catalog");
    expect(source.source_type).toBe("catalog");
    expect(cache.place_id).toBe("fixtures/ebisu-test-a");
    expect(cache.source).toBe("fixture");
  });

  it("coerces restaurant source pr to false for non-verified users", () => {
    const profile = insert("profiles", { display_name: "一般ユーザー" });
    const restaurant = insert("restaurants", { name: "テスト食堂" });

    const inserted = insert("restaurant_sources", {
      restaurant_id: restaurant.id,
      source_type: "user_favorite",
      added_by: profile.id,
      pr: true,
    });

    expect(inserted.pr).toBe(false);

    const updated = executeLocalQuery(
      q({
        table: "restaurant_sources",
        action: "update",
        values: { pr: true },
        filters: [{ op: "eq", column: "id", value: inserted.id }],
        select: "*",
        single: "single",
      })
    );

    expect(updated.error).toBeNull();
    expect((updated.data as Record<string, unknown>).pr).toBe(false);
  });

  it("keeps restaurant source pr true for verified users", () => {
    const profile = insert("profiles", { display_name: "公式ユーザー" });
    insert("official_verification_grants", {
      profile_id: profile.id,
      note: "test verified account",
    });
    const restaurant = insert("restaurants", { name: "テスト食堂" });

    const source = executeLocalQuery(
      q({
        table: "restaurant_sources",
        action: "upsert",
        values: {
          restaurant_id: restaurant.id,
          source_type: "user_favorite",
          added_by: profile.id,
          pr: true,
        },
        onConflict: "restaurant_id,source_type,added_by",
        select: "*",
        single: "single",
      })
    );

    expect(source.error).toBeNull();
    expect((source.data as Record<string, unknown>).pr).toBe(true);
  });

  it("seeds zone mappings and resolves station names to zones", () => {
    const mapping = executeLocalQuery(
      q({
        table: "station_zone_map",
        filters: [{ op: "eq", column: "station", value: "渋谷駅" }],
        single: "single",
      })
    );

    expect(mapping.error).toBeNull();
    expect((mapping.data as Record<string, unknown>).zone_id).toBe("shibuya");

    const zone = executeLocalQuery(
      q({
        table: "zones",
        filters: [{ op: "eq", column: "id", value: "shibuya" }],
        single: "single",
      })
    );

    expect(zone.error).toBeNull();
    expect((zone.data as Record<string, unknown>).name).toBe("渋谷");
    expect(resolveZoneForStation("渋谷")?.id).toBe("shibuya");
  });
});
