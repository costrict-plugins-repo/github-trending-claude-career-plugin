#!/usr/bin/env node

/**
 * session-start.mjs — Career-Ops Session Start Hook
 *
 * Runs at every Claude Code session start (via hooks/hooks.json).
 * Detects whether a career-ops workspace is available and outputs
 * structured JSON so the command router can skip per-invocation detection.
 *
 * Detection order:
 *   1. Walk up from cwd looking for .career-ops.json marker file
 *   2. Fall back to ~/.config/career-ops/config.json → dataDir
 *
 * Output (stdout, JSON):
 *   { career_ops: { workspace, pluginRoot, version, status: "ready" } }
 *   { career_ops: { status: "no-workspace", hint: "..." } }
 */

import { existsSync, readFileSync } from 'fs';
import { join, dirname, resolve, parse as parsePath } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
// hooks/ is one level inside the plugin root, so pluginRoot = dirname(dirname(...))
const pluginRoot = dirname(dirname(__filename));

// ── Walk up from startDir looking for .career-ops.json ────────────────

function findWorkspace(startDir) {
  let dir;
  try {
    dir = resolve(startDir);
  } catch {
    return null;
  }

  if (!existsSync(dir)) return null;

  const { root } = parsePath(dir);

  while (true) {
    if (existsSync(join(dir, '.career-ops.json'))) {
      return dir;
    }
    if (dir === root) return null;
    dir = dirname(dir);
  }
}

// ── Main ───────────────────────────────────────────────────────────────

function main() {
  // 1. Walk up from cwd
  let workspace = findWorkspace(process.cwd());

  // 2. Fall back to global config
  if (!workspace) {
    try {
      const globalConfig = join(homedir(), '.config', 'career-ops', 'config.json');
      if (existsSync(globalConfig)) {
        const cfg = JSON.parse(readFileSync(globalConfig, 'utf8'));
        if (cfg.dataDir && existsSync(cfg.dataDir)) {
          workspace = cfg.dataDir;
        }
      }
    } catch {
      // Ignore parse errors in global config
    }
  }

  if (!workspace) {
    process.stdout.write(JSON.stringify({
      career_ops: {
        status: 'no-workspace',
        hint: 'Run /career-ops init to set up a workspace',
      },
    }) + '\n');
    return;
  }

  // Read version from .career-ops.json (if present)
  let version = null;
  try {
    const markerPath = join(workspace, '.career-ops.json');
    if (existsSync(markerPath)) {
      const marker = JSON.parse(readFileSync(markerPath, 'utf8'));
      version = marker.version || null;
    }
  } catch {
    // Version is optional — don't fail
  }

  process.stdout.write(JSON.stringify({
    career_ops: {
      workspace,
      pluginRoot,
      version,
      status: 'ready',
    },
  }) + '\n');
}

main();
