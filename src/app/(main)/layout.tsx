import { BottomNav } from "@/components/ui/BottomNav";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: "100dvh", paddingBottom: "calc(60px + env(safe-area-inset-bottom))" }}>
      {children}
      <BottomNav />
    </div>
  );
}
