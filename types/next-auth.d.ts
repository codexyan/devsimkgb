import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    id?: string;
    nip?: string;
    nama?: string;
    role?: string;
  }

  interface Session {
    user: {
      id?: string;
      nip?: string;
      nama?: string;
      role?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    nip?: string;
    nama?: string;
    role?: string;
  }
}
