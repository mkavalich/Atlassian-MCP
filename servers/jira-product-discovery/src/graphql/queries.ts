/**
 * GraphQL queries for Jira Product Discovery
 *
 * Note: These queries are based on the Atlassian GraphQL schema for JPD.
 * The exact field names and structure may need adjustment based on the
 * actual GraphQL schema available at runtime.
 */

// Get insights for an idea using Polaris API
// Requires X-ExperimentalApi: polaris-v0 header
// Uses Atlassian Resource Identifiers (ARIs) for project and container (issue)
export const GET_IDEA_INSIGHTS = `
  query GetIdeaInsights($projectAri: ID!, $containerAri: ID) {
    polarisInsights(project: $projectAri, container: $containerAri) {
      id
      description
      created
      updated
      snippets {
        id
        data
        oauthClientId
        url
      }
    }
  }
`;

// Get a single insight by ID using Polaris API
// Requires X-ExperimentalApi: polaris-v0 header
export const GET_INSIGHT = `
  query GetInsight($insightId: ID!) {
    polaris {
      insights {
        insight(id: $insightId) {
          id
          description
          created
          updated
          snippets {
            id
            data
            oauthClientId
            url
          }
          container {
            id
          }
        }
      }
    }
  }
`;

// Get scoring data for an idea
export const GET_IDEA_SCORING = `
  query GetIdeaScoring($issueId: ID!) {
    jira {
      issueById(id: $issueId) {
        id
        key
        productDiscovery {
          scoring {
            fields {
              id
              name
              type
              value
              weight
            }
            totalScore
            rank
          }
        }
      }
    }
  }
`;

// Get JPD project configuration (views, scoring fields)
export const GET_JPD_PROJECT_CONFIG = `
  query GetJpdProjectConfig($projectId: ID!) {
    jira {
      projectById(id: $projectId) {
        id
        key
        name
        productDiscovery {
          views {
            id
            name
            type
          }
          scoringFields {
            id
            name
            description
            type
            weight
            options {
              id
              label
              value
            }
          }
        }
      }
    }
  }
`;

// Alternative query structure using Polaris naming (legacy JPD)
export const GET_POLARIS_INSIGHTS = `
  query GetPolarisInsights($project: ID!, $container: ID) {
    polarisInsights(project: $project, container: $container) {
      id
      description
      snippets {
        id
        data
        oauthClientId
      }
      created
      updated
    }
  }
`;

// Get insights count for an idea (lightweight)
export const GET_INSIGHTS_COUNT = `
  query GetInsightsCount($issueId: ID!) {
    jira {
      issueById(id: $issueId) {
        id
        key
        productDiscovery {
          insights {
            totalCount
          }
        }
      }
    }
  }
`;
