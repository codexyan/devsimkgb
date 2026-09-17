"use client";
// v2 : no useSession dependency
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";

interface UserProfile {
  id: string;
  nip: string;
  nama: string;
  jabatan: string | null;
  email: string | null;
  role: string;
  createdAt: string;
}

interface ChangeRequest {
  id: string;
  nama: string | null;
  jabatan: string | null;
  email: string | null;
  status: string;
  alasanTolak: string | null;
  createdAt: string;
}

const ROLE_LABEL: Record<string, string> = {
  superAdminCore: "Super Admin",
  SDM: "Operator SDM",
};

const STATUS_CFG: Record<string, { label: string; bg: string; border: string; color: string }> = {
  pending:  { label: "Menunggu Persetujuan", bg: "var(--tint-amber-bg)", border: "var(--tint-amber-ln)", color: "var(--st-amber2)" },
  approved: { label: "Disetujui",            bg: "var(--tint-green-bg)", border: "var(--tint-green-ln)", color: "var(--st-green)" },
  rejected: { label: "Ditolak",              bg: "var(--tint-red-bg)", border: "var(--tint-red-ln)", color: "var(--st-red)" },
};

function EyeIcon({ open }: { open: boolean }) {
  return open
    ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
    : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>;
}

function Field({
  label, value, onChange, type = "text", placeholder, readOnly, hint,
}: {
  label: string; value: string; onChange?: (v: string) => void;
  type?: string; placeholder?: string; readOnly?: boolean; hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold" style={{ color: "var(--dt3)" }}>{label}</label>
      <input
        type={type} value={value} readOnly={readOnly} placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none transition"
        style={{
          border: readOnly ? "0.5px solid var(--ln1)" : "0.5px solid var(--dt6)",
          background: readOnly ? "var(--sub)" : "var(--card)",
          color: readOnly ? "var(--dt4)" : "var(--dtn)",
        }}
        onFocus={(e) => { if (!readOnly) e.currentTarget.style.borderColor = "var(--dtn)"; }}
        onBlur={(e) => { if (!readOnly) e.currentTarget.style.borderColor = "var(--dt6)"; }}
      />
      {hint && <p className="text-xs" style={{ color: "var(--dt5)" }}>{hint}</p>}
    </div>
  );
}

function Alert({ type, message, onClose }: { type: "success" | "error"; message: string; onClose: () => void }) {
  const c = type === "success"
    ? { bg: "var(--tint-green-bg)", border: "var(--tint-green-ln)", color: "var(--st-green)" }
    : { bg: "var(--tint-red-bg)", border: "var(--tint-red-ln)", color: "var(--st-red)" };
  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl mb-4" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
      <p className="text-xs flex-1" style={{ color: c.color }}>{message}</p>
      <button onClick={onClose} style={{ color: c.color, opacity: 0.5 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
      </button>
    </div>
  );
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [request, setRequest] = useState<ChangeRequest | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state (pre-filled dengan nilai saat ini)
  const [nama, setNama] = useState("");
  const [jabatan, setJabatan] = useState("");
  const [email, setEmail] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [alertForm, setAlertForm] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Password
  const [passwordLama, setPasswordLama] = useState("");
  const [passwordBaru, setPasswordBaru] = useState("");
  const [konfirmasi, setKonfirmasi] = useState("");
  const [showLama, setShowLama] = useState(false);
  const [showBaru, setShowBaru] = useState(false);
  const [showKonfirmasi, setShowKonfirmasi] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [alertPw, setAlertPw] = useState<{ type: "success" | "error"; message: string } | null>(null);

  async function load() {
    const [pRes, rRes] = await Promise.all([fetch("/api/profile"), fetch("/api/profile/request")]);
    const p = await pRes.json() as any;
    const r = await rRes.json() as any;
    setProfile(p);
    setNama(p.nama ?? "");
    setJabatan(p.jabatan ?? "");
    setEmail(p.email ?? "");
    setRequest(r);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSubmitRequest(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setAlertForm(null);
    try {
      const res = await fetch("/api/profile/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama, jabatan, email }),
      });
      const data = await res.json() as any;
      if (!res.ok) {
        setAlertForm({ type: "error", message: data.error ?? "Gagal mengajukan permintaan" });
      } else {
        setAlertForm({ type: "success", message: "Permintaan perubahan berhasil diajukan. Menunggu persetujuan admin." });
        await load();
      }
    } catch {
      setAlertForm({ type: "error", message: "Terjadi kesalahan. Coba lagi." });
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setSavingPw(true);
    setAlertPw(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passwordLama, passwordBaru, konfirmasiPassword: konfirmasi }),
      });
      const data = await res.json() as any;
      if (!res.ok) {
        setAlertPw({ type: "error", message: data.error ?? "Gagal mengganti password" });
      } else {
        // Sesi dengan password lama berakhir di server, jadi pengguna diarahkan masuk kembali.
        setAlertPw({ type: "success", message: "Password berhasil diperbarui. Silakan masuk kembali." });
        setPasswordLama(""); setPasswordBaru(""); setKonfirmasi("");
        setTimeout(() => signOut({ callbackUrl: "/login" }), 2000);
      }
    } catch {
      setAlertPw({ type: "error", message: "Terjadi kesalahan. Coba lagi." });
    } finally {
      setSavingPw(false);
    }
  }

  const initials = (profile?.nama ?? nama).split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() || "U";

  const hasPending = request?.status === "pending";

  const passwordStrength = (() => {
    if (!passwordBaru) return null;
    if (passwordBaru.length < 6) return { label: "Terlalu pendek", color: "var(--st-red)", pct: 20 };
    if (passwordBaru.length < 8) return { label: "Lemah", color: "var(--st-amber)", pct: 45 };
    const s = [/[A-Z]/.test(passwordBaru), /[0-9]/.test(passwordBaru), /[^A-Za-z0-9]/.test(passwordBaru)].filter(Boolean).length;
    return s === 0 ? { label: "Sedang", color: "var(--st-amber)", pct: 60 }
      : s === 1 ? { label: "Kuat", color: "var(--st-green)", pct: 80 }
      : { label: "Sangat Kuat", color: "var(--st-green)", pct: 100 };
  })();

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <p className="text-xs" style={{ color: "var(--dt4)" }}>Memuat profil...</p>
    </div>
  );

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-base font-semibold" style={{ color: "var(--dtn)" }}>Profil Saya</h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--dt4)" }}>Perubahan profil memerlukan persetujuan admin</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* -- Kartu identitas -- */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 flex flex-col items-center gap-4" style={{ border: "0.5px solid var(--ln1)", alignSelf: "start" }}>
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold" style={{ background: "var(--navy-solid)", color: "#c9a227" }}>
            {initials}
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold" style={{ color: "var(--dtn)" }}>{profile?.nama}</p>
            {profile?.jabatan && <p className="text-xs mt-0.5" style={{ color: "var(--dt3)" }}>{profile.jabatan}</p>}
            <span className="inline-block mt-2 text-xs px-2.5 py-1 rounded-full font-semibold" style={{
              background: profile?.role === "superAdminCore" ? "var(--tint-amber-bg)" : "var(--tint-navy)",
              color: profile?.role === "superAdminCore" ? "#92650a" : "var(--dtn)",
              border: `1px solid ${profile?.role === "superAdminCore" ? "var(--tint-amber-ln)" : "var(--ln0)"}`,
            }}>
              {ROLE_LABEL[profile?.role ?? ""] ?? profile?.role}
            </span>
          </div>

          <div className="w-full space-y-2.5 pt-2" style={{ borderTop: "0.5px solid var(--ln2)" }}>
            {[
              { icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#5a7a9a" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>, label: "NIP", value: profile?.nip },
              profile?.email ? { icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#5a7a9a" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>, label: "Email", value: profile.email } : null,
              { icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#5a7a9a" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>, label: "Bergabung", value: profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-" },
            ].filter(Boolean).map((item) => (
              <div key={item!.label} className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--tint-navy)" }}>{item!.icon}</div>
                <div>
                  <p className="text-xs font-medium" style={{ color: "var(--dtn)" }}>{item!.label}</p>
                  <p className="text-xs" style={{ color: "var(--dt4)" }}>{item!.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* -- Form kanan -- */}
        <div className="lg:col-span-3 space-y-4">

          {/* Status permintaan terakhir */}
          {request && (() => {
            const cfg = STATUS_CFG[request.status] ?? STATUS_CFG.pending;
            return (
              <div className="rounded-2xl px-4 py-3.5 space-y-1" style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold" style={{ color: cfg.color }}>Permintaan Perubahan Profil</p>
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: cfg.border, color: cfg.color }}>{cfg.label}</span>
                </div>
                <div className="text-xs space-y-0.5" style={{ color: cfg.color }}>
                  {request.nama && <p>Nama: <strong>{request.nama}</strong></p>}
                  {request.jabatan !== null && <p>Jabatan: <strong>{request.jabatan || "-"}</strong></p>}
                  {request.email !== null && <p>Email: <strong>{request.email || "-"}</strong></p>}
                  {request.alasanTolak && <p className="mt-1">Alasan ditolak: <strong>{request.alasanTolak}</strong></p>}
                </div>
                <p className="text-xs" style={{ color: cfg.color, opacity: 0.65 }}>
                  Diajukan {new Date(request.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
            );
          })()}

          {/* Form ajukan perubahan profil */}
          <div className="bg-white rounded-2xl p-5" style={{ border: "0.5px solid var(--ln1)" }}>
            <div className="mb-4">
              <p className="text-sm font-semibold" style={{ color: "var(--dtn)" }}>Ajukan Perubahan Profil</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--dt4)" }}>
                {hasPending ? "Permintaan sedang diproses admin, tidak dapat mengajukan perubahan baru" : "Perubahan akan diteruskan ke admin untuk disetujui"}
              </p>
            </div>

            {alertForm && <Alert type={alertForm.type} message={alertForm.message} onClose={() => setAlertForm(null)} />}

            <form onSubmit={handleSubmitRequest} className="space-y-4">
              <Field label="NIP" value={profile?.nip ?? ""} readOnly hint="NIP tidak dapat diubah" />
              <Field label="Nama Lengkap" value={nama} onChange={hasPending ? undefined : setNama} readOnly={hasPending} placeholder="Masukkan nama lengkap" />
              <Field label="Jabatan" value={jabatan} onChange={hasPending ? undefined : setJabatan} readOnly={hasPending} placeholder="Contoh: Analis SDM" />
              <Field label="Email" type="email" value={email} onChange={hasPending ? undefined : setEmail} readOnly={hasPending} placeholder="Contoh: nama@kemenkumham.go.id" />

              {!hasPending && (
                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="text-xs px-5 py-2.5 rounded-xl font-semibold transition disabled:opacity-50"
                    style={{ background: "var(--navy-solid)", color: "#fff" }}
                  >
                    {submitting ? "Mengajukan..." : "Ajukan Perubahan"}
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Ganti Password : langsung tanpa approval */}
          <div className="bg-white rounded-2xl p-5" style={{ border: "0.5px solid var(--ln1)" }}>
            <div className="mb-4">
              <p className="text-sm font-semibold" style={{ color: "var(--dtn)" }}>Keamanan Akun</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--dt4)" }}>Ganti password login, berlaku langsung</p>
            </div>

            {alertPw && <Alert type={alertPw.type} message={alertPw.message} onClose={() => setAlertPw(null)} />}

            <form onSubmit={handlePassword} className="space-y-4">
              {[
                { label: "Password Lama", val: passwordLama, set: setPasswordLama, show: showLama, toggle: () => setShowLama(!showLama) },
                { label: "Password Baru", val: passwordBaru, set: setPasswordBaru, show: showBaru, toggle: () => setShowBaru(!showBaru) },
                { label: "Konfirmasi Password Baru", val: konfirmasi, set: setKonfirmasi, show: showKonfirmasi, toggle: () => setShowKonfirmasi(!showKonfirmasi) },
              ].map(({ label, val, set, show, toggle }, idx) => (
                <div key={idx} className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold" style={{ color: "var(--dt3)" }}>{label}</label>
                  <div className="relative">
                    <input
                      type={show ? "text" : "password"} value={val}
                      onChange={(e) => set(e.target.value)}
                      placeholder={idx === 0 ? "Password saat ini" : idx === 1 ? "Minimal 6 karakter" : "Ulangi password baru"}
                      className="w-full rounded-xl px-3.5 py-2.5 pr-10 text-sm outline-none transition"
                      style={{
                        border: `0.5px solid ${idx === 2 && konfirmasi && passwordBaru && konfirmasi !== passwordBaru ? "var(--tint-red-ln)" : "var(--dt6)"}`,
                        color: "var(--dtn)",
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = "var(--dtn)"}
                      onBlur={(e) => e.currentTarget.style.borderColor = idx === 2 && konfirmasi && passwordBaru && konfirmasi !== passwordBaru ? "var(--tint-red-ln)" : "var(--dt6)"}
                    />
                    <button type="button" onClick={toggle} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--dt5)" }}>
                      <EyeIcon open={show} />
                    </button>
                  </div>
                  {idx === 1 && passwordStrength && (
                    <div className="space-y-1">
                      <div style={{ height: "3px", borderRadius: "99px", background: "var(--ln2)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${passwordStrength.pct}%`, background: passwordStrength.color, transition: "all 0.3s" }} />
                      </div>
                      <p className="text-xs" style={{ color: passwordStrength.color }}>{passwordStrength.label}</p>
                    </div>
                  )}
                  {idx === 2 && konfirmasi && passwordBaru && (
                    <p className="text-xs" style={{ color: konfirmasi === passwordBaru ? "var(--st-green)" : "var(--st-red)" }}>
                      {konfirmasi === passwordBaru ? "Password cocok" : "Password tidak cocok"}
                    </p>
                  )}
                </div>
              ))}

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={savingPw || !passwordLama || !passwordBaru || !konfirmasi || passwordBaru !== konfirmasi}
                  className="text-xs px-5 py-2.5 rounded-xl font-semibold transition disabled:opacity-40"
                  style={{ background: "var(--red-solid)", color: "#fff" }}
                >
                  {savingPw ? "Menyimpan..." : "Ganti Password"}
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}
