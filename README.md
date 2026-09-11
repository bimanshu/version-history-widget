# version-history-widget

Zero-dependency version history for web projects. Every change gets a titled,
restorable snapshot, and a floating "Versions" widget on the live site lets
anyone browse, search, and restore with one click.

Two modes:

- **Project mode** — multi-file sites/apps. Snapshots live in `.versions/`.
- **Single-file mode** — one HTML file. Snapshots live inside the file itself.

## Install

```bash
npm install --save-dev version-history-widget
```

Or use without installing:

```bash
npx version-history-widget init
```

## Project mode

```bash
npx vh init                 # sets up .versions/, injects the widget, saves version 1
npx vh record "Title" -d "what changed and why"
npx vh restore 4            # safety-snapshots current state, then restores version 4
npx vh list [query]         # list versions, optionally filtered
```

Serve it so the restore button works:

```bash
node .versions/serve.js       # standalone static server with restore endpoint
```

Or mount the middleware in your own dev server:

```js
// Express
app.use(require('./.versions/middleware.js')());

// Vite
export default {
  plugins: [{
    name: 'version-history',
    configureServer(server) {
      server.middlewares.use(require('./.versions/middleware.js')());
    },
  }],
};
```

## Single-file mode

```bash
npx vh-singlefile init page.html
npx vh-singlefile record page.html "Title" -d "details"
npx vh-singlefile list page.html [query]
```

Restoring is handled entirely in the browser by the injected widget — no
server needed.

## Claude Code skill

If you use Claude Code, this installs a skill so you can drive it with
`/version-history-widget` (or by just describing what you want) instead
of typing the CLI commands yourself:

```bash
npx version-history-widget skill
```

This copies a `SKILL.md` into `~/.claude/skills/version-history-widget/`
on your machine. It's per-machine — anyone else who wants the slash
command needs to run this once on their own machine too.

## How it works

- No runtime dependencies — only Node's built-in `fs`, `path`, `http`, and
  `child_process`.
- Every snapshot stores full file contents plus a generated diff, so restores
  are exact and history is human-readable.
- The widget (`widget.js`) is vanilla JS + inline CSS, scoped under `vh-`
  class names so it never collides with your site's styles.

## Customizing the widget UI

All of the widget's markup and styling live in `widget.js` as a single
template string. Open it directly and edit the `css` variable (colors,
spacing, fonts) or the HTML-building functions for layout changes — there's
no build step, so changes take effect on next reload.

## License

MIT
