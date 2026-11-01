export default function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  return <main className="mx-auto w-full max-w-5xl px-6 py-8">{children}</main>;
}
