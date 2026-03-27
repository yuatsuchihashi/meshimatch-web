export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-mesh min-h-dvh flex items-center justify-center px-6">
      {children}
    </div>
  );
}
