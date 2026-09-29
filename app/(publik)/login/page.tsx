"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

const SELEKTOR_FOKUS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function LoginPage() {
  const router = useRouter();
  const [nip, setNip] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [nipLupa, setNipLupa] = useState("");
  const [waAdmin, setWaAdmin] = useState("");
  const [kontakSelesai, setKontakSelesai] = useState(false);

  const triggerLupaRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const nipLupaRef = useRef<HTMLInputElement>(null);
  const tekanDiLatarRef = useRef(false);

  // Nomor WA admin diambil dari Pengaturan lewat endpoint publik; kegagalan diabaikan.
  // Peringatan "belum diatur" baru tampil setelah permintaan selesai.
  useEffect(() => {
    let batal = false;
    fetch("/api/public/kontak")
      .then((r) => (r.ok ? (r.json() as Promise<{ waAdmin?: unknown }>) : null))
      .then((d) => {
        const nomor = typeof d?.waAdmin === "string" ? d.waAdmin.replace(/\D/g, "") : "";
        if (!batal && nomor) setWaAdmin(nomor);
      })
      .catch(() => {})
      .finally(() => {
        if (!batal) setKontakSelesai(true);
      });
    return () => {
      batal = true;
    };
  }, []);

  const tutupLupa = useCallback(() => {
    setShowForgot(false);
    setNipLupa("");
    triggerLupaRef.current?.focus();
  }, []);

  // Selama dialog terbuka: halaman di belakang tidak dapat digulir, fokus ke isian NIP, Escape
  // menutup, Tab tetap di dalam dialog.
  useEffect(() => {
    if (!showForgot) return;
    const html = document.documentElement;
    const overflowSebelumnya = html.style.overflow;
    html.style.overflow = "hidden";
    nipLupaRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        tutupLupa();
        return;
      }
      if (e.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const daftar = Array.from(dialog.querySelectorAll<HTMLElement>(SELEKTOR_FOKUS));
      if (daftar.length === 0) return;
      const pertama = daftar[0];
      const terakhir = daftar[daftar.length - 1];
      const aktif = document.activeElement;
      if (!aktif || !dialog.contains(aktif)) {
        e.preventDefault();
        pertama.focus();
      } else if (e.shiftKey && aktif === pertama) {
        e.preventDefault();
        terakhir.focus();
      } else if (!e.shiftKey && aktif === terakhir) {
        e.preventDefault();
        pertama.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      html.style.overflow = overflowSebelumnya;
    };
  }, [showForgot, tutupLupa]);

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (!nip || !password) {
      setError("NIP dan password wajib diisi");
      return;
    }
    setLoading(true);
    try {
      const result = await signIn("credentials", { nip, password, redirect: false });
      if (result?.code === "terlalu_banyak_percobaan") {
        setError("Terlalu banyak percobaan masuk yang gagal. Coba lagi dalam 15 menit.");
        return;
      }
      if (result?.error) {
        setError("NIP atau password salah. Periksa kembali dan coba lagi.");
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("Gagal menghubungi server. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  // Tutup hanya bila tekan dan lepas mouse sama-sama di latar, bukan saat
  // menyeret seleksi teks dari dalam dialog.
  function onLatarMouseDown(e: MouseEvent<HTMLDivElement>) {
    tekanDiLatarRef.current = e.target === e.currentTarget;
  }

  function onLatarClick(e: MouseEvent<HTMLDivElement>) {
    if (tekanDiLatarRef.current && e.target === e.currentTarget) tutupLupa();
    tekanDiLatarRef.current = false;
  }

  const nipLupaBersih = nipLupa.trim();
  const bisaKirim = Boolean(nipLupaBersih && waAdmin);
  const hrefWa = bisaKirim
    ? `https://wa.me/${waAdmin}?text=${encodeURIComponent(
        ["Assalamualaikum Admin SIM-KGB,", "Saya lupa password.", `NIP: ${nipLupaBersih}`, "Mohon bantuannya."].join("\n"),
      )}`
    : "";

  const keteranganSandi = [capsLock ? "login-caps" : "", error ? "login-galat" : ""].filter(Boolean).join(" ") || undefined;

  return (
    <div className="lg-halaman">
      <div className="lg-kolom">
        <h1 className="pub-h1 lg-judul">Masuk ke SIM-KGB</h1>
        <p className="pub-lead lg-lead">
          Khusus Tim SDM, keuangan, dan pengelola kepegawaian Kanwil Ditjenpas Kalimantan Selatan.
        </p>
        <p className="lg-publik">
          Pegawai yang ingin melihat status KGB tidak perlu masuk. <Link href="/kgb">Cek status KGB</Link>
        </p>

        <div className="pub-panel">
          <form onSubmit={handleLogin} className="lg-form">
            <div className="pub-field">
              <label htmlFor="login-nip" className="pub-label">
                NIP
              </label>
              <input
                id="login-nip"
                name="nip"
                type="text"
                inputMode="numeric"
                autoComplete="username"
                maxLength={18}
                className="pub-input"
                value={nip}
                onChange={(e) => setNip(e.target.value)}
                aria-describedby={error ? "login-galat" : undefined}
              />
            </div>

            <div className="pub-field">
              <div className="lg-label-baris">
                <label htmlFor="login-password" className="pub-label">
                  Password
                </label>
                <button
                  ref={triggerLupaRef}
                  type="button"
                  className="pub-btn-text lg-lupa"
                  aria-haspopup="dialog"
                  onClick={() => setShowForgot(true)}
                >
                  Lupa password?
                </button>
              </div>
              <div className="lg-sandi">
                <input
                  id="login-password"
                  name="password"
                  type={showPwd ? "text" : "password"}
                  autoComplete="current-password"
                  className="pub-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => setCapsLock(e.getModifierState("CapsLock"))}
                  onKeyUp={(e) => setCapsLock(e.getModifierState("CapsLock"))}
                  onBlur={() => setCapsLock(false)}
                  aria-describedby={keteranganSandi}
                />
                <button
                  type="button"
                  className="pub-btn-secondary lg-toggle"
                  aria-pressed={showPwd}
                  aria-controls="login-password"
                  onClick={() => setShowPwd((v) => !v)}
                >
                  {showPwd ? "Sembunyikan" : "Tampilkan"}
                  <span className="pub-visually-hidden"> password</span>
                </button>
              </div>
              {capsLock && (
                <p id="login-caps" className="pub-hint lg-caps">
                  Caps Lock sedang aktif.
                </p>
              )}
            </div>

            <div role="alert">
              {error && (
                <p id="login-galat" className="pub-note-bad lg-galat">
                  {error}
                </p>
              )}
            </div>

            <button type="submit" className="pub-btn pub-btn-block lg-kirim" disabled={loading} aria-busy={loading}>
              {loading && <span className="lg-putar" aria-hidden="true" />}
              {loading ? "Memproses" : "Masuk"}
            </button>
          </form>
        </div>
      </div>

      {showForgot && (
        <div className="pub-dialog-backdrop" onMouseDown={onLatarMouseDown} onClick={onLatarClick}>
          <div
            ref={dialogRef}
            className="pub-dialog lg-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lupa-judul"
            aria-describedby="lupa-keterangan"
          >
            <h2 id="lupa-judul" className="lg-dialog-judul">
              Lupa password
            </h2>
            <p id="lupa-keterangan">
              Tulis NIP Anda, lalu kirim permintaan reset password ke admin lewat WhatsApp.
            </p>

            <div className="pub-field">
              <label htmlFor="lupa-nip" className="pub-label">
                NIP
              </label>
              <input
                ref={nipLupaRef}
                id="lupa-nip"
                name="nip-lupa"
                type="text"
                inputMode="numeric"
                maxLength={18}
                className="pub-input"
                value={nipLupa}
                onChange={(e) => setNipLupa(e.target.value)}
              />
            </div>

            {kontakSelesai && !waAdmin && (
              <p className="pub-note-warn">Nomor kontak admin belum diatur. Hubungi Super Admin secara langsung.</p>
            )}

            <div className="lg-dialog-aksi">
              {bisaKirim ? (
                <a className="pub-btn pub-btn-block" href={hrefWa} target="_blank" rel="noopener noreferrer">
                  Kirim lewat WhatsApp
                  <span className="pub-visually-hidden"> (membuka tab baru)</span>
                </a>
              ) : (
                <button type="button" className="pub-btn pub-btn-block" disabled>
                  Kirim lewat WhatsApp
                </button>
              )}
              <button type="button" className="pub-btn-secondary pub-btn-block" onClick={tutupLupa}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
