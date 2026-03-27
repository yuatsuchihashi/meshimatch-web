"use client";

import { useState } from "react";
import { searchUsers } from "@/actions/follows";
import { GlassInput } from "@/components/ui/GlassInput";
import { GlassCard } from "@/components/ui/GlassCard";
import { cn } from "@/lib/utils";
import { User, X, Search, Plus } from "lucide-react";

type Member = {
  id: string;
  display_name: string;
};

type MemberSelectorProps = {
  following: Member[];
  selected: Member[];
  onAdd: (member: Member) => void;
  onRemove: (id: string) => void;
};

export function MemberSelector({
  following,
  selected,
  onAdd,
  onRemove,
}: MemberSelectorProps) {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Member[]>([]);

  const selectedIds = new Set(selected.map((m) => m.id));

  // Show following list, filtered by query
  const filteredFollowing = following.filter(
    (f) =>
      !selectedIds.has(f.id) &&
      f.display_name.toLowerCase().includes(query.toLowerCase())
  );

  async function handleSearch(value: string) {
    setQuery(value);
    if (value.trim().length >= 2) {
      const { data } = await searchUsers(value.trim());
      setSearchResults(
        (data ?? [])
          .filter((u) => !selectedIds.has(u.id))
          .map((u) => ({ id: u.id, display_name: u.display_name }))
      );
    } else {
      setSearchResults([]);
    }
  }

  const availableUsers =
    query.trim().length >= 2 ? searchResults : filteredFollowing;

  return (
    <div className="flex flex-col gap-3">
      {/* Selected members chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((member) => (
            <span
              key={member.id}
              className="glass inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-accent rounded-xl"
            >
              <User size={12} />
              {member.display_name}
              <button
                type="button"
                onClick={() => onRemove(member.id)}
                className="hover:text-danger transition-colors"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search
          size={16}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/40"
        />
        <GlassInput
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="フォロー中のユーザーを追加..."
          className="pl-10"
        />
      </div>

      {/* Available users */}
      {availableUsers.length > 0 && (
        <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
          {availableUsers.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => {
                onAdd(user);
                setQuery("");
                setSearchResults([]);
              }}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-left",
                "hover:bg-white/15 transition-colors cursor-pointer"
              )}
            >
              <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center">
                <User size={12} className="text-accent" />
              </div>
              <span className="flex-1 text-foreground">{user.display_name}</span>
              <Plus size={14} className="text-accent" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
