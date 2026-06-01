import { z } from "zod";

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  PORT: z.coerce.number().int().positive().default(4000)
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse({ ...readLocalEnvFiles(), ...source });
}

function readLocalEnvFiles() {
  return [resolve(process.cwd(), ".env"), resolve(process.cwd(), "apps/server/.env")]
    .filter((path) => existsSync(path))
    .reduce<Record<string, string>>((env, path) => ({ ...env, ...parseEnvFile(path) }), {});
}

function parseEnvFile(path: string) {
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .reduce<Record<string, string>>((env, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return env;
      const separator = trimmed.indexOf("=");
      if (separator === -1) return env;
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
      env[key] = value;
      return env;
    }, {});
}
