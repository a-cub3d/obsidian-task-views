# obsidian-tasks-view — Plugin Spec

**Version:** 1.1 — Phase 1 (Sidebar Only)
**Last updated:** June 2026
**Status:** Pre-build reference document

---

## Overview

`obsidian-tasks-view` is a UI companion plugin for the Obsidian Tasks plugin by obsidian-tasks-group. It does not replace Tasks — it provides a better way to visualize and interact with tasks that already exist in the vault. All task logic, parsing, editing, and completion is delegated to the Tasks plugin. This plugin handles display and navigation only.

---

## Architecture

### Two-Phase Build

**Phase 1 (this document):** Sidebar leaf view only.
**Phase 2 (future):** Full-window week view with drag and drop rescheduling.

Do not begin Phase 2 until Phase 1 is installed, running, and tested in the vault.

### Plugin Dependencies

- Requires the Tasks plugin (obsidian-tasks-group) to be installed and enabled
- On load, check that the Tasks plugin is present. If not, show an error notice and disable the view
- Tasks plugin API calls used:
  - `apiV1.createOrEdit(task, file)` — opens the Tasks edit modal
  - `executeToggleTaskDoneCommand()` — handles task completion

### Scaffold Base

Clone from: https://github.com/obsidian/obsidian-sample-plugin

---

## Phase 1 — Sidebar Leaf View

### Registration

- Register as an Obsidian `ItemView` in the right or left sidebar
- View type identifier: `tasks-view-sidebar`
- Display name: "Tasks"
- Icon: use `setIcon()` with `checkmark` — this inherits whatever icon style the active theme uses automatically
- Persists across sessions like any native sidebar pane
- Reopens on startup via `app.workspace.onLayoutReady()`

---

## Task Parsing

### Source

Scan all `.md` files in the vault for task syntax. Do not hardcode any folder paths.

Respect the excluded folders setting — skip any file whose path starts with an excluded folder. See Settings section.

### Full Task Syntax Reference

The following is the complete emoji field set used by the Tasks plugin. Parse and handle all of them even if not all are surfaced in the UI. This prevents display errors when encountering fields the user rarely uses.

```
- [ ]  Todo
- [/]  In Progress
- [x]  Done
- [>]  Migrated (treat as cancelled)
- [b]  Bookmark (subtask/child only — see Bookmark Rule)

Date fields:
⏳ YYYY-MM-DD   Scheduled date
📅 YYYY-MM-DD   Due date
🛫 YYYY-MM-DD   Start date
✅ YYYY-MM-DD   Completion date

Recurrence:
🔁 every week   Recurrence rule

Priority:
⏫   Highest
🔼   High
🔽   Low
⬇️   Lowest
(no emoji = Normal priority)

Other:
➕ YYYY-MM-DD   Created date
🆔 abc123       Task ID
⛔ abc123       Depends on (task ID)
```

**Fields actively used in this vault:** `⏳` scheduled, `📅` due, `🔁` recurrence.
All other fields: parse silently, do not crash, do not surface in the UI unless noted.

### Status Rules

| Status | Symbol | Default Behavior | Toggleable |
|---|---|---|---|
| Todo | `[ ]` | Show | No |
| In Progress | `[/]` | Show | No |
| Bookmark | `[b]` | Show as child only, never standalone | No |
| Done | `[x]` | Show inline, crossed out and de-emphasized | Yes — toggle in settings |
| Migrated | `[>]` | Hide entirely | Yes — toggle in settings |

### Bookmark `[b]` Rule — Critical

A `[b]` item is a non-task bookmark used under reading and assignment tasks. Rules:

- If a `[b]` item is a direct child of a visible parent task in the same file, render it indented beneath the parent
- If a `[b]` item exists at the top level with no parent task above it in the list, ignore it entirely
- Never surface a `[b]` item as a standalone task in any view
- `[b]` items are display-only — do not attach click-to-edit or checkoff behavior to them

### Subtask Hierarchy

- Detect subtasks by indentation level in the source markdown
- Render subtasks indented beneath their parent in the sidebar
- Maintain the visual parent-child relationship exactly as it appears in the source file

---

## Sidebar — Today View

### What "Today" Means

Show tasks where either:
- Scheduled date (`⏳`) equals today, OR
- Due date (`📅`) equals today

Both fields are in use. A task qualifies if either date matches today.

### Overdue

A task is overdue if either its scheduled date or due date is before today and the task is not done.

- Render overdue tasks in a collapsed banner at the top of the sidebar
- Banner label: "Overdue" with a count badge
- Clicking the banner expands/collapses the overdue list
- Overdue tasks render with the date highlighted in red
- Collapsed by default

### Grouping

Tasks are grouped by their source note or heading. Two modes, toggled in plugin settings:

**Group by note (default):** Group header is the file name, e.g. `MBA / BUSN 610`

**Group by heading:** Group header is the nearest heading above the task in the source file

Each group header shows:
- Group name
- Task count pill
- Chevron to collapse/expand the group
- Groups are expanded by default

### Task Item Rendering

Each task item displays the following, matching the visual layout of the Tasks plugin query renderer:

- Checkbox (inherits Obsidian theme styling)
- Task description text, truncated with ellipsis if too long
- Date metadata row beneath the description:
  - Scheduled date if present (`⏳`)
  - Due date if present (`📅`), highlighted orange if due today
  - Recurrence indicator (`🔁 rule`) if present
- Source note link icon — always visible, clicking it opens the source file and scrolls to the task line
- Edit button (pencil icon) — always visible, clicking it opens the Tasks plugin modal via `apiV1.createOrEdit(task, file)`
- Both the source link and edit button are always visible on every task item, not just on hover — this matches the Tasks query renderer behavior
- Done tasks render with strikethrough text and reduced opacity

### Interactions

**Checkbox click:**
- Calls `executeToggleTaskDoneCommand()` on the task
- Updates the checkbox state and applies strikethrough immediately
- Does not re-render the full list on every toggle — update the item in place

**Task text click:**
- Opens the Tasks plugin edit modal via `apiV1.createOrEdit(task, file)`
- Do not build a custom edit UI — always delegate to the Tasks modal

**Source link icon click:**
- Opens the source `.md` file in the editor
- Scrolls to and highlights the task line
- Opens in a new pane if the file is not already open (respects Obsidian's default pane behavior)

**Edit button click:**
- Opens the Tasks plugin edit modal via `apiV1.createOrEdit(task, file)`

### Quick Add

- Fixed input at the top of the sidebar, above the task groups
- Placeholder text: `Add to inbox…`
- Right side label shows the configured inbox file name (e.g. `📥 Inbox.md`)
- On Enter: appends a bare task line `- [ ] {text}` to the bottom of the configured inbox file
- On Escape: clears and dismisses
- Does not open the Tasks modal — just writes the line to the file
- Inbox file path is configurable in plugin settings

### Progress Bar and Stats

Fixed at the bottom of the sidebar:

- Thin progress bar showing completed tasks / total tasks for today
- Bar fills left to right with a gradient from accent color to green
- Below the bar: three stat pills — `N done`, `N pending`, `N overdue`
- Updates reactively when tasks are checked off

---

## Settings

Accessible via Obsidian Settings → Community Plugins → Tasks View

| Setting | Type | Default | Description |
|---|---|---|---|
| Inbox file path | Text | `Inbox.md` | Path to the file quick-add writes to |
| Excluded folders | Text (comma separated) | `System/Templates` | Folders to skip during vault scan. Add any folder path, e.g. `System/Templates, Archive` |
| Group by | Dropdown | `Note` | `Note` or `Heading` |
| Show completed tasks | Toggle | On | Show `[x]` done tasks inline with strikethrough |
| Show migrated tasks | Toggle | Off | Show `[>]` migrated tasks (off = hide entirely) |
| Default date field | Dropdown | `Scheduled` | Which date field controls sort order. Both fields are always checked for today filtering regardless |

---

## Visual Design

Reference file: `tasks-plugin-mockup.html` (uploaded to this project)

### Light and Dark Mode

The plugin must support both light and dark mode. Use Obsidian's native CSS variables exclusively — do not hardcode any color values. This ensures the plugin automatically adapts when the user switches themes or modes.

**Key Obsidian CSS variables to use:**

```css
/* Backgrounds */
--background-primary
--background-secondary
--background-modifier-hover
--background-modifier-border

/* Text */
--text-normal
--text-muted
--text-faint
--text-accent

/* Interactive */
--interactive-accent
--interactive-accent-hover

/* Status colors — define these as plugin-scoped variables */
--tasks-view-color-overdue: var(--color-red)
--tasks-view-color-due-today: var(--color-orange)
--tasks-view-color-done: var(--text-faint)
```

- Never hardcode hex values
- Typography: inherit from `--font-interface` and `--font-monospace`
- Sidebar width: inherit from Obsidian's sidebar — do not set a fixed width
- Scrollbar: 3px wide, transparent track, subtle thumb
- The mockup HTML uses a specific dark palette for visual reference only — translate all colors to their equivalent Obsidian CSS variable

---

## Mobile Considerations

- Sidebar view must render correctly on Obsidian mobile (iOS and Android)
- Touch targets minimum 44px height for checkboxes and task items
- Source link and edit icons must be tappable at full size
- Quick add input must trigger the native mobile keyboard correctly
- No interactions should be hover-only — everything accessible by tap

---

## Error Handling

- If Tasks plugin is not installed: show a notice in the sidebar explaining the dependency
- If the inbox file does not exist: create it automatically on first quick-add
- If a task file has been moved or deleted since last scan: skip it silently, do not crash
- If an excluded folder path is misconfigured: skip it silently, log a console warning

---

## What This Plugin Does NOT Do

- Does not parse or modify task recurrence logic
- Does not manage task statuses beyond delegating to Tasks plugin
- Does not provide its own edit modal
- Does not sync to any external service
- Does not replace or modify the Tasks plugin in any way
- Phase 1 does not include the week view or drag and drop — that is Phase 2

---

## Phase 2 Preview (Do Not Build Yet)

For reference only. Do not implement until Phase 1 is complete and tested.

- Full-window leaf view registered as a separate Obsidian view
- 7-column week calendar layout
- Tasks displayed by scheduled or due date in their respective day column
- Drag and drop between columns rewrites the date field in the source `.md` file directly
- Week navigation with prev/next arrows and a Today button
- Filter chips to toggle scheduled vs due date display
- Click task card opens Tasks plugin modal
- Mobile: columns scroll horizontally
