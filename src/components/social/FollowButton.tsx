"use client";

import { followUser, unfollowUser } from "@/actions/follows";
import { GlassButton } from "@/components/ui/GlassButton";
import { useTransition } from "react";
import { UserPlus, UserMinus } from "lucide-react";

type FollowButtonProps = {
  targetUserId: string;
  isFollowing: boolean;
};

export function FollowButton({ targetUserId, isFollowing }: FollowButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      if (isFollowing) {
        await unfollowUser(targetUserId);
      } else {
        await followUser(targetUserId);
      }
    });
  }

  return (
    <GlassButton
      variant={isFollowing ? "ghost" : "accent"}
      size="sm"
      onClick={handleToggle}
      disabled={isPending}
    >
      {isFollowing ? (
        <>
          <UserMinus size={14} className="inline mr-1" />
          フォロー解除
        </>
      ) : (
        <>
          <UserPlus size={14} className="inline mr-1" />
          フォロー
        </>
      )}
    </GlassButton>
  );
}
