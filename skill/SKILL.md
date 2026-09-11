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

## Record after you change things

**If a project has a `.versions/` directory, it has version history enabled,
and every meaningful change you make should end with a recorded version.**
Don't leave the user's history stuck on an old snapshot — after editing
files, run `record` with a short human title describing what you changed:

`npx version-history-widget record "Tweak icon animation timing" -d "what changed and why"`

If the project is set up for auto-recording (`vh watch`, or the middleware
mounted in their dev server), versions are captured on their own and you
don't need to record manually — but recording explicitly is still better,
since it gives the version a meaningful title instead of "Updated src/main.js".

To set a project up so changes are never missed again, see "Auto-recording"
below.

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

## Auto-recording

So that changes are never silently lost, a project can record versions on
its own. Two ways, both framework-agnostic:

- Run a watcher alongside whatever dev server they use:
  `npx version-history-widget watch`
  It debounces, so a burst of edits becomes one version.
- Or mount the middleware in their dev server, which starts the same
  watcher automatically whenever the server runs. For Vite, a
  `vite.config.js` containing:

  ```js
  import { createRequire } from 'module';
  const require = createRequire(import.meta.url);

  export default {
    plugins: [{
      name: 'version-history',
      configureServer(server) {
        server.middlewares.use(require('./.versions/middleware.js')());
      },
    }],
  };
  ```

  (`createRequire` is needed because Vite configs are ES modules and the
  vendored `.versions/` files are CommonJS.)

If the user reports that a change they made isn't showing up in the widget,
it is almost always because nothing recorded it — check
`.versions/manifest.json` against the current files, record the missing
version, then set up one of the two options above.

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
