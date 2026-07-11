import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Aplikasi ini hampir seluruhnya dinamis (terproteksi auth), jadi incremental
// cache (ISR) tidak dipakai — konfigurasi default cukup. Bila nanti ada ISR,
// tambahkan overrides incrementalCache (mis. r2IncrementalCache).
export default defineCloudflareConfig();
