import { LocaleToggle } from "@/components/LocaleToggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-mesh min-h-dvh flex items-center justify-center px-6">
      <div className="fixed top-5 right-5 z-10">
        <LocaleToggle light />
      </div>
      {children}
    </div>
  );
}
