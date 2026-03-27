import { GlassBottomNav } from "@/components/ui/GlassBottomNav";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-mesh-subtle min-h-dvh pb-20">
      {children}
      <GlassBottomNav />
    </div>
  );
}
