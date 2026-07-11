"use client";

import { useState, useId } from "react";
import { useRole } from "@/app/dashboard/components/RoleContext";
import { ROLES } from "@/lib/auth";

/* ---- Tipe ---- */
interface Section {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  content: React.ReactNode;
}

interface KasusData {
  num: string;
  title: string;
  badge: string;
  accent: string;
  accentBg: string;
  deskripsi: string;
  awal: { label: string; val: string; hl?: boolean; indent?: boolean }[];
  akhir: { label: string; val: string; hl?: boolean; indent?: boolean }[];
  catatan?: string;
  flow: FCNode[];
}

/* ---- Helper komponen ---- */
/* Peta tone per warna seksi → nilai KONKRET untuk gradien/bayangan/tint.
   Warna seksi berupa var(--…) tidak bisa ditempeli alpha-hex (mis. `${c}ee`
   menghasilkan CSS invalid), jadi turunannya didefinisikan eksplisit di sini. */
const TONE: Record<string, { grad: string; shadow: string; soft: string }> = {
  "var(--dtn)":       { grad: "linear-gradient(135deg,#2d5d94,var(--navy-solid))",   shadow: "rgba(26,58,92,0.32)",   soft: "var(--tint-navy)" },
  "var(--st-green)":  { grad: "linear-gradient(135deg,#17a37e,var(--green-solid))",  shadow: "rgba(15,110,86,0.32)",  soft: "var(--tint-green-bg)" },
  "var(--st-amber)":  { grad: "linear-gradient(135deg,#d99414,var(--amber-solid))",  shadow: "rgba(184,124,10,0.32)", soft: "var(--tint-amber-bg)" },
  "var(--st-red)":    { grad: "linear-gradient(135deg,#e35d5d,var(--red-solid))",    shadow: "rgba(220,38,38,0.32)",  soft: "var(--tint-red-bg)" },
  "var(--st-violet)": { grad: "linear-gradient(135deg,#9b7ae0,var(--violet-solid))", shadow: "rgba(109,40,217,0.32)", soft: "var(--tint-violet-bg)" },
  "var(--st-blue)":   { grad: "linear-gradient(135deg,#60a5fa,var(--blue-solid))",   shadow: "rgba(30,64,175,0.32)",  soft: "var(--tint-blue-bg)" },
  "#c9a227":          { grad: "linear-gradient(135deg,#e0bd54,#b8931f)",             shadow: "rgba(201,162,39,0.35)", soft: "rgba(201,162,39,0.12)" },
};
const tone = (c: string) =>
  TONE[c] ?? { grad: `linear-gradient(135deg,${c},${c})`, shadow: "rgba(9,20,40,0.25)", soft: "var(--sub)" };

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
        style={{ background: "linear-gradient(135deg,var(--navy-solid),#2d5a8e)", color: "#fff" }}
      >
        {n}
      </div>
      <p className="text-xs leading-relaxed pt-0.5" style={{ color: "var(--dt2)" }}>{children}</p>
    </div>
  );
}

function Pill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: bg, color }}>
      {label}
    </span>
  );
}

function InfoCard({ icon, title, children, accent = "var(--dtn)" }: { icon: React.ReactNode; title: string; children: React.ReactNode; accent?: string }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--ln1)", boxShadow: "0 2px 12px rgba(26,58,92,0.06)" }}>
      <div className="flex items-center gap-2.5 px-4 py-3" style={{ background: accent, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <span style={{ color: "rgba(255,255,255,0.85)" }}>{icon}</span>
        <p className="text-xs font-semibold" style={{ color: "#fff" }}>{title}</p>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function DataRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid var(--ln2)" }}>
      <span className="text-xs" style={{ color: "var(--dt4)" }}>{label}</span>
      <span className="text-xs font-semibold" style={{ color: highlight ? "#c9a227" : "var(--dtn)" }}>{value}</span>
    </div>
  );
}

type FCNodeType = "start" | "end" | "process" | "decision" | "warning" | "success";

interface FCNode {
  label: string;
  sub?: string;
  type: FCNodeType;
  edgeLabel?: string;
}

const FC_STYLE: Record<FCNodeType, { fill: string; stroke: string; text: string; sub: string }> = {
  start:    { fill: "#dcfce7", stroke: "#22c55e", text: "var(--st-green)",  sub: "#16a34a" },
  end:      { fill: "var(--navy-solid)", stroke: "#1e4570", text: "#fff",     sub: "rgba(255,255,255,0.65)" },
  process:  { fill: "var(--tint-blue-bg)", stroke: "#93c5fd", text: "var(--st-blue)",  sub: "#60a5fa" },
  decision: { fill: "var(--tint-amber-bg2)", stroke: "#fbbf24", text: "#78350f",  sub: "var(--st-amber)" },
  warning:  { fill: "var(--tint-red-bg2)", stroke: "var(--tint-red-ln)", text: "var(--st-red)",  sub: "var(--st-red)" },
  success:  { fill: "var(--tint-green-bg2)", stroke: "var(--tint-green-ln)", text: "var(--st-green)",  sub: "#059669" },
};

/* ---- Flowchart Vertikal (mobile) ---- */
const NODE_H: Record<FCNodeType, number> = {
  start: 42, end: 42, process: 58, decision: 72, warning: 58, success: 58,
};
const SVG_W = 320;
const CX = SVG_W / 2;
const RECT_W = 246;
const PILL_W = 180;
const DIAMOND_HW = 130;
const GAP = 26;

function FlowchartVertical({ nodes }: { nodes: FCNode[] }) {
  const uid = useId();
  const tops: number[] = [];
  let cursor = 10;
  for (const n of nodes) {
    tops.push(cursor);
    cursor += NODE_H[n.type] + GAP;
  }
  const svgH = cursor - GAP + 10;
  const cy = (i: number) => tops[i] + NODE_H[nodes[i].type] / 2;
  const bottom = (i: number) => tops[i] + NODE_H[nodes[i].type];

  return (
    <svg viewBox={`0 0 ${SVG_W} ${svgH}`} width="100%" style={{ maxWidth: SVG_W, display: "block" }}>
      <defs>
        <marker id={`arrV${uid}`} markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#94a3b8" />
        </marker>
      </defs>
      {nodes.map((n, i) => {
        if (i === nodes.length - 1) return null;
        const y1 = bottom(i); const y2 = tops[i + 1]; const midY = (y1 + y2) / 2;
        return (
          <g key={`eV${i}`}>
            <line x1={CX} y1={y1} x2={CX} y2={y2 - 5} stroke="#94a3b8" strokeWidth="1.5" markerEnd={`url(#arrV${uid})`} />
            {n.edgeLabel && <text x={CX + 8} y={midY + 4} fontSize="9" fill="#64748b" fontFamily="system-ui, sans-serif" fontWeight="600">{n.edgeLabel}</text>}
          </g>
        );
      })}
      {nodes.map((n, i) => {
        const st = FC_STYLE[n.type];
        const t = tops[i]; const nh = NODE_H[n.type]; const centerY = cy(i);
        const labelY = n.sub ? centerY - 5 : centerY + 4;
        const subY = centerY + 10;
        if (n.type === "decision") {
          const pts = `${CX},${t} ${CX + DIAMOND_HW},${centerY} ${CX},${t + nh} ${CX - DIAMOND_HW},${centerY}`;
          return (
            <g key={i}>
              <polygon points={pts} fill={st.fill} stroke={st.stroke} strokeWidth="1.5" />
              <text x={CX} y={labelY} textAnchor="middle" fontSize="10.5" fontWeight="700" fill={st.text} fontFamily="system-ui, sans-serif">{n.label}</text>
              {n.sub && <text x={CX} y={subY} textAnchor="middle" fontSize="8.5" fill={st.sub} fontFamily="system-ui, sans-serif">{n.sub}</text>}
            </g>
          );
        }
        if (n.type === "start" || n.type === "end") {
          return (
            <g key={i}>
              <rect x={CX - PILL_W / 2} y={t} width={PILL_W} height={nh} rx={nh / 2} fill={st.fill} stroke={st.stroke} strokeWidth="1.5" />
              <text x={CX} y={labelY} textAnchor="middle" fontSize="10.5" fontWeight="700" fill={st.text} fontFamily="system-ui, sans-serif">{n.label}</text>
              {n.sub && <text x={CX} y={subY} textAnchor="middle" fontSize="8.5" fill={st.sub} fontFamily="system-ui, sans-serif">{n.sub}</text>}
            </g>
          );
        }
        return (
          <g key={i}>
            <rect x={CX - RECT_W / 2} y={t} width={RECT_W} height={nh} rx="10" fill={st.fill} stroke={st.stroke} strokeWidth="1.5" />
            <text x={CX} y={labelY} textAnchor="middle" fontSize="10.5" fontWeight="600" fill={st.text} fontFamily="system-ui, sans-serif">{n.label}</text>
            {n.sub && <text x={CX} y={subY} textAnchor="middle" fontSize="8.5" fill={st.sub} fontFamily="system-ui, sans-serif">{n.sub}</text>}
          </g>
        );
      })}
    </svg>
  );
}

/* ---- Flowchart Horizontal (desktop) : HTML/CSS untuk text-wrap proper ---- */
function FlowchartHorizontal({ nodes }: { nodes: FCNode[] }) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "12px 4px 16px", gap: 0, minWidth: "max-content" }}>
      {nodes.map((n, i) => {
        const st = FC_STYLE[n.type];
        const isLast = i === nodes.length - 1;
        const isPill = n.type === "start" || n.type === "end";
        const isDiamond = n.type === "decision";

        const nodeContent = (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "10px", fontWeight: 700, color: st.text, lineHeight: 1.35, wordBreak: "keep-all" }}>{n.label}</div>
            {n.sub && (
              <div style={{ fontSize: "8px", color: st.sub, marginTop: "3px", lineHeight: 1.35, wordBreak: "break-word" }}>{n.sub}</div>
            )}
          </div>
        );

        return (
          <div key={i} style={{ display: "flex", alignItems: "center" }}>
            {/* Node shape */}
            {isPill && (
              <div style={{
                background: st.fill,
                border: `1.5px solid ${st.stroke}`,
                borderRadius: "999px",
                padding: "8px 14px",
                width: "132px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxSizing: "border-box",
                minHeight: "48px",
              }}>
                {nodeContent}
              </div>
            )}
            {isDiamond && (
              <div style={{ position: "relative", width: "150px", height: "100px", flexShrink: 0 }}>
                {/* Border layer (slightly larger, behind fill) */}
                <div style={{
                  position: "absolute",
                  inset: "-1.5px",
                  background: st.stroke,
                  clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
                }} />
                {/* Fill layer */}
                <div style={{
                  position: "absolute",
                  inset: 0,
                  background: st.fill,
                  clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
                }} />
                {/* Text overlay : safe padding to keep inside diamond */}
                <div style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: "8px 28px",
                }}>
                  {nodeContent}
                </div>
              </div>
            )}
            {!isPill && !isDiamond && (
              <div style={{
                background: st.fill,
                border: `1.5px solid ${st.stroke}`,
                borderRadius: "10px",
                padding: "8px 10px",
                width: "148px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxSizing: "border-box",
                minHeight: "64px",
              }}>
                {nodeContent}
              </div>
            )}

            {/* Arrow connector */}
            {!isLast && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "36px", flexShrink: 0, gap: "2px" }}>
                {n.edgeLabel && (
                  <div style={{ fontSize: "8px", color: "var(--dt3)", fontWeight: 700, whiteSpace: "nowrap", marginBottom: "1px" }}>{n.edgeLabel}</div>
                )}
                <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
                  <div style={{ flex: 1, height: "1.5px", background: "var(--dt4)" }} />
                  <div style={{ width: 0, height: 0, borderTop: "4px solid transparent", borderBottom: "4px solid transparent", borderLeft: "7px solid var(--dt4)" }} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---- Responsive Flowchart (vertikal mobile, horizontal desktop) ---- */
function FlowchartResponsive({ nodes }: { nodes: FCNode[] }) {
  return (
    <>
      <div className="md:hidden">
        <FlowchartVertical nodes={nodes} />
      </div>
      <div className="hidden md:block overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: "touch" }}>
        <FlowchartHorizontal nodes={nodes} />
      </div>
    </>
  );
}

/* ---- StudiKasusCard ---- */
function StudiKasusCard({ num, title, badge, accent, accentBg, deskripsi, awal, akhir, catatan, flow }: KasusData) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.08)", border: "1px solid rgba(0,0,0,0.06)" }}>
      <div className="px-4 py-3 flex items-center gap-3" style={{ background: accentBg }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "rgba(255,255,255,0.18)", color: "#fff" }}>
          {num}
        </div>
        <p className="text-xs font-semibold flex-1" style={{ color: "#fff" }}>{title}</p>
        <span className="text-xs font-bold px-2 py-0.5 rounded-lg" style={{ background: "rgba(255,255,255,0.2)", color: "#fff" }}>{badge}</span>
      </div>

      <div className="p-4 space-y-4" style={{ background: "var(--card)" }}>
        <p className="text-xs leading-relaxed" style={{ color: "var(--dt3)" }}>{deskripsi}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Keadaan Awal */}
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--tint-green-ln)" }}>
            <div className="px-3 py-2 flex items-center gap-1.5" style={{ background: "var(--tint-green-bg)", borderBottom: "1px solid var(--tint-green-ln)" }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <p className="text-xs font-bold" style={{ color: "var(--st-green)" }}>Keadaan Awal</p>
            </div>
            <div>
              {awal.map((r, i) => (
                <div key={i} className="flex items-start justify-between gap-2 px-3 py-1.5" style={{ borderBottom: "1px solid var(--tint-green-bg)", background: r.indent ? "var(--sub)" : "var(--card)" }}>
                  <span className="text-xs shrink-0 leading-relaxed" style={{ color: r.indent ? "var(--dt5)" : "var(--dt4)", paddingLeft: r.indent ? "8px" : "0" }}>
                    {r.indent ? "↳ " : ""}{r.label}
                  </span>
                  <span className="text-xs font-semibold text-right leading-relaxed" style={{ color: r.hl ? accent : (r.indent ? "var(--dt4)" : "var(--dtn)") }}>
                    {r.val}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Keadaan Akhir */}
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--tint-blue-ln)" }}>
            <div className="px-3 py-2 flex items-center gap-1.5" style={{ background: "var(--tint-blue-bg)", borderBottom: "1px solid var(--tint-blue-ln)" }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              <p className="text-xs font-bold" style={{ color: "var(--st-blue)" }}>Keadaan Akhir</p>
            </div>
            <div>
              {akhir.map((r, i) => (
                <div key={i} className="flex items-start justify-between gap-2 px-3 py-1.5" style={{ borderBottom: "1px solid var(--tint-blue-bg)", background: r.indent ? "var(--sub)" : "var(--card)" }}>
                  <span className="text-xs shrink-0 leading-relaxed" style={{ color: r.indent ? "var(--dt5)" : "var(--dt4)", paddingLeft: r.indent ? "8px" : "0" }}>
                    {r.indent ? "↳ " : ""}{r.label}
                  </span>
                  <span className="text-xs font-semibold text-right leading-relaxed" style={{ color: r.hl ? accent : (r.indent ? "var(--dt4)" : "var(--dtn)") }}>
                    {r.val}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {catatan && (
          <div className="rounded-xl p-3" style={{ background: "var(--tint-amber-bg)", border: "1px solid var(--tint-amber-ln)" }}>
            <p className="text-xs leading-relaxed" style={{ color: "var(--st-amber2)" }}>
              <span className="font-semibold">Catatan: </span>{catatan}
            </p>
          </div>
        )}

        {/* Flowchart */}
        <div>
          <p className="text-xs font-semibold mb-3 flex items-center gap-1.5" style={{ color: "var(--dt4)" }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            ALUR TEKNIS DI SISTEM
          </p>
          <FlowchartResponsive nodes={flow} />
        </div>
      </div>
    </div>
  );
}

/* ---- Konstanta unit kerja ---- */
const UNIT = "Kantor Wilayah Direktorat Jenderal Pemasyarakatan Kalimantan Selatan";

/* ---- Data Studi Kasus ---- */
const allKasus: KasusData[] = [
  {
    num: "01",
    title: "KGB Normal: Tepat Waktu",
    badge: "NORMAL",
    accent: "var(--st-green)",
    accentBg: "linear-gradient(135deg,var(--st-green),var(--st-green))",
    deskripsi: "KGB berjalan normal. Admin memproses sebelum deadline SDM sehingga gaji naik tepat pada TMT berlaku tanpa rapelan.",
    awal: [
      { label: "Nama", val: "Siti Rahayu, S.Sos." },
      { label: "NIP", val: "198506152010012003" },
      { label: "Jabatan", val: "Analis Kebijakan Muda" },
      { label: "Unit Kerja", val: UNIT },
      { label: "Golongan/Ruang", val: "III/a (Penata Muda Tk.I)" },
      { label: "MKG Awal", val: "6 tahun 0 bulan", hl: true },
      { label: "Gaji Pokok Saat Ini", val: "±Rp 3.121.000/bln", hl: true },
      { label: "Gol III/a MKG 6 thn", val: "sesuai tabel PP gaji berlaku", indent: true },
      { label: "TMT KGB Berlaku", val: "1 April 2026" },
      { label: "Deadline SDM", val: "28 Februari 2026" },
      { label: "Status KGB", val: "Belum Diproses" },
    ],
    akhir: [
      { label: "MKG Akhir", val: "8 tahun 0 bulan (+2 thn)", hl: true },
      { label: "Gaji Pokok Baru", val: "±Rp 3.233.000/bln", hl: true },
      { label: "Gol III/a MKG 8 thn", val: "sesuai tabel PP gaji berlaku", indent: true },
      { label: "Kenaikan Gaji Pokok", val: "±Rp 112.000/bln", hl: true },
      { label: "SK KGB Diterbitkan", val: "Sebelum 28 Feb 2026" },
      { label: "TMT KGB Berikutnya", val: "1 April 2028" },
      { label: "Deadline SDM Berikutnya", val: "28 Februari 2028" },
      { label: "Rapelan", val: "Tidak ada" },
      { label: "Status", val: "Selesai" },
    ],
    catatan: "Gaji naik langsung per 1 April 2026. Tidak ada selisih yang perlu dibayar mundur karena SK terbit sebelum TMT berlaku.",
    flow: [
      { label: "Pegawai Terdaftar", sub: "Sistem hitung deadline SDM otomatis", type: "start" },
      { label: "Cron Harian Berjalan", sub: "Cek: TMT - hari_ini ≤ 14 hari?", type: "process" },
      { label: "Notifikasi H-14 Dibuat", sub: "Insert ke tabel notif | Tampil di dashboard", type: "process" },
      { label: "Notifikasi H-7 Dibuat", sub: "Level: Warning | Kartu KGB jadi merah", type: "warning", edgeLabel: "H-7" },
      { label: "Admin Verifikasi Data", sub: "Cek MKG, golongan, TMT di panel detail", type: "process" },
      { label: "Upload SK + Selesaikan", sub: "DB: status=Selesai | MKG+2 | TMT baru dibuat", type: "success" },
      { label: "SELESAI", sub: "MKG 8 thn | Deadline SDM baru otomatis", type: "end" },
    ],
  },
  {
    num: "02",
    title: "Rapelan: Deadline Terlewat",
    badge: "RAPELAN",
    accent: "var(--st-amber2)",
    accentBg: "linear-gradient(135deg,#78350f,var(--st-amber2))",
    deskripsi: "KGB tidak diproses sebelum deadline SDM karena salah satu dari dua penyebab nyata: admin lupa memantau notifikasi, atau pegawai pindahan dengan berkas belum lengkap dari UPT asal. Gaji tetap naik berlaku mundur dari TMT, selisih dibayar oleh bagian keuangan.",
    awal: [
      { label: "Nama", val: "Ahmad Fauzi, A.Md." },
      { label: "NIP", val: "199001032015031002" },
      { label: "Jabatan", val: "Pengadministrasi Umum" },
      { label: "Unit Kerja", val: UNIT },
      { label: "Golongan/Ruang", val: "II/c (Pengatur Tingkat I)" },
      { label: "MKG Awal", val: "4 tahun 0 bulan", hl: true },
      { label: "Gaji Pokok Saat Ini", val: "±Rp 2.677.000/bln", hl: true },
      { label: "Gol II/c MKG 4 thn", val: "sesuai tabel PP gaji berlaku", indent: true },
      { label: "TMT KGB Berlaku", val: "1 Maret 2026" },
      { label: "Deadline SDM", val: "31 Januari 2026" },
      { label: "Jendela Proses", val: "1–31 Januari 2026 (sistem buka otomatis)", hl: true },
      { label: "Status KGB", val: "Belum Diproses, deadline terlewat!" },
      { label: "Penyebab Rapelan (1)", val: "Admin lupa atau terlewat memantau notifikasi" },
      { label: "Penyebab Rapelan (2)", val: "Pegawai pindahan, berkas belum lengkap dari UPT asal" },
      { label: "Catatan Kasus Khusus", val: "Pegawai baru diinput tahun berjalan → gunakan mode Arsip agar tidak ada flag rapelan (sudah diproses sistem lain)" },
    ],
    akhir: [
      { label: "MKG Akhir", val: "6 tahun 0 bulan (+2 thn)", hl: true },
      { label: "Gaji Pokok Baru", val: "±Rp 2.767.000/bln", hl: true },
      { label: "Gol II/c MKG 6 thn", val: "sesuai tabel PP gaji berlaku", indent: true },
      { label: "Kenaikan Gaji Pokok", val: "±Rp 90.000/bln", hl: true },
      { label: "Tanggal Diproses", val: "10 Maret 2026" },
      { label: "Keterlambatan", val: "38 hari setelah deadline SDM" },
      { label: "Rapelan Keuangan", val: "Selisih 1–10 Mar (10 hari)", hl: true },
      { label: "Nominal Rapelan", val: "±Rp 29.000 (10/31 × Rp 90rb)", hl: true },
      { label: "Catatan Mode Arsip", val: "Pegawai baru diinput tahun berjalan: gunakan Arsip → flag rapelan tidak muncul karena KGB sudah diproses di sistem sebelumnya", hl: true },
      { label: "TMT KGB Berikutnya", val: "1 Maret 2028" },
      { label: "Status", val: "Selesai + Flag Rapelan Diarsip" },
    ],
    catatan: "Dua penyebab rapelan yang nyata: (1) admin lupa memantau notifikasi, (2) pegawai pindahan berkas terlambat dari UPT asal. Khusus pegawai baru diinput tahun berjalan: gunakan mode Arsip, flag rapelan tidak akan muncul karena KGB sejatinya sudah pernah diproses di sistem sebelumnya.",
    flow: [
      { label: "Jendela Proses Dibuka", sub: "Sistem buka otomatis 1 Jan 2026 (H-2 TMT)", type: "start" },
      { label: "Deadline SDM Terlewat", sub: "31 Jan 2026, SK belum diproses", type: "warning" },
      { label: "Sistem Tandai Rapelan", sub: "Deteksi real-time: deadline lewat → kartu rapelan menyala di Data KGB", type: "warning" },
      { label: "Notif Critical Dibuat", sub: "generateNotifikasi: tipe=rapelan, prioritas=critical", type: "process" },
      { label: "Admin Proses KGB / Arsip", sub: "Upload SK atau gunakan mode Arsip jika data historis", type: "process" },
      { label: "Klik Selesaikan KGB", sub: "DB: status=Selesai | Berlaku mundur 1 Mar", type: "success" },
      { label: "Keuangan Bayar Selisih?", sub: "Rapel 1–10 Mar ±Rp 29.000 dibayarkan", type: "decision" },
      { label: "SELESAI + Arsip", sub: "Flag rapelan diarsip | Audit log tersimpan", type: "end" },
    ],
  },
  {
    num: "03",
    title: "Penundaan KGB: Hukuman Disiplin",
    badge: "HUKDIS",
    accent: "var(--st-red)",
    accentBg: "linear-gradient(135deg,var(--st-red),var(--st-red))",
    deskripsi: "Pegawai mendapat SK hukdis Penundaan KGB. Sistem otomatis menggeser TMT +12 bulan dan memblokir proses KGB. MKG bertambah +3 (bukan +2) karena masa penundaan dihitung penuh sesuai PP 53/2010.",
    awal: [
      { label: "Nama", val: "Budi Santoso, S.Kom." },
      { label: "NIP", val: "198803122012101003" },
      { label: "Jabatan", val: "Pranata Komputer Muda" },
      { label: "Unit Kerja", val: UNIT },
      { label: "Golongan/Ruang", val: "III/b (Penata Muda)" },
      { label: "MKG Awal", val: "8 tahun 0 bulan", hl: true },
      { label: "Gaji Pokok Saat Ini", val: "±Rp 3.309.000/bln", hl: true },
      { label: "Gol III/b MKG 8 thn", val: "sesuai tabel PP gaji berlaku", indent: true },
      { label: "TMT KGB Semula", val: "1 Juni 2026" },
      { label: "Deadline SDM Semula", val: "30 April 2026" },
      { label: "SK Hukdis", val: "No. 001/SK/HUKDIS/2025" },
      { label: "Jenis Hukdis", val: "Penundaan KGB 1 Tahun" },
      { label: "TMT Hukdis Mulai", val: "1 Januari 2026" },
      { label: "TMT Hukdis Berakhir", val: "31 Desember 2026" },
    ],
    akhir: [
      { label: "TMT KGB Digeser Otomatis", val: "1 Juni 2027 (+12 bulan)", hl: true },
      { label: "Deadline SDM Baru", val: "30 April 2027" },
      { label: "MKG Saat KGB Diproses", val: "8 + 3 = 11 tahun", hl: true },
      { label: "Penundaan 1 thn + interval 2 thn", val: "= 3 tahun (PP 53/2010)", indent: true },
      { label: "Gaji Pokok Baru", val: "±Rp 3.462.000/bln", hl: true },
      { label: "Gol III/b MKG 11 thn", val: "sesuai tabel PP gaji berlaku", indent: true },
      { label: "Kenaikan Gaji Pokok", val: "±Rp 153.000/bln", hl: true },
      { label: "TMT KGB Berikutnya", val: "1 Juni 2029" },
      { label: "Deadline SDM Berikutnya", val: "30 April 2029" },
      { label: "Status", val: "Selesai, KGB normal kembali" },
    ],
    catatan: "Selama Jan–Des 2026, KGB diblokir total. Blokir dicabut otomatis 1 Januari 2027. MKG +3 (bukan +2) adalah konsekuensi hukum PP 53/2010 yang menghitung masa penundaan sebagai masa kerja.",
    flow: [
      { label: "SK Hukdis Diterima", sub: "PP 53/2010: Penundaan KGB 1 Tahun", type: "start" },
      { label: "Catat Hukdis di Sistem", sub: "Riwayat → Tab Hukdis → Input no SK & TMT", type: "process" },
      { label: "DB Proses Dampak Hukdis", sub: "TMT KGB +12 bln | status_kgb = BLOKIR", type: "warning" },
      { label: "KGB Diblokir Penuh", sub: "Tombol proses nonaktif Jan–Des 2026", type: "warning" },
      { label: "Cron 1 Des: Notif H-30", sub: "Admin: hukdis Budi berakhir 30 hari lagi", type: "process" },
      { label: "1 Jan 2027: Blokir Dicabut", sub: "Cron deteksi berakhir → status = AKTIF", type: "success" },
      { label: "Proses KGB Normal", sub: "MKG 11 thn | Upload SK | Deadline 30 Apr", type: "process" },
      { label: "SELESAI", sub: "MKG 11 thn | TMT baru 1 Jun 2029", type: "end" },
    ],
  },
  {
    num: "04",
    title: "Koreksi Data Pegawai Keliru",
    badge: "KOREKSI",
    accent: "var(--dt3)",
    accentBg: "linear-gradient(135deg,var(--dt2),var(--dt3))",
    deskripsi: "Admin menemukan data master pegawai salah, misalnya golongan keliru saat input awal. Karena kalkulasi KGB (gaji pokok baru, MKG) sepenuhnya otomatis dari data master pegawai, koreksi harus dilakukan di Manajemen Pegawai terlebih dahulu, baru entri KGB yang salah dibatalkan dan diinput ulang.",
    awal: [
      { label: "Nama", val: "Dewi Lestari, S.H." },
      { label: "NIP", val: "199205182018042001" },
      { label: "Jabatan", val: "Analis Hukum Muda" },
      { label: "Unit Kerja", val: UNIT },
      { label: "Golongan di Master Pegawai (SALAH)", val: "III/b (seharusnya III/c)", hl: true },
      { label: "Golongan Benar", val: "III/c (Penata)" },
      { label: "MKG Awal", val: "6 tahun 0 bulan" },
      { label: "TMT KGB Berlaku", val: "1 Mei 2026" },
      { label: "Deadline SDM", val: "31 Maret 2026" },
      { label: "Dampak Kesalahan", val: "Gaji pokok baru dihitung dari tabel III/b yang keliru", hl: true },
      { label: "Status Entri KGB Saat Ini", val: "sedang_diproses, belum upload SK final" },
      { label: "Catatan Penting", val: "Form input KGB tidak punya field golongan, selalu auto dari master pegawai", hl: true },
    ],
    akhir: [
      { label: "Langkah 1", val: "Edit data pegawai di Manajemen Pegawai → ubah golongan ke III/c", hl: true },
      { label: "Langkah 2", val: "Batalkan entri KGB lama (status → Dibatalkan)", hl: true },
      { label: "Langkah 3", val: "Input ulang KGB, sistem otomatis pakai golongan III/c yang sudah difix", hl: true },
      { label: "Gaji Pokok Baru (Koreksi)", val: "±Rp 3.400.000/bln (Gol III/c MKG 8 thn)", hl: true },
      { label: "Gol III/c MKG 8 thn", val: "sesuai tabel PP gaji berlaku", indent: true },
      { label: "Kenaikan Gaji Pokok", val: "±Rp 115.000/bln (dari data benar)" },
      { label: "Audit Trail", val: "Entri salah (Dibatalkan) + entri baru tersimpan permanen", hl: true },
      { label: "TMT KGB Berikutnya", val: "1 Mei 2028" },
      { label: "Status", val: "Selesai, data sudah benar" },
    ],
    catatan: "Golongan, MKG, dan gaji pokok di form KGB TIDAK bisa diubah manual, semua dihitung otomatis dari data master pegawai. Jika ada data yang salah, perbaiki dulu di Manajemen Pegawai, baru batalkan entri KGB lama dan input ulang. Riwayat pembatalan tersimpan sebagai audit trail.",
    flow: [
      { label: "Kesalahan Terdeteksi", sub: "Golongan di master pegawai salah → III/b (harusnya III/c)", type: "warning" },
      { label: "Edit Master Pegawai", sub: "Manajemen Pegawai → Edit → Golongan diubah ke III/c", type: "process" },
      { label: "Batalkan KGB Lama", sub: "Data KGB → Batalkan → alasan: Koreksi data golongan", type: "process" },
      { label: "Input Ulang KGB", sub: "Sistem auto-load golongan III/c dari master terbaru", type: "process" },
      { label: "Kalkulasi Otomatis Benar", sub: "Gaji III/c MKG 8 thn | recalculate otomatis", type: "success" },
      { label: "Upload SK + Selesaikan", sub: "DB: status=Selesai | Audit trail lengkap", type: "success" },
      { label: "SELESAI", sub: "Entri salah (Dibatalkan) + entri benar tersimpan", type: "end" },
    ],
  },
  {
    num: "05",
    title: "Import Pegawai Massal: Satker Baru",
    badge: "IMPORT",
    accent: "var(--st-green)",
    accentBg: "linear-gradient(135deg,var(--st-green),var(--st-green))",
    deskripsi: "Sub-satuan kerja baru bergabung ke Kanwil. 25 pegawai perlu didaftarkan ke SIM-KGB sekaligus. Import CSV membuat data pegawai + 1 entri KGB berikutnya secara otomatis. Untuk riwayat KGB yang sudah selesai di satker lama, admin menggunakan Mode Arsip setelah import.",
    awal: [
      { label: "Unit Baru", val: UNIT + " (Sub-satker baru)" },
      { label: "Jumlah Pegawai", val: "25 orang" },
      { label: "Sumber Data", val: "SIMPEG lama, belum masuk SIM-KGB" },
      { label: "Contoh Pegawai", val: "Eko Prasetyo, S.Sos." },
      { label: "Golongan/MKG", val: "III/b | MKG 10 tahun", indent: true },
      { label: "TMT KGB Terakhir (di satker lama)", val: "1 Maret 2024", indent: true },
      { label: "TMT KGB Berikutnya", val: "1 Maret 2026", indent: true },
      { label: "Deadline SDM", val: "31 Januari 2026", indent: true },
      { label: "Kolom wajib di template CSV", val: "NIP, nama, jabatan, pangkat, golongan, TMT golongan, MKG, TMT KGB terakhir, TMT KGB berikutnya", hl: true },
    ],
    akhir: [
      { label: "25 Pegawai Tersimpan", val: "Otomatis aktif di SIM-KGB", hl: true },
      { label: "1 Entri KGB Dibuat per Pegawai", val: "Status: Belum Diproses, TMT sesuai data import", hl: true },
      { label: "Notifikasi Aktif", val: "H-14/H-7 berjalan sesuai TMT KGB berikutnya" },
      { label: "Riwayat KGB Historis?", val: "Gunakan Mode Arsip di Data KGB untuk tiap periode lampau", hl: true },
      { label: "Mode Arsip (Eko)", val: "Input TMT 1 Mar 2024 → langsung Selesai tanpa flag rapelan", indent: true },
      { label: "Baris error", val: "NIP duplikat atau format salah dilewati, dilaporkan ke admin" },
      { label: "Status", val: "Semua pegawai aktif | KGB berikutnya masuk antrean" },
    ],
    catatan: "Import hanya membuat 1 entri KGB (berikutnya). Untuk memasukkan KGB yang sudah selesai di sistem lama, gunakan Mode Arsip satu per satu setelah import. Mode Arsip mencatat KGB historis sebagai Selesai tanpa memunculkan flag rapelan.",
    flow: [
      { label: "Buka Menu Import", sub: "Manajemen Pegawai → Import CSV", type: "start" },
      { label: "Unduh & Isi Template", sub: "NIP, gol, MKG, TMT golongan, TMT KGB terakhir & berikutnya", type: "process" },
      { label: "Upload & Validasi Sistem", sub: "Cek: duplikasi NIP, kolom wajib, format tanggal", type: "decision", edgeLabel: "Valid" },
      { label: "25 Pegawai + KGB Tersimpan", sub: "1 entri KGB Belum Diproses per pegawai", type: "success" },
      { label: "Mode Arsip (opsional)", sub: "Input riwayat KGB lama → langsung Selesai | tanpa rapelan", type: "process" },
      { label: "SELESAI", sub: "25 aktif | KGB berikutnya di antrean | Notif berjalan", type: "end" },
    ],
  },
  {
    num: "06",
    title: "Hukdis Berakhir: Pemulihan KGB",
    badge: "PEMULIHAN",
    accent: "var(--st-violet)",
    accentBg: "linear-gradient(135deg,var(--st-violet),var(--st-violet))",
    deskripsi: "Lanjutan Kasus 03 (Budi Santoso). Hukdis berakhir 31 Desember 2026. Sistem otomatis mencabut blokir tanpa tindakan manual admin. KGB langsung aktif di antrean.",
    awal: [
      { label: "Nama", val: "Budi Santoso, S.Kom." },
      { label: "Unit Kerja", val: UNIT },
      { label: "Konteks", val: "Lanjutan Kasus 03 (Hukdis aktif)" },
      { label: "Status Hukdis", val: "AKTIF: Penundaan KGB 1 Tahun" },
      { label: "Periode Hukdis", val: "1 Jan 2026 – 31 Des 2026" },
      { label: "TMT KGB (digeser)", val: "1 Juni 2027" },
      { label: "Deadline SDM", val: "30 April 2027" },
      { label: "Status KGB", val: "DIBLOKIR sepanjang Jan–Des 2026" },
      { label: "MKG Saat Ini", val: "8 tahun (belum berubah)", hl: true },
      { label: "Gaji Pokok Saat Ini", val: "±Rp 3.309.000/bln (Gol III/b MKG 8 thn)", hl: true },
    ],
    akhir: [
      { label: "Tanggal Blokir Dicabut", val: "1 Januari 2027 (otomatis sistem)", hl: true },
      { label: "Notifikasi H-30", val: "1 Des 2026, admin diperingatkan", hl: true },
      { label: "KGB Muncul di Antrean", val: "Status: Belum Diproses" },
      { label: "MKG saat Diproses", val: "8 + 3 = 11 tahun", hl: true },
      { label: "Masa tunda 1 thn + interval 2 thn", val: "= 3 tahun MKG (PP 53/2010)", indent: true },
      { label: "Gaji Pokok Baru", val: "±Rp 3.462.000/bln (Gol III/b MKG 11 thn)", hl: true },
      { label: "Kenaikan Gaji Pokok", val: "±Rp 153.000/bln", hl: true },
      { label: "TMT KGB Berikutnya", val: "1 Juni 2029" },
      { label: "Status", val: "Selesai, KGB aktif kembali normal" },
    ],
    catatan: "Sistem mendeteksi berakhirnya hukdis otomatis setiap hari. Admin tidak perlu tindakan manual untuk mencabut blokir, cukup tunggu notifikasi lalu proses KGB.",
    flow: [
      { label: "Hukdis Aktif", sub: "KGB diblokir | Tombol proses nonaktif", type: "warning" },
      { label: "Cron 1 Des: Notif H-30", sub: "DB: hitung hari menuju hukdis_berakhir", type: "process" },
      { label: "Cron Cek 31 Des 2026?", sub: "tgl_sekarang >= hukdis_berakhir", type: "decision", edgeLabel: "YA" },
      { label: "Blokir Dicabut Otomatis", sub: "DB: status_kgb=AKTIF | KGB di antrean", type: "success" },
      { label: "Admin Proses KGB", sub: "MKG 11 thn | Upload SK | Deadline 30 Apr", type: "process" },
      { label: "SELESAI", sub: "Hukdis arsip | TMT baru 1 Jun 2029", type: "end" },
    ],
  },
  {
    num: "07",
    title: "CPNS Gol. II ke PNS: KGB Pertama (SMA)",
    badge: "CPNS→PNS",
    accent: "var(--st-amber)",
    accentBg: "linear-gradient(135deg,var(--st-amber2),var(--st-amber))",
    deskripsi: "Pegawai lulusan SMA masuk CPNS Gol II/a. Perbedaan kunci: KGB pertama terjadi 1 tahun setelah CPNS (bersamaan pengangkatan PNS), bukan 2 tahun seperti Gol III. Syarat MKG untuk KGB pertama Gol II adalah lebih dari 1 tahun.",
    awal: [
      { label: "Nama", val: "Budi Hartono" },
      { label: "NIP", val: "200601012024021001" },
      { label: "Pendidikan", val: "SMA/Sederajat" },
      { label: "Unit Kerja", val: UNIT },
      { label: "Status", val: "CPNS (masa percobaan)" },
      { label: "TMT CPNS", val: "1 Maret 2024" },
      { label: "Golongan/Ruang CPNS", val: "II/a (Pengatur Muda)" },
      { label: "MKG Awal CPNS", val: "0 tahun 0 bulan", hl: true },
      { label: "Gaji Pokok CPNS (80%)", val: "±Rp 1.747.200/bln", hl: true },
      { label: "80% × Rp 2.184.000", val: "Gol II/a MKG 0 thn (PP 5/2024)", indent: true },
      { label: "Syarat KGB Pertama Gol II", val: "MKG > 1 tahun", hl: true },
      { label: "Interval KGB Pertama", val: "1 TAHUN setelah CPNS (bukan 2 tahun!)", hl: true },
    ],
    akhir: [
      { label: "TMT PNS", val: "1 Maret 2025 (12 bln masa percobaan)", hl: true },
      { label: "Golongan/Ruang PNS", val: "II/a (tidak berubah)" },
      { label: "KGB Pertama Bersamaan PNS", val: "TMT KGB ke-1: 1 Maret 2025", hl: true },
      { label: "TMT CPNS + 1 tahun", val: "1 Mar 2024 + 1 thn = 1 Mar 2025", indent: true },
      { label: "MKG saat KGB Pertama", val: "1 tahun 0 bulan", hl: true },
      { label: "Deadline SDM KGB Pertama", val: "31 Januari 2025" },
      { label: "Gaji setelah KGB Pertama", val: "±Rp 2.221.000/bln (Gol II/a MKG 1 thn)", hl: true },
      { label: "Naik dari gaji CPNS 80%", val: "Rp 1.747.200 → Rp 2.221.000", indent: true },
      { label: "TMT KGB Ke-2", val: "1 Maret 2027 (interval 2 thn berikutnya)" },
      { label: "MKG saat KGB Ke-2", val: "3 tahun 0 bulan" },
      { label: "Status", val: "Selesai, KGB pertama berhasil" },
    ],
    catatan: "BEDA dengan Gol III: Gol II/a (SMA) KGB pertama setelah 1 tahun CPNS. Gol III/a (S1) KGB pertama setelah 2 tahun CPNS. Setelah KGB pertama, keduanya interval 2 tahun.",
    flow: [
      { label: "CPNS Diangkat", sub: "Gol II/a | MKG 0 | Gaji 80% Rp 1.747.200", type: "start" },
      { label: "Input di SIM-KGB", sub: "Status: CPNS | TMT CPNS: 1 Mar 2024", type: "process" },
      { label: "Sistem Hitung TMT KGB", sub: "Gol II: CPNS+1thn → KGB: 1 Mar 2025", type: "process" },
      { label: "Masa Percobaan Lulus?", sub: "Penilaian 12 bln kinerja & disiplin", type: "decision", edgeLabel: "LULUS" },
      { label: "PNS + KGB Bersamaan", sub: "1 Mar 2025: PNS & KGB ke-1 berlaku", type: "success" },
      { label: "Admin Selesaikan KGB", sub: "Upload SK | DB: MKG=1thn | status=Selesai", type: "process" },
      { label: "SELESAI", sub: "Gol II/a MKG 1 thn | KGB ke-2: 1 Mar 2027", type: "end" },
    ],
  },
  {
    num: "08",
    title: "CPNS Gol. III ke PNS: KGB Pertama (S-1)",
    badge: "CPNS→PNS",
    accent: "#0369a1",
    accentBg: "linear-gradient(135deg,#075985,#0369a1)",
    deskripsi: "Pegawai fresh graduate S-1 masuk CPNS Gol III/a. KGB pertama baru terjadi 2 tahun setelah CPNS (1 tahun setelah PNS). Syarat MKG untuk KGB pertama Gol III adalah lebih dari 2 tahun, berbeda dengan Gol II.",
    awal: [
      { label: "Nama", val: "Ani Ratnasari, S.H." },
      { label: "NIP", val: "199912202024032001" },
      { label: "Pendidikan", val: "S-1 Ilmu Hukum" },
      { label: "Unit Kerja", val: UNIT },
      { label: "Status", val: "CPNS (masa percobaan)" },
      { label: "TMT CPNS", val: "1 Maret 2024" },
      { label: "Golongan/Ruang CPNS", val: "III/a (Penata Muda)" },
      { label: "MKG Awal CPNS", val: "0 tahun 0 bulan", hl: true },
      { label: "Gaji Pokok CPNS (80%)", val: "±Rp 2.228.560/bln", hl: true },
      { label: "80% × Rp 2.785.700", val: "Gol III/a MKG 0 thn (PP 5/2024)", indent: true },
      { label: "Syarat KGB Pertama Gol III", val: "MKG > 2 tahun", hl: true },
      { label: "Interval KGB Pertama", val: "2 TAHUN setelah CPNS (beda dari Gol II!)", hl: true },
    ],
    akhir: [
      { label: "TMT PNS", val: "1 Maret 2025 (12 bln masa percobaan)", hl: true },
      { label: "Golongan/Ruang PNS", val: "III/a (tidak berubah)" },
      { label: "Gaji PNS awal (100%)", val: "±Rp 2.840.000/bln (Gol III/a MKG 1 thn)", hl: true },
      { label: "TMT KGB Pertama", val: "1 Maret 2026 (2 tahun setelah CPNS)", hl: true },
      { label: "TMT CPNS + 2 tahun", val: "1 Mar 2024 + 2 thn = 1 Mar 2026", indent: true },
      { label: "MKG saat KGB Pertama", val: "2 tahun 0 bulan", hl: true },
      { label: "Deadline SDM KGB Pertama", val: "31 Januari 2026" },
      { label: "Gaji setelah KGB Pertama", val: "±Rp 2.950.000/bln (Gol III/a MKG 2 thn)", hl: true },
      { label: "Kenaikan dari Gaji PNS awal", val: "±Rp 110.000/bln", hl: true },
      { label: "TMT KGB Ke-2", val: "1 Maret 2028 (interval 2 thn berikutnya)" },
      { label: "MKG saat KGB Ke-2", val: "4 tahun 0 bulan" },
      { label: "Status", val: "Selesai, KGB pertama berhasil" },
    ],
    catatan: "PERBANDINGAN: Gol II/a → KGB pertama 1 Mar 2025 (MKG 1 thn). Gol III/a → KGB pertama 1 Mar 2026 (MKG 2 thn). Ani menunggu 1 tahun lebih lama meski masuk CPNS tanggal sama. Gaji Gol III/a lebih tinggi namun interval KGB pertama lebih panjang.",
    flow: [
      { label: "CPNS Diangkat", sub: "Gol III/a | MKG 0 | Gaji 80% Rp 2.228.560", type: "start" },
      { label: "Input di SIM-KGB", sub: "Status: CPNS | TMT CPNS: 1 Mar 2024", type: "process" },
      { label: "PNS: 1 Mar 2025", sub: "MKG 1 thn | Gaji 100% Rp 2.840.000", type: "success" },
      { label: "Sistem Hitung TMT KGB", sub: "Gol III: CPNS+2thn → KGB: 1 Mar 2026", type: "process" },
      { label: "Notif H-14 (15 Feb 2026)", sub: "Deadline SDM: 31 Jan 2026, segera proses", type: "warning" },
      { label: "Admin Upload SK + Selesaikan", sub: "DB: MKG=2thn | status=Selesai", type: "process" },
      { label: "SELESAI", sub: "Gol III/a MKG 2 thn | KGB ke-2: 1 Mar 2028", type: "end" },
    ],
  },
];

/* ---- Konten section ---- */
const sections: Section[] = [
  {
    id: "pengantar",
    label: "Pengantar",
    color: "var(--dtn)",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
    content: (
      <div className="space-y-5">
        <p className="text-sm leading-relaxed" style={{ color: "var(--dt2)" }}>
          <strong style={{ color: "var(--dtn)" }}>SIM-KGB</strong> adalah sistem informasi berbasis web untuk mengelola
          Kenaikan Gaji Berkala (KGB) pegawai negeri sipil secara otomatis, terstruktur, dan tepat waktu.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { icon: "📊", title: "Monitoring Real-time", desc: "Pantau deadline KGB seluruh pegawai dalam satu dashboard" },
            { icon: "🤖", title: "Kalkulasi Otomatis", desc: "MKG dan gaji pokok baru dihitung otomatis berdasarkan PP 5/2024" },
            { icon: "🔔", title: "Notifikasi Cerdas", desc: "Pengingat H-14, H-7, dan rapelan tanpa perlu manual" },
            { icon: "📄", title: "Generate & Upload SK", desc: "Buat surat keputusan KGB atau upload SK TTD resmi" },
            { icon: "💰", title: "Modul Keuangan", desc: "Konfirmasi KGB, penentuan rapelan, dan rekap dasar input Gaji Web" },
            { icon: "📋", title: "Laporan & Rekap", desc: "Rekap per bulan, golongan, unit kerja. Cetak PDF dengan logo resmi." },
          ].map((f) => (
            <div key={f.title} className="flex items-start gap-3 rounded-2xl p-3.5" style={{ background: "var(--sub)", border: "1px solid var(--ln1)" }}>
              <span className="text-xl shrink-0">{f.icon}</span>
              <div>
                <p className="text-xs font-semibold" style={{ color: "var(--dtn)" }}>{f.title}</p>
                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--dt4)" }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-2xl p-4" style={{ background: "var(--tint-amber-bg)", border: "1px solid var(--tint-amber-ln)" }}>
          <p className="text-xs font-semibold mb-2" style={{ color: "var(--st-amber2)" }}>⚖️ Dasar Hukum</p>
          <div className="space-y-1.5">
            {[
              "PP No. 7 Tahun 1977: Peraturan Gaji PNS",
              "PP No. 5 Tahun 2024: Tabel Gaji PNS Terkini",
              "PP No. 53 Tahun 2010: Disiplin PNS (Hukdis & Penundaan KGB)",
            ].map((h) => (
              <div key={h} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#c9a227" }} />
                <p className="text-xs" style={{ color: "var(--st-amber2)" }}>{h}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "dashboard",
    label: "Dashboard",
    color: "var(--st-green)",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
      </svg>
    ),
    content: (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed" style={{ color: "var(--dt2)" }}>
          Dashboard adalah pusat kendali yang menampilkan kondisi KGB seluruh pegawai secara menyeluruh dalam satu tampilan.
        </p>
        <div className="space-y-3">
          {[
            { emoji: "🃏", title: "Kartu Statistik", desc: "Jumlah KGB Rapelan, Mendekati Deadline, Sedang Diproses, dan Selesai bulan ini. Klik kartu untuk langsung filter ke Data KGB.", color: "var(--tint-navy)" },
            { emoji: "📅", title: "Kalender Progress", desc: "Persentase KGB selesai per bulan dalam tahun berjalan. Bulan dengan progress 100% ditandai hijau.", color: "var(--tint-green-bg)" },
            { emoji: "🔔", title: "Notifikasi Terbaru", desc: "5 notifikasi terkini. Klik untuk melihat semua notifikasi di halaman Notifikasi.", color: "var(--tint-amber-bg)" },
            { emoji: "⚠️", title: "Banner Peringatan", desc: "Muncul otomatis jika ada pegawai dengan hukdis aktif atau KGB yang melewati deadline.", color: "var(--tint-red-bg)" },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-3.5 rounded-2xl p-3.5" style={{ background: item.color, border: "1px solid rgba(0,0,0,0.05)" }}>
              <span className="text-lg shrink-0">{item.emoji}</span>
              <div>
                <p className="text-xs font-semibold" style={{ color: "var(--dtn)" }}>{item.title}</p>
                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--dt3)" }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "kgb",
    label: "Data KGB",
    color: "var(--dtn)",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    ),
    content: (
      <div className="space-y-5">
        <p className="text-sm leading-relaxed" style={{ color: "var(--dt2)" }}>
          Halaman utama pengelolaan KGB. Semua proses input, verifikasi, upload SK, dan penyelesaian dilakukan di sini.
        </p>
        <InfoCard
          accent="linear-gradient(135deg,var(--navy-solid),#2d5a8e)"
          title="Alur Proses KGB Normal"
          icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
        >
          <div className="space-y-2.5">
            {[
              "Sistem tampilkan KGB yang mendekati atau melewati deadline",
              "Admin klik kartu pegawai untuk buka detail & verifikasi data",
              "Upload SK KGB (file PDF) yang telah ditandatangani",
              "Klik Selesaikan KGB → status berubah jadi Selesai",
              "Unduh SK atau generate surat jika diperlukan",
            ].map((s, i) => <Step key={i} n={i + 1}>{s}</Step>)}
          </div>
        </InfoCard>
        <div>
          <p className="text-xs font-semibold mb-2.5" style={{ color: "var(--dtn)" }}>Status KGB</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { status: "Belum Diproses", color: "var(--st-amber)", bg: "var(--tint-amber-bg)", line: "var(--tint-amber-ln)", desc: "Belum ada tindakan" },
              { status: "Sedang Diproses", color: "var(--dtn)", bg: "var(--tint-navy)", line: "var(--ln0)", desc: "Berkas sedang diproses" },
              { status: "Selesai", color: "var(--st-green)", bg: "var(--tint-green-bg)", line: "var(--tint-green-ln)", desc: "SK sudah diterbitkan" },
              { status: "Dibatalkan", color: "var(--st-red)", bg: "var(--tint-red-bg)", line: "var(--tint-red-ln)", desc: "Data salah, dapat diinput ulang" },
            ].map((s) => (
              <div key={s.status} className="rounded-xl p-3" style={{ background: s.bg, border: `1px solid ${s.line}` }}>
                <span className="text-xs font-bold" style={{ color: s.color }}>{s.status}</span>
                <p className="text-xs mt-0.5" style={{ color: s.color, opacity: 0.8 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl p-4" style={{ background: "var(--tint-amber-bg)", border: "1px solid var(--tint-amber-ln)" }}>
          <p className="text-xs font-semibold mb-1" style={{ color: "var(--st-amber2)" }}>⏰ Deadline SDM</p>
          <p className="text-xs leading-relaxed" style={{ color: "var(--st-amber2)" }}>
            Deadline SDM = <strong>akhir bulan ke-2 sebelum TMT KGB berlaku</strong>.<br />
            Contoh: TMT 1 Juni 2026 → Rekon keuangan 1–15 Mei → <strong>Deadline SDM: 30 April 2026</strong>
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "pegawai",
    label: "Manajemen Pegawai",
    color: "var(--st-violet)",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    content: (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed" style={{ color: "var(--dt2)" }}>
          Kelola data master pegawai: tambah manual, import massal, edit, dan rekam riwayat hukdis.
        </p>
        {[
          { emoji: "✏️", title: "Tambah Pegawai Manual", desc: "Klik + Tambah Pegawai, isi NIP, nama, jabatan, golongan, MKG, dan TMT KGB. Sistem otomatis hitung deadline SDM.", color: "var(--tint-violet-bg)" },
          { emoji: "📥", title: "Import Excel/CSV", desc: "Upload data pegawai massal. Unduh template terlebih dahulu agar format kolom sesuai. Sistem validasi tiap baris sebelum disimpan.", color: "var(--tint-green-bg)" },
          { emoji: "🔄", title: "Edit & Nonaktifkan", desc: "Klik pegawai di tabel untuk edit. Pegawai pensiun/keluar bisa dinonaktifkan, riwayat tetap tersimpan.", color: "var(--tint-blue-bg)" },
          { emoji: "📋", title: "Riwayat Pegawai", desc: "Klik ikon riwayat untuk melihat histori KGB lengkap dan catatan hukdis aktif/nonaktif.", color: "#fff7ed" },
        ].map((item) => (
          <div key={item.title} className="flex items-start gap-3.5 rounded-2xl p-3.5" style={{ background: item.color, border: "1px solid rgba(0,0,0,0.05)" }}>
            <span className="text-xl shrink-0">{item.emoji}</span>
            <div>
              <p className="text-xs font-semibold" style={{ color: "var(--dtn)" }}>{item.title}</p>
              <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--dt3)" }}>{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "hukdis",
    label: "Hukuman Disiplin",
    color: "var(--st-red)",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    content: (
      <div className="space-y-5">
        <p className="text-sm leading-relaxed" style={{ color: "var(--dt2)" }}>
          Pencatatan hukdis mengacu <strong style={{ color: "var(--dtn)" }}>PP No. 53 Tahun 2010</strong>.
          Hanya jenis <Pill label="Penundaan KGB" color="var(--st-red)" bg="var(--tint-red-bg)" /> yang berdampak ke proses KGB.
        </p>
        <div className="rounded-2xl overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(220,38,38,0.1)", border: "1px solid var(--tint-red-ln)" }}>
          <div className="px-4 py-3" style={{ background: "linear-gradient(135deg,var(--st-red),var(--st-red))" }}>
            <p className="text-xs font-semibold text-white">🔒 Penundaan KGB: PP 53/2010 Pasal 7 ayat (3)</p>
          </div>
          <div className="p-4 space-y-2">
            {[
              { label: "Durasi penundaan", val: "12 bulan (1 tahun), fixed" },
              { label: "Efek ke TMT", val: "Digeser otomatis +12 bulan" },
              { label: "Status KGB", val: "Diblokir selama hukdis aktif" },
              { label: "MKG saat KGB dijatuhkan", val: "+3 tahun (masa tunda dihitung penuh)", hl: true },
            ].map((r) => <DataRow key={r.label} label={r.label} value={r.val} highlight={r.hl} />)}
          </div>
        </div>
        <InfoCard
          accent="linear-gradient(135deg,var(--navy-solid),#2d5a8e)"
          title="Cara Mencatat Hukdis"
          icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>}
        >
          <div className="space-y-2.5">
            {[
              <>Buka <strong>Riwayat Pegawai</strong> (ikon riwayat di tabel pegawai)</>,
              <>Klik tab <strong>Hukdis</strong> lalu tombol <strong>+ Tambah Hukdis</strong></>,
              "Pilih jenis hukdis, isi nomor SK, tanggal SK, TMT mulai dan berakhir",
              "Klik Simpan, sistem otomatis memproses dampak ke KGB",
            ].map((s, i) => <Step key={i} n={i + 1}>{s}</Step>)}
          </div>
        </InfoCard>
        <div className="rounded-2xl p-4" style={{ background: "var(--tint-green-bg)", border: "1px solid var(--tint-green-ln)" }}>
          <p className="text-xs font-semibold mb-1" style={{ color: "var(--st-green)" }}>✅ Hapus / Batalkan Hukdis</p>
          <p className="text-xs leading-relaxed" style={{ color: "var(--st-green)" }}>
            Klik ikon hapus di kartu hukdis. Sistem otomatis pulihkan TMT KGB ke posisi semula dan buka blokir proses KGB.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "notifikasi",
    label: "Notifikasi",
    color: "#c9a227",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
    content: (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed" style={{ color: "var(--dt2)" }}>
          Sistem menghasilkan notifikasi otomatis setiap hari berdasarkan kondisi KGB dan hukdis pegawai.
        </p>
        <div className="space-y-2.5">
          {[
            { label: "H-14", prioritas: "Info", bg: "linear-gradient(135deg,var(--tint-blue-bg),var(--tint-blue-bg2))", warna: "var(--st-blue)", icon: "📢", desc: "KGB jatuh tempo 14 hari lagi. Persiapkan berkas SK." },
            { label: "H-7", prioritas: "Warning", bg: "linear-gradient(135deg,var(--tint-amber-bg),var(--tint-amber-bg2))", warna: "var(--st-amber2)", icon: "⚠️", desc: "Deadline SDM tinggal 7 hari atau kurang. Segera proses." },
            { label: "Rapelan", prioritas: "Critical", bg: "linear-gradient(135deg,var(--tint-red-bg),var(--tint-red-bg2))", warna: "var(--st-red)", icon: "🚨", desc: "Deadline SDM sudah terlewat. KGB berpotensi menjadi rapelan." },
            { label: "Hukdis Berakhir", prioritas: "Warning", bg: "linear-gradient(135deg,var(--tint-amber-bg),var(--tint-amber-bg2))", warna: "var(--st-amber2)", icon: "🔓", desc: "Masa hukuman disiplin akan segera berakhir dalam 30 hari." },
          ].map((n) => (
            <div key={n.label} className="flex items-start gap-3 rounded-2xl p-3.5" style={{ background: n.bg, border: `1px solid ${n.warna}22` }}>
              <span className="text-base shrink-0">{n.icon}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-bold" style={{ color: n.warna }}>{n.label}</span>
                  <Pill label={n.prioritas} color={n.warna} bg={n.warna + "18"} />
                </div>
                <p className="text-xs" style={{ color: n.warna + "cc" }}>{n.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-2xl p-3.5" style={{ background: "var(--sub)", border: "1px solid var(--ln1)" }}>
          <p className="text-xs font-semibold mb-1" style={{ color: "var(--dtn)" }}>🔁 Deduplikasi Otomatis</p>
          <p className="text-xs leading-relaxed" style={{ color: "var(--dt3)" }}>
            Notifikasi H-14/H-7 tidak dibuat ulang dalam 7 hari terakhir. Rapelan dan hukdis berakhir tidak dibuat ulang dalam 30 hari terakhir.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "laporan",
    label: "Laporan & Rekap",
    color: "var(--st-green)",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
      </svg>
    ),
    content: (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed" style={{ color: "var(--dt2)" }}>
          Rekap data KGB yang bisa difilter, divisualisasikan, dan diekspor untuk keperluan pelaporan atau arsip internal.
        </p>
        {[
          { emoji: "🔍", title: "Filter Instan", desc: "Filter tahun, bulan, dan status KGB. Bulan & status difilter client-side, hasil langsung tanpa reload.", color: "var(--sub)" },
          { emoji: "📄", title: "Cetak / Export PDF dengan Logo", desc: "Kop surat lengkap dengan logo instansi, rekap per bulan, per golongan, dan per unit kerja. Layout A4 landscape siap cetak.", color: "var(--tint-green-bg)" },
          { emoji: "📊", title: "Rekap Visual 3-Panel", desc: "Per Golongan (badges berwarna), Per Bulan TMT (progress bar selesai/total), Per Unit Kerja (distribusi). Semua terlihat sekaligus.", color: "var(--tint-blue-bg)" },
          { emoji: "➕", title: "Kolom Selisih Gaji", desc: "Tabel detail menampilkan selisih kenaikan gaji (+Rp) per pegawai sebagai informasi tambahan.", color: "var(--tint-amber-bg)" },
        ].map((item) => (
          <div key={item.title} className="flex items-start gap-3.5 rounded-2xl p-3.5" style={{ background: item.color, border: "1px solid rgba(0,0,0,0.05)" }}>
            <span className="text-xl shrink-0">{item.emoji}</span>
            <div>
              <p className="text-xs font-semibold" style={{ color: "var(--dtn)" }}>{item.title}</p>
              <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--dt3)" }}>{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "keuangan",
    label: "Modul Keuangan",
    color: "var(--st-green)",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
      </svg>
    ),
    content: (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed" style={{ color: "var(--dt2)" }}>
          Modul khusus untuk role <strong style={{ color: "var(--dtn)" }}>Keuangan</strong>. Akses terbatas, hanya dapat melakukan konfirmasi KGB dan melihat riwayat, tidak dapat mengedit data pegawai.
        </p>
        <div className="space-y-3">
          {[
            { emoji: "✅", title: "Konfirmasi KGB", desc: "KGB yang sudah dikirim SDM (status Menunggu Keuangan) dikonfirmasi di sini. Keuangan menentukan apakah ada rapelan atau tidak.", color: "var(--tint-green-bg)" },
            { emoji: "🗂️", title: "Rekap Dasar Input Gaji Web", desc: "Ketika semua KGB bulan TMT dikonfirmasi dalam window 1–15 H-1, sistem otomatis mencatat rekap data. Rekap ini menjadi dasar referensi saat keuangan menginput ke Sistem Gaji Web secara manual.", color: "var(--tint-navy)" },
            { emoji: "📅", title: "Kalender KGB Tahun Berjalan", desc: "Visual 4-kolom: bulan dengan KGB menunggu konfirmasi ditandai ungu, selesai hijau. Klik bulan untuk filter tabel detail di bawahnya.", color: "var(--tint-violet-bg)" },
            { emoji: "📢", title: "Follow Up ke SDM", desc: "Untuk KGB dengan TMT 2 bulan ke depan yang belum dikirim SDM, keuangan bisa kirim notifikasi follow-up. Pesan muncul sebagai banner di dashboard SDM/Admin.", color: "var(--tint-amber-bg)" },
            { emoji: "📋", title: "Riwayat Aktivitas", desc: "Tab terpisah di sidebar: (1) Riwayat KGB per pegawai, klik untuk lihat semua siklus + unduh SK, (2) Log konfirmasi keuangan, (3) Rekap dasar input Gaji Web.", color: "var(--sub)" },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-3.5 rounded-2xl p-3.5" style={{ background: item.color, border: "1px solid rgba(0,0,0,0.05)" }}>
              <span className="text-xl shrink-0">{item.emoji}</span>
              <div>
                <p className="text-xs font-semibold" style={{ color: "var(--dtn)" }}>{item.title}</p>
                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--dt3)" }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-2xl p-4" style={{ background: "var(--tint-amber-bg)", border: "1px solid var(--tint-amber-ln)" }}>
          <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--st-amber2)" }}>⏱ Timeline Masa Rekon</p>
          <div className="space-y-1.5">
            {[
              { t: "H-2 (2 bulan sebelum TMT)", d: "Batas SDM mengirimkan SK ke keuangan. Sistem menampilkan banner peringatan." },
              { t: "H-1 tanggal 1–15", d: "Window rekap. Keuangan konfirmasi KGB, saat semua selesai, rekap dasar input Gaji Web tercatat otomatis di sistem sebagai referensi input manual." },
              { t: "H-1 tanggal 16+", d: "Window rekon tertutup. Auto-rekon tidak aktif, tapi konfirmasi tetap bisa dilakukan." },
            ].map(({ t, d }) => (
              <div key={t} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ background: "#c9a227" }} />
                <p className="text-xs" style={{ color: "var(--st-amber2)" }}><strong>{t}</strong>: {d}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "cek-kgb",
    label: "Portal Cek KGB",
    color: "var(--st-violet)",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
    content: (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed" style={{ color: "var(--dt2)" }}>
          Portal publik di halaman utama aplikasi. Pegawai dapat mengecek status KGB mereka menggunakan NIP, <strong>tanpa perlu login</strong>.
        </p>
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--tint-violet-ln)", boxShadow: "0 2px 12px rgba(124,58,237,0.08)" }}>
          <div className="px-4 py-3" style={{ background: "linear-gradient(135deg,var(--st-violet),var(--st-violet))" }}>
            <p className="text-xs font-semibold text-white">🌐 Informasi yang Ditampilkan ke Pegawai</p>
          </div>
          <div className="p-4 space-y-0">
            {[
              { label: "Identitas", val: "Nama, jabatan, golongan, unit kerja" },
              { label: "TMT KGB Berikutnya", val: "Tanggal berlaku KGB selanjutnya" },
              { label: "Status KGB", val: "Belum / Sedang / Selesai / Ditolak" },
              { label: "Nomor SK", val: "Jika KGB sudah selesai diproses" },
              { label: "Hukdis Aktif", val: "Jenis dan status hukdis (jika ada)" },
              { label: "Flag Rapelan", val: "Jika melewati deadline SDM" },
            ].map((r) => <DataRow key={r.label} label={r.label} value={r.val} />)}
          </div>
        </div>
        <div className="rounded-2xl p-4" style={{ background: "var(--tint-violet-bg)", border: "1px solid var(--tint-violet-ln)" }}>
          <p className="text-xs font-semibold mb-1" style={{ color: "var(--st-violet)" }}>🔗 Cara Akses</p>
          <p className="text-xs leading-relaxed" style={{ color: "var(--st-violet)" }}>
            Buka halaman utama aplikasi → bagian <strong>Cek Status KGB</strong> → masukkan NIP → klik Cek Sekarang.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "faq",
    label: "FAQ",
    color: "var(--st-green)",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    content: (
      <div className="space-y-3">
        {[
          { q: "Kenapa TMT KGB pegawai bergeser otomatis?", a: "Karena ada hukdis jenis Penundaan KGB aktif. Sesuai PP 53/2010, TMT digeser +12 bulan otomatis saat hukdis dicatat." },
          { q: "Apa bedanya Rapelan dan Deadline terlewat?", a: "Sama. KGB disebut rapelan ketika deadline SDM sudah lewat tapi SK belum diterbitkan. Gaji tetap naik tapi dibayar mundur dari TMT berlaku." },
          { q: "Bagaimana jika SK hukdis keliru dicatat?", a: "Hapus catatan hukdis dari tab Hukdis di halaman Riwayat Pegawai. Sistem otomatis pulihkan TMT KGB ke posisi semula dan buka blokir KGB." },
          { q: "Kenapa MKG bertambah +3 setelah penundaan KGB?", a: "PP 53/2010: masa penundaan dihitung penuh. Penundaan 1 tahun + interval normal 2 tahun = 3 tahun masa kerja terhitung." },
          { q: "Apakah hukdis jenis lain memblokir KGB?", a: "Tidak. Hanya Penundaan KGB yang memblokir dan menggeser TMT di sistem ini." },
          { q: "Bagaimana cara generate SK KGB?", a: "Buka Data KGB → klik pegawai → klik Generate SK di panel detail. SK dibuat dalam format yang bisa dicetak." },
          { q: "Apakah masa CPNS dihitung sebagai MKG?", a: "Ya. Masa percobaan CPNS (12 bulan) dihitung penuh sebagai MKG. Sehingga saat diangkat PNS, MKG sudah 1 tahun." },
          { q: "Apa beda KGB pertama CPNS Gol II dan Gol III?", a: "Gol II/a (SMA): KGB pertama 1 tahun setelah CPNS (bersamaan PNS), MKG syarat >1 tahun. Gol III/a (S1): KGB pertama 2 tahun setelah CPNS (1 tahun setelah PNS), MKG syarat >2 tahun. Setelah KGB pertama, keduanya interval 2 tahun." },
        ].map((item, i) => (
          <div key={i} className="rounded-2xl p-4" style={{ background: "var(--sub)", border: "1px solid var(--ln1)" }}>
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5" style={{ background: "var(--navy-solid)", color: "#fff" }}>?</div>
              <div>
                <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--dtn)" }}>{item.q}</p>
                <p className="text-xs leading-relaxed" style={{ color: "var(--dt3)" }}>{item.a}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "studi-kasus",
    label: "Studi Kasus",
    color: "#c9a227",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
    content: (
      <div className="space-y-6">
        <div>
          <p className="text-sm leading-relaxed" style={{ color: "var(--dt2)" }}>
            Skenario nyata dari <strong style={{ color: "var(--dtn)" }}>Kantor Wilayah Direktorat Jenderal Pemasyarakatan Kalimantan Selatan</strong>. Setiap kasus menyajikan keadaan awal lengkap, keadaan akhir, dan alur teknis di sistem.
          </p>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="rounded-xl p-3" style={{ background: "var(--tint-amber-bg)", border: "1px solid var(--tint-amber-ln)" }}>
              <p className="text-xs" style={{ color: "var(--st-amber2)" }}>
                <span className="font-semibold">Nilai gaji (±Rp):</span> ilustratif berdasarkan tabel PP 5/2024, nilai aktual sesuai PP berlaku.
              </p>
            </div>
            <div className="rounded-xl p-3" style={{ background: "var(--tint-blue-bg)", border: "1px solid var(--tint-blue-ln)" }}>
              <p className="text-xs" style={{ color: "var(--st-blue)" }}>
                <span className="font-semibold">Alur proses:</span> vertikal di perangkat mobile, horizontal di desktop (geser jika perlu).
              </p>
            </div>
          </div>
        </div>

        {allKasus.map((k) => (
          <StudiKasusCard key={k.num} {...k} />
        ))}
      </div>
    ),
  },
];

/* ---- Kasus relevan per role ---- */
const KASUS_PER_ROLE: Record<string, string[]> = {
  [ROLES.SUPER_ADMIN]: ["01","02","03","04","05","06","07","08"],
  [ROLES.SDM_KGB]:     ["01","02","03","04","05","06","07","08"],
  [ROLES.SDM_HUKDIS]:  ["03","06"],
  [ROLES.KEUANGAN]:    ["02"],
};

/* ---- Seksi per role ---- */
const SEKSI_PER_ROLE: Record<string, string[]> = {
  [ROLES.SUPER_ADMIN]: ["pengantar","dashboard","kgb","pegawai","hukdis","notifikasi","laporan","keuangan","cek-kgb","faq","studi-kasus"],
  [ROLES.SDM_KGB]:     ["pengantar","dashboard","kgb","pegawai","hukdis","notifikasi","laporan","cek-kgb","faq","studi-kasus"],
  [ROLES.SDM_HUKDIS]:  ["pengantar","dashboard","hukdis","pegawai","notifikasi","faq","studi-kasus"],
  [ROLES.KEUANGAN]:    ["pengantar","dashboard","keuangan","notifikasi","faq","studi-kasus"],
};

/* ---- Page ---- */
export default function PanduanPage() {
  const role = useRole();

  const allowedKasus = KASUS_PER_ROLE[role] ?? KASUS_PER_ROLE[ROLES.SUPER_ADMIN];
  const allowedSeksi = SEKSI_PER_ROLE[role] ?? SEKSI_PER_ROLE[ROLES.SUPER_ADMIN];

  const filteredKasus = allKasus.filter((k) => allowedKasus.includes(k.num));

  const visibleSections = sections
    .filter((s) => allowedSeksi.includes(s.id))
    .map((s) => {
      if (s.id !== "studi-kasus") return s;
      return {
        ...s,
        content: (
          <div className="space-y-6">
            <div>
              <p className="text-sm leading-relaxed" style={{ color: "var(--dt2)" }}>
                Skenario relevan dari <strong style={{ color: "var(--dtn)" }}>Kantor Wilayah Direktorat Jenderal Pemasyarakatan Kalimantan Selatan</strong> sesuai peran Anda.
              </p>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="rounded-xl p-3" style={{ background: "var(--tint-amber-bg)", border: "1px solid var(--tint-amber-ln)" }}>
                  <p className="text-xs" style={{ color: "var(--st-amber2)" }}>
                    <span className="font-semibold">Nilai gaji (+-Rp):</span> ilustratif berdasarkan tabel PP 5/2024, nilai aktual sesuai PP berlaku.
                  </p>
                </div>
                <div className="rounded-xl p-3" style={{ background: "var(--tint-blue-bg)", border: "1px solid var(--tint-blue-ln)" }}>
                  <p className="text-xs" style={{ color: "var(--st-blue)" }}>
                    <span className="font-semibold">Alur proses:</span> vertikal di perangkat mobile, horizontal di desktop (geser jika perlu).
                  </p>
                </div>
              </div>
            </div>
            {filteredKasus.map((k) => (
              <StudiKasusCard key={k.num} {...k} />
            ))}
          </div>
        ),
      };
    });

  const defaultId = visibleSections[0]?.id ?? "pengantar";
  const [active, setActive] = useState(defaultId);

  const safeActive = visibleSections.some((s) => s.id === active) ? active : defaultId;
  const current = visibleSections.find((s) => s.id === safeActive)!;
  const idx = visibleSections.findIndex((s) => s.id === safeActive);

  return (
    <div className="flex gap-5 h-full">
      <aside
        className="w-52 shrink-0 self-start sticky top-0 rounded-2xl overflow-hidden hidden md:block"
        style={{ background: "var(--card)", border: "1px solid var(--ln1)", boxShadow: "0 4px 20px rgba(26,58,92,0.07)" }}
      >
        <div className="px-4 py-3.5 flex items-center gap-2.5" style={{ background: "linear-gradient(135deg,#0f2744,#1a3a5c)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(201,162,39,0.2)", border: "1px solid rgba(201,162,39,0.3)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c9a227" strokeWidth="2">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold" style={{ color: "#fff" }}>Buku Panduan</p>
            <p className="text-xs" style={{ color: "#7aa3c8", fontSize: "10px" }}>{visibleSections.length} topik</p>
          </div>
        </div>
        <nav className="py-2">
          {visibleSections.map((s) => {
            const isActive = safeActive === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-left text-xs transition-all"
                style={{
                  background: isActive ? tone(s.color).soft : "transparent",
                  borderLeft: isActive ? `3px solid ${s.color}` : "3px solid transparent",
                  color: isActive ? s.color : "var(--dt3)",
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                <span className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: isActive ? tone(s.color).grad : "var(--sub)", color: isActive ? "#fff" : "var(--dt5)" }}>
                  {s.icon}
                </span>
                {s.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 min-w-0 space-y-4">
        <div
          className="rounded-2xl p-5 flex items-center gap-4"
          style={{ background: tone(current.color).grad, boxShadow: `0 8px 32px ${tone(current.color).shadow}` }}
        >
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.18)", backdropFilter: "blur(4px)" }}>
            <span style={{ color: "#fff", transform: "scale(1.4)", display: "block" }}>{current.icon}</span>
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium mb-0.5" style={{ color: "rgba(255,255,255,0.7)" }}>{idx + 1} / {visibleSections.length}</p>
            <h2 className="text-base font-bold" style={{ color: "#fff" }}>{current.label}</h2>
          </div>
        </div>

        <div className="flex gap-1.5 flex-wrap md:hidden">
          {visibleSections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className="text-xs px-3 py-1.5 rounded-xl font-medium transition"
              style={{ background: safeActive === s.id ? tone(s.color).grad : "var(--sub)", color: safeActive === s.id ? "#fff" : "var(--dt3)", border: safeActive === s.id ? "1px solid transparent" : "1px solid var(--ln1)" }}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="rounded-2xl p-5" style={{ background: "var(--card)", border: "1px solid var(--ln1)", boxShadow: "0 2px 16px rgba(26,58,92,0.05)" }}>
          {current.content}
        </div>

        <div className="flex items-center justify-between pt-1">
          {idx > 0 ? (
            <button
              onClick={() => setActive(visibleSections[idx - 1].id)}
              className="flex items-center gap-2 text-xs px-4 py-2.5 rounded-xl font-medium transition hover:opacity-80"
              style={{ background: "var(--card)", color: "var(--dt3)", border: "1px solid var(--ln1)", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
              {visibleSections[idx - 1].label}
            </button>
          ) : <div />}

          {idx < visibleSections.length - 1 && (
            <button
              onClick={() => setActive(visibleSections[idx + 1].id)}
              className="flex items-center gap-2 text-xs px-4 py-2.5 rounded-xl font-semibold transition hover:opacity-90"
              style={{ background: tone(visibleSections[idx + 1].color).grad, color: "#fff", boxShadow: `0 4px 14px ${tone(visibleSections[idx + 1].color).shadow}` }}
            >
              {visibleSections[idx + 1].label}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
