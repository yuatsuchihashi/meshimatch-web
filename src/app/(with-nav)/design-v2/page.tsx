import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Heart,
  Home,
  MapPin,
  Megaphone,
  Phone,
  Search,
  Sparkles,
  Ticket,
  Timer,
  User,
  Utensils,
} from "lucide-react";
import {
  Chip,
  CircleIconButton,
  NavBarV2,
  PhotoCard,
  PillButton,
  TicketStub,
  TimerRing,
} from "@/components/v2";

const iconSize = 14;

export default function DesignV2GalleryPage() {
  // dev専用ギャラリー: 本番ビルドでは公開しない (D1レビューP2対応)
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="v2-scope" style={{ minHeight: "100dvh", padding: "28px 18px 40px" }}>
      <div style={{ maxWidth: 430, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <CircleIconButton label="戻る" icon={<ArrowLeft size={18} strokeWidth={2.2} />} />
          <div style={{ textAlign: "center", minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.3, fontWeight: 800, letterSpacing: 0 }}>
              DESIGN v2
            </h1>
            <p style={{ margin: "3px 0 0", color: "var(--v2-muted)", fontSize: 12.5, fontWeight: 500 }}>
              tokens + shared components
            </p>
          </div>
          <CircleIconButton label="通知" icon={<Bell size={18} strokeWidth={2.2} />} />
        </header>

        <section style={{ marginTop: 24 }}>
          <GalleryTitle title="Chips" />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Chip icon={<Sparkles size={iconSize} />} label="おすすめ" />
            <Chip variant="selected" icon={<Utensils size={iconSize} />} label="選択中" />
            <Chip variant="sage" icon={<CheckCircle2 size={iconSize} />} label="営業中" />
            <Chip variant="honey" icon={<Clock3 size={iconSize} />} label="要確認" />
            <Chip variant="blush" icon={<Megaphone size={iconSize} />} label="PR" />
          </div>
        </section>

        <section style={{ marginTop: 22 }}>
          <GalleryTitle title="Buttons" />
          <div style={{ display: "grid", gap: 10 }}>
            <PillButton variant="cta" icon={<Search size={17} strokeWidth={2.5} />}>
              候補を探す
            </PillButton>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <PillButton variant="ink" icon={<Ticket size={17} strokeWidth={2.5} />}>
                招待する
              </PillButton>
              <PillButton variant="ghost" icon={<CalendarDays size={17} strokeWidth={2.5} />}>
                予定を組む
              </PillButton>
            </div>
          </div>
        </section>

        <section style={{ marginTop: 22 }}>
          <GalleryTitle title="PhotoCard" />
          <PhotoCard
            photoSrc="/img/service/02-create-group-plate.webp"
            photoAlt="食事イメージ"
            overlayStart={<Chip variant="sage" icon={<CheckCircle2 size={iconSize} />} label="営業中" />}
            overlayEnd={<Chip variant="blush" icon={<Heart size={iconSize} />} label="Kai推し" />}
            panelAction={<CircleIconButton label="電話" icon={<Phone size={17} strokeWidth={2.4} />} />}
          >
            <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.35 }}>Kissa Alto</div>
            <div style={{ display: "flex", gap: 5, marginTop: 6, flexWrap: "wrap" }}>
              <Chip icon={<MapPin size={12} />} label="渋谷" />
              <Chip label="¥3,000" />
            </div>
          </PhotoCard>
        </section>

        <section style={{ marginTop: 22 }}>
          <GalleryTitle title="TicketStub" />
          <TicketStub
            heading="渋谷ごはん会"
            subtitle="19:30"
            stamp="READY"
            items={[
              { label: "ADMIT", value: "4 PEOPLE" },
              { label: "DATE", value: "JUL 12" },
              { label: "PLACE", value: "SHIBUYA" },
            ]}
          />
        </section>

        <section style={{ marginTop: 22 }}>
          <GalleryTitle title="TimerRing" />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18 }}>
            <TimerRing seconds={7} totalSeconds={10} />
            <TimerRing seconds={2} totalSeconds={10} label="LEFT" />
          </div>
        </section>

        <section style={{ marginTop: 22 }}>
          <GalleryTitle title="NavBarV2" />
          <NavBarV2
            activeHref="/home"
            items={[
              { href: "/home", label: "ホーム", icon: <Home size={19} strokeWidth={2.2} /> },
              { href: "/groups/create", label: "作成", icon: <Utensils size={19} strokeWidth={2.2} /> },
              { href: "/profile", label: "プロフィール", icon: <User size={19} strokeWidth={2.2} /> },
              { href: "/groups/demo", label: "タイマー", icon: <Timer size={19} strokeWidth={2.2} /> },
            ]}
          />
        </section>
      </div>
    </main>
  );
}

function GalleryTitle({ title }: { title: string }) {
  return (
    <h2
      style={{
        margin: "0 0 10px",
        color: "var(--v2-muted)",
        fontSize: 12,
        fontWeight: 800,
        lineHeight: 1,
        letterSpacing: 0,
      }}
    >
      {title}
    </h2>
  );
}
