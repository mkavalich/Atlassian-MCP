#!/usr/bin/env node

/**
 * Tool Catalog Generator
 * 
 * Automatically generates:
 *   - docs/tool-catalog.md (human-readable documentation)
 *   - schemas/tools.json (machine-readable for validation)
 * 
 * Usage:
 *   node scripts/generate-tool-catalog.js
 *   npm run generate:tool-catalog
 */

import { spawn } from 'child_process';
import { readdir, readFile, writeFile, access, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

// Server configuration
const SERVERS = [
  { name: 'jira-projects', description: 'Projects, issues, dashboards, reporting' },
  { name: 'jira-workflows', description: 'Workflows, screens, schemes, automation' },
  { name: 'jira-fields-permissions', description: 'Custom fields, permissions, notifications' },
  { name: 'jira-service-desk', description: 'JSM request types, customer organizations' },
  { name: 'jira-organization', description: 'Atlassian Admin, identity, directories' },
  { name: 'jira-system-admin', description: 'System config, licensing, users, groups' },
  { name: 'jira-product-discovery', description: 'JPD ideas, insights, scoring' },
  { name: 'confluence', description: 'Spaces, pages, comments, attachments' },
];

// Tool type classification patterns
const TYPE_PATTERNS = {
  discovery: [/^search_/, /^list_/, /^find_/, /^query_/, /^get_all_/],
  read: [/^get_/, /^fetch_/, /^read_/, /^view_/, /^show_/],
  create: [/^create_/, /^add_/, /^new_/, /^insert_/, /^register_/],
  update: [/^update_/, /^edit_/, /^modify_/, /^set_/, /^change_/, /^transition_/, /^assign_/, /^move_/],
  delete: [/^delete_/, /^remove_/, /^destroy_/, /^unregister_/],
};

/**
 * Classify a tool by its name and annotations
 */
function classifyTool(toolName, annotations = {}) {
  if (annotations.readOnlyHint === true) {
    for (const pattern of TYPE_PATTERNS.discovery) {
      if (pattern.test(toolName)) return 'discovery';
    }
    return 'read';
  }
  
  if (annotations.destructiveHint === true) {
    return 'delete';
  }

  for (const [type, patterns] of Object.entries(TYPE_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(toolName)) {
        return type;
      }
    }
  }

  return 'other';
}

/**
 * Group tools by category based on common prefixes
 */
function groupToolsByCategory(tools) {
  const groups = {};
  
  for (const tool of tools) {
    const parts = tool.name.split('_');
    let category;
    
    if (parts.length >= 3) {
      category = parts.slice(2).join('_');
      
      if (category.includes('issue')) category = 'Issues';
      else if (category.includes('project')) category = 'Projects';
      else if (category.includes('workflow')) category = 'Workflows';
      else if (category.includes('field')) category = 'Fields';
      else if (category.includes('screen')) category = 'Screens';
      else if (category.includes('permission')) category = 'Permissions';
      else if (category.includes('user')) category = 'Users';
      else if (category.includes('group')) category = 'Groups';
      else if (category.includes('space')) category = 'Spaces';
      else if (category.includes('page')) category = 'Pages';
      else if (category.includes('comment')) category = 'Comments';
      else if (category.includes('attachment')) category = 'Attachments';
      else if (category.includes('dashboard')) category = 'Dashboards';
      else if (category.includes('filter')) category = 'Filters';
      else if (category.includes('automation')) category = 'Automation';
      else if (category.includes('queue')) category = 'Queues';
      else if (category.includes('sla')) category = 'SLAs';
      else if (category.includes('customer')) category = 'Customers';
      else if (category.includes('organization')) category = 'Organizations';
      else if (category.includes('idea')) category = 'Ideas';
      else if (category.includes('insight')) category = 'Insights';
      else if (category.includes('request')) category = 'Requests';
      else category = 'Other';
    } else {
      category = 'Other';
    }
    
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(tool);
  }

  const sortedGroups = {};
  const keys = Object.keys(groups).sort((a, b) => {
    if (a === 'Other') return 1;
    if (b === 'Other') return -1;
    return a.localeCompare(b);
  });
  
  for (const key of keys) {
    sortedGroups[key] = groups[key].sort((a, b) => a.name.localeCompare(b.name));
  }

  return sortedGroups;
}

/**
 * Execute JSON-RPC command against a server
 */
async function executeJsonRpc(serverDir, method, params = {}) {
  const distIndex = join(serverDir, 'dist', 'index.js');
  
  try {
    await access(distIndex);
  } catch {
    console.warn(`  ⚠ Server not built: ${serverDir}`);
    return null;
  }

  const request = JSON.stringify({
    method,
    params,
    jsonrpc: '2.0',
    id: 1
  });

  return new Promise((resolve) => {
    const proc = spawn('node', [distIndex], {
      cwd: serverDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'production' }
    });

    let stdout = '';
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        proc.kill();
        console.warn(`  ⚠ Timeout waiting for response`);
        resolve(null);
      }
    }, 10000);

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.on('close', () => {
      clearTimeout(timeout);
      if (resolved) return;
      resolved = true;

      const lines = stdout.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const response = JSON.parse(line);
          if (response.result && response.result.tools) {
            resolve(response.result.tools);
            return;
          }
        } catch {
          // Not valid JSON, continue
        }
      }

      resolve(null);
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      if (!resolved) {
        resolved = true;
        console.warn(`  ⚠ Process error: ${err.message}`);
        resolve(null);
      }
    });

    const initRequest = JSON.stringify({
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'tool-catalog-generator', version: '1.0.0' }
      },
      jsonrpc: '2.0',
      id: 0
    });

    proc.stdin.write(initRequest + '\n');
    proc.stdin.write(request + '\n');
    proc.stdin.end();
  });
}

/**
 * Fallback: Parse TypeScript source files for tool definitions
 */
async function extractToolsFromSource(serverDir) {
  const toolsDir = join(serverDir, 'src', 'tools');
  const tools = [];

  try {
    const files = await readdir(toolsDir);
    
    for (const file of files) {
      if (!file.endsWith('.ts')) continue;
      
      const content = await readFile(join(toolsDir, file), 'utf-8');
      
      const registerToolRegex = /registerTool\s*\(\s*["'`]([^"'`]+)["'`]\s*,\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/gs;
      
      let match;
      while ((match = registerToolRegex.exec(content)) !== null) {
        const toolName = match[1];
        const configBlock = match[2];
        
        const descMatch = configBlock.match(/description\s*:\s*["'`]([^"'`]+)["'`]/);
        const description = descMatch ? descMatch[1].split('\n')[0].trim() : 'No description';
        
        const annotations = {};
        const readOnlyMatch = configBlock.match(/readOnlyHint\s*:\s*(true|false)/);
        const destructiveMatch = configBlock.match(/destructiveHint\s*:\s*(true|false)/);
        
        if (readOnlyMatch) annotations.readOnlyHint = readOnlyMatch[1] === 'true';
        if (destructiveMatch) annotations.destructiveHint = destructiveMatch[1] === 'true';

        // Extract parameters from inputSchema if possible
        const parameters = [];
        const schemaMatch = configBlock.match(/inputSchema\s*:\s*(\w+)/);
        if (schemaMatch) {
          // Try to find the schema definition
          const schemaName = schemaMatch[1];
          const schemaDefRegex = new RegExp(`${schemaName}\\s*=\\s*z\\.object\\(\\{([^}]+)\\}\\)`, 's');
          const schemaDef = content.match(schemaDefRegex);
          if (schemaDef) {
            const paramMatches = schemaDef[1].matchAll(/(\w+)\s*:/g);
            for (const pm of paramMatches) {
              parameters.push(pm[1]);
            }
          }
        }
        
        tools.push({
          name: toolName,
          description: description.substring(0, 100) + (description.length > 100 ? '...' : ''),
          annotations,
          parameters
        });
      }
    }
  } catch (err) {
    console.warn(`  ⚠ Could not read source files: ${err.message}`);
  }

  return tools;
}

/**
 * Get tools from a server using JSON-RPC or source analysis
 */
async function getServerTools(serverName) {
  const serverDir = join(ROOT_DIR, 'servers', serverName);
  
  console.log(`  Introspecting ${serverName}...`);
  
  let tools = await executeJsonRpc(serverDir, 'tools/list');
  
  if (!tools || tools.length === 0) {
    console.log(`  Falling back to source analysis...`);
    tools = await extractToolsFromSource(serverDir);
  }

  if (!tools || tools.length === 0) {
    console.warn(`  ⚠ No tools found for ${serverName}`);
    return [];
  }

  console.log(`  ✓ Found ${tools.length} tools`);

  // Load examples for this server
  const examples = await loadToolExamples(serverName);
  const exampleCount = Object.keys(examples).length;
  if (exampleCount > 0) {
    console.log(`  ✓ Loaded examples for ${exampleCount} tools`);
  }

  return tools.map(tool => ({
    name: tool.name,
    description: (tool.description || 'No description').split('\n')[0].substring(0, 120),
    type: classifyTool(tool.name, tool.annotations || {}),
    annotations: tool.annotations || {},
    parameters: tool.inputSchema?.properties
      ? Object.keys(tool.inputSchema.properties)
      : (tool.parameters || []),
    examples: examples[tool.name] || []
  }));
}

/**
 * Generate markdown table for tools
 */
function generateToolTable(tools) {
  const lines = [
    '| Tool | Type | Description |',
    '|------|------|-------------|'
  ];

  for (const tool of tools) {
    const escapedDesc = tool.description.replace(/\|/g, '\\|');
    lines.push(`| \`${tool.name}\` | ${tool.type} | ${escapedDesc} |`);
  }

  return lines.join('\n');
}

/**
 * Generate the full catalog markdown
 */
function generateCatalog(serverData) {
  const timestamp = new Date().toISOString();
  const totalTools = serverData.reduce((sum, s) => sum + s.tools.length, 0);
  
  const lines = [
    '# Atlassian MCP Servers - Complete Tool Catalog',
    '',
    `> **Generated:** ${timestamp}`,
    '> ',
    '> This file is auto-generated. Do not edit manually.',
    '> Run `npm run generate:tool-catalog` to regenerate.',
    '',
    `**Total Servers:** ${serverData.length}`,
    `**Total Tools:** ${totalTools}`,
    '',
    '---',
    '',
    '## Summary',
    '',
    '| Server | Tools | Description |',
    '|--------|-------|-------------|',
  ];

  for (const server of serverData) {
    lines.push(`| ${server.name} | ${server.tools.length} | ${server.description} |`);
  }
  lines.push(`| **Total** | **${totalTools}** | |`);
  lines.push('');

  let serverIndex = 1;
  for (const server of serverData) {
    lines.push('---');
    lines.push('');
    lines.push(`## ${serverIndex}. ${server.name} (${server.tools.length} tools)`);
    lines.push('');
    lines.push(server.description);
    lines.push('');

    if (server.tools.length === 0) {
      lines.push('*No tools found or server not built.*');
      lines.push('');
    } else {
      const groups = groupToolsByCategory(server.tools);
      
      for (const [category, tools] of Object.entries(groups)) {
        lines.push(`### ${category} (${tools.length} tools)`);
        lines.push('');
        lines.push(generateToolTable(tools));
        lines.push('');
      }
    }

    serverIndex++;
  }

  lines.push('---');
  lines.push('');
  lines.push('## Tool Type Legend');
  lines.push('');
  lines.push('| Type | Description |');
  lines.push('|------|-------------|');
  lines.push('| discovery | Search, list, or query multiple resources |');
  lines.push('| read | Get or fetch a single resource |');
  lines.push('| create | Create a new resource |');
  lines.push('| update | Modify an existing resource |');
  lines.push('| delete | Remove a resource |');
  lines.push('| other | Utility or uncategorized operations |');
  lines.push('');

  return lines.join('\n');
}

/**
 * Load tool examples from a server's built output
 */
async function loadToolExamples(serverName) {
  const examplesPath = join(ROOT_DIR, 'servers', serverName, 'dist', 'validation', 'tool-examples.js');
  try {
    await access(examplesPath);
    const mod = await import(`file://${examplesPath.replace(/\\/g, '/')}`);
    return mod.toolExamples || {};
  } catch {
    return {};
  }
}

/**
 * Generate the schema JSON for validation
 */
function generateSchema(serverData) {
  const timestamp = new Date().toISOString();

  const schema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'Atlassian MCP Tools Schema',
    description: 'Auto-generated schema of all available MCP tools for skill validation',
    generated: timestamp,
    servers: {},
    allTools: []
  };

  for (const server of serverData) {
    schema.servers[server.name] = {
      description: server.description,
      toolCount: server.tools.length,
      tools: {}
    };

    for (const tool of server.tools) {
      const toolEntry = {
        description: tool.description,
        type: tool.type,
        parameters: tool.parameters || [],
        annotations: tool.annotations || {}
      };

      // Include examples if available
      if (tool.examples && tool.examples.length > 0) {
        toolEntry.examples = tool.examples;
      }

      schema.servers[server.name].tools[tool.name] = toolEntry;

      // Add to flat list for easy lookup
      schema.allTools.push(tool.name);
    }
  }

  // Sort allTools for consistent output
  schema.allTools.sort();

  return schema;
}

/**
 * Main entry point
 */
async function main() {
  console.log('🔍 Tool Catalog Generator\n');
  console.log('Discovering tools from MCP servers...\n');

  const serverData = [];

  for (const server of SERVERS) {
    const tools = await getServerTools(server.name);
    serverData.push({
      name: server.name,
      description: server.description,
      tools
    });
  }

  const totalTools = serverData.reduce((sum, s) => sum + s.tools.length, 0);

  // Generate markdown catalog
  console.log('\n📝 Generating catalog...');
  const catalog = generateCatalog(serverData);
  const catalogPath = join(ROOT_DIR, 'docs', 'tool-catalog.md');
  await writeFile(catalogPath, catalog, 'utf-8');
  console.log(`   ✓ ${catalogPath}`);

  // Generate JSON schema
  console.log('📋 Generating schema...');
  const schema = generateSchema(serverData);
  const schemasDir = join(ROOT_DIR, 'schemas');
  
  try {
    await mkdir(schemasDir, { recursive: true });
  } catch {
    // Directory exists
  }
  
  const schemaPath = join(schemasDir, 'tools.json');
  await writeFile(schemaPath, JSON.stringify(schema, null, 2), 'utf-8');
  console.log(`   ✓ ${schemaPath}`);
  
  console.log(`\n✅ Generation complete`);
  console.log(`   ${serverData.length} servers, ${totalTools} tools documented\n`);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
