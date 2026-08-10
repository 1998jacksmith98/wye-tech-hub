import { requireSession } from "@/lib/session";
import { AppShell } from "@/components/app-shell";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  return (
    <AppShell
      userName={session.user.name || session.user.email || "User"}
      orgName={session.user.organizationName || "Tech Hub"}
    >
      {children}
    </AppShell>
  );
}
