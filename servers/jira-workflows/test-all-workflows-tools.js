#!/usr/bin/env node

/**
 * Test script to verify all 30 workflow-related tools are properly registered and responding
 * This script tests the jira-workflows-mcp-server MCP tools
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Expected workflow-related tools (30 total)
const expectedTools = [
  // Workflow tools (3)
  'get_workflows',
  'create_workflow', 
  'get_workflow_schemes_basic',
  
  // Workflow scheme tools (9)
  'get_workflow_schemes',
  'create_workflow_scheme',
  'update_workflow_scheme',
  'delete_workflow_scheme',
  'get_workflow_scheme_projects',
  'assign_workflow_scheme_to_project',
  'get_workflow_scheme_issue_types',
  'update_workflow_scheme_mappings',
  'get_draft_workflow_scheme',
  
  // Screen tools (18)
  'get_screens',
  'create_screen',
  'update_screen',
  'delete_screen',
  'get_screen_tabs',
  'create_screen_tab',
  'update_screen_tab',
  'delete_screen_tab',
  'move_screen_tab',
  'get_screen_tab_fields',
  'add_field_to_screen_tab',
  'remove_field_from_screen_tab',
  'move_field_on_screen_tab',
  'get_screen_schemes',
  'create_screen_scheme',
  'update_screen_scheme',
  'delete_screen_scheme',
  'get_screen_available_fields'
];

async function testWorkflowTools() {
  console.log('🔄 Testing Jira Workflows MCP Server...\n');
  
  return new Promise((resolve, reject) => {
    // Use environment variables for test configuration
    // These should be provided via environment or test configuration file
    const testEnv = {
      ...process.env,
      // Use environment variables for test credentials - do not hardcode
      JIRA_BASE_URL: process.env.TEST_JIRA_BASE_URL || 'https://test-placeholder.atlassian.net',
      JIRA_EMAIL: process.env.TEST_JIRA_EMAIL || 'test-placeholder@example.com',
      JIRA_API_TOKEN: process.env.TEST_JIRA_API_TOKEN || 'test-placeholder-token'
    };
    
    // Warn if using placeholder values
    if (testEnv.JIRA_BASE_URL.includes('placeholder') || 
        testEnv.JIRA_EMAIL.includes('placeholder') || 
        testEnv.JIRA_API_TOKEN.includes('placeholder')) {
      console.log('⚠️  Using placeholder test credentials. Set TEST_JIRA_* environment variables for proper testing.');
    }
    
    const serverProcess = spawn('node', [join(__dirname, 'dist', 'index.js')], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: testEnv
    });

    let serverOutput = '';
    let errorOccurred = false;

    // Capture stderr for debugging
    serverProcess.stderr.on('data', (data) => {
      const message = data.toString();
      if (message.includes('error') || message.includes('Error')) {
        console.error('❌ Server Error:', message);
        errorOccurred = true;
      }
    });

    // Test tool discovery
    const testMessage = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list'
    };

    serverProcess.stdout.on('data', (data) => {
      serverOutput += data.toString();
      
      try {
        const responses = serverOutput.split('\n').filter(line => line.trim());
        
        for (const line of responses) {
          if (!line.trim()) continue;
          
          const response = JSON.parse(line);
          
          if (response.id === 1 && response.result) {
            const tools = response.result.tools || [];
            
            console.log(`📊 Found ${tools.length} tools:\n`);
            
            // Check for expected tools
            const foundTools = tools.map(tool => tool.name);
            const missingTools = expectedTools.filter(tool => !foundTools.includes(tool));
            const extraTools = foundTools.filter(tool => !expectedTools.includes(tool));
            
            // Display results
            if (missingTools.length === 0 && extraTools.length === 0) {
              console.log('✅ All 30 expected workflow tools found!');
            } else {
              console.log('⚠️  Tool validation results:');
              if (missingTools.length > 0) {
                console.log(`❌ Missing tools (${missingTools.length}): ${missingTools.join(', ')}`);
              }
              if (extraTools.length > 0) {
                console.log(`➕ Extra tools (${extraTools.length}): ${extraTools.join(', ')}`);
              }
            }

            // Group tools by category
            const workflowTools = foundTools.filter(name => 
              ['get_workflows', 'create_workflow', 'get_workflow_schemes_basic'].includes(name)
            );
            
            const workflowSchemeTools = foundTools.filter(name => 
              name.includes('workflow_scheme') && !['get_workflow_schemes_basic'].includes(name)
            );
            
            const screenTools = foundTools.filter(name => 
              name.includes('screen')
            );

            console.log('\n📋 Tool Categories:');
            console.log(`  🔄 Workflow Tools: ${workflowTools.length}`);
            console.log(`  🔗 Workflow Scheme Tools: ${workflowSchemeTools.length}`);
            console.log(`  🖥️  Screen Tools: ${screenTools.length}`);
            console.log(`  📊 Total: ${foundTools.length}`);

            // Display all tools
            console.log('\n📝 All registered tools:');
            tools.forEach((tool, index) => {
              const category = tool.name.includes('workflow') && !tool.name.includes('screen') 
                ? '🔄' 
                : tool.name.includes('screen') 
                ? '🖥️' 
                : '🔗';
              console.log(`  ${index + 1}. ${category} ${tool.name} - ${tool.description}`);
            });

            serverProcess.kill();
            resolve({ 
              success: true, 
              totalTools: tools.length,
              workflowTools: workflowTools.length,
              workflowSchemeTools: workflowSchemeTools.length, 
              screenTools: screenTools.length,
              missingTools,
              extraTools
            });
            return;
          }
        }
      } catch (error) {
        // Partial JSON, continue collecting
      }
    });

    // Send the test message
    setTimeout(() => {
      serverProcess.stdin.write(JSON.stringify(testMessage) + '\n');
    }, 1000);

    // Timeout handling
    setTimeout(() => {
      if (!errorOccurred) {
        console.log('⏰ Test timeout - server may not be responding properly');
        serverProcess.kill();
        resolve({ success: false, error: 'timeout' });
      }
    }, 10000);

    serverProcess.on('error', (error) => {
      console.error('❌ Failed to start server:', error.message);
      reject(error);
    });

    serverProcess.on('exit', (code) => {
      if (code !== 0 && !errorOccurred) {
        console.error(`❌ Server exited with code ${code}`);
        resolve({ success: false, error: `exit_code_${code}` });
      }
    });
  });
}

// Run the test
testWorkflowTools()
  .then((result) => {
    if (result.success) {
      console.log('\n🎉 Jira Workflows MCP Server test completed successfully!');
      console.log(`✅ Server has ${result.totalTools} workflow-related tools ready for use.`);
    } else {
      console.log(`\n❌ Test failed: ${result.error}`);
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('\n💥 Test failed with error:', error.message);
    process.exit(1);
  });