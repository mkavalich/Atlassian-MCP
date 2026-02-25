FROM node:18-alpine

# Create non-root user for security
RUN addgroup -g 1001 jira && \
    adduser -D -u 1001 -G jira jira

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY --chown=jira:jira . .

# Build TypeScript if needed
RUN if [ -f "tsconfig.json" ]; then npm run build; fi

# Switch to non-root user
USER jira

# Set the entrypoint
CMD ["node", "dist/index.js"]