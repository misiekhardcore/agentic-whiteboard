/* global process */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseEnv } from "node:util";

/**
 * The environment files Next reads, lowest priority first. `.env.local` is the
 * machine's own copy, so Next skips it under test and so do we.
 */
function environmentFiles(nodeEnv) {
  const files = [".env"];
  if (nodeEnv !== undefined && nodeEnv.length > 0) files.push(`.env.${nodeEnv}`);
  if (nodeEnv !== "test") files.push(".env.local");
  if (nodeEnv !== undefined && nodeEnv.length > 0) files.push(`.env.${nodeEnv}.local`);
  return files;
}

/**
 * Loads the repository's environment files into `env`, using the same layering
 * and precedence as Next: `.env`, `.env.<NODE_ENV>`, `.env.local`,
 * `.env.<NODE_ENV>.local`, with a variable the environment already exports
 * winning over every file. Missing files are not an error, so a deployment that
 * injects its environment needs no file.
 */
export function loadEnvironment(directory, options = {}) {
  const env = options.env ?? process.env;
  const nodeEnv = options.nodeEnv ?? env.NODE_ENV;
  const values = new Map();

  for (const name of environmentFiles(nodeEnv)) {
    let text;

    try {
      text = readFileSync(join(directory, name), "utf8");
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }

    for (const [key, value] of Object.entries(parseEnv(text))) {
      values.set(key, value);
    }
  }

  for (const [key, value] of values) {
    if (env[key] === undefined) env[key] = value;
  }
}
