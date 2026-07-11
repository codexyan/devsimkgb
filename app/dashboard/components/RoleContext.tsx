"use client";

import { createContext, useContext } from "react";

export const RoleContext = createContext<string>("");

export function useRole(): string {
  return useContext(RoleContext);
}

/* Info user login untuk komponen dashboard (sapaan header, dsb.) */
export interface DashUser {
  nama: string;
  nip: string;
  role: string;
}

export const UserContext = createContext<DashUser>({ nama: "", nip: "", role: "" });

export function useDashUser(): DashUser {
  return useContext(UserContext);
}
