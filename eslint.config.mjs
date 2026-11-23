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
    // Skills instaladas para Claude Code: no son código del proyecto
    ".claude/**",
  ]),
  // Variables que se ignoran a propósito: las que empiezan con _ y las que se separan con ...resto
  {
    rules: { "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true }] },
  },
  // Fotos subidas por el taller (tamaños variables, URL de R2 o /uploads): se usan <img> a propósito, no next/image
  {
    rules: { "@next/next/no-img-element": "off" },
  },
  // Archivos de Node que se ejecutan sueltos (PM2, semillas de datos): ahí require() es lo normal
  {
    files: ["deploy/**/*.cjs", "prisma/seed.ts", "seed-categories.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
]);

export default eslintConfig;
