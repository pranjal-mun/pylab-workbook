# PyLab Workbook

PyLab Workbook is a static, browser-based collection of Python practice
problems. Students write solutions, run visible tests, track their progress,
and keep their work on their own device.

## Current foundation

- eight-section top navigation with a dropdown problem index
- all 33 Basics exercises with typed starters and visible tests
- all 27 Conditional exercises with typed starters and visible tests
- all 20 Loop exercises with typed starters and visible tests
- all 23 Function exercises with typed starters and visible tests
- all 24 List exercises, rewritten as original PyLab prompts with visible tests
- all 13 Dictionary exercises with detailed rules and visible tests
- all 23 Files and Exceptions exercises using real Pyodide file fixtures
- all 11 Recursion exercises with explicit base cases and recursion checks
- structured pass/fail test feedback through Pyodide
- typed starter signatures with concise, caller-focused Google-style docstrings
- multiple files per solution
- persistent IndexedDB storage across browser and computer restarts
- completed-problem progress tracking
- local XP, daily streaks, section progress, and milestone celebrations
- difficulty-based XP rewards (20 / 60 / 100) with persistent paid hints
- Matrix-style digital rain after first-time exercise completions
- JSON backup export and import
- responsive layouts for common classroom monitor sizes
- editor-first Zen mode with on-demand output and test-result panels
- CDN-first dependencies with vendored offline fallbacks

## Run locally

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`.

Append `?localAssets=1` to exercise the vendored CodeMirror and Pyodide path.

## Adding problems

Section menus and the core catalog live in `problems/problems.json`; larger chapter
catalogs are split into chapter files such as `problems/dictionaries.json` and
`problems/files.json`. Each implemented problem defines metadata, starter files,
examples, concepts, per-test standard input, and visible Python assertions.

## Deployment

Deploy the complete directory to any static host and include `vendor/` and
`problems/`. The eventual production project will be published separately from
the original PyLab runner as `pylab-workbook`.
