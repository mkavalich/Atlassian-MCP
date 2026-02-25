# Confluence Server

## Atlassian API Quirks

### V2 API vs Legacy API
Confluence has two APIs:
- **V2 API**: `/wiki/api/v2/` - Newer, cleaner, recommended
- **Legacy API**: `/wiki/rest/api/` - Older, more complete

This server uses V2 where possible, falls back to legacy for missing features.

### Content Storage Format
Confluence content uses "storage format" (XHTML-based):
```xml
<p>This is <strong>bold</strong> text</p>
```
- Must be valid XHTML
- Some elements require specific attributes
- Macros have special syntax: `<ac:structured-macro>`

### Content IDs
- Pages, blogs, comments all have numeric IDs
- IDs are globally unique across the instance
- Space keys are separate from content IDs

### Expansion
Confluence heavily uses `expand` parameter:
- `body.storage` - Get page content
- `version` - Get version info
- `space` - Get space details

Without expansion, many fields return null.

## Patterns in This Server

### Content Operations
Content (pages, blogs) follow a pattern:
1. Create with minimal fields
2. Update to add content
3. Publish (if draft)

Drafts are separate from published content.

### Attachments
Attachments are child content:
- Attached to a parent page
- Have their own version history
- Can be referenced in page content via macro

### Space Permissions
Confluence permissions are complex:
- Space permissions (who can access space)
- Content restrictions (who can view/edit specific pages)
- Anonymous access settings

## Known Issues

### Content Body Size
- Large pages may timeout on retrieval
- Use pagination for page listing
- Consider streaming for large content exports

### Macro Rendering
- Storage format contains macro definitions
- Rendered view is different from storage
- Some macros require specific apps to be installed

### Version Conflicts
- Concurrent edits cause version conflicts
- Always get current version before updating
- Use version number in update requests

### Space Creation
- Space keys must be unique
- Some keys are reserved
- Personal spaces have special handling

### CQL (Confluence Query Language)
- Similar to JQL but different syntax
- Some operators work differently
- Test CQL queries before using in automation

## Testing Notes

- Create a test space with key like `MCPTEST`
- Page creation is cheap—create freely in tests
- Attachments consume storage—clean up after tests
- Space deletion is permanent and affects all content
