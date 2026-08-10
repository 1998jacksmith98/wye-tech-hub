import { auth, signIn } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Button, Card, Input, Label } from "@/components/ui";
import Link from "next/link";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user?.organizationId) redirect("/app");

  const params = await searchParams;
  const hasMicrosoft = Boolean(
    process.env.AUTH_MICROSOFT_ENTRA_ID_ID &&
      process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
  );
  const devMode = process.env.AUTH_DEV_MODE === "true";

  return (
    <main className="app-grid flex min-h-screen items-center justify-center px-6 py-16">
      <Card className="fade-up w-full max-w-md p-8">
        <Link
          href="/"
          className="display text-sm font-semibold uppercase tracking-[0.2em] text-accent"
        >
          Tech Hub
        </Link>
        <h1 className="display mt-4 text-3xl font-semibold tracking-tight">
          Sign in
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Use your Microsoft work account. Local dev login is available while
          Entra is being set up.
        </p>

        {params.error ? (
          <p className="mt-4 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
            Sign-in failed. Check that your email domain is allowed.
          </p>
        ) : null}

        <div className="mt-8 space-y-3">
          {hasMicrosoft ? (
            <form
              action={async () => {
                "use server";
                await signIn("microsoft-entra-id", { redirectTo: "/app" });
              }}
            >
              <Button type="submit" className="w-full">
                Sign in with Microsoft
              </Button>
            </form>
          ) : (
            <p className="rounded-xl bg-accent-soft px-3 py-2 text-sm text-accent-deep">
              Microsoft login is not configured yet. Add Entra credentials in
              `.env` when ready.
            </p>
          )}

          {devMode ? (
            <form
              action={async (formData) => {
                "use server";
                await signIn("dev-login", {
                  name: String(formData.get("name") || "Jack"),
                  email: String(formData.get("email") || "jack@webbyates.com"),
                  redirectTo: "/app",
                });
              }}
              className="space-y-3 border-t border-line pt-5"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
                Local dev login
              </p>
              <div>
                <Label>Name</Label>
                <Input name="name" defaultValue="Jack" required />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  name="email"
                  type="email"
                  defaultValue="jack@webbyates.com"
                  required
                />
              </div>
              <Button type="submit" variant="ghost" className="w-full">
                Continue locally
              </Button>
            </form>
          ) : null}
        </div>
      </Card>
    </main>
  );
}
