import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "./auth.config";

// Instance NextAuth LENGKAP (server/API): authConfig edge-safe + provider
// Credentials yang butuh Prisma + bcryptjs. Middleware memakai authConfig saja.
export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,

  providers: [
    Credentials({
      credentials: {
        nip: { label: "NIP", type: "text" },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {
        if (!credentials?.nip || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { nip: credentials.nip as string },
        });

        if (!user) return null;

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.password,
        );

        if (!passwordMatch) return null;

        return {
          id: user.id,
          nip: user.nip,
          nama: user.nama,
          role: user.role,
        };
      },
    }),
  ],
});
