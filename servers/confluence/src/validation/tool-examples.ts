/**
 * Input examples for complex Confluence tools.
 *
 * API consumers use these as `input_examples` in Anthropic Messages API calls.
 * Improves accuracy from ~72% to ~90% on complex parameter handling.
 *
 * @see https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/implement-tool-use#providing-tool-use-examples
 */

import type { ToolInputExample } from '@atlassian-mcp/optimizations/tools';

export const toolExamples: Record<string, ToolInputExample[]> = {
  create_page: [
    {
      name: 'Create a page with storage format XHTML content',
      input: {
        spaceId: '65537',
        title: 'Sprint 14 Retrospective',
        body: '<h1>Sprint 14 Retrospective</h1><h2>What went well</h2><ul><li>Shipped auth module on time</li><li>Zero critical bugs in release</li></ul><h2>What to improve</h2><ul><li>Better test coverage for edge cases</li></ul>',
      },
    },
    {
      name: 'Create a child page under an existing parent',
      input: {
        spaceId: '65537',
        title: 'API Reference - Authentication',
        parentId: '12345678',
        body: '<p>This page documents the authentication API endpoints.</p><h2>POST /auth/login</h2><p>Authenticates a user and returns a JWT token.</p>',
        status: 'current',
      },
    },
    {
      name: 'Create a draft page',
      input: {
        spaceId: '65537',
        title: 'RFC: Migration to Event-Driven Architecture',
        body: '<p>Draft proposal for migrating core services to event-driven architecture.</p>',
        status: 'draft',
      },
    },
  ],

  update_page: [
    {
      name: 'Update page title and content (version required)',
      input: {
        pageId: '12345678',
        version: 3,
        title: 'Sprint 14 Retrospective (Updated)',
        body: '<h1>Sprint 14 Retrospective</h1><p>Updated with action items from the team meeting.</p>',
      },
    },
    {
      name: 'Update only the body content, keep existing title',
      input: {
        pageId: '12345678',
        version: 5,
        body: '<h1>API Reference</h1><p>Updated endpoint documentation for v2 API.</p>',
      },
    },
  ],

  create_template: [
    {
      name: 'Create an ADR template with Confluence macros and template variables',
      description:
        'Body must be unescaped XHTML storage format. Use <at:var at:name="varname"/> for user-fillable placeholders. Use <ac:structured-macro> for Confluence macros like info panels.',
      input: {
        spaceKey: 'ENG',
        name: 'Architecture Decision Record',
        description: 'Document architectural decisions with context and consequences',
        templateType: 'page',
        body: '<h1>ADR-<at:var at:name="number"/>: <at:var at:name="title"/></h1><ac:structured-macro ac:name="info"><ac:rich-text-body><p><strong>Status:</strong> <at:var at:name="status" at:default="Proposed"/></p><p><strong>Date:</strong> <at:var at:name="date"/></p></ac:rich-text-body></ac:structured-macro><h2>Context</h2><p>Describe the issue motivating this decision.</p><h2>Decision</h2><p>State the decision using active voice.</p><h2>Consequences</h2><h3>Positive</h3><ul><li>Benefit 1</li></ul><h3>Negative</h3><ul><li>Tradeoff 1</li></ul>',
      },
    },
    {
      name: 'Create a runbook template with warning macro and code blocks',
      description:
        'Use ac:structured-macro with ac:name="warning" for alerts, ac:name="code" for code blocks with CDATA.',
      input: {
        spaceKey: 'OPS',
        name: 'Runbook',
        description: 'Operational procedure documentation',
        templateType: 'page',
        body: '<ac:structured-macro ac:name="warning"><ac:rich-text-body><p><strong>Last verified:</strong> <at:var at:name="verified_date"/></p><p><strong>Owner:</strong> <at:var at:name="owner"/></p></ac:rich-text-body></ac:structured-macro><h1><at:var at:name="runbook_title"/></h1><h2>Overview</h2><p>Brief description of what this runbook accomplishes.</p><h2>Prerequisites</h2><ul><li>Required access</li></ul><h2>Procedure</h2><h3>Step 1</h3><ac:structured-macro ac:name="code"><ac:parameter ac:name="language">bash</ac:parameter><ac:plain-text-body><![CDATA[# Command to execute]]></ac:plain-text-body></ac:structured-macro><h2>Verification</h2><p>How to confirm success.</p>',
      },
    },
  ],
};
