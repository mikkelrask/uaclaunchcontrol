#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const version = process.argv[2];

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('Usage: bump-version.mjs <version> (e.g. 1.2.3)');
  process.exit(1);
}

const TAG = `v${version}`;
console.log(`🔧 Bumping to version ${version} (${TAG})...`);

// Helper to read/write JSON
const updateJSON = (filePath, updater) => {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    console.warn(`⚠️ File ${filePath} not found, skipping.`);
    return;
  }
  const content = JSON.parse(fs.readFileSync(abs, 'utf-8'));
  updater(content);
  fs.writeFileSync(abs, JSON.stringify(content, null, 2) + '\n');
};

// Update root package.json
updateJSON('package.json', json => {
  json.version = version;
});

console.log('✅ Updated package.json version field');

// Commit & tag
try {
  execSync('git add package.json');
  execSync(`git commit -m "chore: bump version to v${version}"`);
  execSync(`git tag ${TAG}`);
  
  // Get current branch
  const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  
  execSync(`git push origin ${branch}`);
  execSync(`git push origin ${TAG}`);

  console.log(`🚀 Version ${version} committed, tagged, and pushed to ${branch}.`);
} catch (error) {
  console.error('❌ Failed to commit/tag/push:', error.message);
  process.exit(1);
}
