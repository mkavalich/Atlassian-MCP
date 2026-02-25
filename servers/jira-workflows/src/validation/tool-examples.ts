/**
 * Input examples for complex Jira Workflows tools.
 *
 * API consumers use these as `input_examples` in Anthropic Messages API calls.
 * Improves accuracy from ~72% to ~90% on complex parameter handling.
 *
 * @see https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/implement-tool-use#providing-tool-use-examples
 */

import type { ToolInputExample } from '@atlassian-mcp/optimizations/tools';

export const toolExamples: Record<string, ToolInputExample[]> = {
  create_workflow: [
    {
      name: 'Simple 3-status development workflow',
      input: {
        name: 'Simple Dev Workflow',
        description: 'Basic workflow with To Do, In Progress, and Done',
        statuses: [
          { id: 'todo', name: 'To Do', statusCategory: 'TODO' },
          { id: 'in-progress', name: 'In Progress', statusCategory: 'IN_PROGRESS' },
          { id: 'done', name: 'Done', statusCategory: 'DONE' },
        ],
        transitions: [
          { name: 'Create', from: [], to: 'todo' },
          { name: 'Start Work', from: ['todo'], to: 'in-progress' },
          { name: 'Complete', from: ['in-progress'], to: 'done' },
          { name: 'Reopen', from: ['done'], to: 'todo' },
        ],
      },
    },
    {
      name: 'Workflow with code review stage',
      input: {
        name: 'Dev with Review',
        description: 'Development workflow including code review',
        statuses: [
          { id: 'backlog', name: 'Backlog', statusCategory: 'TODO' },
          { id: 'dev', name: 'In Development', statusCategory: 'IN_PROGRESS' },
          { id: 'review', name: 'Code Review', statusCategory: 'IN_PROGRESS' },
          { id: 'done', name: 'Done', statusCategory: 'DONE' },
        ],
        transitions: [
          { name: 'Create', from: [], to: 'backlog' },
          { name: 'Start Development', from: ['backlog'], to: 'dev' },
          { name: 'Submit for Review', from: ['dev'], to: 'review' },
          { name: 'Request Changes', from: ['review'], to: 'dev' },
          { name: 'Approve', from: ['review'], to: 'done' },
        ],
      },
    },
  ],

  setup_workflow_guided: [
    {
      name: 'Create a full SDLC workflow for a project',
      input: {
        name: 'Product SDLC Workflow',
        description: 'Full software development lifecycle with UAT and release gates',
        workflowType: 'sdlc',
        projectKey: 'PROJ',
      },
    },
    {
      name: 'Create a custom workflow with specific statuses',
      input: {
        name: 'Support Triage Flow',
        description: 'Custom support triage process',
        workflowType: 'custom',
        customStatuses: [
          { name: 'Received', category: 'TODO' },
          { name: 'Triaging', category: 'IN_PROGRESS' },
          { name: 'Awaiting Customer', category: 'IN_PROGRESS' },
          { name: 'Resolved', category: 'DONE' },
        ],
      },
    },
  ],

  create_automation_rule: [
    {
      name: 'Auto-assign new bugs to project lead',
      input: {
        name: 'Auto-assign Bugs',
        authorAccountId: '557058:abcdef01-2345-6789-abcd-ef0123456789',
        trigger: {
          type: 'ISSUE_CREATED',
        },
        components: [
          {
            type: 'ASSIGN_ISSUE',
            value: {
              assignee: {
                type: 'SMART_VALUE',
                value: '{{issue.project.lead.accountId}}',
              },
            },
          },
        ],
      },
    },
    {
      name: 'Add comment when issue transitions to Done',
      input: {
        name: 'Done Notification Comment',
        authorAccountId: '557058:abcdef01-2345-6789-abcd-ef0123456789',
        trigger: {
          type: 'ISSUE_TRANSITIONED',
        },
        components: [
          {
            type: 'COMMENT_ISSUE',
            value: {
              message: 'This issue has been marked as Done.',
            },
          },
        ],
      },
    },
    {
      name: 'Log action with JQL condition',
      input: {
        name: 'Log High Priority Changes',
        authorAccountId: '557058:abcdef01-2345-6789-abcd-ef0123456789',
        trigger: {
          type: 'ISSUE_UPDATED',
        },
        conditions: [
          {
            type: 'JQL_CONDITION',
            value: {
              jql: 'priority in (High, Highest)',
            },
          },
        ],
        components: [
          {
            type: 'LOG_ACTION',
            value: {
              message: 'High priority issue updated: {{issue.key}}',
            },
          },
        ],
      },
    },
  ],

  update_automation_rule: [
    {
      name: 'Rename a rule and disable it',
      input: {
        ruleId: '12345',
        name: 'Auto-assign Bugs (Disabled)',
        enabled: false,
      },
    },
    {
      name: 'Replace the trigger on an existing rule',
      input: {
        ruleId: '12345',
        trigger: {
          type: 'ISSUE_COMMENTED',
        },
      },
    },
  ],
};
