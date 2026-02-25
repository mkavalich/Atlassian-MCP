---
name: confluence-template-library-builder
version: 1.0.0
description: >
  Create a documentation template library in Confluence with common templates
  (ADR, Runbook, API Spec, Meeting Notes) and example pages. Use this skill
  when the user asks to "set up templates", "create doc standards", "build
  template library", "standardize documentation", "create ADR template",
  "runbook template", or any request involving establishing documentation
  templates and standards in Confluence.
tags:
  - confluence
  - templates
  - documentation
  - standards
---

# Confluence Template Library Builder

## Purpose

This skill creates a standardized documentation template library in Confluence,
establishing consistent patterns for common document types:

- **ADR (Architecture Decision Record)** - Capture technical decisions
- **Runbook** - Operational procedures for incidents/tasks
- **API Specification** - Document API endpoints and usage
- **Meeting Notes** - Structured meeting documentation
- **Technical Design** - System design documents
- **Postmortem** - Incident retrospectives

**The core problem this solves:** Teams create documentation inconsistently.
Without templates, every document starts from scratch, critical sections are
forgotten, and institutional knowledge isn't captured uniformly. Templates
encode organizational standards and make good documentation the path of least
resistance.

**Scope:** Single Confluence space. Creates templates and example pages.

---

## Phase 0: Space Setup

Find or create the target space for templates.

### Step 0.1: Search for Existing Space

```
search_spaces({query: "<SPACE_KEY_OR_NAME>"})
```

If the user specified an existing space, verify it exists.

### Step 0.2: Create Space (if needed)

If no space exists or user requests a new one:

```
create_space({
  key: "<SPACE_KEY>",
  name: "<SPACE_NAME>",
  description: "Documentation templates and standards"
})
```

**Critical constraints:**
- Space key must be UPPERCASE alphanumeric
- Key must start with a letter (not number)
- Key cannot exceed 255 characters
- `create_space` uses V1 API, returns different structure than V2

Extract the numeric `spaceId` from the response - required for page creation.

### Step 0.3: Record Space Details

Capture:
- Space ID (numeric)
- Space key
- Homepage ID (for parent references)

### CHECKPOINT: Space Ready

**Success criteria:**
- Space exists and is accessible
- Space ID captured
- Write permissions confirmed

**If space creation fails:**
1. Check if key already exists (keys must be unique)
2. Verify key format (uppercase, starts with letter)
3. Check user's space creation permissions

---

## Phase 1: Template Creation

Create each template type. Templates in Confluence are special content
types that appear in the "Create" menu.

### Step 1.1: Check Existing Templates

```
get_templates({spaceKey: "<SPACE_KEY>"})
```

Avoid creating duplicates. Note any existing templates to preserve.

### Step 1.2: Create ADR Template

```
create_template({
  spaceKey: "<SPACE_KEY>",
  name: "Architecture Decision Record",
  description: "Document architectural decisions with context and consequences",
  body: "<ADR_TEMPLATE_BODY>"
})
```

See [reference/storage-format-templates.md](./reference/storage-format-templates.md)
for the complete XHTML storage format body.

**Template variables:**
- Use `<at:var at:name="title"/>` for user-fillable placeholders
- Variables appear as prompts when creating from template

### Step 1.3: Create Runbook Template

```
create_template({
  spaceKey: "<SPACE_KEY>",
  name: "Runbook",
  description: "Operational procedure documentation",
  body: "<RUNBOOK_TEMPLATE_BODY>"
})
```

### Step 1.4: Create API Specification Template

```
create_template({
  spaceKey: "<SPACE_KEY>",
  name: "API Specification",
  description: "REST API endpoint documentation",
  body: "<API_SPEC_TEMPLATE_BODY>"
})
```

### Step 1.5: Create Meeting Notes Template

```
create_template({
  spaceKey: "<SPACE_KEY>",
  name: "Meeting Notes",
  description: "Structured meeting documentation",
  body: "<MEETING_NOTES_TEMPLATE_BODY>"
})
```

### Step 1.6: Create Technical Design Template

```
create_template({
  spaceKey: "<SPACE_KEY>",
  name: "Technical Design",
  description: "System design and architecture documentation",
  body: "<TECH_DESIGN_TEMPLATE_BODY>"
})
```

### Step 1.7: Create Postmortem Template

```
create_template({
  spaceKey: "<SPACE_KEY>",
  name: "Postmortem",
  description: "Incident retrospective documentation",
  body: "<POSTMORTEM_TEMPLATE_BODY>"
})
```

### CHECKPOINT: Templates Created

**Success criteria:**
- All requested templates created
- Templates appear in space template list
- No error responses

**If template creation fails:**
1. Check XHTML body format (must be valid storage format)
2. Verify `spaceKey` is correct (not spaceId)
3. Check for duplicate template names

---

## Phase 2: Example Pages

Create one example page per template demonstrating proper usage.

### Step 2.1: Create Examples Parent Page

```
create_page({
  spaceId: "<SPACE_ID>",
  title: "Template Examples",
  body: "<EXAMPLES_INDEX_BODY>"
})
```

This parent page will hold all examples and explain when to use each template.

### Step 2.2: Create ADR Example

```
create_page({
  spaceId: "<SPACE_ID>",
  parentId: "<EXAMPLES_PAGE_ID>",
  title: "Example: ADR-001 Use PostgreSQL for Primary Database",
  body: "<ADR_EXAMPLE_BODY>"
})
```

Populate with realistic example content showing how the template should be used.

### Step 2.3: Create Runbook Example

```
create_page({
  spaceId: "<SPACE_ID>",
  parentId: "<EXAMPLES_PAGE_ID>",
  title: "Example: Deploy to Production Runbook",
  body: "<RUNBOOK_EXAMPLE_BODY>"
})
```

### Step 2.4: Create API Spec Example

```
create_page({
  spaceId: "<SPACE_ID>",
  parentId: "<EXAMPLES_PAGE_ID>",
  title: "Example: Users API Specification",
  body: "<API_SPEC_EXAMPLE_BODY>"
})
```

### Step 2.5: Create Meeting Notes Example

```
create_page({
  spaceId: "<SPACE_ID>",
  parentId: "<EXAMPLES_PAGE_ID>",
  title: "Example: Sprint Planning Meeting 2024-01-15",
  body: "<MEETING_EXAMPLE_BODY>"
})
```

### Step 2.6: Add Labels to Examples

```
add_labels({
  contentId: "<PAGE_ID>",
  labels: ["template-example", "<template-type>"]
})
```

Label each example page for discoverability.

### CHECKPOINT: Examples Created

**Success criteria:**
- Examples parent page created
- One example per template type
- All examples properly parented
- Labels applied

**If page creation fails:**
1. Check `spaceId` is numeric (not key)
2. Verify parent page ID exists
3. Check XHTML body format
4. Ensure title is unique in space

---

## Phase 3: Index Page

Create the main navigation and usage guide.

### Step 3.1: Create Template Library Index

```
create_page({
  spaceId: "<SPACE_ID>",
  title: "Documentation Templates",
  body: "<INDEX_PAGE_BODY>"
})
```

The index page should include:
- Overview of available templates
- When to use each template
- Links to examples
- How to create from template

### Step 3.2: Update Space Homepage (Optional)

If this is a dedicated templates space, consider setting the index as homepage
or linking prominently from the existing homepage.

### Step 3.3: Add Navigation Labels

```
add_labels({
  contentId: "<INDEX_PAGE_ID>",
  labels: ["template-library", "documentation-standards"]
})
```

### CHECKPOINT: Library Complete

**Success criteria:**
- Index page created with navigation
- Templates accessible from space
- Examples demonstrate usage
- Labels enable discovery

---

## Completion Report

```
TEMPLATE LIBRARY CREATED
========================
Space: <SPACE_NAME> (<SPACE_KEY>)
Created: <DATE>

TEMPLATES CREATED
-----------------
1. Architecture Decision Record
2. Runbook
3. API Specification
4. Meeting Notes
5. Technical Design
6. Postmortem

EXAMPLE PAGES
-------------
- Template Examples (parent)
  - Example: ADR-001 Use PostgreSQL
  - Example: Deploy to Production Runbook
  - Example: Users API Specification
  - Example: Sprint Planning Meeting

USAGE
-----
To create from template:
1. Click "Create" in Confluence
2. Select the space
3. Choose template from list
4. Fill in variables and content
```

---

## Anti-Patterns (DO NOT)

1. **DO NOT** use space key where spaceId is required. `create_page` needs
   numeric spaceId, while `create_template` needs text spaceKey.

2. **DO NOT** use HTML directly. Confluence requires XHTML storage format
   with specific namespace declarations.

3. **DO NOT** create child pages before parent exists. Page hierarchy
   requires parent page ID at creation time.

4. **DO NOT** assume template variables work everywhere. Some Confluence
   features have limited template variable support.

5. **DO NOT** create duplicate templates. Check existing templates first
   and update or skip if already present.

6. **DO NOT** use very long template bodies inline. Reference the storage
   format templates document for full XHTML content.

7. **DO NOT** forget labels. Templates without labels are hard to find
   and categorize.

---

## Tool Reference

| Tool | Purpose | Phase |
|------|---------|-------|
| `search_spaces` | Find existing space | 0 |
| `create_space` | Create new space | 0 |
| `get_templates` | Check existing templates | 1 |
| `create_template` | Create each template | 1 |
| `create_page` | Create example pages | 2, 3 |
| `add_labels` | Tag templates and examples | 2, 3 |

---

## Reference Files

- [storage-format-templates.md](./reference/storage-format-templates.md) - Complete
  XHTML storage format bodies for each template type.
