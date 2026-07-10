import { describe, expect, it } from "vitest";
import { getVerifiedProfileIds, isVerified } from "@/lib/verification";

function clientWithGrants(profileIds: string[]) {
  const rows = profileIds.map((profile_id) => ({ profile_id }));
  return {
    from: () => ({
      select: () => ({
        eq: (_column: string, value: string) => ({
          maybeSingle: async () => ({
            data: rows.find((row) => row.profile_id === value) ?? null,
            error: null,
          }),
        }),
        in: async (_column: string, values: string[]) => ({
          data: rows.filter((row) => values.includes(row.profile_id)),
          error: null,
        }),
      }),
    }),
  };
}

describe("verification helpers", () => {
  it("resolves a single verified profile", async () => {
    const client = clientWithGrants(["official"]);

    await expect(isVerified(client, "official")).resolves.toBe(true);
    await expect(isVerified(client, "regular")).resolves.toBe(false);
    await expect(isVerified(client, null)).resolves.toBe(false);
  });

  it("returns a set of verified profile ids", async () => {
    const client = clientWithGrants(["official-a", "official-b"]);
    const ids = await getVerifiedProfileIds(client, ["official-a", "regular"]);

    expect([...ids]).toEqual(["official-a"]);
  });
});
