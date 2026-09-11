---
name: version-history-widget
description: Zero-dependency version history for web projects (the `vh` / version-history-widget CLI). Use when the user wants to save a checkpoint or snapshot of their site, record a titled version of recent changes, list past versions, or restore/roll back to an earlier version. Covers both project mode (multi-file sites, snapshots in .versions/) and single-file mode (one HTML file, snapshots embedded in the file).
---

# Version History Widget

CLI for saving titled, restorable snapshots of a web project, plus a
floating "Versions" widget injected into the live site so anyone can
browse, search, and restore with one click. No runtime dependencies.

Two modes — pick based on what the user is working on:

- **Project mode**: a normal multi-file site/app. History lives in `.versions/`.
- **Single-file mode**: one standalone `.html` file. History lives inside that file.

## Project mode

Run these with Bash from the project root (`npx` needs no local install):

- First time only — sets up `.versions/`, injects the widget into the
  site's entry HTML, saves version 1:
  `npx version-history-widget init`
- After the user has made changes and wants a checkpoint:
  `npx version-history-widget record "Title" -d "what changed and why"`
- List versions, optionally filtered by title/details text:
  `npx version-history-widget list [query]`
- Restore an earlier version (this automatically snapshots the
  current state first, so it's safe):
  `npx version-history-widget restore <id>`
- To serve the site so the widget's in-browser restore button works:
  `node .versions/serve.js` (or mount `.versions/middleware.js` in
  their existing dev server — see `.versions/middleware.js`'s header
  comment for Express/Vite examples).

If `.versions/` doesn't exist yet in the project, run `init` first.

## Single-file mode

Use when the user names one `.html` file rather than a project:

- Init: `npx -p version-history-widget vh-singlefile init page.html`
- Record: `npx -p version-history-widget vh-singlefile record page.html "Title" -d "details"`
- List: `npx -p version-history-widget vh-singlefile list page.html [query]`

Restoring in single-file mode happens entirely in the browser via the
widget embedded in the file — no server or CLI restore command needed.

## Notes

- If the user has it installed as a devDependency already
  (`npm install --save-dev version-history-widget`), use `npx vh ...`
  and `npx vh-singlefile ...` directly instead of the longer `-p` form.
- Always ask for or infer a short, human title when recording — it's
  what shows up in the widget's list and search.
- Don't run `restore` without the user confirming which version id
  they want — list versions first if it's ambiguous.
