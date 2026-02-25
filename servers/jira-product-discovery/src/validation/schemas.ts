import { z } from 'zod';

// =====================
// Ideas Schemas (REST API)
// =====================

export const getIdeasSchema = z.object({
  projectKey: z.string().min(1).describe('The project key'),
  startAt: z.number().min(0).optional().default(0).describe('Starting index for pagination'),
  maxResults: z.number().min(1).max(100).optional().default(20).describe('Maximum results to return'),
  fields: z.enum(['summary', 'full']).optional().default('summary').describe('Response detail level'),
}).strict();

export const searchIdeasSchema = z.object({
  jql: z.string().min(1).describe('JQL query to search for ideas'),
  startAt: z.number().min(0).optional().default(0).describe('Starting index for pagination'),
  maxResults: z.number().min(1).max(100).optional().default(20).describe('Maximum results to return'),
  fields: z.enum(['summary', 'full']).optional().default('summary').describe('Response detail level'),
  expand: z.string().optional().describe('Comma-separated list of fields to expand'),
}).strict();

export const getIdeaSchema = z.object({
  ideaIdOrKey: z.string().min(1).describe('The idea ID or key (e.g., "JPD-123")'),
  expand: z.string().optional().describe('Comma-separated list of fields to expand'),
  fields: z.enum(['summary', 'full']).optional().default('full').describe('Response detail level'),
}).strict();

export const createIdeaSchema = z.object({
  projectKey: z.string().min(1).describe('The project key'),
  summary: z.string().min(1).max(255).describe('The idea summary/title'),
  description: z.string().optional().describe('The idea description'),
  issueType: z.string().optional().default('Idea').describe('The issue type name'),
  assignee: z.string().optional().describe('Account ID of the assignee'),
  labels: z.array(z.string()).optional().describe('Labels to apply'),
  priority: z.string().optional().describe('Priority name'),
  customFields: z.record(z.string(), z.unknown()).optional().describe('Custom field values'),
}).strict();

export const updateIdeaSchema = z.object({
  ideaIdOrKey: z.string().min(1).describe('The idea ID or key'),
  summary: z.string().min(1).max(255).optional().describe('New summary'),
  description: z.string().optional().describe('New description'),
  assignee: z.string().nullable().optional().describe('Account ID of assignee (null to unassign)'),
  labels: z.array(z.string()).optional().describe('Labels to set'),
  priority: z.string().optional().describe('Priority name'),
  customFields: z.record(z.string(), z.unknown()).optional().describe('Custom field values'),
}).strict();

export const deleteIdeaSchema = z.object({
  ideaIdOrKey: z.string().min(1).describe('The idea ID or key to delete'),
}).strict();

// =====================
// JPD Projects Schema
// =====================

export const getJpdProjectsSchema = z.object({
  query: z.string().optional().describe('Filter projects by name or key'),
  startAt: z.number().min(0).optional().default(0).describe('Starting index'),
  maxResults: z.number().min(1).max(100).optional().default(20).describe('Max results'),
  fields: z.enum(['summary', 'full']).optional().default('summary').describe('Response detail level'),
}).strict();

// =====================
// Insights Schemas (GraphQL)
// =====================

export const getInsightsSchema = z.object({
  ideaId: z.string().min(1).describe('The idea ID or key'),
  limit: z.number().min(1).max(100).optional().default(20).describe('Maximum insights to return'),
  offset: z.number().min(0).optional().default(0).describe('Offset for pagination'),
}).strict();

export const getInsightSchema = z.object({
  insightId: z.string().min(1).describe('The insight ID'),
}).strict();

export const createInsightSchema = z.object({
  ideaId: z.string().min(1).describe('The idea ID or key to attach the insight to'),
  description: z.string().min(1).describe('The insight content/description'),
  snippets: z.array(z.object({
    data: z.string().optional().describe('Snippet data/content'),
    url: z.string().url().optional().describe('Source URL'),
  }).strict()).optional().describe('Insight snippets with supporting data'),
}).strict();

export const updateInsightSchema = z.object({
  insightId: z.string().min(1).describe('The insight ID to update'),
  description: z.string().min(1).describe('New insight description'),
  snippets: z.array(z.object({
    data: z.string().optional().describe('Snippet data/content'),
    url: z.string().url().optional().describe('Source URL'),
  }).strict()).optional().describe('Updated snippets'),
}).strict();

export const deleteInsightSchema = z.object({
  insightId: z.string().min(1).describe('The insight ID to delete'),
}).strict();

export const analyzeIdeaInsightsSchema = z.object({
  ideaId: z.string().min(1).describe('The idea ID or key'),
  limit: z.number().min(1).max(100).optional().default(50).describe('Maximum insights to analyze'),
}).strict();

// =====================
// Scoring Schema (GraphQL)
// =====================

export const getIdeaScoringSchema = z.object({
  ideaId: z.string().min(1).describe('The idea ID or key'),
}).strict();
