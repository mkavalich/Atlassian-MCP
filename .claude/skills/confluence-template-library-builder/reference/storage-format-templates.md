# Confluence Storage Format Templates

This reference provides complete XHTML storage format bodies for each template type.
Confluence uses XHTML with Atlassian-specific macros for rich content.

## Important Notes

- All content must be valid XHTML
- Use `<ac:structured-macro>` for Confluence macros
- Use `<at:var at:name="variable"/>` for template variables (user fills in)
- Escape special characters properly (`&amp;`, `&lt;`, `&gt;`)

---

## ADR Template

```xml
<h1>ADR-<at:var at:name="number"/>: <at:var at:name="title"/></h1>

<ac:structured-macro ac:name="info">
  <ac:rich-text-body>
    <p><strong>Status:</strong> <at:var at:name="status" at:default="Proposed"/></p>
    <p><strong>Date:</strong> <at:var at:name="date"/></p>
    <p><strong>Decision Makers:</strong> <at:var at:name="deciders"/></p>
  </ac:rich-text-body>
</ac:structured-macro>

<h2>Context</h2>
<p>Describe the issue motivating this decision. What is the context that led to needing this decision?</p>

<h2>Decision</h2>
<p>State the decision that was made. Use active voice: "We will..."</p>

<h2>Alternatives Considered</h2>
<table>
  <thead>
    <tr>
      <th>Option</th>
      <th>Pros</th>
      <th>Cons</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Option 1</td>
      <td></td>
      <td></td>
    </tr>
    <tr>
      <td>Option 2</td>
      <td></td>
      <td></td>
    </tr>
  </tbody>
</table>

<h2>Consequences</h2>
<p>What are the resulting context and consequences after applying this decision?</p>

<h3>Positive</h3>
<ul>
  <li>Benefit 1</li>
</ul>

<h3>Negative</h3>
<ul>
  <li>Tradeoff 1</li>
</ul>

<h2>References</h2>
<ul>
  <li>Related documents and links</li>
</ul>
```

---

## Runbook Template

```xml
<ac:structured-macro ac:name="warning">
  <ac:rich-text-body>
    <p><strong>Last verified:</strong> <at:var at:name="verified_date"/></p>
    <p><strong>Owner:</strong> <at:var at:name="owner"/></p>
  </ac:rich-text-body>
</ac:structured-macro>

<h1><at:var at:name="runbook_title"/></h1>

<h2>Overview</h2>
<p>Brief description of what this runbook accomplishes.</p>

<h2>When to Use</h2>
<ul>
  <li>Trigger condition 1</li>
  <li>Trigger condition 2</li>
</ul>

<h2>Prerequisites</h2>
<ac:structured-macro ac:name="note">
  <ac:rich-text-body>
    <ul>
      <li>Required access or permissions</li>
      <li>Required tools or credentials</li>
    </ul>
  </ac:rich-text-body>
</ac:structured-macro>

<h2>Procedure</h2>

<h3>Step 1: <at:var at:name="step1_title"/></h3>
<ac:structured-macro ac:name="code">
  <ac:parameter ac:name="language">bash</ac:parameter>
  <ac:plain-text-body><![CDATA[# Command to execute]]></ac:plain-text-body>
</ac:structured-macro>
<p>Explain what this step does and what to expect.</p>

<h3>Step 2: <at:var at:name="step2_title"/></h3>
<p>Description of step 2.</p>

<h2>Verification</h2>
<p>How to confirm the procedure completed successfully:</p>
<ul>
  <li>Check item 1</li>
  <li>Expected result 1</li>
</ul>

<h2>Rollback</h2>
<ac:structured-macro ac:name="warning">
  <ac:rich-text-body>
    <p>If the procedure fails, follow these rollback steps:</p>
    <ol>
      <li>Rollback step 1</li>
      <li>Rollback step 2</li>
    </ol>
  </ac:rich-text-body>
</ac:structured-macro>

<h2>Troubleshooting</h2>
<table>
  <thead>
    <tr>
      <th>Symptom</th>
      <th>Likely Cause</th>
      <th>Resolution</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Error message X</td>
      <td>Cause Y</td>
      <td>Do Z</td>
    </tr>
  </tbody>
</table>
```

---

## API Specification Template

```xml
<h1><at:var at:name="api_name"/> API</h1>

<ac:structured-macro ac:name="info">
  <ac:rich-text-body>
    <p><strong>Base URL:</strong> <code><at:var at:name="base_url"/></code></p>
    <p><strong>Version:</strong> <at:var at:name="version"/></p>
    <p><strong>Owner:</strong> <at:var at:name="owner"/></p>
  </ac:rich-text-body>
</ac:structured-macro>

<h2>Overview</h2>
<p>Brief description of what this API does and its primary use cases.</p>

<h2>Authentication</h2>
<p>Describe the authentication method (API key, OAuth, JWT, etc.):</p>
<ac:structured-macro ac:name="code">
  <ac:parameter ac:name="language">bash</ac:parameter>
  <ac:plain-text-body><![CDATA[Authorization: Bearer <token>]]></ac:plain-text-body>
</ac:structured-macro>

<h2>Endpoints</h2>

<h3>GET /resource</h3>
<p>Description of what this endpoint does.</p>

<h4>Request</h4>
<table>
  <thead>
    <tr>
      <th>Parameter</th>
      <th>Type</th>
      <th>Required</th>
      <th>Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>id</td>
      <td>string</td>
      <td>Yes</td>
      <td>Resource identifier</td>
    </tr>
  </tbody>
</table>

<h4>Response</h4>
<ac:structured-macro ac:name="code">
  <ac:parameter ac:name="language">json</ac:parameter>
  <ac:plain-text-body><![CDATA[{
  "id": "123",
  "name": "Example",
  "created_at": "2024-01-15T10:00:00Z"
}]]></ac:plain-text-body>
</ac:structured-macro>

<h4>Error Responses</h4>
<table>
  <thead>
    <tr>
      <th>Status</th>
      <th>Code</th>
      <th>Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>400</td>
      <td>INVALID_REQUEST</td>
      <td>Request validation failed</td>
    </tr>
    <tr>
      <td>404</td>
      <td>NOT_FOUND</td>
      <td>Resource not found</td>
    </tr>
  </tbody>
</table>

<h2>Rate Limits</h2>
<p>Describe rate limiting behavior and headers.</p>

<h2>Changelog</h2>
<table>
  <thead>
    <tr>
      <th>Date</th>
      <th>Version</th>
      <th>Changes</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>2024-01-15</td>
      <td>1.0.0</td>
      <td>Initial release</td>
    </tr>
  </tbody>
</table>
```

---

## Meeting Notes Template

```xml
<h1><at:var at:name="meeting_title"/></h1>

<ac:structured-macro ac:name="info">
  <ac:rich-text-body>
    <p><strong>Date:</strong> <at:var at:name="date"/></p>
    <p><strong>Time:</strong> <at:var at:name="time"/></p>
    <p><strong>Location:</strong> <at:var at:name="location"/></p>
  </ac:rich-text-body>
</ac:structured-macro>

<h2>Attendees</h2>
<ul>
  <li><at:var at:name="attendee1"/></li>
  <li><at:var at:name="attendee2"/></li>
</ul>

<h2>Agenda</h2>
<ol>
  <li>Topic 1</li>
  <li>Topic 2</li>
  <li>Topic 3</li>
</ol>

<h2>Discussion Notes</h2>

<h3>Topic 1</h3>
<p>Key points discussed:</p>
<ul>
  <li>Point 1</li>
  <li>Point 2</li>
</ul>

<h3>Topic 2</h3>
<p>Key points discussed:</p>

<h2>Decisions Made</h2>
<ac:structured-macro ac:name="note">
  <ac:rich-text-body>
    <ol>
      <li><strong>Decision 1:</strong> Description</li>
      <li><strong>Decision 2:</strong> Description</li>
    </ol>
  </ac:rich-text-body>
</ac:structured-macro>

<h2>Action Items</h2>
<ac:structured-macro ac:name="tasklist">
  <ac:rich-text-body>
    <table>
      <thead>
        <tr>
          <th>Action</th>
          <th>Owner</th>
          <th>Due Date</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Action item 1</td>
          <td>@mention</td>
          <td>YYYY-MM-DD</td>
          <td>Open</td>
        </tr>
      </tbody>
    </table>
  </ac:rich-text-body>
</ac:structured-macro>

<h2>Next Meeting</h2>
<p><strong>Date:</strong> <at:var at:name="next_meeting_date"/></p>
<p><strong>Topics to cover:</strong></p>
<ul>
  <li>Follow-up item 1</li>
</ul>
```

---

## Technical Design Template

```xml
<h1><at:var at:name="design_title"/></h1>

<ac:structured-macro ac:name="info">
  <ac:rich-text-body>
    <p><strong>Author:</strong> <at:var at:name="author"/></p>
    <p><strong>Status:</strong> <at:var at:name="status" at:default="Draft"/></p>
    <p><strong>Last Updated:</strong> <at:var at:name="date"/></p>
  </ac:rich-text-body>
</ac:structured-macro>

<ac:structured-macro ac:name="toc"/>

<h2>Executive Summary</h2>
<p>One paragraph summary of what this design proposes and why.</p>

<h2>Problem Statement</h2>
<p>What problem are we solving? Who is affected? What is the impact of not solving it?</p>

<h2>Goals and Non-Goals</h2>

<h3>Goals</h3>
<ul>
  <li>Goal 1</li>
  <li>Goal 2</li>
</ul>

<h3>Non-Goals</h3>
<ul>
  <li>Explicitly out of scope item 1</li>
</ul>

<h2>Proposed Solution</h2>

<h3>High-Level Architecture</h3>
<p>Include architecture diagram here (attach image or use draw.io macro).</p>

<h3>Component Design</h3>

<h4>Component A</h4>
<p>Description and responsibilities.</p>

<h4>Component B</h4>
<p>Description and responsibilities.</p>

<h3>Data Model</h3>
<ac:structured-macro ac:name="code">
  <ac:parameter ac:name="language">sql</ac:parameter>
  <ac:plain-text-body><![CDATA[-- Schema definitions]]></ac:plain-text-body>
</ac:structured-macro>

<h3>API Design</h3>
<p>Key endpoints and contracts.</p>

<h2>Alternatives Considered</h2>
<table>
  <thead>
    <tr>
      <th>Alternative</th>
      <th>Pros</th>
      <th>Cons</th>
      <th>Why Not Chosen</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Alternative 1</td>
      <td></td>
      <td></td>
      <td></td>
    </tr>
  </tbody>
</table>

<h2>Security Considerations</h2>
<ul>
  <li>Authentication/authorization approach</li>
  <li>Data encryption</li>
  <li>Audit logging</li>
</ul>

<h2>Operational Considerations</h2>

<h3>Monitoring</h3>
<p>Key metrics and alerts.</p>

<h3>Deployment</h3>
<p>Rollout strategy and rollback plan.</p>

<h2>Testing Strategy</h2>
<ul>
  <li>Unit tests</li>
  <li>Integration tests</li>
  <li>Load tests</li>
</ul>

<h2>Timeline</h2>
<table>
  <thead>
    <tr>
      <th>Phase</th>
      <th>Duration</th>
      <th>Deliverables</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Phase 1</td>
      <td>2 weeks</td>
      <td>Core implementation</td>
    </tr>
  </tbody>
</table>

<h2>Open Questions</h2>
<ac:structured-macro ac:name="warning">
  <ac:rich-text-body>
    <ul>
      <li>Question 1?</li>
      <li>Question 2?</li>
    </ul>
  </ac:rich-text-body>
</ac:structured-macro>

<h2>References</h2>
<ul>
  <li>Related design docs</li>
  <li>External resources</li>
</ul>
```

---

## Postmortem Template

```xml
<h1>Postmortem: <at:var at:name="incident_title"/></h1>

<ac:structured-macro ac:name="warning">
  <ac:rich-text-body>
    <p><strong>Incident Date:</strong> <at:var at:name="incident_date"/></p>
    <p><strong>Severity:</strong> <at:var at:name="severity"/></p>
    <p><strong>Author:</strong> <at:var at:name="author"/></p>
    <p><strong>Status:</strong> <at:var at:name="status" at:default="Draft"/></p>
  </ac:rich-text-body>
</ac:structured-macro>

<h2>Executive Summary</h2>
<p>One paragraph summary: what happened, impact, and current status.</p>

<h2>Impact</h2>
<table>
  <thead>
    <tr>
      <th>Metric</th>
      <th>Value</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Duration</td>
      <td><at:var at:name="duration"/></td>
    </tr>
    <tr>
      <td>Users Affected</td>
      <td><at:var at:name="users_affected"/></td>
    </tr>
    <tr>
      <td>Revenue Impact</td>
      <td><at:var at:name="revenue_impact"/></td>
    </tr>
    <tr>
      <td>Support Tickets</td>
      <td><at:var at:name="ticket_count"/></td>
    </tr>
  </tbody>
</table>

<h2>Timeline</h2>
<p>All times in UTC.</p>
<table>
  <thead>
    <tr>
      <th>Time</th>
      <th>Event</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>HH:MM</td>
      <td>First alert triggered</td>
    </tr>
    <tr>
      <td>HH:MM</td>
      <td>Incident declared</td>
    </tr>
    <tr>
      <td>HH:MM</td>
      <td>Root cause identified</td>
    </tr>
    <tr>
      <td>HH:MM</td>
      <td>Fix deployed</td>
    </tr>
    <tr>
      <td>HH:MM</td>
      <td>Service restored</td>
    </tr>
  </tbody>
</table>

<h2>Root Cause</h2>
<p>Technical explanation of what caused the incident.</p>

<h2>Resolution</h2>
<p>How was the incident resolved? What actions were taken?</p>

<h2>What Went Well</h2>
<ul>
  <li>Quick detection</li>
  <li>Effective communication</li>
</ul>

<h2>What Went Poorly</h2>
<ul>
  <li>Delayed escalation</li>
  <li>Missing runbook</li>
</ul>

<h2>Action Items</h2>
<ac:structured-macro ac:name="note">
  <ac:rich-text-body>
    <table>
      <thead>
        <tr>
          <th>Priority</th>
          <th>Action</th>
          <th>Owner</th>
          <th>Due Date</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>P0</td>
          <td>Immediate fix to prevent recurrence</td>
          <td>@owner</td>
          <td>YYYY-MM-DD</td>
          <td>Open</td>
        </tr>
        <tr>
          <td>P1</td>
          <td>Add monitoring for early detection</td>
          <td>@owner</td>
          <td>YYYY-MM-DD</td>
          <td>Open</td>
        </tr>
        <tr>
          <td>P2</td>
          <td>Update runbook with learnings</td>
          <td>@owner</td>
          <td>YYYY-MM-DD</td>
          <td>Open</td>
        </tr>
      </tbody>
    </table>
  </ac:rich-text-body>
</ac:structured-macro>

<h2>Lessons Learned</h2>
<p>Key takeaways and how we'll prevent similar incidents.</p>

<h2>Supporting Information</h2>
<ul>
  <li>Link to incident channel</li>
  <li>Link to dashboards</li>
  <li>Related tickets</li>
</ul>
```

---

## Index Page Template

```xml
<h1>Documentation Templates</h1>

<p>This space contains standardized templates for common documentation needs.
Using these templates ensures consistency and completeness across our documentation.</p>

<h2>Available Templates</h2>

<table>
  <thead>
    <tr>
      <th>Template</th>
      <th>When to Use</th>
      <th>Example</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Architecture Decision Record (ADR)</strong></td>
      <td>Documenting significant technical decisions</td>
      <td><a href="#">ADR Example</a></td>
    </tr>
    <tr>
      <td><strong>Runbook</strong></td>
      <td>Operational procedures for incidents or routine tasks</td>
      <td><a href="#">Runbook Example</a></td>
    </tr>
    <tr>
      <td><strong>API Specification</strong></td>
      <td>Documenting REST API endpoints</td>
      <td><a href="#">API Spec Example</a></td>
    </tr>
    <tr>
      <td><strong>Meeting Notes</strong></td>
      <td>Capturing meeting discussions and action items</td>
      <td><a href="#">Meeting Notes Example</a></td>
    </tr>
    <tr>
      <td><strong>Technical Design</strong></td>
      <td>System design and architecture proposals</td>
      <td><a href="#">Tech Design Example</a></td>
    </tr>
    <tr>
      <td><strong>Postmortem</strong></td>
      <td>Incident retrospectives and learnings</td>
      <td><a href="#">Postmortem Example</a></td>
    </tr>
  </tbody>
</table>

<h2>How to Use</h2>

<ol>
  <li>Click <strong>Create</strong> in the Confluence header</li>
  <li>Select the appropriate space</li>
  <li>Choose a template from the list</li>
  <li>Fill in the template variables when prompted</li>
  <li>Complete the content sections</li>
</ol>

<ac:structured-macro ac:name="tip">
  <ac:rich-text-body>
    <p>Review the example pages before creating your first document with a template.
    They demonstrate best practices for each document type.</p>
  </ac:rich-text-body>
</ac:structured-macro>

<h2>Template Examples</h2>
<p>See the <a href="#">Template Examples</a> section for filled-out examples of each template.</p>

<h2>Feedback</h2>
<p>Have suggestions for improving these templates? Contact the documentation team or
submit feedback via the page comments.</p>
```

---

## Usage Notes

When using these templates programmatically:

1. **Escape special characters** in user-provided content
2. **Replace placeholder links** with actual page URLs after creation
3. **Template variables** (`<at:var>`) only work in templates, not regular pages
4. **Test rendering** after creation to ensure XHTML is valid
