# Task Views

A sidebar view for [Obsidian](https://obsidian.md) that gives you a focused way to see your tasks, built on top of the [Tasks plugin](https://github.com/obsidian-tasks-group/obsidian-tasks).

**Task Views is a display layer — it does not replace the Tasks plugin.** All task logic, editing, and completion is handled by Tasks. This plugin adds a sidebar with tabs, quick add, and daily progress tracking.

I built this for my own workflow and wanted it to feel as native to the Tasks plugin as possible — no reimplementing what Tasks already does well, just a cleaner surface for seeing and acting on what's due. If it fits your workflow too, great.

> **Honest disclaimer:** This was vibe coded. I'm not a developer, I have no plans to maintain this or submit it to the Obsidian community plugin list. I'll update it as I need to for myself and share it here. Use it at your own risk, and don't expect support or updates.

![Task Views sidebar](screenshots/Screen%20Shot%202026-06-05%20at%2016.09.03%20PM.png)

---

## Features

- **Three-tab sidebar** — Today, Tomorrow, and Backlog views, each with a configurable Tasks query
- **Today tab** includes an Overdue section (automatically hidden when empty) and a Today section
- **Quick add** — type a task and press Enter to append it to your inbox file
- **Daily progress bar** — tracks done, in-progress, pending, and overdue tasks for the current day
- **Fully configurable queries** — all four sections (Today, Overdue, Tomorrow, Backlog) use standard Tasks plugin query syntax, editable in settings
- **Collapsible sections** — each section can be collapsed independently
- **Light and dark mode** — uses Obsidian CSS variables throughout, no hardcoded colors
- **Mobile compatible**

---

## Requirements

- [Obsidian](https://obsidian.md) v1.12.7
- [Tasks plugin](https://obsidian.md/plugins?id=obsidian-tasks-plugin) v8.0.0, installed and enabled

Task Views will show a warning and refuse to render if the Tasks plugin is not active.

> **Compatibility disclaimer:** Developed and tested on a MacBook and iPhone running the latest macOS and iOS. Only tested against the versions listed above. It may work on other versions and platforms, but there are no guarantees.

---

## Installation

### Manual

1. Download `main.js`, `styles.css`, and `manifest.json` from the [latest release](../../releases/latest)
2. Copy them to `<your vault>/.obsidian/plugins/obsidian-task-views/`
3. Reload Obsidian and enable **Task Views** in Settings → Community plugins

### From the community plugin list

Not listed and not planned.

---

## Usage

Open the Task Views sidebar via the ribbon checkmark icon.

### Tabs

| Tab | What it shows |
|---|---|
| **Today** | Overdue tasks (collapsible, hidden if none) + tasks scheduled or due today |
| **Tomorrow** | Tasks scheduled or due tomorrow |
| **Backlog** | Tasks with no scheduled or due date |

### Quick add

Type in the input at the top and press **Enter** to add a task to your inbox file. The inbox file path is configurable in settings (default: `Inbox.md`).

### Progress bar

The bar and pills at the bottom always reflect your **today's workload** regardless of which tab is active.

The workload is defined as all tasks due or scheduled today **or earlier** (overdue tasks count too — they're still your problem today). Completed tasks are only counted if their completion date is today.

Counting logic:
- **Done** — counts as 1
- **In progress** (`[/]`) — counts as 0.5
- **Pending / overdue** — counts as 0 toward progress, but shown in the pending and overdue pills

This means if you use the `[/]` in-progress status, the bar reflects partial progress rather than treating those tasks as either done or not started.

![Settings panel](screenshots/Screen%20Shot%202026-06-05%20at%2016.04.08%20PM.png)

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

## Task syntax

Since task rendering is handled entirely by the Tasks plugin, **anything Tasks supports will display correctly here** — whatever your version of Tasks renders, and styled however your Obsidian theme styles it.

The following fields are what I use personally, and are the ones this plugin's own parser reads for the progress bar and stats counts:

| Symbol | Field |
|---|---|
| `⏳ YYYY-MM-DD` | Scheduled date |
| `📅 YYYY-MM-DD` | Due date |
| `✅ YYYY-MM-DD` | Completion date |
| `🔁` | Recurrence rule |
| `[ ]` `[/]` `[x]` `[>]` | Todo / In Progress / Done / Migrated |
| `[b]` | Bookmark (rendered indented under parent, never standalone) |

All other fields are parsed silently and ignored by the stats logic.

---

## CSS customization

All styles live in `styles.css` and use [Obsidian CSS variables](https://docs.obsidian.md/Reference/CSS+variables/CSS+variables) exclusively. To override any styles, add a CSS snippet in **Settings → Appearance → CSS snippets**.

Key classes:

| Class | What it styles |
|---|---|
| `.tasks-view-container` | Outer sidebar wrapper |
| `.tasks-view-tab-segment` | The tab bar control |
| `.tasks-view-tab-btn` | Individual tab buttons |
| `.tasks-view-tab-btn.is-active` | Active tab |
| `.tasks-view-section-header` | Section header rows (Overdue, Today, etc.) |
| `.tasks-view-section--overdue` | Overdue section (red accents) |
| `.tasks-view-stats` | Progress bar + pills container |
| `.tasks-view-progress-fill` | The filled portion of the progress bar |
| `.tasks-view-stat-pill--done` | Done pill |
| `.tasks-view-stat-pill--in-progress` | In progress pill |
| `.tasks-view-stat-pill--pending` | Pending pill |
| `.tasks-view-stat-pill--overdue` | Overdue pill |

Example — change the active tab color:
```css
.tasks-view-tab-btn.is-active {
    background: var(--color-purple) !important;
}
```

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
