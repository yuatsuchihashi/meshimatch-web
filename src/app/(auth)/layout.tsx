import { LocaleToggle } from "@/components/LocaleToggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="v2-scope service-canvas min-h-dvh flex items-center justify-center px-6">
      <div className="fixed top-5 right-5 z-10">
        <LocaleToggle />
      </div>
      {children}
    </div>
  );
}
