# Pass A probes

Kept in the repo on purpose. A previous pass deleted its probes, which made its
evidence unreproducible; these are the scripts that produced the numbers cited
in the pass A commit messages, so any claim here can be re-checked rather than
taken on trust.

All three are **read-only** against the dev instance. None prints a credential
value — only names and lengths.

| script | what it establishes |
|---|---|
| `pass-a-api-characterisation.mjs` | Raw-API characterisation used to decide item 1. Proves auth via `/rest/api/3/myself` (`/field` and `/status` answer 200 anonymously and prove nothing), then shows that `/template/search` ignores `startAt`, that `category` is byte-identical to a `bogusParam=1` control, that `categories` (plural, key form) is the real filter, and that the bracket form axios emits for arrays is silently ignored. Also dumps the `/screenscheme` shape used for item 4. |
| `pass-a-item4-render-check.mjs` | Runs the **real** `packages/optimizations` formatter over the **real** `/screenscheme` payload at the default `concise` format, before and after flattening. This is the layer item 4 was failing at; the pre-format payload alone proves nothing. Note it mirrors the flattening logic rather than importing it — `pass-a-live-verify.mjs` is the authoritative end-to-end check. |
| `pass-a-live-verify.mjs` | End-to-end verification against the **running containers** over MCP StreamableHTTP, plus the ground-truth regression sweep and an 8-server smoke test. |

## Running them

`pass-a-api-characterisation.mjs` needs the instance credentials, so it runs
**inside** a container that already has them:

```
docker cp scripts/probes/pass-a-api-characterisation.mjs jira-workflows-mcp:/tmp/p.mjs
docker exec jira-workflows-mcp node /tmp/p.mjs
```

`pass-a-live-verify.mjs` runs on the host and talks to the published ports
(127.0.0.1:4001-4008). Rebuild and recreate the containers first — a live test
against a stale image proves nothing:

```
docker compose build jira-workflows jira-fields-permissions
docker compose up -d --force-recreate jira-workflows jira-fields-permissions
node scripts/probes/pass-a-live-verify.mjs
```

`pass-a-item4-render-check.mjs` needs `packages/optimizations` built and a
captured `/screenscheme` response:

```
npm run build --workspace=packages/optimizations
node scripts/probes/pass-a-item4-render-check.mjs <path-to-screenscheme.json>
```

## Two gotchas worth keeping

- The published `/mcp` endpoint returns **TOON-formatted text** under the
  default `concise` format. Pass `responseFormat: 'detailed'` when you want to
  `JSON.parse` a payload; use the default when you want to see what a caller
  actually reads.
- `scripts/generate-tool-catalog.js` spawns each server's **local**
  `dist/index.js`, not the container. Run `npm run build` in the affected
  workspaces before regenerating, or the catalog will describe a stale build.
