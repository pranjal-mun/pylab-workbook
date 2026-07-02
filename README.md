# PyLab

PyLab is a small, browser-based Python coding environment intended for
classroom use. It supports multiple files, standard input, captured output and
errors, a five-second execution limit, browser-session autosave, and local
reset. Autosaved work is cleared when a new browser session begins.

Python runs entirely in the browser through Pyodide. No backend, account, or
server-side code execution is required.

## Run locally

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`.

PyLab prefers pinned CDN assets and falls back to the copies in `vendor/` when
the CDN is unavailable. Use `?localAssets=1` to test the local-only path.

## Deployment

The complete directory can be deployed to any static host. Keep relative paths
unchanged and include the `vendor/` directory.
