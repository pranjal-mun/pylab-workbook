# Build Plan: Static Browser-Based Python Runner

Build a small Python coding website for students.

## Deployment target

This will be deployed as static files in a university-provided `www` folder.

Assume the hosting supports only normal static webpages, such as:

* HTML
* CSS
* JavaScript
* images/assets

Do **not** assume:

* backend server code
* Docker
* database
* Node server
* Python server
* server-side file writes
* server-side code execution

The final project should work by uploading files into the university `www` directory.
Upload the `vendor` directory with the application files so the local fallback
remains available when a CDN cannot be reached.

## Goal

Create a site similar to compilejava.net, but for Python.

The site should let users:

* write Python code
* create multiple simple files
* run the code
* provide standard input through a text box
* see output/errors
* stop bad or infinite-running code
* save work locally in their browser

## Technical direction

Use browser-only technologies:

* Static HTML/CSS/JavaScript
* Pyodide from a pinned CDN version for Python execution, with vendored static files as a fallback
* CodeMirror from a pinned CDN version for code editing, with vendored static files as a fallback
* Web Worker for running Python
* `localStorage` for local saving

No build step unless absolutely necessary.

Preferred local test command:

```bash
python3 -m http.server
```

Then open the site in the browser.

## Execution model

When the user clicks Run:

1. Collect all editor files.
2. Collect the contents of the stdin text box.
3. Send the files and stdin text to a Web Worker.
4. Load Pyodide in the worker if it is not already loaded.
5. Write files into Pyodide’s virtual filesystem.
6. Run `main.py` if it exists, otherwise run the active Python file.
7. Capture stdout, stderr, tracebacks, and status messages.
8. Display the results after execution completes; live output is not required.

Show a clear loading message while Pyodide starts. Disable Run until the
runtime is ready.

Set a default execution timeout of 5 seconds. The Stop button and timeout
should both terminate the current worker and create a fresh one. The new
worker must reload Pyodide before another run can begin.

## Standard input

Provide a simple multiline stdin text box. Python calls to `input()` should
consume one line at a time from this text, in order. If the program requests
more input than was supplied, return EOF rather than opening an interactive
prompt.

## Multi-file support

Support projects like:

```text
main.py
helpers.py
data.txt
```

This should work:

```python
from helpers import greet
```

Files should live in the same virtual working directory during execution.

## Saving

Autosave the current project to `localStorage` when files change. Restore it
when the page is refreshed or reopened in the same browser session.

Use a session cookie as a best-effort browser-session marker. When PyLab opens
without this cookie, clear the previous `localStorage` autosave before loading
the editor and create a new session cookie. This normally preserves work after
a tab is closed and reopened but clears it after the browser is fully closed
and reopened. Browser session-restore settings may preserve session cookies,
so this is convenience cleanup rather than an exam-security boundary.

Provide a Reset button that restores the initial starter project after a
confirmation prompt. Reset should also replace the autosaved project.

This means saving is local to the browser/device. That is acceptable for the first version.

Do not require a database.

## Validation and limits

Keep the virtual project flat: filenames only, with no folders.

Validate filenames before saving or running:

* reject empty names
* reject duplicate names
* reject `.` and `..`
* reject path separators and traversal attempts
* allow simple characters such as letters, numbers, spaces, `_`, `-`, and `.`

Set explicit limits for the number of files, individual file size, total
project size, stdin size, and captured output size. Display a useful message
when a limit is reached. Choose conservative browser-friendly values during
implementation and define them as named constants so they can be adjusted.

## Phase 2: assignments, tests, and sharing

Do not include instructor-provided tests or permalinks in the MVP.

Possible Phase 2 work:

* load starter projects for assignments
* include visible instructor-provided test files
* run `unittest` and show structured pass/fail results
* encode small projects in the URL hash for static permalinks

Tests delivered to a browser cannot be hidden or trusted for secure grading.
This feature would be intended for practice and immediate feedback.

## Sharing

Permalinks are deferred to Phase 2. If added, implement them statically, for
example by encoding small projects into the URL hash.

Do not add a backend just for permalinks.

## Hosting constraints

The app must still work when hosted under a subdirectory, for example:

```text
https://university.ca/~username/python-runner/
```

So avoid hardcoded root paths like:

```text
/script.js
/style.css
```

Prefer relative paths like:

```text
./script.js
./style.css
```

## Keep it simple

Do not add:

* accounts
* login
* server-side execution
* package installation
* database storage
* Docker
* complex project folders

Build the smallest working static version first.

## MVP acceptance criteria

The first version is complete when a student can:

* create, rename, edit, and delete files in a flat project
* run `main.py`, or the active Python file when `main.py` does not exist
* import another Python file from the same project
* provide text consumed by Python's `input()` function
* see output and tracebacks after execution finishes
* stop execution manually or have it stop after 5 seconds
* reload or reopen the page in the same browser session without losing the autosaved project
* begin with an empty project when a new browser session has no PyLab session cookie
* reset the project to its initial state

The site must work as static files under a hosting subdirectory and must not
require a build step, backend, database, account, or server-side execution.
