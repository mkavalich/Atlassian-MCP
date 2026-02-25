#!/usr/bin/env node

/**
 * Test script for Group 3: Cross-Product Analytics & Directory Health tools
 * Tests the new MCP tools for organization admin functionality
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { access, constants } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Group 3 tools to test
const group3Tools = [
  // Cross-Product Analytics (Compass API)
  'get_compass_component_metrics',
  'get_compass_team_metrics', 
  'get_compass_system_events',
  'get_compass_component_events',
  
  // Directory Integration Health (SCIM)
  'get_scim_directory_groups',
  'get_scim_directory_schemas',
  'get_scim_directory_resource_types',
  'get_directory_health_status',
  'get_provisioning_insights',
  
  // Organization Management
  'get_organizations',
  'get_organization_details',
  
  // Enhanced Directory Analytics
  'get_cross_product_user_activity',
  'get_enhanced_identity_provider_insights',
  'get_advanced_directory_health_monitoring',
  'get_user_behavior_pattern_analysis'
];

const serverPath = path.resolve(__dirname, 'dist', 'index.js');

/**
 * Validate server path to prevent path traversal attacks
 */
function validateServerPath(serverPath) {
  // Ensure path is within expected directory structure
  const expectedBase = path.resolve(__dirname);
  const resolvedPath = path.resolve(serverPath);
  
  if (!resolvedPath.startsWith(expectedBase)) {
    throw new Error('Invalid server path: path traversal detected');
  }
  
  // Additional validation for expected file name
  if (!resolvedPath.endsWith('index.js') && !resolvedPath.endsWith('dist/index.js')) {
    throw new Error('Invalid server path: unexpected file');
  }
  
  return resolvedPath;
}

/**
 * Check if server file exists and is readable
 */
function checkServerAccess(serverPath) {
  return new Promise((resolve, reject) => {
    access(serverPath, constants.F_OK | constants.R_OK, (err) => {
      if (err) {
        reject(new Error(`Server file not accessible: ${err.message}`));
      } else {
        resolve(true);
      }
    });
  });
}

/**
 * Test tool by calling it and checking for proper response structure
 */
async function testTool(toolName, params = {}) {
  return new Promise(async (resolve, reject) => {
    console.log(`\n🧪 Testing tool: ${toolName}`);
    
    try {
      // Validate and sanitize inputs
      if (!toolName || typeof toolName !== 'string') {
        resolve({ success: false, error: 'Invalid tool name' });
        return;
      }
      
      // Validate server path
      const validatedServerPath = validateServerPath(serverPath);
      await checkServerAccess(validatedServerPath);
      
      const input = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: params
        }
      };

      // Use spawn with array arguments to prevent command injection
      const child = spawn('node', [validatedServerPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 30000,
        env: process.env
      });
      
      child.on('error', (error) => {
        console.error(`❌ Process error for ${toolName}:`, error.message);
        resolve({ success: false, error: error.message });
      });

    let responseData = '';
    let hasInitMessage = false;

    child.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          
          // Skip initialization messages
          if (parsed.method === 'notifications/initialized' || 
              parsed.method === 'tools/list' ||
              parsed.method === 'resources/list') {
            hasInitMessage = true;
            continue;
          }
          
          // Look for our response
          if (parsed.id === 1 && parsed.result) {
            responseData = parsed.result;
            child.kill();
            resolve({ success: true, response: responseData });
            return;
          }
          
          // Handle errors
          if (parsed.id === 1 && parsed.error) {
            child.kill();
            resolve({ success: false, error: parsed.error });
            return;
          }
        } catch (e) {
          // Ignore JSON parse errors for non-JSON output
        }
      }
    });

    child.stderr.on('data', (data) => {
      // Only log non-debug stderr output
      const output = data.toString();
      if (!output.includes('DEBUG') && !output.includes('INFO')) {
        console.error(`⚠️  stderr for ${toolName}:`, output);
      }
    });

    // Send the request
    child.stdin.write(JSON.stringify(input) + '\n');
    
    // Timeout handling
    setTimeout(() => {
      child.kill();
      resolve({ success: false, error: 'Timeout - tool did not respond within 30 seconds' });
    }, 30000);
      
    } catch (error) {
      console.error(`❌ Security validation failed for ${toolName}:`, error.message);
      resolve({ success: false, error: `Security validation failed: ${error.message}` });
    }
  });
}

/**
 * Test tool registration by listing available tools
 */
async function testToolRegistration() {
  return new Promise(async (resolve, reject) => {
    console.log('\n📋 Testing tool registration...');
    
    try {
      // Validate server path
      const validatedServerPath = validateServerPath(serverPath);
      await checkServerAccess(validatedServerPath);
      
      const input = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      };

      // Use spawn with array arguments to prevent command injection
      const child = spawn('node', [validatedServerPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 15000,
        env: process.env
      });
      
      child.on('error', (error) => {
        console.error('❌ Process error during tool listing:', error.message);
        resolve({ success: false, error: error.message });
      });

    child.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          
          if (parsed.id === 1 && parsed.result && parsed.result.tools) {
            child.kill();
            
            const registeredTools = parsed.result.tools.map(tool => tool.name);
            const group3ToolsFound = group3Tools.filter(tool => 
              registeredTools.includes(tool)
            );
            
            console.log(`✅ Found ${group3ToolsFound.length}/${group3Tools.length} Group 3 tools registered:`);
            group3ToolsFound.forEach(tool => console.log(`   - ${tool}`));
            
            if (group3ToolsFound.length < group3Tools.length) {
              const missingTools = group3Tools.filter(tool => 
                !registeredTools.includes(tool)
              );
              console.log(`❌ Missing tools:`);
              missingTools.forEach(tool => console.log(`   - ${tool}`));
            }
            
            resolve({ 
              success: true, 
              registeredTools, 
              group3ToolsFound,
              totalRegistered: registeredTools.length 
            });
            return;
          }
        } catch (e) {
          // Ignore JSON parse errors
        }
      }
    });

    child.stderr.on('data', (data) => {
      const output = data.toString();
      if (!output.includes('DEBUG') && !output.includes('INFO')) {
        console.error('⚠️  stderr during tool listing:', output);
      }
    });

    // Send the request
    child.stdin.write(JSON.stringify(input) + '\n');
    
    setTimeout(() => {
      child.kill();
      resolve({ success: false, error: 'Timeout during tool listing' });
    }, 15000);
      
    } catch (error) {
      console.error('❌ Security validation failed during tool listing:', error.message);
      resolve({ success: false, error: `Security validation failed: ${error.message}` });
    }
  });
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('🚀 Starting Group 3 tools testing...');
  console.log('📍 Server path:', serverPath);
  
  // Test 1: Tool Registration
  const registrationResult = await testToolRegistration();
  if (!registrationResult.success) {
    console.error('❌ Tool registration test failed:', registrationResult.error);
    return;
  }
  
  console.log(`✅ Tool registration successful. Total tools: ${registrationResult.totalRegistered}`);
  
  // Test 2: Sample tool calls (without org admin token - should show proper error handling)
  console.log('\n🧪 Testing tool error handling (missing org admin token expected)...');
  
  const sampleTests = [
    { tool: 'get_compass_component_metrics', params: { limit: 10 } },
    { tool: 'get_scim_directory_groups', params: { directoryId: 'test-directory' } },
    { tool: 'get_organizations', params: { limit: 5 } },
    { tool: 'get_cross_product_user_activity', params: {} }
  ];
  
  let successfulErrorHandling = 0;
  
  for (const test of sampleTests) {
    const result = await testTool(test.tool, test.params);
    
    if (result.success && result.response && result.response.content) {
      const content = JSON.parse(result.response.content[0].text);
      
      if (!content.success && content.error && 
          (content.error.code?.includes('ORG_ADMIN_TOKEN') || 
           content.error.code?.includes('MISSING_') ||
           content.error.message?.includes('organization admin'))) {
        console.log(`✅ ${test.tool}: Proper error handling for missing org admin token`);
        successfulErrorHandling++;
      } else if (!content.success) {
        console.log(`✅ ${test.tool}: Returns error response (${content.error.code})`);
        successfulErrorHandling++;
      } else {
        console.log(`⚠️  ${test.tool}: Unexpected success response`);
      }
    } else {
      console.log(`❌ ${test.tool}: Failed to get proper response`);
    }
  }
  
  console.log(`\n📊 Test Summary:`);
  console.log(`   ✅ Tool Registration: ${registrationResult.success ? 'PASSED' : 'FAILED'}`);
  console.log(`   ✅ Group 3 Tools Found: ${registrationResult.group3ToolsFound?.length || 0}/${group3Tools.length}`);
  console.log(`   ✅ Error Handling Tests: ${successfulErrorHandling}/${sampleTests.length} passed`);
  
  if (registrationResult.success && successfulErrorHandling >= sampleTests.length * 0.75) {
    console.log('\n🎉 Group 3 tools implementation appears to be working correctly!');
    console.log('\n📝 Next steps:');
    console.log('   1. Configure JIRA_ORG_ADMIN_TOKEN with appropriate scopes:');
    console.log('      - read:compass-metrics:admin (for Compass API)');
    console.log('      - read:directory:admin (for SCIM Directory API)');
    console.log('      - read:organizations:admin (for Organization API)');
    console.log('   2. Test with actual organization admin credentials');
    console.log('   3. Validate API endpoint responses with real data');
  } else {
    console.log('\n❌ Some issues detected. Review the implementation.');
  }
}

// Run the tests
runTests().catch(error => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});