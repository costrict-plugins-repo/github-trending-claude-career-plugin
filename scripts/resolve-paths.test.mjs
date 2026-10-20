#!/usr/bin/env node

/**
 * resolve-paths.test.mjs — Tests for resolve-paths.mjs
 * Run: node scripts/resolve-paths.test.mjs
 */

import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { findWorkspace, resolvePaths } from './resolve-paths.mjs';

// ── Minimal test runner ────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual === expected) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}`);
    console.error(`    expected: ${JSON.stringify(expected)}`);
    console.error(`    actual:   ${JSON.stringify(actual)}`);
  }
}

// ── Setup temp directory ───────────────────────────────────────────

const tmpBase = join(tmpdir(), `resolve-paths-test-${Date.now()}`);
const wsDir = join(tmpBase, 'my-workspace');
const subDir = join(wsDir, 'deep', 'nested');
const emptyDir = join(tmpBase, 'no-marker');

mkdirSync(subDir, { recursive: true });
mkdirSync(emptyDir, { recursive: true });
writeFileSync(join(wsDir, '.career-ops.json'), JSON.stringify({ version: 1 }));

// ── Tests ──────────────────────────────────────────────────────────

console.log('\nresolve-paths.mjs tests');
console.log('========================\n');

// -- findWorkspace --

console.log('findWorkspace:');

{
  const result = findWorkspace(wsDir);
  assertEqual(result, wsDir, 'finds marker in the dir itself');
}

{
  const result = findWorkspace(subDir);
  assertEqual(result, wsDir, 'finds marker from a nested subdirectory');
}

{
  const result = findWorkspace(emptyDir);
  assertEqual(result, null, 'returns null when no marker exists');
}

{
  const result = findWorkspace(join(tmpBase, 'nonexistent'));
  assertEqual(result, null, 'returns null for a nonexistent directory');
}

// -- resolvePaths: pluginRoot --

console.log('\nresolvePaths (pluginRoot):');

{
  const paths = resolvePaths();
  assert(paths.pluginRoot != null, 'pluginRoot is set by default (parent of scripts/)');
  assert(existsSync(paths.pluginRoot), 'pluginRoot directory exists');
}

{
  const paths = resolvePaths({ pluginRoot: '/tmp/fake-plugin' });
  assertEqual(paths.pluginRoot, '/tmp/fake-plugin', 'pluginRoot can be overridden via opts');
}

// -- resolvePaths: workspace --

console.log('\nresolvePaths (workspace):');

{
  const paths = resolvePaths({ workspace: wsDir });
  assertEqual(paths.workspace, wsDir, 'workspace is set when passed via opts');
}

{
  // Simulate finding workspace via env
  const origEnv = process.env.CAREER_OPS_WORKSPACE;
  process.env.CAREER_OPS_WORKSPACE = wsDir;
  const paths = resolvePaths({});
  assertEqual(paths.workspace, wsDir, 'workspace found via CAREER_OPS_WORKSPACE env');
  if (origEnv === undefined) {
    delete process.env.CAREER_OPS_WORKSPACE;
  } else {
    process.env.CAREER_OPS_WORKSPACE = origEnv;
  }
}

{
  // No workspace set, no env, no marker in cwd parent chain
  const origEnv = process.env.CAREER_OPS_WORKSPACE;
  delete process.env.CAREER_OPS_WORKSPACE;
  const paths = resolvePaths({ workspace: null, cwd: emptyDir });
  assertEqual(paths.workspace, null, 'workspace is null when nothing found');
  if (origEnv !== undefined) {
    process.env.CAREER_OPS_WORKSPACE = origEnv;
  }
}

// -- resolvePaths: workspace-relative paths --

console.log('\nresolvePaths (workspace-relative paths):');

{
  const paths = resolvePaths({ workspace: wsDir });
  assertEqual(paths.cv, join(wsDir, 'cv.md'), 'cv path is workspace-relative');
  assertEqual(paths.profile, join(wsDir, 'config', 'profile.yml'), 'profile path');
  assertEqual(paths.profileMd, join(wsDir, 'modes', '_profile.md'), 'profileMd path');
  assertEqual(paths.portals, join(wsDir, 'portals.yml'), 'portals path');
  assertEqual(paths.articleDigest, join(wsDir, 'article-digest.md'), 'articleDigest path');
  assertEqual(paths.storyBank, join(wsDir, 'interview-prep', 'story-bank.md'), 'storyBank path');
  assertEqual(paths.applications, join(wsDir, 'data', 'applications.md'), 'applications path');
  assertEqual(paths.pipeline, join(wsDir, 'data', 'pipeline.md'), 'pipeline path');
  assertEqual(paths.scanHistory, join(wsDir, 'data', 'scan-history.tsv'), 'scanHistory path');
  assertEqual(paths.reports, join(wsDir, 'reports'), 'reports path');
  assertEqual(paths.output, join(wsDir, 'output'), 'output path');
  assertEqual(paths.jds, join(wsDir, 'jds'), 'jds path');
  assertEqual(paths.trackerAdditions, join(wsDir, 'batch', 'tracker-additions'), 'trackerAdditions path');
  assertEqual(paths.batchLogs, join(wsDir, 'batch', 'logs'), 'batchLogs path');
  assertEqual(paths.data, join(wsDir, 'data'), 'data path');
}

{
  const paths = resolvePaths({ workspace: null, cwd: emptyDir });
  assertEqual(paths.cv, null, 'cv is null when workspace is null');
  assertEqual(paths.applications, null, 'applications is null when workspace is null');
  assertEqual(paths.reports, null, 'reports is null when workspace is null');
  assertEqual(paths.data, null, 'data is null when workspace is null');
}

// -- resolvePaths: plugin-relative paths --

console.log('\nresolvePaths (plugin-relative paths):');

{
  const fakePlugin = '/tmp/fake-plugin';
  const paths = resolvePaths({ pluginRoot: fakePlugin, workspace: wsDir });
  assertEqual(paths.modes, join(fakePlugin, 'modes'), 'modes path');
  assertEqual(paths.shared, join(fakePlugin, 'modes', '_shared.md'), 'shared path');
  assertEqual(paths.templates, join(fakePlugin, 'templates'), 'templates path');
  assertEqual(paths.states, join(fakePlugin, 'templates', 'states.yml'), 'states path');
  assertEqual(paths.cvTemplate, join(fakePlugin, 'templates', 'cv-template.html'), 'cvTemplate path');
  assertEqual(paths.portalsExample, join(fakePlugin, 'templates', 'portals.example.yml'), 'portalsExample path');
  assertEqual(paths.profileExample, join(fakePlugin, 'config', 'profile.example.yml'), 'profileExample path');
  assertEqual(paths.fonts, join(fakePlugin, 'fonts'), 'fonts path');
  assertEqual(paths.scripts, join(fakePlugin, 'scripts'), 'scripts path');
  assertEqual(paths.batchPrompt, join(fakePlugin, 'batch', 'batch-prompt.md'), 'batchPrompt path');
  assertEqual(paths.batchRunner, join(fakePlugin, 'batch', 'batch-runner.sh'), 'batchRunner path');
  assertEqual(paths.examples, join(fakePlugin, 'examples'), 'examples path');
}

// -- resolvePaths: all expected keys present --

console.log('\nresolvePaths (completeness):');

{
  const paths = resolvePaths({ pluginRoot: '/tmp/p', workspace: '/tmp/w' });
  const workspaceKeys = [
    'cv', 'profile', 'profileMd', 'portals', 'articleDigest', 'storyBank',
    'applications', 'pipeline', 'scanHistory', 'reports', 'output', 'jds',
    'trackerAdditions', 'batchLogs', 'data',
  ];
  const pluginKeys = [
    'modes', 'shared', 'templates', 'states', 'cvTemplate',
    'portalsExample', 'profileExample', 'fonts', 'scripts',
    'batchPrompt', 'batchRunner', 'examples',
  ];
  const rootKeys = ['pluginRoot', 'workspace'];
  const allKeys = [...rootKeys, ...workspaceKeys, ...pluginKeys];

  for (const key of allKeys) {
    assert(key in paths, `key "${key}" is present`);
  }
  assertEqual(Object.keys(paths).length, allKeys.length, `exactly ${allKeys.length} keys (no extras)`);
}

// ── Cleanup ────────────────────────────────────────────────────────

rmSync(tmpBase, { recursive: true, force: true });
assert(!existsSync(tmpBase), 'temp directory cleaned up');

// ── Summary ────────────────────────────────────────────────────────

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
