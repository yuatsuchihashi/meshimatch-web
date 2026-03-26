import { GlassCard } from "@/components/ui/GlassCard";
import { Settings, Heart, Users, Utensils, User } from "lucide-react";
import Link from "next/link";
import { MOCK_USER, MOCK_PROFILE } from "@/lib/mock-user";

export default async function ProfilePage() {
  const user = MOCK_USER;
  const profile = MOCK_PROFILE;
  const followingCount = 0;
  const followerCount = 0;

  const menuItems = [
    {
      href: "/profile/preferences",
      icon: Utensils,
      label: "好み設定",
      description: "ジャンルの好み・食事制限を設定",
    },
    {
      href: "/profile/favorites",
      icon: Heart,
      label: "お気に入り",
      description: "保存したレストラン",
    },
    {
      href: "/profile/follows",
      icon: Users,
      label: "フォロー",
      description: `${followingCount} フォロー中 / ${followerCount} フォロワー`,
    },
    {
      href: "/profile/settings",
      icon: Settings,
      label: "設定",
      description: "アカウント設定",
    },
  ];

  return (
    <div className="px-4 pt-8 max-w-md mx-auto">
      <GlassCard variant="strong" className="flex flex-col items-center gap-3 mb-6">
        <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center">
          <User size={32} className="text-accent" />
        </div>
        <h1 className="text-xl font-bold text-foreground">
          {profile.display_name}
        </h1>
        <p className="text-sm text-foreground/50">{user.email}</p>
      </GlassCard>

      <div className="flex flex-col gap-3">
        {menuItems.map(({ href, icon: Icon, label, description }) => (
          <Link key={href} href={href}>
            <GlassCard className="flex items-center gap-4 hover:bg-white/25 transition-colors cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                <Icon size={20} className="text-accent" />
              </div>
              <div>
                <p className="font-medium text-foreground">{label}</p>
                <p className="text-sm text-foreground/50">{description}</p>
              </div>
            </GlassCard>
          </Link>
        ))}
      </div>
    </div>
  );
}
