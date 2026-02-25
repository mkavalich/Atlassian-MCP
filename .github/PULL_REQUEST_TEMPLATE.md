## Summary

Brief description of the changes.

## Type of Change

- [ ] Bug fix
- [ ] New tool
- [ ] New skill
- [ ] Enhancement to existing tool
- [ ] Documentation
- [ ] Refactoring (no functional change)

## Server(s) Affected

- [ ] jira-projects
- [ ] jira-workflows
- [ ] jira-fields-permissions
- [ ] jira-service-desk
- [ ] jira-organization
- [ ] jira-system-admin
- [ ] jira-product-discovery
- [ ] confluence
- [ ] packages/shared
- [ ] packages/optimizations

## Checklist

- [ ] `npm run build:all` succeeds
- [ ] `npm run test:all` passes
- [ ] `npm run validate:all` passes (tool catalog and skills in sync)
- [ ] Tool annotations included (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`)
- [ ] Zod schema with `.strict()` for new tool inputs
- [ ] Documentation updated (if adding/modifying tools, run `npm run generate:tool-catalog`)

## Testing

Describe how you tested these changes.
