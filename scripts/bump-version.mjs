#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const rawVersion = process.argv[2];

if (!rawVersion) {
  console.error('Usage: bump-version.mjs <version> (e.g. 0.2.0 or E1M0.2)');
  process.exit(1);
}

// No more mapping! Use what the user says.
const semver = rawVersion;
const TAG = rawVersion;

console.log(`🔧 Bumping to version ${semver} (Tag: ${TAG})...`);

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
  json.version = semver;
});

console.log('✅ Updated package.json version field');

// Commit & tag
try {
  execSync('git add package.json scripts/bump-version.mjs');
  // Check if there are changes to commit
  const status = execSync('git status --porcelain').toString().trim();
  if (status) {
    execSync(`git commit -m "chore: bump version to ${TAG} 🚀"`);
  }
  
  execSync(`git tag -a -f ${TAG} -m "Release ${TAG}"`);
  
  // Get current branch
  const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  
  console.log(`📡 Pushing to origin ${branch} and tag ${TAG}...`);
  execSync(`git push origin ${branch} --force`);
  execSync(`git push origin ${TAG} --force`);

  console.log(`🚀 Version ${TAG} committed, tagged, and pushed.`);
} catch (error) {
  console.error('❌ Failed to commit/tag/push:', error.message);
  process.exit(1);
}
