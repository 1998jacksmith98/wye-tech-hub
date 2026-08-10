import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  const session = await auth();
  if (session?.user?.organizationId) {
    redirect("/app");
  }

  return (
    <main className="app-grid relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-y-0 right-0 w-[46%] bg-bg-deep" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-[46%] bg-[linear-gradient(160deg,rgba(31,111,139,0.35),transparent_45%)]" />

      <div className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="fade-up max-w-xl">
          <p className="display text-sm font-semibold uppercase tracking-[0.24em] text-accent">
            Webb Yates Engineers
          </p>
          <h1 className="display mt-4 text-5xl font-semibold leading-[1.05] tracking-tight text-ink md:text-6xl">
            Tech Hub
          </h1>
          <div className="hero-rule mt-6 h-1 w-28 bg-accent" />
          <p className="fade-up-delay mt-6 max-w-md text-lg leading-relaxed text-ink-soft">
            One place for project notes, screenshots, due dates and who&apos;s
            working on what — built for Revit technician teams.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-deep"
            >
              Sign in to Tech Hub
            </Link>
            <a
              href="#how"
              className="rounded-xl border border-line bg-white/70 px-5 py-3 text-sm font-semibold text-ink-soft transition hover:bg-white"
            >
              How it works
            </a>
          </div>
        </section>

        <section
          id="how"
          className="fade-up-delay relative z-10 rounded-3xl border border-white/10 bg-white/10 p-8 text-white backdrop-blur md:p-10"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
            Built for the weekly sync
          </p>
          <ul className="mt-6 space-y-5 text-base leading-relaxed text-white/85">
            <li>
              <strong className="text-white">Projects as cards</strong>
              <br />
              See leads, assignees, next issue dates and open actions at a glance.
            </li>
            <li>
              <strong className="text-white">Capture the awkward bits</strong>
              <br />
              Notes, screenshots, emails and Teams links — tagged and searchable.
            </li>
            <li>
              <strong className="text-white">Files in SharePoint</strong>
              <br />
              Attachments live with the team, not trapped on one laptop.
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
