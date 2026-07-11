import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Artefak build OpenNext/Cloudflare (kode hasil generate, bukan source):
    ".open-next/**",
    ".wrangler/**",
    "cloudflare-env.d.ts",
    "open-next.config.ts",
  ]),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern:   "^_",
        varsIgnorePattern:   "^_",
        ignoreRestSiblings:  true,
      }],
    },
  },
]);

export default eslintConfig;
