import { z } from 'zod';

/**
 * Input schemas for Jira Organization MCP Server tools.
 *
 * All schemas use .passthrough() to allow Extensions to add
 * additional parameters (like responseFormat) without modifying these schemas.
 */

// Global Organization input schemas
export const getOrganizationInfoInputSchema = z.object({}).passthrough();

export const getOrganizationPoliciesInputSchema = z.object({}).passthrough();

export const getOrganizationDomainsInputSchema = z.object({}).passthrough();

export const getOrganizationWorkspacesInputSchema = z.object({}).passthrough();

export const getOrganizationEventsInputSchema = z.object({
  limit: z.number().min(1).max(1000).optional().default(50)
    .describe('Maximum number of events to return (default: 50, max: 1000)'),
  from: z.string().max(64).optional()
    .describe('Start date for events (ISO 8601 format)'),
  to: z.string().max(64).optional()
    .describe('End date for events (ISO 8601 format)'),
}).passthrough();

// Identity Providers input schemas
export const getIdentityProvidersInputSchema = z.object({}).passthrough();

export const getDirectoryInfoInputSchema = z.object({
  directoryId: z.string().max(255).describe('Directory ID to get information for'),
}).passthrough();

export const getDirectorySyncStatusInputSchema = z.object({
  directoryId: z.string().max(255).optional()
    .describe('Directory ID to check sync status for (optional - checks all if not specified)'),
}).passthrough();

export const getDirectorySyncSettingsInputSchema = z.object({
  directoryId: z.string().max(255).describe('Directory ID to get sync settings for'),
}).passthrough();

export const getDirectoryUsersInputSchema = z.object({
  directoryId: z.string().max(255).optional()
    .describe('Directory ID to get users from (optional - gets from all directories if not specified)'),
  limit: z.number().min(1).max(1000).optional().default(100)
    .describe('Maximum number of users to return (default: 100, max: 1000)'),
  cursor: z.string().max(4096).optional()
    .describe('Pagination cursor for large result sets'),
}).passthrough();

export const getDirectoryGroupsInputSchema = z.object({
  directoryId: z.string().max(255).optional()
    .describe('Directory ID to get groups from (optional - gets from all directories if not specified)'),
  limit: z.number().min(1).max(1000).optional().default(100)
    .describe('Maximum number of groups to return (default: 100, max: 1000)'),
}).passthrough();

export const getUserLastActiveInputSchema = z.object({
  accountId: z.string().max(255).describe('User account ID to get last active dates for'),
}).passthrough();

// Global User Analysis input schemas
export const getOrganizationUsersInputSchema = z.object({
  limit: z.number().min(1).max(1000).optional().default(100)
    .describe('Maximum number of users to return (default: 100, max: 1000)'),
  accountType: z.enum(['atlassian', 'customer', 'app']).optional()
    .describe('Filter by account type'),
  status: z.enum(['active', 'inactive', 'suspended']).optional()
    .describe('Filter by account status'),
}).passthrough();

export const searchOrganizationUsersInputSchema = z.object({
  query: z.string().max(10000).optional()
    .describe('Search query for user name, email, or display name'),
  domain: z.string().max(255).optional()
    .describe('Filter by email domain (useful for Azure AD analysis)'),
  accountType: z.enum(['atlassian', 'customer', 'app']).optional()
    .describe('Filter by account type'),
  lastActiveAfter: z.string().max(64).optional()
    .describe('Filter users active after this date (ISO 8601 format)'),
  limit: z.number().min(1).max(1000).optional().default(50)
    .describe('Maximum number of users to return (default: 50, max: 1000)'),
}).passthrough();

export const getUserRoleAssignmentsInputSchema = z.object({
  accountId: z.string().max(255).describe('User account ID to get role assignments for'),
}).passthrough();

export const getUserGroupMembershipsInputSchema = z.object({
  accountId: z.string().max(255).describe('User account ID to get group memberships for'),
}).passthrough();

export const analyzeUserAccessInputSchema = z.object({
  accountId: z.string().max(255).optional().describe('User account ID to analyze'),
  email: z.string().max(255).optional().describe('User email to analyze (alternative to accountId)'),
}).passthrough();

// Group 3: Cross-Product Analytics & Directory Health input schemas

// Compass API - Cross-Product Metrics input schemas
export const getCompassComponentMetricsInputSchema = z.object({
  componentId: z.string().max(255).optional()
    .describe('Filter metrics for a specific component ID'),
  teamId: z.string().max(255).optional()
    .describe('Filter metrics for components owned by a specific team'),
  metricType: z.enum(['performance', 'quality', 'security', 'deployment', 'usage']).optional()
    .describe('Filter by metric category'),
  period: z.enum(['daily', 'weekly', 'monthly', 'quarterly']).optional().default('weekly')
    .describe('Time period for metrics aggregation'),
  startDate: z.string().max(64).optional()
    .describe('Start date for metrics (ISO 8601 format)'),
  endDate: z.string().max(64).optional()
    .describe('End date for metrics (ISO 8601 format)'),
  limit: z.number().min(1).max(500).optional().default(100)
    .describe('Maximum number of metrics to return (default: 100, max: 500)'),
  nextPageToken: z.string().max(4096).optional()
    .describe('Token for pagination to get next page of results'),
}).passthrough();

export const getCompassTeamMetricsInputSchema = z.object({
  teamId: z.string().max(255).optional()
    .describe('Filter metrics for a specific team ID'),
  metricType: z.enum(['productivity', 'delivery', 'quality', 'collaboration']).optional()
    .describe('Filter by team metric category'),
  period: z.enum(['daily', 'weekly', 'monthly', 'quarterly']).optional().default('weekly')
    .describe('Time period for metrics aggregation'),
  startDate: z.string().max(64).optional()
    .describe('Start date for metrics (ISO 8601 format)'),
  endDate: z.string().max(64).optional()
    .describe('End date for metrics (ISO 8601 format)'),
  includeComponents: z.boolean().optional().default(false)
    .describe('Include component-level breakdown in team metrics'),
  limit: z.number().min(1).max(500).optional().default(100)
    .describe('Maximum number of metrics to return (default: 100, max: 500)'),
  nextPageToken: z.string().max(4096).optional()
    .describe('Token for pagination to get next page of results'),
}).passthrough();

export const getCompassSystemEventsInputSchema = z.object({
  eventType: z.enum([
    'component.created', 'component.updated', 'component.deleted',
    'team.created', 'team.updated', 'team.deleted',
    'metric.threshold.breached', 'deployment.started', 'deployment.completed',
    'incident.created', 'incident.resolved'
  ]).optional()
    .describe('Filter by specific event type'),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional()
    .describe('Filter by event severity level'),
  status: z.enum(['active', 'resolved', 'acknowledged']).optional()
    .describe('Filter by event status'),
  startDate: z.string().max(64).optional()
    .describe('Start date for events (ISO 8601 format)'),
  endDate: z.string().max(64).optional()
    .describe('End date for events (ISO 8601 format)'),
  limit: z.number().min(1).max(500).optional().default(100)
    .describe('Maximum number of events to return (default: 100, max: 500)'),
  nextPageToken: z.string().max(4096).optional()
    .describe('Token for pagination to get next page of results'),
}).passthrough();

export const getCompassComponentEventsInputSchema = z.object({
  componentId: z.string().max(255).optional()
    .describe('Filter events for a specific component ID'),
  eventType: z.enum([
    'deployment', 'incident', 'metric_breach', 'health_check', 'configuration_change'
  ]).optional()
    .describe('Filter by component event type'),
  severity: z.enum(['info', 'warning', 'error', 'critical']).optional()
    .describe('Filter by event severity level'),
  status: z.enum(['active', 'resolved', 'investigating']).optional()
    .describe('Filter by event status'),
  startDate: z.string().max(64).optional()
    .describe('Start date for events (ISO 8601 format)'),
  endDate: z.string().max(64).optional()
    .describe('End date for events (ISO 8601 format)'),
  limit: z.number().min(1).max(500).optional().default(100)
    .describe('Maximum number of events to return (default: 100, max: 500)'),
  nextPageToken: z.string().max(4096).optional()
    .describe('Token for pagination to get next page of results'),
}).passthrough();

// SCIM Directory Health input schemas
export const getScimDirectoryGroupsInputSchema = z.object({
  directoryId: z.string().max(255)
    .describe('Directory ID to get groups from'),
  filter: z.string().max(10000).optional()
    .describe('SCIM filter expression (e.g., displayName sw "Engineering")'),
  startIndex: z.number().min(1).optional().default(1)
    .describe('1-based index of the first result to return (default: 1)'),
  count: z.number().min(1).max(500).optional().default(100)
    .describe('Maximum number of groups to return (default: 100, max: 500)'),
  attributes: z.array(z.string().max(255)).optional()
    .describe('Specific attributes to include in response'),
  excludedAttributes: z.array(z.string().max(255)).optional()
    .describe('Specific attributes to exclude from response'),
}).passthrough();

export const getScimDirectorySchemasInputSchema = z.object({
  directoryId: z.string().max(255)
    .describe('Directory ID to get schemas from'),
  startIndex: z.number().min(1).optional().default(1)
    .describe('1-based index of the first result to return (default: 1)'),
  count: z.number().min(1).max(100).optional().default(50)
    .describe('Maximum number of schemas to return (default: 50, max: 100)'),
}).passthrough();

export const getScimDirectoryResourceTypesInputSchema = z.object({
  directoryId: z.string().max(255)
    .describe('Directory ID to get resource types from'),
  startIndex: z.number().min(1).optional().default(1)
    .describe('1-based index of the first result to return (default: 1)'),
  count: z.number().min(1).max(100).optional().default(50)
    .describe('Maximum number of resource types to return (default: 50, max: 100)'),
}).passthrough();

// Organization Management input schemas
export const getOrganizationsInputSchema = z.object({
  limit: z.number().min(1).max(200).optional().default(50)
    .describe('Maximum number of organizations to return (default: 50, max: 200)'),
  page: z.number().min(1).optional().default(1)
    .describe('Page number for pagination (default: 1)'),
  status: z.enum(['active', 'suspended', 'deleted']).optional()
    .describe('Filter organizations by status'),
  type: z.enum(['standard', 'enterprise']).optional()
    .describe('Filter organizations by type'),
}).passthrough();

export const getOrganizationDetailsInputSchema = z.object({
  orgId: z.string().max(255)
    .describe('Organization ID to get detailed information for'),
  includeStatistics: z.boolean().optional().default(false)
    .describe('Include usage statistics in the response'),
  includeAudit: z.boolean().optional().default(false)
    .describe('Include audit configuration details'),
  includeCompliance: z.boolean().optional().default(false)
    .describe('Include compliance certification status'),
}).passthrough();

// Enhanced Directory Analytics input schemas
export const getDirectoryHealthStatusInputSchema = z.object({
  directoryId: z.string().max(255).optional()
    .describe('Directory ID to check health for (optional - checks all if not specified)'),
  includeSync: z.boolean().optional().default(true)
    .describe('Include synchronization status and metrics'),
  includeErrors: z.boolean().optional().default(true)
    .describe('Include recent error logs and issues'),
  includePerformance: z.boolean().optional().default(false)
    .describe('Include performance metrics and sync speeds'),
}).passthrough();

export const getCrossProductUserActivityInputSchema = z.object({
  accountId: z.string().max(255).optional()
    .describe('User account ID to analyze activity across products'),
  email: z.string().max(255).optional()
    .describe('User email to analyze (alternative to accountId)'),
  startDate: z.string().max(64).optional()
    .describe('Start date for activity analysis (ISO 8601 format)'),
  endDate: z.string().max(64).optional()
    .describe('End date for activity analysis (ISO 8601 format)'),
  products: z.array(z.enum(['jira', 'confluence', 'bitbucket', 'trello'])).optional()
    .describe('Specific products to include in activity analysis'),
  includeDetails: z.boolean().optional().default(false)
    .describe('Include detailed activity breakdown by product'),
}).passthrough();

export const getProvisioningInsightsInputSchema = z.object({
  directoryId: z.string().max(255).optional()
    .describe('Directory ID to analyze provisioning for'),
  timeframe: z.enum(['7d', '30d', '90d', '1y']).optional().default('30d')
    .describe('Timeframe for provisioning analysis'),
  includeFailures: z.boolean().optional().default(true)
    .describe('Include failed provisioning attempts'),
  includePerformance: z.boolean().optional().default(false)
    .describe('Include provisioning performance metrics'),
  groupBy: z.enum(['day', 'week', 'month']).optional().default('day')
    .describe('Group provisioning data by time period'),
}).passthrough();

// User Management & Permissions input schemas (Group 2 endpoints)
export const getUserManageInputSchema = z.object({
  account_id: z.string().max(255).describe('User account ID to get management permissions for'),
}).passthrough();

export const getUserManageProfileInputSchema = z.object({
  account_id: z.string().max(255).describe('User account ID to get detailed profile information for'),
}).passthrough();

export const getUserManageApiTokensInputSchema = z.object({
  account_id: z.string().max(255).describe('User account ID to get API tokens for'),
}).passthrough();

// Usage Analytics input schemas (Group 2 endpoints)
export const getOrgUserStatsInputSchema = z.object({
  orgId: z.string().max(255).describe('Organization ID to get user statistics for'),
  directoryId: z.string().max(255).describe('Directory ID to get user statistics for'),
  includeInactive: z.boolean().optional().default(false)
    .describe('Whether to include inactive users in statistics'),
  timeframe: z.enum(['7d', '30d', '90d', '1y']).optional().default('30d')
    .describe('Timeframe for user activity statistics'),
}).passthrough();

export const getOrgGroupStatsInputSchema = z.object({
  orgId: z.string().max(255).describe('Organization ID to get group statistics for'),
  directoryId: z.string().max(255).describe('Directory ID to get group statistics for'),
  includeEmpty: z.boolean().optional().default(false)
    .describe('Whether to include empty groups in statistics'),
  timeframe: z.enum(['7d', '30d', '90d', '1y']).optional().default('30d')
    .describe('Timeframe for group activity statistics'),
}).passthrough();
