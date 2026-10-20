#!/usr/bin/env node

/**
 * resolve-paths.mjs — Shared path resolution for career-ops
 *
 * Resolves two roots:
 *   pluginRoot — where system files live (modes, templates, scripts, fonts)
 *   workspace  — where user data lives (cv.md, data/, reports/, output/)
 *
 * All other career-ops scripts import this module to locate files portably,
 * whether running inside a clone or as a Claude Code plugin with a separate
 * workspace directory.
 */

import { existsSync, readFileSync } from 'fs';
import { join, dirname, resolve, parse as parsePath } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── findWorkspace ──────────────────────────────────────────────────

/**
 * Walk up from `startDir` looking for a `.career-ops.json` marker file.
 * Returns the directory containing the marker, or null if not found.
 */
export function findWorkspace(startDir) {
  let dir;
  try {
    dir = resolve(startDir);
  } catch {
    return null;
  }

  // Guard against non-existent start directory
  if (!existsSync(dir)) return null;

  const { root } = parsePath(dir);

  while (true) {
    if (existsSync(join(dir, '.career-ops.json'))) {
      return dir;
    }
    // Reached filesystem root without finding marker
    if (dir === root) return null;
    dir = dirname(dir);
  }
}

// ── resolvePluginRoot ──────────────────────────────────────────────

function resolvePluginRoot(opts) {
  // 1. Explicit option
  if (opts.pluginRoot) return opts.pluginRoot;

  // 2. Env var
  if (process.env.CLAUDE_PLUGIN_ROOT) return process.env.CLAUDE_PLUGIN_ROOT;

  // 3. CLI arg --plugin-root
  const idx = process.argv.indexOf('--plugin-root');
  if (idx !== -1 && process.argv[idx + 1]) return resolve(process.argv[idx + 1]);

  // 4. Default: parent of the scripts/ directory this file lives in
  return dirname(__dirname);
}

// ── resolveWorkspace ───────────────────────────────────────────────

function resolveWorkspace(opts) {
  // Allow explicit null to force no workspace
  if (opts.workspace === null) return null;

  // 1. Explicit option
  if (opts.workspace) return opts.workspace;

  // 2. CLI arg --workspace
  const wsIdx = process.argv.indexOf('--workspace');
  if (wsIdx !== -1 && process.argv[wsIdx + 1]) return resolve(process.argv[wsIdx + 1]);

  // 3. Env var
  if (process.env.CAREER_OPS_WORKSPACE) return process.env.CAREER_OPS_WORKSPACE;

  // 4. Walk up from cwd (or opts.cwd) looking for .career-ops.json
  const startDir = opts.cwd || process.cwd();
  const found = findWorkspace(startDir);
  if (found) return found;

  // 5. Global config: ~/.config/career-ops/config.json → dataDir
  try {
    const globalConfig = join(homedir(), '.config', 'career-ops', 'config.json');
    if (existsSync(globalConfig)) {
      const cfg = JSON.parse(readFileSync(globalConfig, 'utf8'));
      if (cfg.dataDir && existsSync(cfg.dataDir)) return cfg.dataDir;
    }
  } catch {
    // Ignore parse errors in global config
  }

  return null;
}

// ── resolvePaths ───────────────────────────────────────────────────

/**
 * Returns an object with all resolved paths for career-ops.
 *
 * opts.pluginRoot — override pluginRoot detection
 * opts.workspace  — override workspace detection (null = no workspace)
 * opts.cwd        — override cwd for workspace walk-up search
 */
export function resolvePaths(opts = {}) {
  const pluginRoot = resolvePluginRoot(opts);
  const workspace = resolveWorkspace(opts);

  // Helper: join against workspace, return null if workspace is null
  const ws = (...segments) => workspace ? join(workspace, ...segments) : null;

  return {
    // Roots
    pluginRoot,
    workspace,

    // Workspace-relative (user data)
    cv:                ws('cv.md'),
    profile:           ws('config', 'profile.yml'),
    profileMd:         ws('modes', '_profile.md'),
    portals:           ws('portals.yml'),
    articleDigest:     ws('article-digest.md'),
    storyBank:         ws('interview-prep', 'story-bank.md'),
    applications:      ws('data', 'applications.md'),
    pipeline:          ws('data', 'pipeline.md'),
    scanHistory:       ws('data', 'scan-history.tsv'),
    reports:           ws('reports'),
    output:            ws('output'),
    jds:               ws('jds'),
    trackerAdditions:  ws('batch', 'tracker-additions'),
    batchLogs:         ws('batch', 'logs'),
    data:              ws('data'),

    // Plugin-relative (system files)
    modes:             join(pluginRoot, 'modes'),
    shared:            join(pluginRoot, 'modes', '_shared.md'),
    templates:         join(pluginRoot, 'templates'),
    states:            join(pluginRoot, 'templates', 'states.yml'),
    cvTemplate:        join(pluginRoot, 'templates', 'cv-template.html'),
    portalsExample:    join(pluginRoot, 'templates', 'portals.example.yml'),
    profileExample:    join(pluginRoot, 'config', 'profile.example.yml'),
    fonts:             join(pluginRoot, 'fonts'),
    scripts:           join(pluginRoot, 'scripts'),
    batchPrompt:       join(pluginRoot, 'batch', 'batch-prompt.md'),
    batchRunner:       join(pluginRoot, 'batch', 'batch-runner.sh'),
    examples:          join(pluginRoot, 'examples'),
  };
}
