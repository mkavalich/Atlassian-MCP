import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JiraApiClient } from '../api/client.js';

/**
 * Cross-Product Analytics Tools (Compass API)
 *
 * REMOVED: All tools in this module require Compass to be enabled in the organization.
 * - get_compass_component_metrics - requires Compass
 * - get_compass_team_metrics - requires Compass
 * - get_compass_system_events - requires Compass
 * - get_compass_component_events - requires Compass
 *
 * These tools are documented in backlog.json and may be re-added if Compass
 * integration is available.
 */
export async function registerCrossProductAnalyticsTools(_server: McpServer, _apiClient: JiraApiClient) {
  // No tools registered - all Compass tools require Compass to be enabled
  // See backlog.json for details on why these tools were removed
}
