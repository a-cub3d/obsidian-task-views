# obsidian-tasks-view

## What This Is

An Obsidian community plugin that provides a better UI for visualizing and interacting with tasks managed by the Tasks plugin (obsidian-tasks-group). This plugin does NOT replace Tasks — it delegates all task logic, editing, and completion to the Tasks plugin. This plugin handles display only.

## Project Owner

First-time developer. Be explicit about what each step does and why. Flag issues before suggesting fixes. Never assume familiarity with TypeScript or the Obsidian plugin API.

## Phase Rules — Critical

**Phase 1 only: sidebar leaf view.**
Do not build the week view. Do not build drag and drop. Do not scope beyond the sidebar until Phase 1 is installed, running, and tested in the vault. Phase 2 details are in the spec for reference only.

## Reference Files

- Spec doc: `obsidian-tasks-view-spec.md` — source of truth for all features and behavior
- Visual mockup: `tasks-plugin-mockup.html` — reference for UI layout and design

## Vault Details

- Date fields in use: both scheduled (`⏳`) and due (`📅`)
- No tags on tasks
- Priorities rarely used
- Excluded folders: `System/Templates` (configurable in settings)

## Tasks Plugin API

- Dependency check on load: confirm Tasks plugin is installed and enabled before rendering anything
- Edit modal: `app.plugins.plugins['obsidian-tasks-plugin'].apiV1.createOrEdit(task, file)`
- Toggle completion: `executeToggleTaskDoneCommand()`
- API reference: https://publish.obsidian.md/tasks/Advanced/Tasks+Api
- Source reference: https://github.com/obsidian-tasks-group/obsidian-tasks

## Task Syntax to Parse

```
- [ ]  Todo
- [/]  In Progress
- [x]  Done
- [>]  Migrated (hide by default)
- [b]  Bookmark (child only — never standalone)

⏳ YYYY-MM-DD   Scheduled date
📅 YYYY-MM-DD   Due date
🛫 YYYY-MM-DD   Start date
✅ YYYY-MM-DD   Completion date
🔁            Recurrence rule
⏫ 🔼 🔽 ⬇️    Priority
➕ 🆔 ⛔        Created, ID, Depends
```

Parse all fields silently. Only surface scheduled, due, and recurrence in the UI. Do not crash on unknown fields.

## Bookmark Rule

`[b]` items are non-task bookmarks used as subtasks under reading tasks. Rules:
- Render indented under parent task if the parent is visible
- Never render as a standalone task
- No checkbox, no click-to-edit, no checkoff behavior on `[b]` items

## Visual Design

- Use Obsidian CSS variables exclusively — never hardcode colors
- Must work in both light and dark mode automatically
- Key variables: `--background-primary`, `--background-secondary`, `--text-normal`, `--text-muted`, `--text-faint`, `--text-accent`, `--interactive-accent`, `--color-red`, `--color-orange`
- Icon: use `setIcon()` with `checkmark` — inherits active theme style
- Sidebar width: inherit from Obsidian, do not set fixed width

## Build Order

1. Scaffold and register the sidebar ItemView — confirm it opens in Obsidian before anything else
2. Vault scan and task parsing
3. Today view rendering with grouping
4. Checkbox interactions wired to Tasks API
5. Quick add input
6. Source link and edit button on task items
7. Overdue banner
8. Progress bar and stats
9. Settings tab
10. Mobile testing

Always get confirmation that each step works before moving to the next.
