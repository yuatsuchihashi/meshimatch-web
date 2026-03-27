"use client";

import { useState } from "react";
import { searchUsers } from "@/actions/follows";
import { GlassInput } from "@/components/ui/GlassInput";
import { GlassCard } from "@/components/ui/GlassCard";
import { FollowButton } from "./FollowButton";
import { User, Search } from "lucide-react";

type SearchResult = {
  id: string;
  display_name: string;
  avatar_url: string | null;
};

type UserSearchInputProps = {
  followingIds: string[];
};

export function UserSearchInput({ followingIds }: UserSearchInputProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  async function handleSearch(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }

    setSearching(true);
    const { data } = await searchUsers(value.trim());
    setResults(data ?? []);
    setSearching(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search
          size={16}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/40"
        />
        <GlassInput
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="ユーザーを検索..."
          className="pl-10"
        />
      </div>

      {searching && (
        <p className="text-sm text-foreground/50 text-center">検索中...</p>
      )}

      {results.length > 0 && (
        <div className="flex flex-col gap-2">
          {results.map((user) => (
            <GlassCard key={user.id} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                <User size={18} className="text-accent" />
              </div>
              <p className="flex-1 font-medium text-foreground text-sm">
                {user.display_name}
              </p>
              <FollowButton
                targetUserId={user.id}
                isFollowing={followingIds.includes(user.id)}
              />
            </GlassCard>
          ))}
        </div>
      )}

      {!searching && query.trim().length >= 2 && results.length === 0 && (
        <p className="text-sm text-foreground/50 text-center">
          ユーザーが見つかりませんでした
        </p>
      )}
    </div>
  );
}
