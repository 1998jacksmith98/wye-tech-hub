import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { ORG_NAME, ORG_SLUG } from "@/lib/constants";

async function ensureOrgMembership(userId: string, email?: string | null) {
  const org = await prisma.organization.upsert({
    where: { slug: ORG_SLUG },
    update: {},
    create: { name: ORG_NAME, slug: ORG_SLUG },
  });

  const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAINS || "webbyates.com")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

  const allowlisted = (process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const normalized = (email || "").toLowerCase();
  const domain = normalized.split("@")[1] || "";
  const allowed =
    process.env.AUTH_DEV_MODE === "true" ||
    allowlisted.includes(normalized) ||
    allowedDomains.includes(domain);

  if (!allowed) {
    throw new Error("Your account is not allowed to join this Tech Hub yet.");
  }

  await prisma.membership.upsert({
    where: {
      organizationId_userId: { organizationId: org.id, userId },
    },
    update: {},
    create: {
      organizationId: org.id,
      userId,
      role: "member",
    },
  });

  return org;
}

const providers: Provider[] = [];

if (
  process.env.AUTH_MICROSOFT_ENTRA_ID_ID &&
  process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET
) {
  providers.push(
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: `https://login.microsoftonline.com/${process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER || "common"}/v2.0`,
      authorization: {
        params: {
          scope: [
            "openid",
            "profile",
            "email",
            "offline_access",
            "User.Read",
            "Files.ReadWrite.All",
            "Sites.ReadWrite.All",
          ].join(" "),
        },
      },
    }),
  );
}

if (process.env.AUTH_DEV_MODE === "true") {
  providers.push(
    Credentials({
      id: "dev-login",
      name: "Dev login",
      credentials: {
        name: { label: "Name", type: "text" },
        email: { label: "Email", type: "email" },
      },
      async authorize(credentials) {
        const name = String(credentials?.name || "Dev User").trim();
        const email = String(credentials?.email || "dev@webbyates.com")
          .trim()
          .toLowerCase();
        if (!email) return null;

        const user = await prisma.user.upsert({
          where: { email },
          update: { name },
          create: { email, name },
        });

        await ensureOrgMembership(user.id, email);
        return user;
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: process.env.AUTH_DEV_MODE === "true" ? "jwt" : "database",
  },
  providers,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (!user?.id && account?.provider !== "credentials") return true;
      if (!user?.id) return false;
      try {
        await ensureOrgMembership(user.id, user.email);
      } catch {
        return false;
      }

      if (account?.provider === "microsoft-entra-id" && account.access_token) {
        await prisma.account.updateMany({
          where: {
            provider: account.provider,
            providerAccountId: account.providerAccountId,
          },
          data: {
            access_token: account.access_token,
            refresh_token: account.refresh_token,
            expires_at: account.expires_at,
            scope: account.scope,
            token_type: account.token_type,
            id_token: account.id_token,
          },
        });
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    async session({ session, user, token }) {
      const userId = user?.id || token.sub;
      if (session.user && userId) {
        session.user.id = userId;
        const membership = await prisma.membership.findFirst({
          where: { userId },
          include: { organization: true },
        });
        if (membership) {
          session.user.organizationId = membership.organizationId;
          session.user.organizationName = membership.organization.name;
          session.user.role = membership.role;
        }
      }
      return session;
    },
  },
  trustHost: true,
});
