#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Standard Semantic Versioning Bumper
 * Usage: ./scripts/bump-version.mjs 0.2.0
 */

const version = process.argv[2];

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('❌ Error: Please provide a valid SemVer version (e.g. 0.2.0)');
  process.exit(1);
}

const TAG = `v${version}`;
console.log(`🔧 Bumping to version ${version} (Tag: ${TAG})...`);

// Helper to read/write JSON
const updateJSON = (filePath, updater) => {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) return;
  const content = JSON.parse(fs.readFileSync(abs, 'utf-8'));
  updater(content);
  fs.writeFileSync(abs, JSON.stringify(content, null, 2) + '\n');
};

// Update package.json
updateJSON('package.json', json => {
  json.version = version;
});

try {
  execSync('git add package.json scripts/bump-version.mjs');
  const status = execSync('git status --porcelain').toString().trim();
  if (status) {
    execSync(`git commit -m "chore: bump version to ${version} 🚀"`);
  }
  
  // Create tag with v prefix
  execSync(`git tag -a -f ${TAG} -m "Release ${TAG}"`);
  
  const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  
  console.log(`📡 Pushing to origin ${branch} and tag ${TAG}...`);
  execSync(`git push origin ${branch} --force`);
  execSync(`git push origin ${TAG} --force`);

  console.log(`🚀 Version ${version} committed, tagged as ${TAG}, and pushed.`);
} catch (error) {
  console.error('❌ Error during bump:', error.message);
  process.exit(1);
}
