// Authentication types
export interface AuthConfig {
  type: 'basic' | 'oauth';
  baseUrl: string;
  email?: string;
  apiToken?: string;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
}

// API request/response types
export interface RequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  params?: Record<string, any>;
  data?: any;
  headers?: Record<string, string>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
    suggestion?: string;
  };
  metadata?: {
    requestId?: string;
    executionTime?: number;
    rateLimitInfo?: RateLimitInfo;
  };
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

// GraphQL types
export interface GraphQLRequest {
  query: string;
  variables?: Record<string, any>;
  operationName?: string;
}

export interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLErrorDetail[];
}

export interface GraphQLErrorDetail {
  message: string;
  locations?: { line: number; column: number }[];
  path?: (string | number)[];
  extensions?: Record<string, any>;
}

// Jira user type
export interface JiraUser {
  accountId: string;
  displayName?: string;
  emailAddress?: string;
  avatarUrls?: Record<string, string>;
  active?: boolean;
}

// JPD Project type (JPD projects are regular Jira projects with specific type)
export interface JpdProject {
  id: string;
  key: string;
  name: string;
  description?: string;
  projectTypeKey: string; // 'product_discovery' for JPD projects
  lead?: JiraUser;
  style?: string;
  isPrivate?: boolean;
}

// JPD Idea type (Ideas are stored as Jira issues)
export interface JpdIdea {
  id: string;
  key: string;
  self: string;
  fields?: JpdIdeaFields;
  expand?: string;
  // Flat fields for summary mode
  summary?: string;
  description?: any;
  status?: JpdStatus;
  priority?: JpdPriority;
  issuetype?: JpdIssueType;
  created?: string;
  updated?: string;
  assignee?: JiraUser | null;
  reporter?: JiraUser;
  labels?: string[];
  transitions?: any[];
  changelog?: any;
}

export interface JpdIdeaFields {
  summary: string;
  description?: any; // ADF format
  issuetype: JpdIssueType;
  project: JpdProject;
  status: JpdStatus;
  priority?: JpdPriority;
  assignee?: JiraUser | null;
  reporter?: JiraUser;
  creator?: JiraUser;
  created: string;
  updated: string;
  labels?: string[];
  // JPD-specific fields (custom fields)
  [key: string]: any;
}

export interface JpdIssueType {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
  subtask?: boolean;
}

export interface JpdStatus {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
  statusCategory?: {
    id: number;
    key: string;
    name: string;
    colorName: string;
  };
}

export interface JpdPriority {
  id: string;
  name: string;
  iconUrl?: string;
  description?: string;
}

// JPD Insight types (GraphQL)
export interface JpdInsight {
  id: string;
  description: string;
  created?: string;
  updated?: string;
  createdBy?: JiraUser;
  author?: {
    accountId: string;
    displayName?: string;
  };
  snippets?: JpdInsightSnippet[];
  properties?: Record<string, any>;
}

export interface JpdInsightSnippet {
  id: string;
  data?: string;
  oauthClientId?: string;
  url?: string;
}

export interface JpdInsightInput {
  ideaId: string;
  description: string;
  snippets?: {
    data?: string;
    url?: string;
  }[];
}

// JPD Scoring types (GraphQL)
export interface JpdScoringData {
  ideaId?: string;
  scores?: JpdScore[];
  fields?: JpdScore[];
  totalScore?: number;
  rank?: number;
}

export interface JpdScore {
  id?: string;
  fieldId?: string;
  name?: string;
  fieldName?: string;
  type?: string;
  value?: number | string | null;
  weight?: number;
  weightedValue?: number;
}

export interface JpdScoringField {
  id: string;
  name: string;
  description?: string;
  type: 'number' | 'rating' | 'select';
  options?: JpdScoringOption[];
  weight?: number;
}

export interface JpdScoringOption {
  id: string;
  label: string;
  value: number;
}

// JPD View types (GraphQL)
export interface JpdView {
  id: string;
  name: string;
  projectKey: string;
  type: 'roadmap' | 'board' | 'list' | 'matrix' | 'timeline';
  filters?: JpdFilter[];
  groupBy?: string;
  sortBy?: string;
}

export interface JpdFilter {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'in' | 'greater_than' | 'less_than';
  value: any;
}

// Search result types (new /search/jql format as of Aug 2025)
export interface JpdSearchResult {
  issues: JpdIdea[];
  nextPageToken?: string;
  isLast: boolean;
  // Legacy fields (may not be present in new API)
  expand?: string;
  startAt?: number;
  maxResults?: number;
  total?: number;
}

// Create idea response
export interface JpdCreateIdeaResponse {
  id: string;
  key: string;
  self: string;
}

// Insights list response (GraphQL)
export interface JpdInsightsResponse {
  insights: JpdInsight[];
  total: number;
  hasMore: boolean;
}

// Insight analysis response
export interface JpdInsightAnalysis {
  ideaId: string;
  ideaKey: string;
  totalInsights: number;
  insightsByType?: Record<string, number>;
  recentInsights: JpdInsight[];
  summary?: string;
}

// Aliases for compatibility with ideas.ts patterns
export type JiraSearchResult = JpdSearchResult;
export type JiraCreateIssueResponse = JpdCreateIdeaResponse;
