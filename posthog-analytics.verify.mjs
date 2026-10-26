#!/usr/bin/env node
/**
 * Offline verification runner for the PostHog instrumentation.
 *
 *   node posthog-analytics.verify.mjs
 *
 * Runs `posthog-analytics.test.mjs` with Node's built-in test runner (the
 * project's existing toolchain — nothing extra is installed), `shell: false`,
 * a bounded timeout and a minimal child environment: OS/path/temp values plus a
 * fixed synthetic project token/host. Environment files and framework autoload
 * cannot leak in, because the child does not inherit `process.env`. No data is
 * sent anywhere: the suite injects an in-memory transport.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const TEST_FILE = "posthog-analytics.test.mjs";
const TIMEOUT_MS = 120_000;
const MIN_ASSERTIONS = 60;

function fail(message, detail = "") {
  process.stderr.write(`FAIL: ${message}\n`);
  if (detail) process.stderr.write(`${detail}\n`);
  process.exit(1);
}

if (!existsSync(join(root, TEST_FILE))) {
  fail(`missing tests: ${TEST_FILE} not found next to this runner`);
}
if (!process.execPath) {
  fail("missing runner: no Node.js executable available");
}

/** Minimal, non-inherited environment: no dotenv, no framework autoload. */
const childEnv = {
  PATH: process.env.PATH ?? "",
  Path: process.env.Path ?? process.env.PATH ?? "",
  PATHEXT: process.env.PATHEXT ?? "",
  SystemRoot: process.env.SystemRoot ?? "",
  SYSTEMROOT: process.env.SYSTEMROOT ?? process.env.SystemRoot ?? "",
  windir: process.env.windir ?? "",
  TEMP: process.env.TEMP ?? "",
  TMP: process.env.TMP ?? "",
  TMPDIR: process.env.TMPDIR ?? "",
  HOME: process.env.HOME ?? process.env.USERPROFILE ?? "",
  USERPROFILE: process.env.USERPROFILE ?? "",
  NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: "synthetic-project-token-offline-verification",
  NEXT_PUBLIC_POSTHOG_HOST: "https://us.i.posthog.com",
};

const result = spawnSync(
  process.execPath,
  ["--test", "--test-reporter=tap", TEST_FILE],
  {
    cwd: root,
    env: childEnv,
    shell: false,
    timeout: TIMEOUT_MS,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  },
);

if (result.error) {
  fail(
    `runner failed to start or timed out: ${result.error.message}`,
    result.error.stack ?? "",
  );
}
if (result.signal) {
  fail(`tests were killed by ${result.signal}`);
}

const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;

if (result.status !== 0) {
  fail(`tests failed (exit ${result.status})`, output);
}

const passCount = Number((output.match(/^# pass (\d+)$/m) ?? [])[1] ?? 0);
const failCount = Number((output.match(/^# fail (\d+)$/m) ?? [])[1] ?? 0);
const assertionCount = Number((output.match(/^# assertions: (\d+)$/m) ?? [])[1] ?? 0);

if (!Number.isFinite(passCount) || passCount < 1) {
  fail("no tests ran", output);
}
if (failCount !== 0) {
  fail(`${failCount} test(s) failed`, output);
}
if (!assertionCount || assertionCount < MIN_ASSERTIONS) {
  fail(
    `zero or too few assertions (${assertionCount || 0}, expected >= ${MIN_ASSERTIONS})`,
    output,
  );
}

process.stdout.write(
  [
    "PASS posthog analytics offline verification",
    `  runner: ${process.execPath} --test --test-reporter=tap ${TEST_FILE} (shell: false)`,
    `  tests: ${passCount} passed, ${failCount} failed, ${assertionCount} assertions`,
    "  transport: in-memory client, network denied, synthetic token only",
    "",
  ].join("\n"),
);
