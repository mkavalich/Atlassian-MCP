/**
 * Input examples for complex Jira Projects tools.
 *
 * API consumers use these as `input_examples` in Anthropic Messages API calls.
 * Improves accuracy from ~72% to ~90% on complex parameter handling.
 *
 * @see https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/implement-tool-use#providing-tool-use-examples
 */

import type { ToolInputExample } from '@atlassian-mcp/optimizations/tools';

export const toolExamples: Record<string, ToolInputExample[]> = {
  create_issue: [
    {
      name: 'Create a bug with priority and labels',
      input: {
        projectKey: 'PROJ',
        issueType: 'Bug',
        summary: 'Login page returns 500 error on mobile Safari',
        description: 'Users on iOS Safari see a 500 error when submitting the login form.',
        priority: 'High',
        labels: ['mobile', 'login'],
        dueDate: '2026-03-15',
      },
    },
    {
      name: 'Create a story with custom fields (select, number, user picker)',
      input: {
        projectKey: 'PROJ',
        issueType: 'Story',
        summary: 'Add dark mode toggle to settings page',
        assignee: '557058:abcdef01-2345-6789-abcd-ef0123456789',
        customFields: {
          customfield_10001: { value: 'Frontend' },
          customfield_10002: [{ id: '10500' }, { id: '10501' }],
          customfield_10003: { accountId: '557058:abcdef01-2345-6789-abcd-ef0123456789' },
          customfield_10005: 3,
        },
      },
    },
    {
      name: 'Create a subtask under an existing issue',
      input: {
        projectKey: 'PROJ',
        issueType: 'Sub-task',
        summary: 'Implement API endpoint for dark mode preference',
        parentKey: 'PROJ-100',
        priority: 'Medium',
      },
    },
  ],

  update_issue: [
    {
      name: 'Update summary, priority, and add labels',
      input: {
        issueIdOrKey: 'PROJ-123',
        summary: 'Updated: Login page returns 500 error on all mobile browsers',
        priority: 'Highest',
        labels: ['mobile', 'login', 'critical'],
      },
    },
    {
      name: 'Set custom fields and due date',
      input: {
        issueIdOrKey: 'PROJ-456',
        assignee: '557058:abcdef01-2345-6789-abcd-ef0123456789',
        dueDate: '2026-03-15',
        customFields: {
          customfield_10001: { value: 'Backend' },
          customfield_10005: 5,
        },
      },
    },
  ],

  bulk_create_issues: [
    {
      name: 'Create three tasks for a sprint',
      input: {
        issues: [
          { projectKey: 'PROJ', issueType: 'Task', summary: 'Set up CI pipeline', priority: 'High' },
          { projectKey: 'PROJ', issueType: 'Task', summary: 'Write unit tests for auth module', labels: ['testing'] },
          { projectKey: 'PROJ', issueType: 'Bug', summary: 'Fix header alignment on mobile', priority: 'Medium' },
        ],
      },
    },
  ],

  transition_issue: [
    {
      name: 'Move issue to Done with resolution',
      input: {
        issueIdOrKey: 'PROJ-123',
        transitionName: 'Done',
        resolution: 'Done',
        comment: 'Verified fix in staging environment.',
      },
    },
    {
      name: 'Start progress on an issue by transition name',
      input: {
        issueIdOrKey: 'PROJ-456',
        transitionName: 'Start Progress',
      },
    },
  ],

  add_comment: [
    {
      name: 'Add a public comment',
      input: {
        issueIdOrKey: 'PROJ-123',
        body: 'Deployment completed successfully to staging. Ready for QA review.',
      },
    },
    {
      name: 'Add a comment restricted to Developers role',
      input: {
        issueIdOrKey: 'PROJ-123',
        body: 'Root cause was a null pointer in the auth middleware. Fixed in commit abc123.',
        visibility: { type: 'role', value: 'Developers' },
      },
    },
  ],

  search_jql: [
    {
      name: 'Find high-priority open bugs assigned to me',
      input: {
        jql: 'project = PROJ AND issuetype = Bug AND status != Done AND priority in (High, Highest) AND assignee = currentUser() ORDER BY priority DESC',
        fields: ['summary', 'status', 'priority', 'assignee'],
        maxResults: 20,
      },
    },
    {
      name: 'Search for recently updated issues in open sprints',
      input: {
        jql: 'project = PROJ AND sprint in openSprints() AND updated >= -7d ORDER BY updated DESC',
        maxResults: 50,
      },
    },
    {
      name: 'Find unresolved issues created this quarter',
      input: {
        jql: 'project = PROJ AND resolution = Unresolved AND created >= startOfMonth(-2) ORDER BY created ASC',
        fields: ['summary', 'status', 'created', 'assignee'],
      },
    },
  ],

  create_sprint: [
    {
      name: 'Create a two-week sprint with goal and dates',
      input: {
        name: 'Sprint 14',
        originBoardId: 1,
        goal: 'Complete authentication module and begin API documentation',
        startDate: '2026-03-01T09:00:00.000Z',
        endDate: '2026-03-15T17:00:00.000Z',
      },
    },
    {
      name: 'Create an unscheduled future sprint',
      input: {
        name: 'Sprint 15',
        originBoardId: 1,
        goal: 'Payment integration MVP',
      },
    },
  ],

  create_issue_type_scheme: [
    {
      name: 'Create a scheme for software development projects',
      input: {
        name: 'Software Project Scheme',
        issueTypeIds: ['10001', '10002', '10003', '10004'],
        defaultIssueTypeId: '10001',
        description: 'Standard issue types: Bug, Story, Task, Epic',
      },
    },
  ],
};
