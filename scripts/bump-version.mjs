#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const rawVersion = process.argv[2];

if (!rawVersion) {
  console.error('Usage: bump-version.mjs <version> (e.g. 0.2.0 or E1M0.2)');
  process.exit(1);
}

// Map Doom-style version to technical semver for OS compatibility
// E1M0.2 -> 0.2.0 (Episode 1, Milestone 0.2)
let semver = rawVersion;
if (rawVersion.startsWith('E1M')) {
  const parts = rawVersion.replace('E1M', '').split('.');
  if (parts.length === 1) semver = `${parts[0]}.0.0`;
  else if (parts.length === 2) semver = `${parts[0]}.${parts[1]}.0`;
}

// Ensure technical semver is strictly digits for macOS
if (!/^\d+\.\d+\.\d+$/.test(semver)) {
  semver = '0.0.0';
}

const TAG = rawVersion;
console.log(`🔧 Bumping to technical version ${semver} for Tag: ${TAG}...`);

// Helper to read/write JSON
const updateJSON = (filePath, updater) => {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) return;
  const content = JSON.parse(fs.readFileSync(abs, 'utf-8'));
  updater(content);
  fs.writeFileSync(abs, JSON.stringify(content, null, 2) + '\n');
};

updateJSON('package.json', json => {
  json.version = semver;
});

try {
  execSync('git add package.json scripts/bump-version.mjs');
  const status = execSync('git status --porcelain').toString().trim();
  if (status) {
    execSync(`git commit -m "chore: bump to technical v${semver} for release ${TAG} 🚀"`);
  }
  
  execSync(`git tag -a -f ${TAG} -m "Release ${TAG}"`);
  const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  
  execSync(`git push origin ${branch} --force`);
  execSync(`git push origin ${TAG} --force`);

  console.log(`🚀 Release ${TAG} (Technical: ${semver}) pushed.`);
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
