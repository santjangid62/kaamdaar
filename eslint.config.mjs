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
    // local data + the OpenNext build workspace (huge, own node_modules):
    ".data/**",
    ".wrangler/**",
    ".open-next/**",
    "freebuff-sites-build/**",
    "freebuff.open-next.config.ts",
    ".seed-demo.js",
    "tsconfig.tsbuildinfo",
  ]),
]);

export default eslintConfig;
