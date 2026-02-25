ARG SERVER=jira-projects

FROM node:20-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/ ./packages/
COPY servers/ ./servers/
RUN npm ci
WORKDIR /app/packages/shared
RUN npm run build
WORKDIR /app/packages/optimizations
RUN npm run build
WORKDIR /app
ENV SKIP_DECLARATIONS=true
RUN npm run build --workspaces --if-present

FROM node:20-slim AS production
ARG SERVER
WORKDIR /app
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
RUN mkdir -p packages/shared packages/optimizations servers/${SERVER}
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/optimizations/dist ./packages/optimizations/dist
COPY --from=builder /app/packages/optimizations/package.json ./packages/optimizations/
COPY --from=builder /app/servers/${SERVER}/dist ./servers/${SERVER}/dist
COPY --from=builder /app/servers/${SERVER}/package.json ./servers/${SERVER}/
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
RUN npm ci --omit=dev --workspace=servers/${SERVER} --workspace=packages/shared --workspace=packages/optimizations
RUN groupadd -r mcp && useradd -r -g mcp mcp && chown -R mcp:mcp /app
USER mcp
ENV NODE_ENV=production TRANSPORT=http MCP_PORT=3000 SERVER_NAME=${SERVER}
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD curl -f http://localhost:3000/health || exit 1
EXPOSE 3000
CMD ["sh", "-c", "node servers/${SERVER_NAME}/dist/index.js"]
