# Task Views

A better UI for visualizing and interacting with tasks in [Obsidian](https://obsidian.md), built on top of the [Tasks plugin](https://github.com/obsidian-tasks-group/obsidian-tasks).

**Task Views is a display layer — it does not replace the Tasks plugin.** All task logic, editing, and completion is handled by Tasks. This plugin adds a focused sidebar view with tabs, quick add, and daily progress tracking.

---

## Features

- **Three-tab sidebar** — Today, Tomorrow, and Backlog views, each with a configurable Tasks query
- **Today tab** includes an Overdue section (automatically hidden when empty) and a Today section
- **Quick add** — type a task and press Enter to append it to your inbox file
- **Daily progress bar** — tracks done, in-progress, pending, and overdue tasks for the current day
- **Fully configurable queries** — all five sections (Today, Overdue, Tomorrow, Backlog) use standard Tasks plugin query syntax, editable in settings
- **Collapsible sections** — each section can be collapsed independently
- **Light and dark mode** — uses Obsidian CSS variables throughout, no hardcoded colors
- **Mobile compatible**

---

## Requirements

- [Obsidian](https://obsidian.md) v1.0.0 or later
- [Tasks plugin](https://obsidian.md/plugins?id=obsidian-tasks-plugin) installed and enabled

Task Views will show a warning and refuse to render if the Tasks plugin is not active.

---

## Installation

### Manual

1. Download `main.js`, `styles.css`, and `manifest.json` from the [latest release](../../releases/latest)
2. Copy them to `<your vault>/.obsidian/plugins/obsidian-task-views/`
3. Reload Obsidian and enable **Task Views** in Settings → Community plugins

### From the community plugin list

Not yet listed. Submission pending.

---

## Usage

Open the Task Views sidebar via the ribbon checkmark icon, or via **Command palette → Task Views: Open sidebar**.

### Tabs

| Tab | What it shows |
|---|---|
| **Today** | Overdue tasks (collapsible, hidden if none) + tasks scheduled or due today |
| **Tomorrow** | Tasks scheduled or due tomorrow |
| **Backlog** | Tasks with no scheduled or due date |

### Quick add

Type in the input at the top and press **Enter** to add a task to your inbox file. The inbox file path is configurable in settings (default: `Inbox.md`).

### Progress bar

The bar and pills at the bottom always reflect your **today's workload** regardless of which tab is active — done, in-progress, pending, and overdue counts for tasks due or scheduled today (or earlier).

---

## Settings

Open settings via the gear icon in the sidebar, or via **Settings → Task Views**.

| Setting | Description |
|---|---|
| **Inbox file path** | File that quick-add writes new tasks to |
| **Excluded folders** | Folders skipped during vault scan (e.g. `System/Templates`) |
| **Today query** | Tasks plugin query for the Today section |
| **Overdue query** | Tasks plugin query for the Overdue section |
| **Tomorrow query** | Tasks plugin query for the Tomorrow section |
| **Backlog query** | Tasks plugin query for the Backlog section |

All queries use standard [Tasks plugin query syntax](https://publish.obsidian.md/tasks/Queries/About+Queries). Changes take effect when you click **Apply**.

---

## Task syntax supported

Task Views parses the following fields from task lines:

| Symbol | Field |
|---|---|
| `⏳ YYYY-MM-DD` | Scheduled date |
| `📅 YYYY-MM-DD` | Due date |
| `✅ YYYY-MM-DD` | Completion date |
| `🔁` | Recurrence rule |
| `[ ]` `[/]` `[x]` `[>]` | Todo / In Progress / Done / Migrated |
| `[b]` | Bookmark (rendered indented under parent, never standalone) |

All other fields (priority, created, ID, depends) are parsed silently and ignored in the UI.

---

## Development

```bash
npm install
npm run dev      # watch mode
npm run build    # production build + deploy to vault
```

The build script auto-deploys to your vault plugin folder via `esbuild.config.mjs`. Update the destination path in that file to match your vault location.

---

## License

[MIT](LICENSE)
