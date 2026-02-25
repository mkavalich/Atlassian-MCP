/**
 * Field Configurations for Entity-Specific Response Formatting
 *
 * Defines which fields to include at each response format level
 * (concise, standard, detailed) for all supported entity types.
 *
 * Field paths use dot notation for nested objects (e.g., 'status.name').
 * The special value '*' means "include all fields".
 */

import type { EntityType, EntityFieldConfig } from '../types/field-config.js';

/**
 * Field configurations for all supported Atlassian entity types.
 *
 * Each entity has three levels:
 * - concise: Minimal fields for list views (~3-5 fields)
 * - standard: Common fields for typical usage (~6-10 fields)
 * - detailed: All fields (specified as ['*'])
 */
export const FIELD_CONFIGS: Record<EntityType, EntityFieldConfig> = {
  // ========================================
  // Jira Projects Server
  // ========================================

  issue: {
    concise: ['key', 'summary', 'status.name'],
    standard: [
      'key',
      'summary',
      'status.name',
      'assignee.displayName',
      'priority.name',
      'issuetype.name',
      'created',
      'updated',
    ],
    detailed: ['*'],
  },

  project: {
    concise: ['key', 'name'],
    standard: [
      'key',
      'name',
      'lead.displayName',
      'projectTypeKey',
      'style',
      'description',
    ],
    detailed: ['*'],
  },

  comment: {
    concise: ['id', 'author.displayName', 'created'],
    standard: [
      'id',
      'author.displayName',
      'body',
      'created',
      'updated',
      'visibility.type',
    ],
    detailed: ['*'],
  },

  transition: {
    concise: ['id', 'name'],
    standard: ['id', 'name', 'to.name', 'to.statusCategory.name', 'hasScreen'],
    detailed: ['*'],
  },

  dashboard: {
    concise: ['id', 'name'],
    standard: [
      'id',
      'name',
      'owner.displayName',
      'popularity',
      'isFavourite',
      'view',
    ],
    detailed: ['*'],
  },

  issueType: {
    concise: ['id', 'name'],
    standard: [
      'id',
      'name',
      'description',
      'subtask',
      'hierarchyLevel',
      'iconUrl',
    ],
    detailed: ['*'],
  },

  attachment: {
    concise: ['id', 'filename', 'mimeType'],
    standard: [
      'id',
      'filename',
      'mimeType',
      'size',
      'author.displayName',
      'created',
      'content',
    ],
    detailed: ['*'],
  },

  // ========================================
  // Jira Workflows Server
  // ========================================

  workflow: {
    concise: ['name', 'isDefault'],
    standard: [
      'name',
      'description',
      'isDefault',
      'statuses',
      'transitions',
      'lastModifiedUser',
    ],
    detailed: ['*'],
  },

  screen: {
    concise: ['id', 'name'],
    standard: ['id', 'name', 'description', 'scope.type', 'scope.project.key'],
    detailed: ['*'],
  },

  automationRule: {
    concise: ['id', 'name', 'state'],
    standard: [
      'id',
      'name',
      'state',
      'trigger.type',
      'ruleScope.type',
      'created',
      'authorAccountId',
    ],
    detailed: ['*'],
  },

  status: {
    concise: ['id', 'name', 'statusCategory.name'],
    standard: [
      'id',
      'name',
      'description',
      'statusCategory.name',
      'statusCategory.colorName',
      'scope.type',
    ],
    detailed: ['*'],
  },

  workflowScheme: {
    concise: ['id', 'name'],
    standard: [
      'id',
      'name',
      'description',
      'defaultWorkflow',
      'draft',
    ],
    detailed: ['*'],
  },

  screenScheme: {
    concise: ['id', 'name'],
    standard: [
      'id',
      'name',
      'description',
      'screens.default',
      'screens.create',
      'screens.edit',
      'screens.view',
    ],
    detailed: ['*'],
  },

  automationTemplate: {
    concise: ['id', 'name'],
    standard: [
      'id',
      'name',
      'description',
      'category',
    ],
    detailed: ['*'],
  },

  // ========================================
  // Jira Fields/Permissions Server
  // ========================================

  field: {
    concise: ['id', 'name', 'schema.type'],
    standard: [
      'id',
      'name',
      'description',
      'schema.type',
      'schema.system',
      'isLocked',
      'searcherKey',
    ],
    detailed: ['*'],
  },

  fieldConfiguration: {
    concise: ['id', 'name'],
    standard: ['id', 'name', 'description', 'isDefault'],
    detailed: ['*'],
  },

  permissionScheme: {
    concise: ['id', 'name'],
    standard: ['id', 'name', 'description', 'self'],
    detailed: ['*'],
  },

  permission: {
    concise: ['key', 'name'],
    standard: ['key', 'name', 'description', 'type'],
    detailed: ['*'],
  },

  // ========================================
  // Jira Service Desk Server
  // ========================================

  request: {
    concise: ['issueKey', 'requestTypeId', 'currentStatus.status'],
    standard: [
      'issueKey',
      'requestTypeId',
      'serviceDeskId',
      'currentStatus.status',
      'reporter.displayName',
      'createdDate.friendly',
      'requestFieldValues',
    ],
    detailed: ['*'],
  },

  queue: {
    concise: ['id', 'name', 'issueCount'],
    standard: ['id', 'name', 'jql', 'issueCount', 'fields'],
    detailed: ['*'],
  },

  sla: {
    concise: ['id', 'name'],
    standard: ['id', 'name', 'completedCycles', 'ongoingCycle.breached'],
    detailed: ['*'],
  },

  customer: {
    concise: ['accountId', 'displayName'],
    standard: ['accountId', 'displayName', 'emailAddress', 'active', 'links'],
    detailed: ['*'],
  },

  serviceDesk: {
    concise: ['id', 'projectKey', 'projectName'],
    standard: ['id', 'projectKey', 'projectName', 'projectId', '_links.self'],
    detailed: ['*'],
  },

  requestType: {
    concise: ['id', 'name', 'description'],
    standard: ['id', 'name', 'description', 'serviceDeskId', 'issueTypeId', 'groupIds', 'helpText'],
    detailed: ['*'],
  },

  customerOrganization: {
    concise: ['id', 'name'],
    standard: ['id', 'name', '_links.self'],
    detailed: ['*'],
  },

  // ========================================
  // Jira Organization Server
  // ========================================

  user: {
    concise: ['accountId', 'displayName'],
    standard: [
      'accountId',
      'displayName',
      'emailAddress',
      'active',
      'accountType',
      'timeZone',
    ],
    detailed: ['*'],
  },

  group: {
    concise: ['groupId', 'name'],
    standard: ['groupId', 'name', 'self'],
    detailed: ['*'],
  },

  // ========================================
  // Confluence Server
  // ========================================

  page: {
    concise: ['id', 'title', 'status'],
    standard: [
      'id',
      'title',
      'status',
      'spaceId',
      'parentId',
      'authorId',
      'createdAt',
      'version.number',
    ],
    detailed: ['*'],
  },

  space: {
    concise: ['id', 'key', 'name'],
    standard: [
      'id',
      'key',
      'name',
      'type',
      'status',
      'description.plain.value',
      'homepageId',
    ],
    detailed: ['*'],
  },

  blogPost: {
    concise: ['id', 'title', 'status'],
    standard: [
      'id',
      'title',
      'status',
      'spaceId',
      'authorId',
      'createdAt',
      'version.number',
    ],
    detailed: ['*'],
  },

  // ========================================
  // Jira Product Discovery Server
  // ========================================

  idea: {
    concise: ['key', 'summary', 'status.name'],
    standard: [
      'key',
      'summary',
      'status.name',
      'priority.name',
      'issuetype.name',
      'created',
      'updated',
    ],
    detailed: ['*'],
  },

  insight: {
    concise: ['id', 'description', 'created'],
    standard: [
      'id',
      'description',
      'created',
      'updated',
      'author.displayName',
      'snippets',
    ],
    detailed: ['*'],
  },

  jpdProject: {
    concise: ['key', 'name'],
    standard: [
      'id',
      'key',
      'name',
      'projectTypeKey',
      'description',
      'lead.displayName',
    ],
    detailed: ['*'],
  },
};
