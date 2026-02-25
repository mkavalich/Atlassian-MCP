#!/usr/bin/env node
/**
 * Package Atlassian skills as ZIP files for Claude Desktop upload.
 *
 * Usage: npm run package:skills
 * Output: dist/skills/*.zip
 */

import { execSync } from 'child_process';
import { readdirSync, mkdirSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const skillsDir = join(rootDir, '.claude', 'skills');
const outputDir = join(rootDir, 'dist', 'skills');

// Only package Atlassian-related skills
const atlassianSkills = [
  'atlassian-project-setup',
  'confluence-space-health-audit',
  'confluence-template-library-builder',
  'jpd-prioritization-review',
  'sprint-health-reporter',
  'jpd-idea-to-delivery'
];

// Ensure output directory exists
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

console.log('Packaging Atlassian skills for Claude Desktop...\n');

let packaged = 0;
for (const skill of atlassianSkills) {
  const skillPath = join(skillsDir, skill);

  if (!existsSync(skillPath) || !statSync(skillPath).isDirectory()) {
    console.log(`⚠ Skipping ${skill} (not found)`);
    continue;
  }

  const zipPath = join(outputDir, `${skill}.zip`);

  try {
    // Use PowerShell's Compress-Archive on Windows, zip on Unix
    if (process.platform === 'win32') {
      execSync(
        `powershell -Command "Compress-Archive -Path '${skillPath}\\*' -DestinationPath '${zipPath}' -Force"`,
        { stdio: 'pipe' }
      );
    } else {
      execSync(`cd "${skillsDir}" && zip -r "${zipPath}" "${skill}"`, { stdio: 'pipe' });
    }
    console.log(`✓ ${skill}.zip`);
    packaged++;
  } catch (error) {
    console.error(`✗ Failed to package ${skill}: ${error.message}`);
  }
}

console.log(`\nPackaged ${packaged} skills to dist/skills/`);
console.log('\nTo use in Claude Desktop:');
console.log('1. Open Claude Desktop → Settings → Capabilities');
console.log('2. Upload each ZIP file as a custom skill');
