import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { buatPembatasPercobaan } from "@/lib/auth/pembatasPercobaan";
import { buatPemeriksaSesi, sidikSandi } from "@/lib/auth/sesiPengguna";
import { authConfig } from "./auth.config";

// Sesi yang dibaca diperiksa terhadap data pengguna (lihat lib/auth/sesiPengguna.ts): akun yang dihapus
// atau password-nya diatur ulang tidak lagi punya sesi, paling lambat satu menit per isolate.
const pemeriksaSesi = buatPemeriksaSesi({ muatSemuaPengguna: () => db.user.findMany() });

/** Dipanggil setelah password diubah atau akun dihapus agar isolate ini langsung memeriksa ulang. */
export const lupakanSesiPengguna = pemeriksaSesi.lupakan;

// Batas percobaan login gagal per isolate: per NIP dan alamat IP, dan per alamat IP untuk percobaan
// yang menebak banyak NIP. Perlindungan utama tetap aturan rate limiting Cloudflare pada
// POST /api/auth/callback/credentials.
const JENDELA_LOGIN_MS = 15 * 60 * 1000;
const pembatasNipIp = buatPembatasPercobaan({ batas: 5, jendelaMs: JENDELA_LOGIN_MS });
// Batas per IP dibuat longgar karena seluruh pegawai satu kantor bisa keluar lewat satu alamat IP.
const pembatasIp = buatPembatasPercobaan({ batas: 100, jendelaMs: JENDELA_LOGIN_MS });

/** Kode ini dibaca halaman login agar pengguna tahu penolakannya sementara, bukan password salah. */
class LoginTerkunciSementara extends CredentialsSignin {
  code = "terlalu_banyak_percobaan";
}

function alamatIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "tanpa-ip"
  );
}

// Instance NextAuth LENGKAP (server/API): authConfig edge-safe + provider
// Credentials yang butuh Prisma + bcryptjs. Middleware memakai authConfig saja.
export const { handlers, auth } = NextAuth({
  ...authConfig,

  callbacks: {
    ...authConfig.callbacks,

    async jwt(params) {
      const token = await authConfig.callbacks.jwt(params);
      if (params.user) {
        const sidik = (params.user as { sidikSandi?: unknown }).sidikSandi;
        if (typeof sidik === "string") token.sidikSandi = sidik;
        return token;
      }
      // null mengakhiri sesi: auth() mengembalikan null, rute API menjawab 401, halaman ke /login.
      const berlaku = await pemeriksaSesi.sesiBerlaku({ id: token.id, sidikSandi: token.sidikSandi });
      return berlaku ? token : null;
    },
  },

  providers: [
    Credentials({
      credentials: {
        nip: { label: "NIP", type: "text" },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials, request) {
        const nip = typeof credentials?.nip === "string" ? credentials.nip.trim() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!nip || !password) return null;

        const ip = alamatIp(request);
        const kunciNipIp = `${nip}|${ip}`;
        if (pembatasNipIp.terkunci(kunciNipIp) || pembatasIp.terkunci(ip)) {
          console.warn(`[login] percobaan untuk NIP ${nip} dari ${ip} ditolak sementara karena terlalu banyak kegagalan`);
          throw new LoginTerkunciSementara();
        }

        const user = await db.user.findUnique({ nip });
        const passwordMatch = !!user && (await bcrypt.compare(password, user.password));

        if (!user || !passwordMatch) {
          pembatasNipIp.catatGagal(kunciNipIp);
          pembatasIp.catatGagal(ip);
          console.warn(`[login] gagal masuk untuk NIP ${nip} dari ${ip}`);
          return null;
        }
        pembatasNipIp.hapus(kunciNipIp);
        // Daftar pengguna di isolate ini dimuat ulang agar akun atau password yang baru saja dibuat
        // tidak dianggap usang oleh pemeriksaan sesi.
        pemeriksaSesi.lupakan();

        const hasil = {
          id: user.id,
          nip: user.nip,
          nama: user.nama,
          role: user.role,
          // Disalin ke token oleh callback jwt untuk mendeteksi password yang diubah sesudah login.
          sidikSandi: await sidikSandi(user.password),
        };
        return hasil;
      },
    }),
  ],
});
