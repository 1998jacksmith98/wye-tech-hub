import Link from "next/link";
import { signOut } from "@/lib/auth";
import { Button } from "@/components/ui";

export function AppShell({
  userName,
  orgName,
  children,
}: {
  userName: string;
  orgName: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line/80 bg-bg-elevated/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-8">
            <Link href="/app" className="display text-lg font-semibold tracking-tight">
              <span className="text-accent">WYE</span> Tech Hub
            </Link>
            <nav className="flex flex-wrap items-center gap-1 text-sm font-semibold text-ink-soft">
              <Link href="/app" className="rounded-lg px-3 py-2 hover:bg-white hover:text-ink">
                Projects
              </Link>
              <Link
                href="/app/weekly"
                className="rounded-lg px-3 py-2 hover:bg-white hover:text-ink"
              >
                Weekly board
              </Link>
              <Link
                href="/app/calendar"
                className="rounded-lg px-3 py-2 hover:bg-white hover:text-ink"
              >
                Calendar
              </Link>
              <Link
                href="/app/feed"
                className="rounded-lg px-3 py-2 hover:bg-white hover:text-ink"
              >
                Information feed
              </Link>
              <Link
                href="/app/families"
                className="rounded-lg px-3 py-2 hover:bg-white hover:text-ink"
              >
                Families
              </Link>
              <Link
                href="/app/team"
                className="rounded-lg px-3 py-2 hover:bg-white hover:text-ink"
              >
                Team
              </Link>
              <Link
                href="/app/revit"
                className="rounded-lg px-3 py-2 hover:bg-white hover:text-ink"
              >
                Revit
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold text-ink">{userName}</p>
              <p className="text-xs text-ink-muted">{orgName}</p>
            </div>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <Button type="submit" variant="ghost" className="!py-2">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] px-6 py-8">{children}</main>
    </div>
  );
}
