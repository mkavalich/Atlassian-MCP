# Atlassian MCP Servers - Complete Tool Catalog

> **Generated:** 2026-02-23T13:43:43.060Z
> 
> This file is auto-generated. Do not edit manually.
> Run `npm run generate:tool-catalog` to regenerate.

**Total Servers:** 8
**Total Tools:** 275

---

## Summary

| Server | Tools | Description |
|--------|-------|-------------|
| jira-projects | 60 | Projects, issues, dashboards, reporting |
| jira-workflows | 39 | Workflows, screens, schemes, automation |
| jira-fields-permissions | 31 | Custom fields, permissions, notifications |
| jira-service-desk | 12 | JSM request types, customer organizations |
| jira-organization | 31 | Atlassian Admin, identity, directories |
| jira-system-admin | 21 | System config, licensing, users, groups |
| jira-product-discovery | 12 | JPD ideas, insights, scoring |
| confluence | 69 | Spaces, pages, comments, attachments |
| **Total** | **275** | |

---

## 1. jira-projects (60 tools)

Projects, issues, dashboards, reporting

### Attachments (1 tools)

| Tool | Type | Description |
|------|------|-------------|
| `list_issue_attachments` | discovery | 📋 READ: List all attachments on an issue. Returns attachment metadata including IDs, filenames, sizes, and download URL |

### Fields (2 tools)

| Tool | Type | Description |
|------|------|-------------|
| `get_issue_createmeta_fields` | read | 🔍 DISCOVERY: Get all fields (with options inline) for creating an issue in a specific project with a specific issue typ |
| `get_issue_editmeta_fields` | read | 🔍 DISCOVERY: Get all editable fields for an existing issue. Shows which fields can be modified and their allowed values |

### Issues (3 tools)

| Tool | Type | Description |
|------|------|-------------|
| `bulk_create_issues` | other | 📦 BATCH CREATE: Create multiple issues in a single request (up to 50). More efficient than multiple create_issue calls. |
| `get_issue_createmeta_issuetypes` | read | 🔍 DISCOVERY: Get available issue types that the current user can create in a specific project. Unlike "get_issue_types" |
| `get_sprint_issues` | read | Get all issues in a specific sprint. Useful for sprint reviews and tracking progress. |

### Projects (1 tools)

| Tool | Type | Description |
|------|------|-------------|
| `assign_issue_type_scheme_to_project` | update | ⚙️ ACTION: Assign an issue type scheme to a project. This determines which issue types are available for creating issues |

### Other (53 tools)

| Tool | Type | Description |
|------|------|-------------|
| `add_attachment` | create | 📎 CREATE: Add an attachment to an issue. Provide the file content as base64 encoded string. Use "get_attachment_meta" f |
| `add_comment` | create | 💬 CREATE: Add a comment to an issue. Supports plain text or Atlassian Document Format. Use visibility to restrict who c |
| `add_issue_types_to_scheme` | create | ⚙️ ACTION: Add issue types to an existing issue type scheme. |
| `assign_issue` | update | 👤 UPDATE: Assign an issue to a user or unassign it. Use "search_site_users" to find valid account IDs. Set accountId to |
| `create_board` | create | ⚠️ PREREQUISITE: Use "create_filter" in jira-system-admin FIRST to create a JQL filter, then use the returned filter ID  |
| `create_dashboard` | create | ✅ Create a new dashboard with share permissions. Creates a dashboard that can be discovered with "get_dashboards" and ma |
| `create_issue` | create | ⚠️ MULTIPLE PREREQUISITES: Use "search_projects" first to find valid project keys AND "get_issue_types" to find valid is |
| `create_issue_type` | create | 🆕 CREATE: Creates a new issue type with specified configuration. After creation, use the returned ID with other issue t |
| `create_issue_type_scheme` | create | 🆕 CREATE: Creates a new issue type scheme with specified configuration. After creation, use the returned ID with other  |
| `create_project` | create | 🆕 CREATE: Creates a new company-managed project (Scrum, Kanban, or Service Desk) with specified configuration. After cr |
| `create_sprint` | create | ⚠️ PREREQUISITE: Use "get_boards" first to find a valid Scrum board ID. |
| `delete_attachment` | delete | 🗑️ DELETE: Permanently delete an attachment. This action cannot be undone. Use "list_issue_attachments" first to find t |
| `delete_board` | delete | ⚠️ DESTRUCTIVE: Permanently delete a board. This removes the board view but does NOT delete any issues - they remain in  |
| `delete_comment` | delete | 🗑️ DELETE: Permanently delete a comment. Use "get_comments" first to find the comment ID. You can only delete comments  |
| `delete_dashboard` | delete | ⚠️ PREREQUISITE: Use "get_dashboards" first to discover valid dashboard IDs. Permanently deletes a dashboard. If you get |
| `delete_issue` | delete | 🗑️ DELETE: Permanently delete an issue. This action cannot be undone. Use deleteSubtasks=true to also delete subtasks,  |
| `delete_issue_type` | delete | ⚠️ PREREQUISITE: Use "get_issue_types" first to find valid issue type IDs. Delete an issue type (with optional alternati |
| `delete_issue_type_scheme` | delete | ⚠️ PREREQUISITE: Use "get_issue_type_schemes" first to find valid scheme IDs. Delete an issue type scheme (ensure no pro |
| `delete_project` | delete | ⚠️ PREREQUISITE: Use "search_projects" first to find valid project IDs or keys. Delete a project permanently (use with c |
| `delete_sprint` | delete | Delete a sprint. Issues in the sprint will be moved to the backlog. This action cannot be undone. |
| `generate_project_report` | read | ⚠️ PREREQUISITE: Ensure the project key exists and you have access. Generates a comprehensive project report including i |
| `get_attachment` | read | 📖 READ: Get metadata and download URL for a specific attachment by its ID. Returns the content URL for downloading the  |
| `get_attachment_meta` | read | ⚙️ READ: Get Jira attachment settings including whether attachments are enabled and the maximum upload size. Use this be |
| `get_board` | read | Get details of a specific Jira Software board by ID. |
| `get_board_backlog` | read | Get issues from the backlog of a Scrum board. Returns issues not yet assigned to any sprint. |
| `get_board_configuration` | read | Get the configuration of a board including columns, estimation settings, and filters. |
| `get_boards` | read | 🔍 DISCOVERY TOOL: Primary discovery method for Agile operations. Use this first to find board IDs before working with s |
| `get_comments` | read | 📖 READ: Retrieve comments on an issue with pagination support. Use expand="renderedBody" to get HTML-rendered content. |
| `get_dashboard` | read | ⚠️ PREREQUISITE: Use "get_dashboards" first to discover valid dashboard IDs. Retrieves detailed information for a specif |
| `get_dashboards` | read | 🔍 DISCOVERY TOOL: Use this first to find available dashboard IDs before using other dashboard management tools. Returns |
| `get_issue` | read | 📖 READ: Retrieve detailed information about a specific issue by its key or ID. Use expand parameter to include addition |
| `get_issue_type_scheme_mappings` | read | 🔍 DISCOVERY TOOL: Get mappings between issue type schemes and projects. Use this to discover which projects use which i |
| `get_issue_type_schemes` | read | 🔍 DISCOVERY TOOL: Primary discovery method for issue type scheme operations. Use this first to find available scheme ID |
| `get_issue_types` | read | 🔍 DISCOVERY TOOL: Primary discovery method for issue type operations. Use this first to find available issue type IDs b |
| `get_project` | read | ⚠️ PREREQUISITE: Use "search_projects" first to find valid project IDs or keys. Get details for a specific project by ID |
| `get_project_analytics` | read | ⚠️ PREREQUISITE: Use "generate_project_report" or "search_jql" first to verify project access. Retrieves detailed analyt |
| `get_sprint` | read | Get details of a specific sprint by ID. |
| `get_sprints_for_board` | read | 🔍 DISCOVERY TOOL: List all sprints for a Scrum board. Use this to discover sprint IDs before moving issues or managing  |
| `get_transitions` | read | 🔍 DISCOVERY: Get available workflow transitions for an issue. Use this to find valid transition IDs before using "trans |
| `load_tool_schema` | read | Get the full input schema for a specific tool. Use this before calling a tool to understand its parameters. Returns JSON |
| `move_issues_to_backlog` | update | Move issues from any sprint back to the backlog. Removes them from their current sprint. |
| `move_issues_to_sprint` | update | ⚠️ MULTIPLE PREREQUISITES: |
| `search_jql` | discovery | 🔍 Execute JQL queries to search for issues and generate reports. Provides powerful searching capabilities with JQL (Jir |
| `search_projects` | discovery | 🔍 DISCOVERY TOOL: Primary discovery method for project operations. Use this first to find available project IDs and key |
| `search_tools` | discovery | Discover available tools by category or type. Use this first to find the right tool for your task. |
| `transition_issue` | update | 🔄 UPDATE: Move an issue to a new status via workflow transition. Use "get_transitions" first to find available transiti |
| `update_comment` | update | ✏️ UPDATE: Edit an existing comment. Use "get_comments" first to find the comment ID. You can only edit comments you aut |
| `update_dashboard` | update | ⚠️ PREREQUISITE: Use "get_dashboards" first to discover valid dashboard IDs. Updates dashboard details and share permiss |
| `update_issue` | update | ✏️ UPDATE: Update fields on an existing issue. Only specified fields will be modified; omitted fields remain unchanged.  |
| `update_issue_type` | update | ⚠️ PREREQUISITE: Use "get_issue_types" first to find valid issue type IDs. Update an existing issue type configuration.  |
| `update_issue_type_scheme` | update | ⚠️ PREREQUISITE: Use "get_issue_type_schemes" first to find valid scheme IDs. Update an existing issue type scheme confi |
| `update_project` | update | ⚠️ PREREQUISITE: Use "search_projects" first to find valid project IDs or keys. Update an existing project's details, co |
| `update_sprint` | update | ⚠️ PREREQUISITE: Use "get_sprints_for_board" to find sprint ID. |

---

## 2. jira-workflows (39 tools)

Workflows, screens, schemes, automation

### Automation (1 tools)

| Tool | Type | Description |
|------|------|-------------|
| `enable_disable_automation_rule` | other | ⚙️ MANAGEMENT TOOL: ⚠️ PREREQUISITE: Use "get_automation_rules" first to find valid rule IDs. If no rules exist (empty l |

### Fields (3 tools)

| Tool | Type | Description |
|------|------|-------------|
| `get_screen_available_fields` | read | ⚠️ PREREQUISITE: Use "get_screens" first to find valid screen IDs. Gets fields that can be added to a screen. If you get |
| `get_screen_tab_fields` | read | ⚠️ PREREQUISITE: Use "get_screens" first to find valid screen IDs. Gets all fields for a specific screen tab. If you get |
| `move_screen_tab_field` | update | ⚠️ PREREQUISITE: Use "get_screens" first to find valid screen IDs. Moves a field within a screen tab to a different posi |

### Issues (2 tools)

| Tool | Type | Description |
|------|------|-------------|
| `delete_workflow_scheme_issue_type` | delete | ⚠️ PREREQUISITE: Use "get_workflow_schemes_detailed" first to discover valid scheme IDs and current issue type mappings. |
| `set_workflow_scheme_issue_type` | update | ⚠️ MULTIPLE PREREQUISITES AND LIMITATIONS: Use "get_workflow_schemes_detailed" first to find scheme IDs. CRITICAL: Activ |

### Projects (2 tools)

| Tool | Type | Description |
|------|------|-------------|
| `assign_issue_type_screen_scheme_to_project` | update | ⚠️ IMPORTANT: The schemeId parameter requires an Issue Type Screen Scheme ID — NOT a plain Screen Scheme ID. These are d |
| `assign_workflow_scheme_to_project` | update | ⚠️ GREENFIELD PROJECTS ONLY: Assigns a workflow scheme to a classic Jira project. CRITICAL PREREQUISITE: The target proj |

### Screens (3 tools)

| Tool | Type | Description |
|------|------|-------------|
| `add_field_to_default_screen` | create | ⚠️ PREREQUISITES: Use "get_screen_available_fields" first to check if the field can be added. Adding a field that is alr |
| `add_field_to_screen` | create | ⚠️ PREREQUISITE: Use "get_screens" first to find valid screen IDs. Adds a field to a specific screen tab using POST meth |
| `remove_field_from_screen_tab` | delete | ⚠️ PREREQUISITE: Use "get_screens" first to find valid screen IDs. Removes a field from a screen tab. If you get "Screen |

### Other (28 tools)

| Tool | Type | Description |
|------|------|-------------|
| `create_automation_rule` | create | ⚙️ MANAGEMENT TOOL: Creates a new automation rule. Use get_automation_component_types first to discover available types  |
| `create_screen` | create | 🆕 CREATE: Creates a new screen with tabs and fields. After creation, use the returned ID with other screen management t |
| `create_screen_scheme` | create | 🆕 CREATE: Creates a new screen scheme with screen mappings for different operations. After creation, use the returned I |
| `create_screen_tab` | create | ⚠️ PREREQUISITE: Use "get_screens" first to find valid screen IDs. Creates a new tab on a screen. If you get "Screen not |
| `create_workflow` | create | 🆕 CREATE: Creates a new workflow with statuses and transitions. |
| `create_workflow_scheme` | create | ✅ Create a new workflow scheme with issue type mappings. Creates a workflow scheme that can be discovered with "get_work |
| `delete_screen` | delete | ⚠️ PREREQUISITE: Use "get_screens" first to find valid screen IDs. Deletes a screen by ID. If you get "Screen not found" |
| `delete_screen_scheme` | delete | ⚠️ PREREQUISITE: Use "get_screen_schemes" first to find valid screen scheme IDs. Deletes a screen scheme by ID. If you g |
| `delete_screen_tab` | delete | ⚠️ PREREQUISITE: Use "get_screens" first to find valid screen IDs. Deletes a tab from a screen. If you get "Screen not f |
| `delete_workflow` | delete | Deletes a Jira workflow by its entity ID. The workflow must not be in use by any active workflow schemes. Use get_workfl |
| `get_automation_component_types` | read | 🔍 DISCOVERY TOOL: Returns all available automation component types (triggers, actions, conditions, branches) with their |
| `get_automation_rule_details` | read | 🔍 DISCOVERY TOOL: ⚠️ PREREQUISITE: Use "get_automation_rules" first to find valid rule IDs. If get_automation_rules ret |
| `get_automation_rules` | read | 🔍 DISCOVERY TOOL: Primary discovery method for automation rule operations. Use this first to find available rule IDs, n |
| `get_automation_templates` | read | 🔍 DISCOVERY TOOL: Retrieves available automation rule templates that can be used as starting points for creating new ru |
| `get_screen_schemes` | read | 🔍 DISCOVERY TOOL: Primary discovery method for screen scheme operations. Use this first to find available screen scheme |
| `get_screen_tabs` | read | ⚠️ PREREQUISITE: Use "get_screens" first to find valid screen IDs. Gets all tabs for a specific screen. If you get "Scre |
| `get_screens` | read | 🔍 DISCOVERY TOOL: Primary discovery method for screen operations. Use this first to find available screen IDs before us |
| `get_statuses` | read | 🔍 DISCOVERY TOOL: Primary discovery method for workflow status operations. Use this FIRST before creating workflows to  |
| `get_workflow_schemes_basic` | read | 🔍 DISCOVERY TOOL: Primary discovery method for workflow scheme operations. Use this first to find available workflow sc |
| `get_workflow_schemes_detailed` | read | 🔍 DISCOVERY TOOL: Use this first to find available workflow scheme IDs before using other workflow scheme management to |
| `get_workflows` | read | 🔍 DISCOVERY TOOL: Primary discovery method for workflow operations. Use this first to find available workflow names and |
| `load_tool_schema` | read | Get the full input schema for a specific tool. Use this before calling a tool to understand its parameters. Returns JSON |
| `search_tools` | discovery | Discover available tools by category or type. Use this first to find the right tool for your task. |
| `setup_workflow_guided` | other | Guided workflow setup that handles complete workflow creation end-to-end. |
| `update_automation_rule` | update | ⚙️ MANAGEMENT TOOL: ⚠️ PREREQUISITE: Use "get_automation_rules" first to find valid rule IDs. If no rules exist (empty l |
| `update_screen` | update | ⚠️ PREREQUISITE: Use "get_screens" first to find valid screen IDs. Updates an existing screen name and/or description. I |
| `update_screen_tab` | update | ⚠️ PREREQUISITE: Use "get_screens" first to find valid screen IDs. Updates the name of a screen tab. If you get "Screen  |
| `update_workflow_scheme` | update | ⚠️ PREREQUISITE: Use "get_workflow_schemes_detailed" first to discover valid scheme IDs. Updates an existing workflow sc |

---

## 3. jira-fields-permissions (31 tools)

Custom fields, permissions, notifications

### Fields (9 tools)

| Tool | Type | Description |
|------|------|-------------|
| `create_custom_field` | create | 🆕 CREATE: Creates a new custom field in Jira with specified configuration. After creation, use the returned ID with oth |
| `create_custom_field_context` | create | ⚠️ KNOWN LIMITATION: Some system custom fields are "locked" and cannot have new contexts created. Returns VALIDATION_ERR |
| `create_custom_field_options` | create | ⚠️ PREREQUISITES: |
| `delete_custom_field` | delete | ⚠️ PREREQUISITE: Use "get_fields_paginated" first to find valid field IDs. Deletes a custom field from Jira. If you get  |
| `delete_custom_field_context` | delete | ⚠️ KNOWN LIMITATION: Some system custom fields are "locked" and their contexts cannot be deleted. Returns VALIDATION_ERR |
| `get_custom_field_contexts` | read | 🔍 DISCOVERY TOOL: Always use this first before working with field options. Discovers all available context IDs for a cu |
| `get_custom_field_options` | read | ⚠️ PREREQUISITES: |
| `update_custom_field` | update | ⚠️ PREREQUISITE: Use "get_fields_paginated" first to find valid field IDs. Updates the name or description of a custom f |
| `update_custom_field_context` | update | ⚠️ KNOWN LIMITATION: Some system custom fields are "locked" and their contexts cannot be modified. Returns VALIDATION_ER |

### Permissions (2 tools)

| Tool | Type | Description |
|------|------|-------------|
| `get_global_permissions` | read | 🔍 DISCOVERY TOOL: Primary discovery method for global permission operations. Use this first to find available global pe |
| `get_my_permissions` | read | 🔍 DISCOVERY TOOL: Gets current user permissions for a specific project, issue, or globally. Use this to understand your |

### Screens (3 tools)

| Tool | Type | Description |
|------|------|-------------|
| `add_field_to_notification_screen` | create | ⚠️ PREREQUISITES: Use "get_notification_screens" to find valid screen IDs, then use jira-workflows "get_screen_tabs" to  |
| `create_notification_screen` | create | Create a new screen for notification workflows with tabs and fields |
| `get_notification_screens` | read | Retrieve all screens available for notification configuration |

### Other (17 tools)

| Tool | Type | Description |
|------|------|-------------|
| `create_field_configuration` | create | 🆕 CREATE: Creates a new field configuration with specified name and description. After creation, use the returned ID wi |
| `create_field_configuration_scheme` | create | 🆕 CREATE: Creates a new field configuration scheme with mappings between issue types and field configurations. After cr |
| `create_notification_scheme` | create | Create a new notification scheme with event notifications |
| `create_permission_grant` | create | ⚠️ PREREQUISITE: Use "get_permission_schemes" first to find valid permission scheme IDs. Adds a permission grant to a pe |
| `create_permission_scheme` | create | 🆕 CREATE: Creates a new permission scheme with specified permissions. After creation, use the returned ID with other pe |
| `delete_permission_grant` | delete | ⚠️ PREREQUISITE: Use "get_permission_schemes" first to find valid permission scheme IDs. Removes a permission grant from |
| `delete_permission_scheme` | delete | ⚠️ PREREQUISITE: Use "get_permission_schemes" first to find valid permission scheme IDs. Deletes a permission scheme by  |
| `get_field_configuration_schemes` | read | 🔍 DISCOVERY TOOL: Primary discovery method for field configuration scheme operations. Use this first to find available  |
| `get_field_configurations` | read | 🔍 DISCOVERY TOOL: Primary discovery method for field configuration operations. Use this first to find available field c |
| `get_fields_paginated` | read | 🔍 DISCOVERY TOOL: Primary discovery method for field operations. Use this first to find available field IDs before usin |
| `get_notification_schemes` | read | Retrieve all notification schemes with pagination support |
| `get_permission_grants` | read | ⚠️ PREREQUISITE: Use "get_permission_schemes" first to find valid permission scheme IDs. Gets all permission grants for  |
| `get_permission_schemes` | read | 🔍 DISCOVERY TOOL: Primary discovery method for permission scheme operations. Use this first to find available permissio |
| `load_tool_schema` | read | Get the full input schema for a specific tool. Use this before calling a tool to understand its parameters. Returns JSON |
| `search_tools` | discovery | Discover available tools by category or type. |
| `update_field_configuration` | update | ⚠️ PREREQUISITE: Use "get_field_configurations" first to find valid field configuration IDs. Updates an existing field c |
| `update_permission_scheme` | update | ⚠️ PREREQUISITE: Use "get_permission_schemes" first to find valid permission scheme IDs. Updates an existing permission  |

---

## 4. jira-service-desk (12 tools)

JSM request types, customer organizations

### Customers (2 tools)

| Tool | Type | Description |
|------|------|-------------|
| `get_organization_customers` | read | ⚠️ PREREQUISITE: Use "get_customer_organizations" first to find valid organization IDs. Lists all customers in a specifi |
| `get_project_customer_organizations` | read | 🔍 DISCOVERY TOOL: Lists organizations associated with a specific service project. Use this to understand project-level  |

### Fields (1 tools)

| Tool | Type | Description |
|------|------|-------------|
| `get_request_type_fields` | read | ⚠️ MULTIPLE PREREQUISITES: Use "get_service_desks" and "get_request_types" first to discover valid service desk and requ |

### Organizations (2 tools)

| Tool | Type | Description |
|------|------|-------------|
| `get_customer_organization_membership` | read | 🔍 DISCOVERY TOOL: Checks which organizations a specific customer belongs to. Use this to understand customer organizati |
| `get_customer_organizations` | read | 🔍 DISCOVERY TOOL: Primary discovery method for customer organization operations. Use this first to find available custo |

### Workflows (1 tools)

| Tool | Type | Description |
|------|------|-------------|
| `configure_request_type_workflow` | other | ⚠️ MULTIPLE PREREQUISITES: Use "get_service_desks", "get_request_types" first AND verify workflow exists. Configures wor |

### Other (6 tools)

| Tool | Type | Description |
|------|------|-------------|
| `analyze_customer_visibility` | read | 🔍 DISCOVERY TOOL: Comprehensive analysis of why customers can or cannot see each other in user pickers. Use this to dia |
| `create_request_type` | create | ⚠️ PREREQUISITE: Use "get_service_desks" first to find valid service desk IDs. Creates a new request type in a service d |
| `get_request_types` | read | ⚠️ PREREQUISITE: Use "get_service_desks" first to discover valid service desk IDs. Retrieves all request types for a spe |
| `get_service_desks` | read | 🔍 DISCOVERY TOOL: Use this first to find available service desk IDs before using other service desk management tools. R |
| `load_tool_schema` | read | Get the full input schema for a specific tool. Use this before calling a tool to understand its parameters. Returns JSON |
| `search_tools` | discovery | Discover available tools by category or type. |

---

## 5. jira-organization (31 tools)

Atlassian Admin, identity, directories

### Groups (2 tools)

| Tool | Type | Description |
|------|------|-------------|
| `get_org_group_stats` | read | Retrieve group statistics for organization and directory analysis |
| `get_user_group_memberships` | read | ⚠️ PREREQUISITE: Use "get_organization_users" or "search_organization_users" first to find valid user account IDs. Gets  |

### Insights (2 tools)

| Tool | Type | Description |
|------|------|-------------|
| `get_enhanced_identity_provider_insights` | read | Advanced identity provider analysis with provisioning insights and performance metrics |
| `get_provisioning_insights` | read | Analyze user provisioning patterns, performance, and failure rates across directories |

### Spaces (1 tools)

| Tool | Type | Description |
|------|------|-------------|
| `get_organization_workspaces` | read | List all product workspaces (Jira, Confluence, etc.) in the organization |

### Users (5 tools)

| Tool | Type | Description |
|------|------|-------------|
| `get_cross_product_user_activity` | read | Analyze user activity patterns across Atlassian products for comprehensive user behavior insights |
| `get_directory_users` | read | ⚠️ PREREQUISITE: Use "get_identity_providers" first to find valid directory IDs. Lists users synced from directories wit |
| `get_org_user_stats` | read | Retrieve user statistics for organization and directory analysis |
| `get_organization_users` | read | 🔍 DISCOVERY TOOL: Primary discovery method for organization user operations. Use this first to find available user IDs  |
| `search_organization_users` | discovery | 🔍 DISCOVERY TOOL: Advanced search for users in the organization with filters. Use this to find specific users by variou |

### Other (21 tools)

| Tool | Type | Description |
|------|------|-------------|
| `analyze_user_access` | read | ⚠️ PREREQUISITE: Use "get_organization_users" or "search_organization_users" first to find valid user account IDs. Compr |
| `get_advanced_directory_health_monitoring` | read | Comprehensive directory health monitoring with predictive insights and trend analysis |
| `get_directory_health_status` | read | Comprehensive directory health analysis including sync status, error patterns, and performance metrics |
| `get_directory_info` | read | ⚠️ PREREQUISITE: Use "get_identity_providers" first to find valid directory IDs. Gets detailed information about a speci |
| `get_directory_sync_settings` | read | ⚠️ PREREQUISITE: Use "get_identity_providers" first to find valid directory IDs. Gets sync configuration including frequ |
| `get_directory_sync_status` | read | ⚠️ PREREQUISITE: Use "get_identity_providers" first to find valid directory IDs. Checks the sync status and health of di |
| `get_identity_providers` | read | 🔍 DISCOVERY TOOL: Primary discovery method for identity provider operations. Lists all configured identity providers an |
| `get_organization_details` | read | Retrieve comprehensive details for a specific organization including statistics, audit, and compliance information |
| `get_organization_domains` | read | List all verified domains and their verification status |
| `get_organization_events` | read | Retrieve organization audit events and administrative activities |
| `get_organization_info` | read | Retrieve comprehensive organization details, settings, and configuration |
| `get_organization_policies` | read | List all security and access policies configured at organization level |
| `get_organizations` | read | Retrieve list of Atlassian organizations with filtering and pagination support for multi-org management |
| `get_user_behavior_pattern_analysis` | read | Analyze user behavior patterns across directory and product usage for security and optimization insights |
| `get_user_last_active` | read | ⚠️ PREREQUISITE: Use "get_organization_users" first to find valid user account IDs. Gets a user's last active dates acro |
| `get_user_manage` | read | Retrieve user management permissions and capabilities for a specific user |
| `get_user_manage_api_tokens` | read | Retrieve API tokens for a specific user for security monitoring |
| `get_user_manage_profile` | read | Retrieve detailed user profile information for management purposes |
| `get_user_role_assignments` | read | ⚠️ PREREQUISITE: Use "get_organization_users" or "search_organization_users" first to find valid user account IDs. Gets  |
| `load_tool_schema` | read | Get the full input schema for a specific tool. Use this before calling a tool to understand its parameters. Returns JSON |
| `search_tools` | discovery | Discover available tools by category or type. |

---

## 6. jira-system-admin (21 tools)

System config, licensing, users, groups

### Permissions (1 tools)

| Tool | Type | Description |
|------|------|-------------|
| `get_bulk_permissions` | read | ⚠️ PREREQUISITE: Use search_projects first to find valid project IDs. Check permissions across multiple projects efficie |

### Users (2 tools)

| Tool | Type | Description |
|------|------|-------------|
| `get_site_user_groups` | read | ⚠️ PREREQUISITE: Use "search_site_users" first to find valid user account IDs. Get all SITE-LEVEL groups that a specific |
| `search_site_users` | discovery | 🔍 DISCOVERY TOOL: Primary SITE-LEVEL user discovery method for finding users by name, email, username, or account ID. U |

### Other (18 tools)

| Tool | Type | Description |
|------|------|-------------|
| `create_filter` | create | 🆕 CREATE: Creates a new filter with JQL query and share permissions. After creation, use the returned filter ID with ot |
| `export_project_data` | read | ⚠️ PREREQUISITE: Use project discovery tools first to find valid project keys. Export comprehensive project data includi |
| `export_user_data` | read | ⚠️ PREREQUISITE: Use "search_users" first to find valid user account IDs. Export user data including profile, groups, pe |
| `generate_health_check_report` | read | 📊 REPORTING: Generate comprehensive system health check and diagnostic report with multiple check levels (basic/compreh |
| `generate_system_report` | read | 📊 REPORTING: Generate comprehensive system health and configuration report with multiple sections (system, license, usa |
| `generate_usage_analytics` | read | 📊 REPORTING: Generate detailed usage analytics and activity reports with time period filtering. Provides comprehensive  |
| `get_application_properties` | read | 🔍 DISCOVERY TOOL: Primary system configuration discovery method. Use this first to find available application property  |
| `get_application_roles` | read | 🔍 DISCOVERY TOOL: Primary application role discovery method. Use this first to find available application role keys bef |
| `get_audit_records` | read | 🔍 DISCOVERY TOOL: Primary audit log discovery method for administrative actions. Use this to find audit records with ad |
| `get_instance_info` | read | 🔍 DISCOVERY TOOL: Primary Jira instance information discovery method. Use this to find server details, version, deploym |
| `get_system_avatars` | read | 🔍 DISCOVERY TOOL: Primary avatar discovery method for projects, issue types, or users. Use this first to find available |
| `get_system_limits` | read | 📊 MONITORING: Retrieve system limits and current usage information for capacity planning and performance monitoring. Pr |
| `get_time_tracking_settings` | read | 🔍 DISCOVERY TOOL: Primary time tracking configuration discovery method. Use this first to review current time tracking  |
| `load_tool_schema` | read | Get the full input schema for a specific tool. Use this before calling a tool to understand its parameters. Returns JSON |
| `search_groups` | discovery | 🔍 DISCOVERY TOOL: Primary group discovery method for finding groups by name or pattern. Use this first to find availabl |
| `search_tools` | discovery | Discover available tools by category or type. |
| `set_application_property` | update | ⚠️ PREREQUISITE: Use "get_application_properties" first to find valid property IDs. Set or update a Jira application pro |
| `update_time_tracking_settings` | update | ⚠️ KNOWN LIMITATION: Time tracking settings in Jira Cloud are managed differently than Jira Data Center. Use "get_time_t |

---

## 7. jira-product-discovery (12 tools)

JPD ideas, insights, scoring

### Insights (1 tools)

| Tool | Type | Description |
|------|------|-------------|
| `analyze_idea_insights` | read | 📊 ANALYSIS: Aggregate analysis of all insights for an idea. Returns summary statistics, themes, and patterns in the evi |

### Projects (1 tools)

| Tool | Type | Description |
|------|------|-------------|
| `get_jpd_projects` | read | 🔍 DISCOVERY: List all Jira Product Discovery projects. Use this first to find project keys before working with ideas an |

### Other (10 tools)

| Tool | Type | Description |
|------|------|-------------|
| `create_idea` | create | 🆕 CREATE: Create a new idea in a JPD project. Requires project key and summary. Use "get_jpd_projects" to find valid pr |
| `delete_idea` | delete | 🗑️ DELETE: Permanently delete an idea and all its associated insights. This action cannot be undone. Use with extreme c |
| `get_idea` | read | 📖 READ: Get full details of a specific idea by ID or key. Use expand parameter to include additional data like changelo |
| `get_idea_scoring` | read | 📊 READ: Get the prioritization scoring data for an idea. Includes impact, effort, confidence, reach, and other scoring  |
| `get_ideas` | read | 🔍 DISCOVERY: List all ideas in a JPD project. Use "get_jpd_projects" first to find valid project keys. Returns ideas wi |
| `get_insights` | read | 🔍 DISCOVERY: List all insights (evidence) attached to an idea. Insights represent customer feedback, research findings, |
| `load_tool_schema` | read | Get the full input schema for a specific tool. Use this before calling a tool to understand its parameters. Returns JSON |
| `search_ideas` | discovery | 🔍 DISCOVERY: Search for ideas using JQL (Jira Query Language). Supports complex queries like status, labels, assignee,  |
| `search_tools` | discovery | 🔍 META DISCOVERY: Find available Jira Product Discovery tools by category or capability. Start here to understand what  |
| `update_idea` | update | ✏️ UPDATE: Update fields on an existing idea. Only specified fields will be modified. Use "get_idea" first to see curren |

---

## 8. confluence (69 tools)

Spaces, pages, comments, attachments

### Comments (4 tools)

| Tool | Type | Description |
|------|------|-------------|
| `add_footer_comment` | create | 💬 CREATE: Add a footer comment to a page. These appear at the bottom of the page. |
| `get_footer_comments` | read | 📖 READ: Get only footer comments on a page (comments at the bottom of the page). |
| `get_inline_comments` | read | 📖 READ: Get only inline comments on a page (comments attached to specific text). |
| `get_page_comments` | read | 📖 READ: Get all comments on a page (both footer and inline comments). |

### Permissions (2 tools)

| Tool | Type | Description |
|------|------|-------------|
| `check_content_permission` | read | 📖 READ: Check if a user has a specific permission on a piece of content. |
| `get_space_permissions` | read | 🔍 DISCOVERY: Get all permissions configured for a space. Shows who can access the space and what they can do. |

### Other (63 tools)

| Tool | Type | Description |
|------|------|-------------|
| `add_content_watch` | create | 👁️ CREATE: Start watching content to receive notifications. |
| `add_labels` | create | 🏷️ CREATE: Add labels to a piece of content. |
| `copy_attachment` | other | 📋 CREATE: Copy an attachment to another page. |
| `copy_page` | other | 📋 CREATE: Create a copy of a page. Can copy to different space or parent. Optionally copies attachments and labels. |
| `create_blog_post` | create | 📝 CREATE: Create a new blog post in a space. |
| `create_content_property` | create | 🆕 CREATE: Create a custom property on content. |
| `create_page` | create | 🆕 CREATE: Create a new page in Confluence. |
| `create_space` | create | 🆕 CREATE: Create a new space in Confluence. Requires a unique key (uppercase alphanumeric) and name. |
| `create_template` | create | 🆕 CREATE: Create a new page template. Omit spaceKey for a global template. |
| `delete_attachment` | delete | 🗑️ DELETE: Delete an attachment. By default moves to trash; use purge=true to permanently delete. |
| `delete_blog_post` | delete | 🗑️ DELETE: Delete a blog post. Moves to trash by default. |
| `delete_comment` | delete | 🗑️ DELETE: Permanently delete a comment. This cannot be undone. |
| `delete_content_property` | delete | 🗑️ DELETE: Delete a content property. |
| `delete_page` | delete | 🗑️ DELETE: Delete a page. By default moves to trash; use purge=true to permanently delete. WARNING: Cannot be undone if |
| `delete_space` | delete | 🗑️ DELETE: Permanently delete a space and ALL its content. WARNING: This cannot be undone! All pages, blogs, and attach |
| `delete_template` | delete | 🗑️ DELETE: Permanently delete a template. |
| `download_attachment` | read | 📥 READ: Get the download URL for an attachment. |
| `get_attachment` | read | 📖 READ: Get details about a specific attachment. |
| `get_attachment_versions` | read | 📖 READ: Get version history of an attachment. |
| `get_attachments` | read | 🔍 DISCOVERY: Get all attachments on a page. Filter by media type or filename. |
| `get_audit_records` | read | 📖 READ: Get audit log records. Admin only. |
| `get_blog_post` | read | 📖 READ: Get details of a specific blog post. |
| `get_blog_posts` | read | 🔍 DISCOVERY: Search for blog posts in Confluence. Filter by space or status. |
| `get_comment_children` | read | 📖 READ: Get replies to a comment (nested comments). |
| `get_content_properties` | read | 📖 READ: Get custom properties stored on content. |
| `get_content_states` | read | 📖 READ: Get available content states (like Draft, Review, Published). |
| `get_content_watchers` | read | 📖 READ: Get users watching a piece of content. |
| `get_labels` | read | 📖 READ: Get labels on a piece of content (page, blog post, etc). |
| `get_page` | read | 📖 READ: Retrieve detailed information about a specific page including its content. Use bodyFormat to specify how you wa |
| `get_page_ancestors` | read | 📖 READ: Get parent pages (ancestors) of a page. Shows the hierarchy path from root to this page. |
| `get_page_children` | read | 📖 READ: Get child pages of a parent page. Use for navigating page hierarchies. |
| `get_page_likes` | read | 📖 READ: Get users who liked a page. Shows engagement with the content. |
| `get_page_restrictions` | read | 📖 READ: Get current restrictions (permissions) on a page. Shows who can read/edit the page. |
| `get_page_version` | read | 📖 READ: Retrieve a specific version of a page. Useful for comparing changes or viewing historical content. |
| `get_page_versions` | read | 📖 READ: Retrieve version history for a page. Shows who made changes and when. |
| `get_permission_types` | read | 🔍 DISCOVERY: Get all available permission types in Confluence. Use this to understand what operations can be granted. |
| `get_space` | read | 📖 READ: Retrieve detailed information about a specific space including its description and homepage. |
| `get_space_content` | read | 📖 READ: Get all pages in a space. Use depth="root" for top-level pages only, or "all" for entire hierarchy. |
| `get_space_labels` | read | 📖 READ: Get all labels used in a space. |
| `get_space_settings` | read | 📖 READ: Get settings for a space including routing and appearance options. |
| `get_space_watchers` | read | 📖 READ: Get users watching a space. |
| `get_system_info` | read | 📖 READ: Get Confluence system information. |
| `get_template` | read | 📖 READ: Get details and body content of a specific template. |
| `get_templates` | read | 🔍 DISCOVERY: Get available page templates. Filter by space for space-specific templates, or omit for global templates. |
| `load_tool_schema` | read | Get the full input schema for a specific tool. Use this before calling a tool to understand its parameters. Returns JSON |
| `move_page` | update | 🔄 UPDATE: Move a page to a new parent or position. Changes the page hierarchy. |
| `remove_content_watch` | delete | 👁️ DELETE: Stop watching content. |
| `restore_space` | other | 📤 UPDATE: Restore an archived space to make it active again. |
| `search_content` | discovery | 🔍 DISCOVERY: Simple text search across Confluence content. For complex queries, use "search_cql". |
| `search_cql` | discovery | 🔍 DISCOVERY: Search Confluence using CQL (Confluence Query Language). Powerful query syntax for finding content. |
| `search_pages` | discovery | 🔍 DISCOVERY: Search for pages in Confluence. Filter by space, title, or status. Use this to find pages before reading o |
| `search_spaces` | discovery | 🔍 DISCOVERY: Search for spaces in Confluence. Filter by type, status, or labels. This is the starting point for finding |
| `search_tools` | discovery | Find available Confluence tools by category or operation type. START HERE. |
| `set_content_state` | update | ⚠️ PREREQUISITE: Use "get_content_states" first to find valid state IDs. State IDs must be numeric (e.g., "1", "2"). Set |
| `set_page_restrictions` | update | 🔒 UPDATE: Set restrictions on a page to control who can read or edit it. |
| `set_space_theme` | update | ⚠️ KNOWN LIMITATION: Confluence Cloud has limited theme support. Common theme keys include "default" and custom theme ke |
| `update_attachment` | update | ✏️ UPDATE: Upload a new version of an existing attachment. |
| `update_blog_post` | update | ✏️ UPDATE: Update an existing blog post. Requires current version number. If title is not provided, the current title wi |
| `update_comment` | update | ✏️ UPDATE: Edit an existing comment. Requires the current version number. |
| `update_content_property` | update | ✏️ UPDATE: Update a content property value. |
| `update_page` | update | ✏️ UPDATE: Update an existing page. Requires the current version number to prevent conflicts. Use "get_page" first to ge |
| `update_space_settings` | update | ✏️ UPDATE: Update space settings like routing options. |
| `upload_attachment` | other | ⚠️ KNOWN LIMITATION: File uploads require multipart/form-data which may not work in all environments. Provide base64-enc |

---

## Tool Type Legend

| Type | Description |
|------|-------------|
| discovery | Search, list, or query multiple resources |
| read | Get or fetch a single resource |
| create | Create a new resource |
| update | Modify an existing resource |
| delete | Remove a resource |
| other | Utility or uncategorized operations |
