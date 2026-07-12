// Generator ID untuk record baru (pengganti Prisma @default(cuid())).
// crypto.randomUUID tersedia di Node 18+ dan Cloudflare Workers.

export function newId(): string {
  return crypto.randomUUID();
}
