export default function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  return (
    <div>
      <header>
        <h1>Dashboard</h1>
      </header>
      <main>{children}</main>
    </div>
  );
}
