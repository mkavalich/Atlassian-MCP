/**
 * GraphQL mutations for Jira Product Discovery
 *
 * Note: These mutations are based on the Atlassian GraphQL schema for JPD.
 * The exact field names and structure may need adjustment based on the
 * actual GraphQL schema available at runtime.
 */

// Create a new insight for an idea using Polaris API
// Requires X-ExperimentalApi: polaris-v0 header
// Schema from introspection:
//   cloudID: String! (required)
//   projectID: Int! (required)
//   issueID: Int (optional - links insight to idea)
//   description: JSON (optional)
export const CREATE_INSIGHT = `
  mutation CreateInsight($cloudId: String!, $projectId: Int!, $issueId: Int, $description: JSON!) {
    createPolarisInsight(input: {cloudID: $cloudId, projectID: $projectId, issueID: $issueId, description: $description}) {
      success
      errors
    }
  }
`;

// Update an existing insight using Polaris API
// Requires X-ExperimentalApi: polaris-v0 header
// Schema from introspection: UpdatePolarisInsightInput has description and snippets
// The id is passed as a separate argument to the mutation
export const UPDATE_INSIGHT = `
  mutation UpdateInsight($id: ID!, $description: JSON) {
    updatePolarisInsight(id: $id, input: {description: $description}) {
      id
      description
      updated
      snippets {
        id
        data
        url
      }
    }
  }
`;

// Delete an insight using Polaris API
// Requires X-ExperimentalApi: polaris-v0 header
// Note: DeletePolarisInsightInput may not exist - try direct id argument
export const DELETE_INSIGHT = `
  mutation DeleteInsight($id: ID!) {
    deletePolarisInsight(id: $id) {
      success
    }
  }
`;

// Alternative mutation structure using Polaris naming (legacy JPD)
export const CREATE_POLARIS_INSIGHT = `
  mutation CreatePolarisInsight($project: ID!, $container: ID, $description: String!, $snippets: [InsightSnippetInput!]) {
    createPolarisInsight(
      project: $project
      container: $container
      description: $description
      snippets: $snippets
    ) {
      id
      description
      snippets {
        id
        data
      }
    }
  }
`;

export const UPDATE_POLARIS_INSIGHT = `
  mutation UpdatePolarisInsight($id: ID!, $description: String, $snippets: [InsightSnippetInput!]) {
    updatePolarisInsight(id: $id, description: $description, snippets: $snippets) {
      id
      description
      updated
    }
  }
`;

export const DELETE_POLARIS_INSIGHT = `
  mutation DeletePolarisInsight($id: ID!) {
    deletePolarisInsight(id: $id) {
      success
    }
  }
`;

// Update idea scoring
export const UPDATE_IDEA_SCORING = `
  mutation UpdateIdeaScoring($issueId: ID!, $scores: [ScoringFieldValueInput!]!) {
    jira {
      productDiscovery {
        updateIdeaScoring(issueId: $issueId, scores: $scores) {
          success
          scoring {
            fields {
              id
              name
              value
            }
            totalScore
          }
          errors {
            message
            field
          }
        }
      }
    }
  }
`;
