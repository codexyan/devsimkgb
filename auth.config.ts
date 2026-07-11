import type { NextAuthConfig } from "next-auth";

// Konfigurasi NextAuth yang EDGE-SAFE: tanpa provider Credentials (yang menarik
// Prisma + bcryptjs). Dipakai middleware untuk mendekode JWT sesi; instance
// lengkap (dengan Credentials) ada di auth.ts dan menyebarkan config ini agar
// bentuk token/sesi identik di kedua sisi.
export const authConfig = {
  providers: [],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.nip = user.nip;
        token.nama = user.nama;
        token.role = user.role;
      }
      return token;
    },

    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.nip = token.nip as string;
      session.user.nama = token.nama as string;
      session.user.role = token.role as string;
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },

  // Di luar Vercel (mis. Cloudflare Workers) trustHost tidak otomatis aktif;
  // tanpa ini NextAuth menolak Host header deployment. Aman karena app ini
  // hanya dilayani lewat host yang dikonfigurasi di platform deploy.
  trustHost: true,

  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
    updateAge: 60 * 60,
  },
} satisfies NextAuthConfig;
