/**
 * Field Configuration Types for Entity-Specific Formatting
 *
 * Defines which fields to include for each entity type at each
 * response format level (concise, standard, detailed).
 */

import type { ResponseFormat } from './response-format.js';

/**
 * Field path supporting dot notation for nested objects.
 * Examples: 'key', 'status.name', 'assignee.displayName'
 */
export type FieldPath = string;

/**
 * Field configuration for a single entity type.
 */
export interface EntityFieldConfig {
  /** Fields for concise format (minimal, ~3-5 fields) */
  concise: FieldPath[];
  /** Fields for standard format (common fields, ~6-10 fields) */
  standard: FieldPath[];
  /** Fields for detailed format ('*' means all fields) */
  detailed: FieldPath[] | ['*'];
}

/**
 * Supported entity types across all Atlassian MCP servers.
 */
export type EntityType =
  // Jira Projects
  | 'issue'
  | 'project'
  | 'comment'
  | 'transition'
  | 'dashboard'
  | 'issueType'
  | 'attachment'
  // Jira Workflows
  | 'workflow'
  | 'workflowScheme'
  | 'screen'
  | 'screenScheme'
  | 'automationRule'
  | 'automationTemplate'
  | 'status'
  // Jira Fields/Permissions
  | 'field'
  | 'fieldConfiguration'
  | 'permissionScheme'
  | 'permission'
  // Jira Service Desk
  | 'request'
  | 'queue'
  | 'sla'
  | 'customer'
  | 'serviceDesk'
  | 'requestType'
  | 'customerOrganization'
  // Jira Organization
  | 'user'
  | 'group'
  // Confluence
  | 'page'
  | 'space'
  | 'blogPost'
  // Jira Product Discovery
  | 'idea'
  | 'insight'
  | 'jpdProject';

/**
 * Gets the fields to include for a given entity type and format.
 */
export function getFieldsForFormat(
  entityType: EntityType,
  format: ResponseFormat,
  configs: Record<EntityType, EntityFieldConfig>
): FieldPath[] {
  const config = configs[entityType];
  if (!config) {
    // Fallback: return all fields for unknown entity types
    return ['*'];
  }
  return config[format];
}

/**
 * Checks if detailed format should return all fields.
 */
export function isAllFields(fields: FieldPath[]): boolean {
  return fields.length === 1 && fields[0] === '*';
}
