#!/usr/bin/env node

/**
 * Skill Validator
 * 
 * Validates that skills only reference tools that actually exist.
 * Compares skill metadata and content against schemas/tools.json.
 * 
 * Usage:
 *   node scripts/validate-skills.js
 *   npm run validate:skills
 */

import { readdir, readFile, access } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

/**
 * Load the tools schema
 */
async function loadToolsSchema() {
  const schemaPath = join(ROOT_DIR, 'schemas', 'tools.json');
  
  try {
    await access(schemaPath);
  } catch {
    console.error('❌ Schema file not found: schemas/tools.json');
    console.error('   Run "npm run generate:tool-catalog" first');
    process.exit(1);
  }

  const content = await readFile(schemaPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Find all skills in the project
 */
async function findSkills() {
  const skillsDir = join(ROOT_DIR, '.claude', 'skills');
  const skills = [];

  try {
    const entries = await readdir(skillsDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillPath = join(skillsDir, entry.name);
        skills.push({
          name: entry.name,
          path: skillPath
        });
      }
    }
  } catch (err) {
    console.warn(`⚠ Could not read skills directory: ${err.message}`);
  }

  return skills;
}

/**
 * Load skill metadata from metadata.yaml
 */
async function loadSkillMetadata(skillPath) {
  const metadataPath = join(skillPath, 'metadata.yaml');
  
  try {
    await access(metadataPath);
    const content = await readFile(metadataPath, 'utf-8');
    return parseYaml(content);
  } catch {
    return null;
  }
}

/**
 * Extract tool references from skill content
 * Looks for patterns like `tool_name` in backticks
 */
async function extractToolReferences(skillPath) {
  const references = new Set();
  
  // Read SKILL.md
  const skillMdPath = join(skillPath, 'SKILL.md');
  try {
    const content = await readFile(skillMdPath, 'utf-8');
    
    // Match tool names in backticks (e.g., `jira_create_issue`)
    const backtickMatches = content.matchAll(/`([a-z][a-z0-9_]*_[a-z0-9_]+)`/g);
    for (const match of backtickMatches) {
      // Filter to likely tool names (contain underscore, lowercase)
      const candidate = match[1];
      if (candidate.includes('_') && !candidate.startsWith('npm_') && !candidate.startsWith('git_')) {
        references.add(candidate);
      }
    }

    // Match tool names in code blocks with "tool": "name" pattern
    const jsonMatches = content.matchAll(/"tool"\s*:\s*"([^"]+)"/g);
    for (const match of jsonMatches) {
      references.add(match[1]);
    }

  } catch {
    // SKILL.md not found
  }

  // Also check reference files
  const refDir = join(skillPath, 'reference');
  try {
    const refFiles = await readdir(refDir);
    for (const file of refFiles) {
      if (file.endsWith('.md')) {
        const content = await readFile(join(refDir, file), 'utf-8');
        const backtickMatches = content.matchAll(/`([a-z][a-z0-9_]*_[a-z0-9_]+)`/g);
        for (const match of backtickMatches) {
          const candidate = match[1];
          if (candidate.includes('_') && !candidate.startsWith('npm_') && !candidate.startsWith('git_')) {
            references.add(candidate);
          }
        }
      }
    }
  } catch {
    // No reference directory
  }

  return Array.from(references);
}

/**
 * Validate a single skill
 */
async function validateSkill(skill, allTools) {
  const errors = [];
  const warnings = [];

  // Load metadata
  const metadata = await loadSkillMetadata(skill.path);
  
  // Extract references from content
  const contentRefs = await extractToolReferences(skill.path);
  
  // Combine declared and detected tool references
  const declaredTools = metadata?.tools_used || [];
  const allRefs = new Set([...declaredTools, ...contentRefs]);

  // Check each reference against schema
  for (const toolRef of allRefs) {
    if (!allTools.includes(toolRef)) {
      // Check if it's close to an existing tool (typo detection)
      const similar = allTools.filter(t => 
        t.includes(toolRef.split('_').pop()) || 
        toolRef.includes(t.split('_').pop())
      );
      
      if (similar.length > 0) {
        errors.push({
          tool: toolRef,
          message: `Tool "${toolRef}" not found. Did you mean: ${similar.slice(0, 3).join(', ')}?`
        });
      } else {
        errors.push({
          tool: toolRef,
          message: `Tool "${toolRef}" not found in any server`
        });
      }
    }
  }

  // Check for undeclared tools (in content but not in metadata)
  if (metadata?.tools_used) {
    for (const ref of contentRefs) {
      if (!declaredTools.includes(ref) && allTools.includes(ref)) {
        warnings.push({
          tool: ref,
          message: `Tool "${ref}" used in content but not declared in metadata.yaml`
        });
      }
    }
  }

  // Check if metadata exists
  if (!metadata && contentRefs.length > 0) {
    warnings.push({
      tool: null,
      message: 'No metadata.yaml found. Consider adding one to declare tool dependencies.'
    });
  }

  return { errors, warnings, toolCount: allRefs.size };
}

/**
 * Main entry point
 */
async function main() {
  console.log('🔍 Skill Validator\n');

  // Load schema
  console.log('Loading tools schema...');
  const schema = await loadToolsSchema();
  const allTools = schema.allTools;
  console.log(`   Found ${allTools.length} tools across ${Object.keys(schema.servers).length} servers\n`);

  // Find skills
  console.log('Scanning skills...');
  const skills = await findSkills();
  
  if (skills.length === 0) {
    console.log('   No skills found in .claude/skills/');
    console.log('\n✅ Validation complete (nothing to validate)\n');
    return;
  }

  console.log(`   Found ${skills.length} skill(s)\n`);

  // Validate each skill
  let totalErrors = 0;
  let totalWarnings = 0;
  let skippedCount = 0;

  for (const skill of skills) {
    // Check if skill should skip validation
    const metadata = await loadSkillMetadata(skill.path);
    if (metadata?.skip_validation === true) {
      console.log(`Skipping ${skill.name} (skip_validation: true)`);
      skippedCount++;
      continue;
    }

    console.log(`Validating ${skill.name}...`);
    const result = await validateSkill(skill, allTools);
    
    if (result.errors.length === 0 && result.warnings.length === 0) {
      console.log(`   ✓ Valid (${result.toolCount} tools referenced)`);
    } else {
      for (const error of result.errors) {
        console.log(`   ❌ ${error.message}`);
        totalErrors++;
      }
      for (const warning of result.warnings) {
        console.log(`   ⚠ ${warning.message}`);
        totalWarnings++;
      }
    }
  }

  console.log('');

  // Summary
  if (totalErrors > 0) {
    console.log(`❌ Validation failed: ${totalErrors} error(s), ${totalWarnings} warning(s)`);
    console.log('\nTo fix:');
    console.log('  1. Check tool names for typos');
    console.log('  2. Run "npm run generate:tool-catalog" to refresh the schema');
    console.log('  3. Update skills to use correct tool names');
    process.exit(1);
  } else if (totalWarnings > 0) {
    console.log(`⚠ Validation passed with ${totalWarnings} warning(s)\n`);
  } else {
    console.log('✅ All skills validated successfully\n');
  }
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
