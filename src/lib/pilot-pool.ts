import config from "../../data/pilot-pool-config.json";
import { isLocalMode } from "@/lib/local-mode";

export const PILOT_CURATOR_PROFILE_ID = config.curatorProfileId;

export function includePilotCurator(
  followedProfileIds: string[],
  env: Record<string, string | undefined> = process.env,
  localMode = isLocalMode()
) {
  const enabled = localMode || env.MESHIMATCH_PILOT_POOL === "1";
  return enabled
    ? [...new Set([...followedProfileIds, PILOT_CURATOR_PROFILE_ID])]
    : [...new Set(followedProfileIds)];
}
