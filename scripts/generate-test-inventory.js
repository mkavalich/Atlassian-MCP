/**
 * Tool Inventory Generator
 * 
 * Reads schemas/tools.json and generates a flat inventory of all tools
 * organized for systematic testing.
 * 
 * Usage: node scripts/generate-test-inventory.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Read the tools schema
const toolsSchema = JSON.parse(
  readFileSync(join(rootDir, 'schemas', 'tools.json'), 'utf-8')
);

// Build inventory
const inventory = {
  generated: new Date().toISOString(),
  summary: {
    totalTools: 0,
    byServer: {},
    byType: {
      discovery: [],
      read: [],
      create: [],
      update: [],
      delete: [],
      other: []
    },
    byPhase: {
      phase1_discovery: [],
      phase2_create: [],
      phase3_read: [],
      phase4_update: [],
      phase5_delete: []
    }
  },
  tools: []
};

// Process each server
for (const [serverName, serverData] of Object.entries(toolsSchema.servers)) {
  inventory.summary.byServer[serverName] = {
    count: serverData.toolCount,
    tools: []
  };

  for (const [toolName, toolData] of Object.entries(serverData.tools)) {
    const fullToolName = `${serverName}:${toolName}`;
    
    const toolEntry = {
      server: serverName,
      name: toolName,
      fullName: fullToolName,
      type: toolData.type || 'other',
      description: toolData.description,
      isReadOnly: toolData.annotations?.readOnlyHint ?? false,
      isDestructive: toolData.annotations?.destructiveHint ?? false,
      testStatus: 'pending',
      testPriority: calculatePriority(toolData, toolName)
    };

    inventory.tools.push(toolEntry);
    inventory.summary.byServer[serverName].tools.push(toolName);
    inventory.summary.totalTools++;

    // Categorize by type
    const typeCategory = toolData.type || 'other';
    if (inventory.summary.byType[typeCategory]) {
      inventory.summary.byType[typeCategory].push(fullToolName);
    } else {
      inventory.summary.byType.other.push(fullToolName);
    }

    // Categorize by test phase
    if (toolData.annotations?.readOnlyHint && 
        (toolData.type === 'discovery' || toolData.type === 'read' || 
         toolName.startsWith('search_') || toolName.startsWith('get_'))) {
      inventory.summary.byPhase.phase1_discovery.push(fullToolName);
    } else if (toolData.type === 'create' || toolName.startsWith('create_') || toolName.startsWith('add_')) {
      inventory.summary.byPhase.phase2_create.push(fullToolName);
    } else if (toolData.type === 'read' || toolName.startsWith('get_')) {
      inventory.summary.byPhase.phase3_read.push(fullToolName);
    } else if (toolData.type === 'update' || toolName.startsWith('update_') || toolName.startsWith('set_')) {
      inventory.summary.byPhase.phase4_update.push(fullToolName);
    } else if (toolData.type === 'delete' || toolName.startsWith('delete_') || toolName.startsWith('remove_')) {
      inventory.summary.byPhase.phase5_delete.push(fullToolName);
    } else {
      // Default to phase 3 for other tools
      inventory.summary.byPhase.phase3_read.push(fullToolName);
    }
  }
}

function calculatePriority(toolData, toolName) {
  // Discovery tools are highest priority (test first)
  if (toolName.startsWith('search_') || toolName.startsWith('get_') && toolData.annotations?.readOnlyHint) {
    if (toolName.includes('projects') || toolName.includes('spaces') || toolName.includes('instance')) {
      return 1; // Core discovery
    }
    return 2; // Other discovery
  }
  
  // Create tools are next priority
  if (toolData.type === 'create' || toolName.startsWith('create_')) {
    return 3;
  }
  
  // Read/update tools
  if (toolData.type === 'read' || toolData.type === 'update') {
    return 4;
  }
  
  // Delete tools are lowest priority (test last)
  if (toolData.type === 'delete' || toolName.startsWith('delete_')) {
    return 5;
  }
  
  return 4; // Default
}

// Sort tools by priority
inventory.tools.sort((a, b) => {
  if (a.testPriority !== b.testPriority) {
    return a.testPriority - b.testPriority;
  }
  return a.fullName.localeCompare(b.fullName);
});

// Write inventory
writeFileSync(
  join(rootDir, 'test-results', 'tool-inventory.json'),
  JSON.stringify(inventory, null, 2)
);

console.log('Tool inventory generated!');
console.log(`Total tools: ${inventory.summary.totalTools}`);
console.log('\nBy server:');
for (const [server, data] of Object.entries(inventory.summary.byServer)) {
  console.log(`  ${server}: ${data.count} tools`);
}
console.log('\nBy test phase:');
for (const [phase, tools] of Object.entries(inventory.summary.byPhase)) {
  console.log(`  ${phase}: ${tools.length} tools`);
}
