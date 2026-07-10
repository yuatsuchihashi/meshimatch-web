export type VerificationClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle?: () => Promise<{ data: unknown; error: unknown }>;
        single?: () => Promise<{ data: unknown; error: unknown }>;
      };
      in: (column: string, values: string[]) => Promise<{ data: unknown; error: unknown }>;
    };
  };
};

export async function isVerified(
  client: VerificationClient,
  profileId: string | null | undefined
): Promise<boolean> {
  if (!profileId) return false;

  const query = client
    .from("official_verification_grants")
    .select("profile_id")
    .eq("profile_id", profileId);
  const result =
    typeof query.maybeSingle === "function"
      ? await query.maybeSingle()
      : await query.single?.();

  return Boolean(result?.data && !result.error);
}

export async function getVerifiedProfileIds(
  client: VerificationClient,
  profileIds: string[]
): Promise<Set<string>> {
  const ids = [...new Set(profileIds.filter(Boolean))];
  if (ids.length === 0) return new Set();

  const { data } = await client
    .from("official_verification_grants")
    .select("profile_id")
    .in("profile_id", ids);

  return new Set(
    ((data ?? []) as { profile_id?: string | null }[])
      .map((row) => row.profile_id)
      .filter((id): id is string => Boolean(id))
  );
}
