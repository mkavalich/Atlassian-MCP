# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Install curl for healthcheck
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm install

# Copy source and build files
COPY tsconfig.json ./
COPY build.mjs ./
COPY src/ ./src/

# Build with esbuild (fast, memory-efficient)
RUN npm run build

# Production stage
FROM node:20-slim AS production

WORKDIR /app

# Install curl for healthcheck
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r mcp && useradd -r -g mcp mcp

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Change ownership
RUN chown -R mcp:mcp /app

# Switch to non-root user
USER mcp

# Environment variables
ENV NODE_ENV=production
ENV TRANSPORT=http
ENV MCP_PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start server
CMD ["node", "dist/index.js"]
