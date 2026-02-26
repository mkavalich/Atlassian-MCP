# Contributing to Atlassian MCP Servers

Thank you for your interest in contributing to the Atlassian MCP Servers project!

## Code of Conduct

This project follows a [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold it.

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Create a feature branch (`git checkout -b feature/my-feature`)
4. Make your changes
5. Run validation (`npm run validate:all`)
6. Commit your changes (`git commit -m 'Add my feature'`)
7. Push to your branch (`git push origin feature/my-feature`)
8. Open a Pull Request

## Development Setup

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- Atlassian Cloud account with API tokens

### Building

```bash
npm install
npm run build:all        # Build all servers
npm run test:all         # Run all tests
npm run validate:all     # Validate tool catalog and skills
```

### Building a Single Server

```bash
cd servers/jira-projects
npm run build
npm test
```

## Code Standards

### MCP Tool Guidelines

All tools must follow these patterns:

1. **Tool Annotations** - Include `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`
2. **Discovery Pattern** - Discovery tools should be called first to find IDs
3. **Progressive Disclosure** - Use `search_tools` for tool discovery
4. **Response Guidance** - Include `usage_guidance` and `suggested_next_steps` in responses
5. **Zod Validation** - All input schemas use Zod with `.strict()` enforcement
6. **No `any` types** - TypeScript strict mode is enforced

### Naming Conventions

- Tool names: `snake_case` (e.g., `search_projects`, `get_issue`)
- Categories: lowercase with hyphens (e.g., `issue-types`)
- Types: `discovery`, `read`, `create`, `update`, `delete`

## Adding New Tools

See the [Development Guide](docs/development-guide.md) for a complete walkthrough with code examples.

Quick steps:

1. Add Zod schema in `src/validation/schemas.ts`
2. Add MCP input schema in `src/validation/input-schemas.ts`
3. Implement tool in appropriate `src/tools/*.ts` file
4. Add to `toolCatalog` in `src/server.ts`
5. Run `npm run generate:tool-catalog` to update docs and schemas
6. Run `npm run validate:all` to verify everything is in sync

## Updating Documentation

When your changes affect tools or skills, update the docs in the same PR:

| Change | Action |
|--------|--------|
| Add/remove/modify tools | Run `npm run generate:tool-catalog` |
| Add new server | Update root `README.md`, create `servers/<name>/README.md` |
| Create/modify skill | Update skill's `metadata.yaml` with tool dependencies |

## Testing

### Integration Tests

Integration tests use the `MCP_TEST_` prefix for any entities created in Atlassian Cloud. This makes test data easy to identify and clean up.

```bash
npm run test:all         # Run all tests
npm test                 # Run tests for current server (from server directory)
```

### Validation

Pre-push validation ensures tools and skills stay synchronized:

```bash
npm run validate:all     # Regenerates tool catalog, validates skills
```

## AI-Assisted Contributions

We welcome AI-assisted contributions. If you used AI tools (Claude, Copilot, etc.) to help write your contribution, please disclose this in your PR description. This aligns with the [MCP project's policy](https://github.com/modelcontextprotocol/.github/blob/main/CONTRIBUTING.md) on AI-assisted contributions.

For AI agents working directly on this codebase, see [AGENTS.md](AGENTS.md).

## Good First Issues

Look for issues labeled [`good first issue`](https://github.com/mkavalich/Atlassian-MCP/labels/good%20first%20issue) for a good starting point. These are typically:

- Adding a missing tool for an existing Atlassian API endpoint
- Improving tool descriptions or parameter documentation
- Adding input examples to complex tools
- Documentation improvements

## License

By contributing to this project, you agree that your contributions will be licensed under the [MIT License](LICENSE).

## Questions?

Open an issue for discussion before starting major changes.
