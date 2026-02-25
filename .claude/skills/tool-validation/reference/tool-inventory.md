# Tool Inventory

Complete list of all 278 tools organized by server and test phase.

---

## Phase 1: Discovery Tools (44 tools)

Test these first - they are read-only and validate API connectivity.

### jira-projects
- `search_projects` - Find all projects
- `get_issue_types` - Find all issue types
- `get_issue_type_schemes` - Find issue type schemes
- `get_dashboards` - Find all dashboards

### jira-workflows
- `get_workflows` - Find all workflows
- `get_workflow_schemes_basic` - Find workflow schemes (basic info)
- `get_workflow_schemes_detailed` - Find workflow schemes (detailed)
- `get_screens` - Find all screens
- `get_screen_schemes` - Find screen schemes
- `get_automation_rules` - Find automation rules
- `get_automation_templates` - Find automation templates
- `search_tools` - Meta: find tools in this server

### jira-fields-permissions
- `get_fields_paginated` - Find all fields
- `get_custom_field_contexts` - Find field contexts
- `get_field_configurations` - Find field configurations
- `get_field_configuration_schemes` - Find field config schemes
- `get_permission_schemes` - Find permission schemes
- `get_global_permissions` - Find global permissions

### jira-service-desk
- `get_service_desks` - Find all service desks
- `get_customer_organizations` - Find customer orgs
- `search_tools` - Meta: find tools in this server

### jira-organization
- `get_organizations` - Find organizations
- `search_organization_users` - Search org users

### jira-system-admin
- `get_instance_info` - Jira instance details
- `get_system_limits` - System limits
- `get_audit_records` - Audit log
- `get_jira_license` - License info
- `search_site_users` - Find users
- `search_groups` - Find groups
- `get_application_roles` - Find app roles
- `get_application_properties` - System properties
- `get_time_tracking_settings` - Time tracking config
- `get_system_webhooks` - Webhooks

### jira-product-discovery
- `search_tools` - Meta: find tools
- `get_jpd_projects` - Find JPD projects
- `get_ideas` - List ideas in project
- `search_ideas` - Search ideas via JQL

### confluence
- `search_spaces` - Find all spaces
- `search_pages` - Find pages
- `search_cql` - Search via CQL
- `search_content` - Text search
- `get_templates` - Find templates
- `get_blog_posts` - Find blog posts
- `get_permission_types` - Available permissions

---

## Phase 2: Create Tools (49 tools)

Create test entities. Follow dependency order.

### jira-projects
- `create_project` - Create project (do first)
- `create_issue` - Create issue (requires project)
- `create_issue_type` - Create issue type
- `create_issue_type_scheme` - Create issue type scheme
- `create_dashboard` - Create dashboard
- `add_comment` - Add comment to issue
- `add_attachment` - Add attachment to issue

### jira-workflows
- `create_workflow` - Create workflow
- `create_workflow_scheme` - Create workflow scheme
- `create_screen` - Create screen
- `create_screen_tab` - Create tab on screen
- `create_screen_scheme` - Create screen scheme
- `add_field_to_screen` - Add field to screen
- `add_field_to_default_screen` - Add to default screen
- `create_automation_rule` - Create automation rule

### jira-fields-permissions
- `create_custom_field` - Create custom field
- `create_custom_field_context` - Create field context
- `create_custom_field_options` - Create field options
- `create_field_configuration` - Create field config
- `create_field_configuration_scheme` - Create field config scheme
- `create_permission_scheme` - Create permission scheme
- `create_permission_grant` - Add grant to scheme
- `create_notification_scheme` - Create notification scheme
- `create_notification_screen` - Create notification screen
- `add_field_to_notification_screen` - Add field to notification screen

### jira-service-desk
- `create_request_type` - Create request type

### jira-system-admin
- `create_filter` - Create saved filter

### jira-product-discovery
- `create_idea` - Create idea
- `create_insight` - Create insight on idea

### confluence
- `create_space` - Create space (do first)
- `create_page` - Create page (requires space)
- `create_blog_post` - Create blog post
- `create_template` - Create template
- `upload_attachment` - Upload file to page
- `add_footer_comment` - Add footer comment
- `add_inline_comment` - Add inline comment
- `add_labels` - Add labels to content
- `add_space_label` - Add label to space
- `add_space_permission` - Add permission
- `add_content_watch` - Watch content
- `create_content_property` - Create property

---

## Phase 3: Read Tools (116 tools)

Read entity details. Use IDs from Phase 2.

### jira-projects
- `get_project` - Get project details
- `get_issue` - Get issue details
- `get_comments` - Get issue comments
- `get_attachment` - Get attachment details
- `list_issue_attachments` - List attachments on issue
- `get_attachment_meta` - Attachment settings
- `get_dashboard` - Get dashboard details
- `get_transitions` - Get issue transitions
- `get_project_analytics` - Project analytics
- `generate_project_report` - Generate report
- `search_jql` - Search issues via JQL

### jira-workflows
- `get_screen_tabs` - Get tabs on screen
- `get_screen_tab_fields` - Get fields on tab
- `get_screen_available_fields` - Available fields for screen
- `get_workflow_scheme_projects` - Projects using scheme
- `get_workflow_scheme_issue_types` - Issue type mappings
- `get_automation_rule_details` - Rule details
- `get_rule_executions` - Rule execution history

### jira-fields-permissions
- `get_custom_field_options` - Get field options
- `get_custom_field_options_guided` - Guided option retrieval
- `get_permission_grants` - Get grants in scheme
- `get_my_permissions` - Current user permissions
- `get_user_permissions` - Specific user permissions
- `get_permission_scheme_users` - Users in scheme
- `get_project_permissions` - Project permissions
- `get_notification_schemes` - Get notification schemes
- `get_notification_screens` - Get notification screens

### jira-service-desk
- `get_request_types` - Get request types
- `get_request_type_fields` - Get fields for request type
- `get_organization_customers` - Get customers in org
- `get_customer_organization_membership` - Customer's orgs
- `get_project_customer_organizations` - Project's orgs

### jira-organization
- `get_organization_details` - Org details
- `get_organization_info` - Org info
- `get_organization_policies` - Org policies
- `get_organization_domains` - Org domains
- `get_organization_workspaces` - Workspaces
- `get_organization_events` - Org events
- `get_organization_users` - Org users
- `get_user_role_assignments` - User roles
- `get_user_group_memberships` - User groups
- `get_user_manage` - User management
- `get_user_manage_profile` - User profile
- `get_user_manage_api_tokens` - User API tokens
- `get_identity_providers` - Identity providers
- `get_directory_info` - Directory info
- `get_directory_sync_status` - Sync status
- `get_directory_sync_settings` - Sync settings
- `get_directory_users` - Directory users
- `get_directory_groups` - Directory groups
- `get_directory_health_status` - Directory health
- `get_provisioning_insights` - Provisioning insights
- `get_enhanced_identity_provider_insights` - IDP insights
- `get_advanced_directory_health_monitoring` - Health monitoring
- `get_user_behavior_pattern_analysis` - Behavior analysis
- `get_org_user_stats` - User stats
- `get_org_group_stats` - Group stats
- `get_user_last_active` - Last active
- `get_scim_directory_groups` - SCIM groups
- `get_scim_directory_schemas` - SCIM schemas
- `get_scim_directory_resource_types` - SCIM resource types
- `get_compass_component_metrics` - Compass metrics
- `get_compass_team_metrics` - Team metrics
- `get_compass_system_events` - System events
- `get_compass_component_events` - Component events
- `get_cross_product_user_activity` - Cross-product activity
- `analyze_user_access` - User access analysis

### jira-system-admin
- `get_site_user_groups` - User's groups
- `get_bulk_permissions` - Bulk permission check
- `get_system_avatars` - System avatars
- `export_project_data` - Export project
- `export_user_data` - Export user data
- `generate_system_report` - System report
- `generate_usage_analytics` - Usage analytics
- `generate_health_check_report` - Health check

### jira-product-discovery
- `get_idea` - Get idea details
- `get_insights` - Get insights for idea
- `get_insight` - Get insight details
- `analyze_idea_insights` - Analyze insights
- `get_idea_scoring` - Get scoring data

### confluence
- `get_space` - Get space details
- `get_page` - Get page details
- `get_space_content` - Get content in space
- `get_space_settings` - Space settings
- `get_space_theme` - Space theme
- `get_page_versions` - Page version history
- `get_page_version` - Specific version
- `get_page_children` - Child pages
- `get_page_ancestors` - Parent pages
- `get_page_restrictions` - Page restrictions
- `get_page_likes` - Page likes
- `get_page_comments` - All comments
- `get_footer_comments` - Footer comments
- `get_inline_comments` - Inline comments
- `get_comment_children` - Comment replies
- `get_attachments` - Page attachments
- `get_attachment` - Attachment details
- `get_attachment_versions` - Attachment versions
- `download_attachment` - Get download URL
- `get_template` - Template details
- `get_blog_post` - Blog post details
- `get_space_permissions` - Space permissions
- `get_space_permission_users` - Permission users
- `check_content_permission` - Check permission
- `get_labels` - Content labels
- `get_space_labels` - Space labels
- `get_content_properties` - Content properties
- `get_content_property` - Specific property
- `get_content_watchers` - Content watchers
- `get_space_watchers` - Space watchers
- `get_audit_records` - Audit log
- `get_system_info` - System info
- `get_content_states` - Content states

---

## Phase 4: Update Tools (35 tools)

Modify test entities.

### jira-projects
- `update_project` - Update project
- `update_issue` - Update issue
- `update_comment` - Update comment
- `update_dashboard` - Update dashboard
- `update_issue_type` - Update issue type
- `update_issue_type_scheme` - Update issue type scheme
- `transition_issue` - Transition issue status
- `assign_issue` - Assign issue

### jira-workflows
- `update_workflow_scheme` - Update workflow scheme
- `update_screen` - Update screen
- `update_screen_tab` - Update screen tab
- `update_screen_scheme` - Update screen scheme
- `move_screen_tab_field` - Move field position
- `assign_workflow_scheme_to_project` - Assign scheme
- `set_workflow_scheme_issue_type` - Set issue type workflow
- `update_automation_rule` - Update automation rule
- `enable_disable_automation_rule` - Toggle rule

### jira-fields-permissions
- `update_custom_field` - Update custom field
- `update_custom_field_context` - Update context
- `update_field_configuration` - Update field config
- `update_permission_scheme` - Update permission scheme

### jira-service-desk
- `update_request_type_fields` - Update request type fields

### jira-system-admin
- `set_application_property` - Set property
- `update_time_tracking_settings` - Update time tracking

### jira-product-discovery
- `update_idea` - Update idea
- `update_insight` - Update insight

### confluence
- `update_space` - Update space
- `update_space_settings` - Update settings
- `set_space_theme` - Set theme
- `update_page` - Update page
- `move_page` - Move page
- `set_page_restrictions` - Set restrictions
- `update_comment` - Update comment
- `update_attachment` - Update attachment
- `update_template` - Update template
- `update_blog_post` - Update blog post
- `update_content_property` - Update property
- `set_content_state` - Set content state
- `bulk_update_permissions` - Bulk update perms

---

## Phase 5: Delete Tools (28 tools)

Clean up test entities. Delete children before parents.

### jira-projects
- `delete_comment` - Delete comment (first)
- `delete_attachment` - Delete attachment
- `delete_issue` - Delete issue
- `delete_dashboard` - Delete dashboard
- `delete_issue_type` - Delete issue type
- `delete_issue_type_scheme` - Delete scheme
- `delete_project` - Delete project (last)

### jira-workflows
- `remove_field_from_screen_tab` - Remove field
- `delete_screen_tab` - Delete tab
- `delete_screen` - Delete screen
- `delete_screen_scheme` - Delete screen scheme
- `delete_workflow_scheme_issue_type` - Remove issue type
- `delete_workflow_scheme` - Delete workflow scheme
- `delete_automation_rule` - Delete automation rule

### jira-fields-permissions
- `delete_permission_grant` - Delete grant
- `delete_permission_scheme` - Delete scheme
- `delete_custom_field_context` - Delete context
- `delete_custom_field` - Delete field

### jira-product-discovery
- `delete_insight` - Delete insight
- `delete_idea` - Delete idea

### confluence
- `delete_comment` - Delete comment
- `remove_label` - Remove label
- `remove_space_label` - Remove space label
- `remove_content_watch` - Remove watch
- `delete_content_property` - Delete property
- `delete_attachment` - Delete attachment
- `delete_template` - Delete template
- `delete_blog_post` - Delete blog post
- `delete_page` - Delete page
- `remove_space_permission` - Remove permission
- `delete_space` - Delete space (last)

---

## Other Tools (6 tools)

Special-purpose tools that don't fit CRUD pattern.

### jira-workflows
- `setup_workflow_guided` - Guided workflow setup
- `execute_manual_rule` - Trigger manual automation
- `validate_automation_rule` - Validate rule config

### jira-service-desk
- `configure_request_type_workflow` - Configure workflow
- `analyze_customer_visibility` - Analyze visibility

### confluence
- `copy_page` - Copy page
- `copy_attachment` - Copy attachment
- `copy_space_permissions` - Copy permissions
- `archive_space` - Archive space
- `restore_space` - Restore space
