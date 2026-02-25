import { z } from 'zod';

/**
 * Input schemas for Jira Product Discovery MCP Server tools.
 *
 * All schemas use .passthrough() to allow Extensions to add
 * additional parameters (like responseFormat) without modifying these schemas.
 */

// =====================
// JPD Projects Input Schema
// =====================

export const getJpdProjectsInputSchema = z.object({
  query: z.string().optional()
    .describe('Filter projects by name or key (e.g., "Discovery" or "JPD")'),
  startAt: z.number().min(0).optional()
    .describe('Starting index for pagination (default: 0)'),
  maxResults: z.number().min(1).max(100).optional()
    .describe('Maximum number of projects to return (default: 20, max: 100)'),
  fields: z.enum(['summary', 'full']).optional()
    .describe('Response detail level: "summary" for key info only, "full" for all fields (default: summary)'),
}).passthrough();

// =====================
// Ideas Input Schemas (REST API)
// =====================

export const getIdeasInputSchema = z.object({
  projectKey: z.string().min(1)
    .describe('The project key to list ideas from (e.g., "JPD")'),
  startAt: z.number().min(0).optional()
    .describe('Starting index for pagination (default: 0)'),
  maxResults: z.number().min(1).max(100).optional()
    .describe('Maximum ideas to return (default: 20, max: 100)'),
  fields: z.enum(['summary', 'full']).optional()
    .describe('Response detail level: "summary" for key/summary only, "full" for all fields (default: summary)'),
}).passthrough();

export const searchIdeasInputSchema = z.object({
  jql: z.string().min(1)
    .describe('JQL query to search ideas (e.g., "project = JPD AND status = Open")'),
  startAt: z.number().min(0).optional()
    .describe('Starting index for pagination (default: 0)'),
  maxResults: z.number().min(1).max(100).optional()
    .describe('Maximum ideas to return (default: 20, max: 100)'),
  fields: z.enum(['summary', 'full']).optional()
    .describe('Response detail level (default: summary)'),
  expand: z.string().optional()
    .describe('Comma-separated fields to expand (e.g., "changelog,transitions")'),
}).passthrough();

export const getIdeaInputSchema = z.object({
  ideaIdOrKey: z.string().min(1)
    .describe('The idea ID or key (e.g., "JPD-123" or "10001")'),
  expand: z.string().optional()
    .describe('Comma-separated fields to expand (e.g., "changelog,transitions,renderedFields")'),
  fields: z.enum(['summary', 'full']).optional()
    .describe('Response detail level (default: full)'),
}).passthrough();

export const createIdeaInputSchema = z.object({
  projectKey: z.string().min(1)
    .describe('The project key (e.g., "JPD"). Use get_jpd_projects to find valid keys'),
  summary: z.string().min(1).max(255)
    .describe('The idea title/summary (required, max 255 characters)'),
  description: z.string().optional()
    .describe('The idea description. Supports plain text or Atlassian Document Format (ADF)'),
  issueType: z.string().optional()
    .describe('The issue type name (default: "Idea")'),
  assignee: z.string().optional()
    .describe('Account ID of the assignee. Use search tools to find account IDs'),
  labels: z.array(z.string()).optional()
    .describe('Array of labels to apply to the idea'),
  priority: z.string().optional()
    .describe('Priority name (e.g., "High", "Medium", "Low")'),
  customFields: z.record(z.string(), z.unknown()).optional()
    .describe('Custom field values as key-value pairs (e.g., {"customfield_10001": "value"})'),
}).passthrough();

export const updateIdeaInputSchema = z.object({
  ideaIdOrKey: z.string().min(1)
    .describe('The idea ID or key to update (e.g., "JPD-123")'),
  summary: z.string().min(1).max(255).optional()
    .describe('New summary/title'),
  description: z.string().optional()
    .describe('New description (plain text or ADF)'),
  assignee: z.string().nullable().optional()
    .describe('Account ID of new assignee (set to null to unassign)'),
  labels: z.array(z.string()).optional()
    .describe('New labels array (replaces existing labels)'),
  priority: z.string().optional()
    .describe('New priority name'),
  customFields: z.record(z.string(), z.unknown()).optional()
    .describe('Custom field values to update'),
}).passthrough();

export const deleteIdeaInputSchema = z.object({
  ideaIdOrKey: z.string().min(1)
    .describe('The idea ID or key to delete (e.g., "JPD-123"). WARNING: This is permanent!'),
}).passthrough();

// =====================
// Insights Input Schemas (GraphQL)
// =====================

export const getInsightsInputSchema = z.object({
  ideaId: z.string().min(1)
    .describe('The idea ID or key to get insights for (e.g., "JPD-123")'),
  limit: z.number().min(1).max(100).optional()
    .describe('Maximum insights to return (default: 20, max: 100)'),
  offset: z.number().min(0).optional()
    .describe('Offset for pagination (default: 0)'),
}).passthrough();

export const getInsightInputSchema = z.object({
  insightId: z.string().min(1)
    .describe('The insight ID to retrieve'),
}).passthrough();

export const createInsightInputSchema = z.object({
  ideaId: z.string().min(1)
    .describe('The idea ID or key to attach the insight to (e.g., "JPD-123")'),
  description: z.string().min(1)
    .describe('The insight content/description - what did you learn or discover?'),
  snippets: z.array(z.object({
    data: z.string().optional()
      .describe('Snippet content/data'),
    url: z.string().url().optional()
      .describe('Source URL for the insight'),
  })).optional()
    .describe('Supporting snippets with source data or URLs'),
}).passthrough();

export const updateInsightInputSchema = z.object({
  insightId: z.string().min(1)
    .describe('The insight ID to update'),
  description: z.string().min(1)
    .describe('New insight description'),
  snippets: z.array(z.object({
    data: z.string().optional()
      .describe('Snippet content/data'),
    url: z.string().url().optional()
      .describe('Source URL'),
  })).optional()
    .describe('Updated snippets'),
}).passthrough();

export const deleteInsightInputSchema = z.object({
  insightId: z.string().min(1)
    .describe('The insight ID to delete. WARNING: This is permanent!'),
}).passthrough();

export const analyzeIdeaInsightsInputSchema = z.object({
  ideaId: z.string().min(1)
    .describe('The idea ID or key to analyze insights for'),
  limit: z.number().min(1).max(100).optional()
    .describe('Maximum insights to include in analysis (default: 50)'),
}).passthrough();

// =====================
// Scoring Input Schema (GraphQL)
// =====================

export const getIdeaScoringInputSchema = z.object({
  ideaId: z.string().min(1)
    .describe('The idea ID or key to get scoring data for'),
}).passthrough();
