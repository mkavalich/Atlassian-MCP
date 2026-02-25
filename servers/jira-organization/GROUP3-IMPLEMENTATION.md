# Group 3: Cross-Product Analytics & Directory Health Implementation

## Overview

This document describes the implementation of Group 3 strategic org-level READ endpoints for **Cross-Product Analytics & Directory Health** in the jira-organization-mcp-server.

## Implementation Summary

### ✅ Completed Tasks

1. **Enhanced API Client** (`src/api/client.ts`)
   - Updated `requiresOrgAdminToken()` method to include new endpoint patterns
   - Added `makeCompassApiRequest()` for Compass API calls
   - Added `makeOrganizationApiRequest()` for Organization API calls  
   - Added `makeScimDirectoryRequest()` for SCIM Directory API calls
   - All new methods enforce organization admin token requirements

2. **Comprehensive TypeScript Types** (`src/types/index.ts`)
   - Added Compass API types for metrics and events
   - Added SCIM Directory types for groups, schemas, and resource types
   - Added Organization API types for org management
   - Added supporting interfaces for all response structures

3. **Input Validation Schemas** (`src/validation/input-schemas.ts`)
   - Created comprehensive schemas for all 15 new tools
   - Added proper validation with min/max limits and enum constraints
   - Included detailed descriptions for all parameters

4. **Tool Implementations**
   - **Cross-Product Analytics** (4 tools) - `src/tools/cross-product-analytics.ts`
   - **Directory Health** (5 tools) - `src/tools/directory-health.ts`  
   - **Organization Management** (2 tools) - `src/tools/organization-management.ts`
   - **Enhanced Directory Analytics** (4 tools) - `src/tools/enhanced-directory-analytics.ts`

## Implemented Tools (15 Total)

### Cross-Product Analytics (Compass API)
- `get_compass_component_metrics` - Component performance, quality, security metrics
- `get_compass_team_metrics` - Team productivity, delivery, collaboration metrics
- `get_compass_system_events` - System-wide events and component lifecycle
- `get_compass_component_events` - Component-specific deployments, incidents, health

**Required Scope:** `read:compass-metrics:admin`

### Directory Integration Health (SCIM API)
- `get_scim_directory_groups` - Directory groups with health insights
- `get_scim_directory_schemas` - SCIM schemas for compliance analysis
- `get_scim_directory_resource_types` - Available resource types and configuration
- `get_directory_health_status` - Comprehensive directory health analysis
- `get_provisioning_insights` - Provisioning performance and failure analysis

**Required Scope:** `read:directory:admin`

### Organization Management
- `get_organizations` - List organizations with filtering and pagination
- `get_organization_details` - Detailed org info with statistics and compliance

**Required Scope:** `read:organizations:admin`

### Enhanced Directory Analytics
- `get_cross_product_user_activity` - User activity correlation across products
- `get_enhanced_identity_provider_insights` - Advanced IDP analytics
- `get_advanced_directory_health_monitoring` - Predictive health monitoring
- `get_user_behavior_pattern_analysis` - Security and optimization insights

**Required Scopes:** `read:directory:admin`, `read:users:admin`

## API Endpoints Implemented

### Compass API (api.atlassian.com)
- `GET /api-group-metrics/` - Component and team metrics
- `GET /api-group-events/` - System and component events

### SCIM Directory API (api.atlassian.com/scim)
- `GET /directory/{directoryId}/Groups` - Directory groups
- `GET /directory/{directoryId}/Schemas` - SCIM metadata
- `GET /directory/{directoryId}/ResourceTypes` - Available resource types

### Organization API (api.atlassian.com/admin)
- `GET /v1/orgs` - List of organizations
- `GET /v1/orgs/{orgId}` - Detailed organization information

## Security & Token Management

- All Group 3 endpoints require `JIRA_ORG_ADMIN_TOKEN` with appropriate scopes
- Proper error handling for missing or invalid organization admin tokens
- READ-ONLY access pattern maintained throughout implementation
- Token validation occurs at the API client level before requests

## Testing Results ✅

- **Tool Registration**: All 15 Group 3 tools successfully registered
- **Total Server Tools**: 32 (17 existing + 15 new)
- **Error Handling**: Proper validation for missing organization admin tokens
- **Type Safety**: Full TypeScript compilation without errors
- **MCP Compliance**: All tools follow MCP protocol standards

## Usage Example

```bash
# Configure organization admin token
export JIRA_ORG_ADMIN_TOKEN="your_org_admin_api_token"

# Add to Claude Code
claude mcp add jira-organization docker exec -i mcp-jira-organization node /app/dist/index.js

# Test a Group 3 tool
# get_compass_component_metrics will retrieve cross-product component metrics
# get_organizations will list all organizations in your Atlassian environment
```

## Required Environment Variables

```bash
# Standard Jira credentials
JIRA_BASE_URL=https://yourorg.atlassian.net
JIRA_EMAIL=your.email@example.com
JIRA_API_TOKEN=your_regular_api_token

# Organization admin token (NEW - required for Group 3 tools)
JIRA_ORG_ADMIN_TOKEN=your_organization_admin_token
```

## Required Scopes for Organization Admin Token

The `JIRA_ORG_ADMIN_TOKEN` must be configured with these scopes:

- `read:compass-metrics:admin` - For Compass API cross-product metrics
- `read:directory:admin` - For SCIM Directory integration health
- `read:organizations:admin` - For organization management
- `read:users:admin` - For enhanced directory analytics

## Architecture Benefits

1. **Clean Separation**: Group 3 tools are organized in separate modules
2. **Type Safety**: Comprehensive TypeScript types for all responses
3. **Error Handling**: Proper validation and user-friendly error messages
4. **Extensibility**: Framework ready for additional organizational endpoints
5. **Security**: Organization admin token validation at API client level
6. **Compliance**: All tools are READ-ONLY as required

## Next Steps

1. **Configure Organization Admin Token**: Set up `JIRA_ORG_ADMIN_TOKEN` with required scopes
2. **Test with Real Data**: Validate API responses with actual organizational data
3. **Monitor Performance**: Track API rate limits and response times
4. **Extend Analytics**: Add more sophisticated data analysis capabilities
5. **Integration**: Integrate with monitoring and alerting systems

## Files Modified/Created

### Modified Files
- `src/api/client.ts` - Enhanced with new API methods and token validation
- `src/types/index.ts` - Added comprehensive types for all new endpoints
- `src/validation/input-schemas.ts` - Added validation schemas for all tools
- `src/index.ts` - Registered all new tool modules

### New Files
- `src/tools/cross-product-analytics.ts` - Compass API tools
- `src/tools/directory-health.ts` - SCIM Directory health tools  
- `src/tools/organization-management.ts` - Organization API tools
- `src/tools/enhanced-directory-analytics.ts` - Advanced analytics framework
- `test-group3-tools.js` - Comprehensive testing script
- `GROUP3-IMPLEMENTATION.md` - This documentation

## Production Readiness

✅ **Implemented**: All Group 3 endpoints as specified  
✅ **Tested**: Tool registration and error handling validated  
✅ **Documented**: Comprehensive documentation and examples  
✅ **Type Safe**: Full TypeScript implementation  
✅ **Secure**: Organization admin token validation  
✅ **Compliant**: READ-ONLY access pattern maintained  

The Group 3 implementation provides enterprise Jira administrators with powerful tools for cross-product analytics, directory health monitoring, and organizational insights while maintaining security and compliance standards.