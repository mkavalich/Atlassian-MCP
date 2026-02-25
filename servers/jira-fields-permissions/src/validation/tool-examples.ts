/**
 * Input examples for complex Jira Fields & Permissions tools.
 *
 * API consumers use these as `input_examples` in Anthropic Messages API calls.
 * Improves accuracy from ~72% to ~90% on complex parameter handling.
 *
 * @see https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/implement-tool-use#providing-tool-use-examples
 */

import type { ToolInputExample } from '@atlassian-mcp/optimizations/tools';

export const toolExamples: Record<string, ToolInputExample[]> = {
  create_permission_grant: [
    {
      name: 'Grant browse permission to a project role',
      input: {
        schemeId: 10000,
        permission: 'BROWSE_PROJECTS',
        holder: { type: 'projectRole', parameter: '10002' },
      },
    },
    {
      name: 'Grant create issues permission to a group',
      input: {
        schemeId: 10000,
        permission: 'CREATE_ISSUES',
        holder: { type: 'group', parameter: 'jira-software-users' },
      },
    },
    {
      name: 'Grant edit permission to a specific user',
      input: {
        schemeId: 10000,
        permission: 'EDIT_ISSUES',
        holder: { type: 'user', parameter: '557058:abcdef01-2345-6789-abcd-ef0123456789' },
      },
    },
  ],
};
