/**
 * Automation Rule Component Type Mapping
 *
 * Maps friendly names to Atlassian internal component type identifiers
 * used by the Jira Automation REST API.
 *
 * Sources:
 * - Confirmed via React state extraction from Jira Cloud Automation UI (2026-02-17)
 * - Confirmed via rule export JSON from Jira Cloud instances
 * - Confirmed via API rule creation testing
 *
 * All entries below are VERIFIED unless marked [inferred].
 * The `defaultValue` field contains the minimum required value object
 * for creating a rule with this component type via the public API.
 */

// ─── Trigger Types ──────────────────────────────────────────────────────────

export interface ComponentTypeEntry {
  /** Raw Atlassian API type identifier */
  apiType: string;
  /** Human-readable description */
  description: string;
  /** Default value object for this component type (minimum required for API creation) */
  defaultValue: Record<string, unknown> | string;
}

export const TRIGGER_TYPES: Record<string, ComponentTypeEntry> = {
  // ── Issue Event Triggers (all confirmed via UI React state extraction) ──
  ISSUE_CREATED: {
    apiType: 'jira.issue.event.trigger:created',
    description: 'Fires when an issue is created',
    defaultValue: { eventKey: 'jira:issue_created', issueEvent: 'issue_created' },
  },
  ISSUE_UPDATED: {
    apiType: 'jira.issue.event.trigger:updated',
    description: 'Fires when an issue is updated',
    defaultValue: { eventKey: 'jira:issue_updated', issueEvent: 'issue_updated' },
  },
  ISSUE_TRANSITIONED: {
    apiType: 'jira.issue.event.trigger:transitioned',
    description: 'Fires when an issue transitions between statuses',
    defaultValue: {
      eventKey: 'jira:issue_updated',
      issueEvent: 'issue_generic',
      fromStatus: [],
      toStatus: [],
    },
  },
  ISSUE_ASSIGNED: {
    apiType: 'jira.issue.event.trigger:assigned',
    description: 'Fires when an issue is assigned',
    defaultValue: { eventKey: 'jira:issue_updated', issueEvent: 'issue_assigned' },
  },
  ISSUE_COMMENTED: {
    apiType: 'jira.issue.event.trigger:commented',
    description: 'Fires when a comment is added to an issue',
    defaultValue: {
      eventKey: 'jira:issue_updated',
      issueEvent: 'issue_commented',
      eventTypes: [],
    },
  },
  ISSUE_DELETED: {
    apiType: 'jira.issue.event.trigger:deleted',
    description: 'Fires when an issue is deleted',
    defaultValue: { eventKey: 'jira:issue_deleted', issueEvent: 'issue_deleted' },
  },
  ISSUE_LINKED: {
    apiType: 'jira.issue.event.trigger:link',
    description: 'Fires when an issue is linked',
    defaultValue: { linkTypes: [] },
  },
  ISSUE_MOVED: {
    apiType: 'jira.issue.event.trigger:moved',
    description: 'Fires when an issue is moved to another project',
    defaultValue: {
      eventKey: 'jira:issue_updated',
      issueEvent: 'issue_moved',
      sourceProject: '-1999',
      targetProject: '-1999',
    },
  },
  WORK_LOGGED: {
    apiType: 'jira.issue.event.trigger:worklog',
    description: 'Fires when work is logged on an issue',
    defaultValue: { actions: [] },
  },

  // ── Field & Scheduled Triggers (confirmed) ──
  FIELD_VALUE_CHANGED: {
    apiType: 'jira.issue.field.changed',
    description: 'Fires when a specific field value changes',
    defaultValue: { fields: [], changeType: 'ANY_CHANGE', actions: [] },
  },
  SCHEDULED: {
    apiType: 'jira.jql.scheduled',
    description: 'Fires on a schedule, optionally runs a JQL query',
    defaultValue: {
      jql: '',
      executionMode: 'nosearch',
      onlyUpdatedIssues: true,
      schedule: {
        rate: 0,
        rateInterval: 86400,
        cronExpression: '',
        method: 'BASIC',
      },
    },
  },
  MANUAL: {
    apiType: 'jira.manual.trigger.issue',
    description: 'Manually triggered from an issue',
    defaultValue: { groups: [] },
  },
  INCOMING_WEBHOOK: {
    apiType: 'jira.incoming.webhook',
    description: 'Fires when an incoming webhook is received',
    defaultValue: { searchOrProvide: 'provided' },
  },
  MULTIPLE_ISSUE_EVENTS: {
    apiType: 'jira.multiple.issue.event',
    description: 'Fires on multiple configurable issue events',
    defaultValue: { events: [] },
  },

  // ── Version Triggers (confirmed) ──
  VERSION_CREATED: {
    apiType: 'jira.version.event.trigger:created',
    description: 'Fires when a version is created',
    defaultValue: { versionNameFilter: '' },
  },
  VERSION_RELEASED: {
    apiType: 'jira.version.event.trigger:released',
    description: 'Fires when a version is released [inferred]',
    defaultValue: { versionNameFilter: '' },
  },
  VERSION_UPDATED: {
    apiType: 'jira.version.event.trigger:updated',
    description: 'Fires when a version is updated [inferred]',
    defaultValue: { versionNameFilter: '' },
  },
  VERSION_DELETED: {
    apiType: 'jira.version.event.trigger:deleted',
    description: 'Fires when a version is deleted [inferred]',
    defaultValue: { versionNameFilter: '' },
  },
  VERSION_UNRELEASED: {
    apiType: 'jira.version.event.trigger:unreleased',
    description: 'Fires when a version is unreleased [inferred]',
    defaultValue: { versionNameFilter: '' },
  },

  // ── Sprint Triggers (confirmed: started; others inferred from pattern) ──
  SPRINT_CREATED: {
    apiType: 'jira.sprint.event.trigger:created',
    description: 'Fires when a sprint is created [inferred]',
    defaultValue: { sprintNameFilter: '' },
  },
  SPRINT_STARTED: {
    apiType: 'jira.sprint.event.trigger:started',
    description: 'Fires when a sprint is started',
    defaultValue: { sprintNameFilter: '' },
  },
  SPRINT_COMPLETED: {
    apiType: 'jira.sprint.event.trigger:completed',
    description: 'Fires when a sprint is completed [inferred]',
    defaultValue: { sprintNameFilter: '' },
  },

  // ── DevOps Triggers (confirmed) ──
  DEPLOYMENT_STATE_CHANGED: {
    apiType: 'devops.deploy.event.trigger:statechange',
    description: 'Fires when a deployment status changes',
    defaultValue: {},
  },
};

// ─── Action Types ───────────────────────────────────────────────────────────

export const ACTION_TYPES: Record<string, ComponentTypeEntry> = {
  // ── Issue Actions (all confirmed via UI React state extraction) ──
  TRANSITION_ISSUE: {
    apiType: 'jira.issue.transition',
    description: 'Transition an issue to a new status',
    defaultValue: {
      destinationStatus: { type: 'COPY', value: 'trigger' },
      transitionMatch: '',
      ignoreConditions: false,
      sendNotifications: true,
      operations: [],
    },
  },
  EDIT_ISSUE: {
    apiType: 'jira.issue.edit',
    description: 'Edit issue fields',
    defaultValue: {
      sendNotifications: true,
      operations: [],
    },
  },
  CREATE_ISSUE: {
    apiType: 'jira.issue.create',
    description: 'Create a new issue',
    defaultValue: {
      operations: [
        { field: { type: 'ID', value: 'summary' }, fieldType: 'summary', type: 'SET', value: null },
        { field: { type: 'ID', value: 'description' }, fieldType: 'description', type: 'SET', value: null },
        { field: { type: 'ID', value: 'project' }, fieldType: 'project', type: 'SET', value: { value: 'current', type: 'COPY' } },
        { field: { type: 'ID', value: 'issuetype' }, fieldType: 'issuetype', type: 'SET', value: { type: 'COPY', value: 'current' } },
      ],
    },
  },
  COMMENT_ISSUE: {
    apiType: 'jira.issue.comment',
    description: 'Add a comment to an issue',
    defaultValue: {
      comment: '',
      sendNotifications: true,
      addCommentOnce: true,
      publicComment: false,
    },
  },
  ASSIGN_ISSUE: {
    apiType: 'jira.issue.assign',
    description: 'Assign an issue to a user',
    defaultValue: {
      assignType: 'SPECIFY_USER',
      assignee: { type: 'SMART', value: '{{initiator}}' },
    },
  },
  LINK_ISSUES: {
    apiType: 'jira.issue.link',
    description: 'Link two issues together',
    defaultValue: {
      linkType: 'inward:10000',
      issue: { type: 'COPY', value: 'trigger' },
    },
  },
  DELETE_ISSUE: {
    apiType: 'jira.issue.delete',
    description: 'Delete an issue [inferred]',
    defaultValue: {},
  },
  CLONE_ISSUE: {
    apiType: 'jira.issue.clone',
    description: 'Clone an issue [inferred]',
    defaultValue: {},
  },
  CREATE_SUBTASK: {
    apiType: 'jira.issue.create.subtask',
    description: 'Create a subtask under the current issue [inferred]',
    defaultValue: {
      operations: [
        { field: { type: 'ID', value: 'summary' }, fieldType: 'summary', type: 'SET', value: null },
      ],
    },
  },

  // ── Communication Actions (confirmed) ──
  SEND_WEB_REQUEST: {
    apiType: 'jira.issue.outgoing.webhook',
    description: 'Send a web request (webhook)',
    defaultValue: {
      url: '',
      headers: [],
      sendIssue: false,
      contentType: 'empty',
      method: 'POST',
      responseEnabled: false,
    },
  },
  SEND_EMAIL: {
    apiType: 'jira.send.email',
    description: 'Send a customized email [inferred]',
    defaultValue: {
      to: '',
      subject: '',
      body: '',
    },
  },

  // ── Variable/Data Actions (confirmed) ──
  CREATE_VARIABLE: {
    apiType: 'jira.create.variable',
    description: 'Create or set a smart value variable',
    defaultValue: {
      name: { type: 'FREE', value: '' },
      type: 'SMART',
      query: { type: 'SMART', value: '' },
      lazy: false,
    },
  },
  LOG_ACTION: {
    apiType: 'codebarrel.action.log',
    description: 'Log a value to the automation audit log',
    defaultValue: '',
  },

  // ── Lookup/Branch Actions [inferred] ──
  LOOKUP_ISSUES: {
    apiType: 'jira.lookup.issues',
    description: 'Lookup related issues using JQL (branch) [inferred]',
    defaultValue: {
      jql: '',
    },
  },
};

// ─── Condition Types ────────────────────────────────────────────────────────

export const CONDITION_TYPES: Record<string, ComponentTypeEntry> = {
  JQL_CONDITION: {
    apiType: 'jira.jql.condition',
    description: 'Evaluate a JQL query as a condition',
    defaultValue: '',
  },
  ISSUE_FIELDS_CONDITION: {
    apiType: 'jira.issue.condition',
    description: 'Check issue field values (equals, not equals, one of, etc.)',
    defaultValue: {
      selectedField: { type: 'ID', value: 'status' },
      selectedFieldType: 'status',
      comparison: 'ONE_OF',
    },
  },
  ADVANCED_COMPARE: {
    apiType: 'jira.comparator.condition',
    description: 'Compare two values using smart value expressions',
    defaultValue: {
      first: '',
      second: '',
      operator: 'EQUALS',
    },
  },
  USER_CONDITION: {
    apiType: 'jira.user.condition',
    description: 'Check user-related conditions (reporter, assignee, etc.)',
    defaultValue: {
      operator: 'OR',
      conditions: [{ field: 'reporter', check: 'USER_IS', criteria: [] }],
    },
  },
  RELATED_ISSUES: {
    apiType: 'jira.related.issues.condition',
    description: 'Check conditions on related/linked issues [inferred]',
    defaultValue: {
      jql: '',
    },
  },
  IF_ELSE_BLOCK: {
    apiType: 'jira.condition.if.block',
    description: 'If/else conditional block (groups conditions) [inferred]',
    defaultValue: {
      conditionMatchType: 'ALL',
    },
  },
};

// ─── Branch Types ───────────────────────────────────────────────────────────

export const BRANCH_TYPES: Record<string, ComponentTypeEntry> = {
  RELATED_ISSUES_BRANCH: {
    apiType: 'jira.issue.related',
    description: 'Branch to operate on related/linked issues',
    defaultValue: {
      relatedType: 'current',
      jql: '',
      linkTypes: [],
    },
  },
};

// ─── All Type Maps ──────────────────────────────────────────────────────────

const TYPE_MAPS = {
  TRIGGER: TRIGGER_TYPES,
  ACTION: ACTION_TYPES,
  CONDITION: CONDITION_TYPES,
  CONDITION_BLOCK: CONDITION_TYPES,
  BRANCH: BRANCH_TYPES,
} as const;

export type ComponentCategory = keyof typeof TYPE_MAPS;

/**
 * Resolve a component type from a friendly name or raw API identifier.
 *
 * @param category - Component category: TRIGGER, ACTION, CONDITION, CONDITION_BLOCK, or BRANCH
 * @param type - Friendly name (e.g., ISSUE_CREATED) or raw API type (e.g., jira.issue.event.trigger:created)
 * @returns The raw Atlassian API type identifier
 * @throws Error with descriptive message if the type is not recognized
 *
 * @example
 * resolveComponentType('TRIGGER', 'ISSUE_CREATED')
 * // => 'jira.issue.event.trigger:created'
 *
 * resolveComponentType('ACTION', 'jira.issue.assign')
 * // => 'jira.issue.assign' (passthrough)
 */
export function resolveComponentType(category: ComponentCategory, type: string): string {
  // Passthrough: if it already looks like a raw API identifier (contains a dot), use as-is
  if (type.includes('.')) {
    return type;
  }

  const typeMap = TYPE_MAPS[category];
  if (!typeMap) {
    const validCategories = Object.keys(TYPE_MAPS).join(', ');
    throw new Error(
      `Unknown component category "${category}". Valid categories: ${validCategories}`
    );
  }

  // Look up the friendly name (case-insensitive)
  const upperType = type.toUpperCase();
  const entry = (typeMap as Record<string, ComponentTypeEntry>)[upperType];
  if (entry) {
    return entry.apiType;
  }

  // Check all maps in case the user used a name from a different category
  for (const [cat, map] of Object.entries(TYPE_MAPS)) {
    const found = (map as Record<string, ComponentTypeEntry>)[upperType];
    if (found) {
      throw new Error(
        `"${type}" is a ${cat} type, not a ${category} type. ` +
        `Use resolveComponentType('${cat}', '${type}') instead.`
      );
    }
  }

  // Not found anywhere - provide helpful error
  const availableTypes = Object.keys(typeMap).join(', ');
  throw new Error(
    `Unknown ${category} type "${type}". Available friendly names: ${availableTypes}. ` +
    `You can also pass raw Atlassian API identifiers directly (e.g., "jira.issue.event.trigger:created").`
  );
}

/**
 * Get all available friendly names for a component category.
 */
export function getAvailableTypes(category: ComponentCategory): string[] {
  const typeMap = TYPE_MAPS[category];
  return typeMap ? Object.keys(typeMap) : [];
}

/**
 * Get the full entry (apiType + description + defaultValue) for a friendly name.
 */
export function getComponentTypeEntry(
  category: ComponentCategory,
  friendlyName: string,
): ComponentTypeEntry | undefined {
  const typeMap = TYPE_MAPS[category];
  return typeMap ? (typeMap as Record<string, ComponentTypeEntry>)[friendlyName.toUpperCase()] : undefined;
}

/**
 * Get the default value object for a component type.
 * Returns a deep clone so callers can safely mutate.
 *
 * @param category - Component category
 * @param type - Friendly name or raw API type
 * @returns Deep-cloned default value, or undefined if not found
 */
export function getDefaultValue(
  category: ComponentCategory,
  type: string,
): Record<string, unknown> | string | undefined {
  // Try friendly name lookup first
  const typeMap = TYPE_MAPS[category];
  if (!typeMap) return undefined;

  const upperType = type.toUpperCase();
  const entry = (typeMap as Record<string, ComponentTypeEntry>)[upperType];
  if (entry) {
    return JSON.parse(JSON.stringify(entry.defaultValue));
  }

  // Try reverse lookup by apiType
  if (type.includes('.')) {
    for (const e of Object.values(typeMap as Record<string, ComponentTypeEntry>)) {
      if (e.apiType === type) {
        return JSON.parse(JSON.stringify(e.defaultValue));
      }
    }
  }

  return undefined;
}
