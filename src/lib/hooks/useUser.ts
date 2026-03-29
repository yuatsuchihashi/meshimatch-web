"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { UserProfile } from "@/lib/types";

interface UseUserResult {
  user: UserProfile | null;
  userId: string | null;
  loading: boolean;
  refresh: () => void;
}

export function useUser(): UseUserResult {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        if (!cancelled) { setUser(null); setUserId(null); setLoading(false); }
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, display_name, disliked_genres, allergies")
        .eq("id", authUser.id)
        .single();

      if (!cancelled) {
        setUserId(authUser.id);
        if (profile) {
          setUser({
            id: profile.id,
            displayName: profile.display_name ?? "ユーザー",
            dislikedGenres: profile.disliked_genres ?? [],
            allergies: profile.allergies ?? [],
          });
        } else {
          setUser({ id: authUser.id, displayName: "ユーザー", dislikedGenres: [], allergies: [] });
        }
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [tick]);

  return { user, userId, loading, refresh };
}
