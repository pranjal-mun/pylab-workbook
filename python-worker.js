"use strict";

const PYODIDE_VERSION = "0.27.7";
const PYODIDE_CDN_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
const PYODIDE_LOCAL_URL = new URL("./vendor/pyodide/", self.location.href).href;
const PROJECT_DIR = "/home/pyodide/pylab";
const MAX_OUTPUT_CHARS = 200 * 1024;

let pyodide;

initialize();

async function initialize() {
  try {
    pyodide = await loadRuntime();
    ensureProjectDirectory();
    self.postMessage({ type: "ready" });
  } catch (error) {
    self.postMessage({ type: "fatal", error: formatError(error) });
  }
}

async function loadRuntime() {
  const forceLocal = new URLSearchParams(self.location.search).has("localAssets");
  if (!forceLocal) {
    try {
      importScripts(`${PYODIDE_CDN_URL}pyodide.js`);
      return await loadPyodide({ indexURL: PYODIDE_CDN_URL });
    } catch {
      // Continue with the local pinned runtime below.
    }
  }
  importScripts(`${PYODIDE_LOCAL_URL}pyodide.js`);
  return loadPyodide({ indexURL: PYODIDE_LOCAL_URL });
}

self.addEventListener("message", async (event) => {
  if (event.data?.type !== "run" || !pyodide) return;
  try {
    const result = await runProject(event.data);
    self.postMessage({ type: "result", ...result });
  } catch (error) {
    self.postMessage({ type: "result", success: false, stdout: "", stderr: formatError(error) });
  }
});

function ensureProjectDirectory() {
  if (!pyodide.FS.analyzePath(PROJECT_DIR).exists) pyodide.FS.mkdirTree(PROJECT_DIR);
}

function clearProjectDirectory() {
  for (const name of pyodide.FS.readdir(PROJECT_DIR)) {
    if (name !== "." && name !== "..") pyodide.FS.unlink(`${PROJECT_DIR}/${name}`);
  }
}

async function runProject({ files, entry, stdin }) {
  clearProjectDirectory();
  for (const file of files) {
    pyodide.FS.writeFile(`${PROJECT_DIR}/${file.name}`, file.content, { encoding: "utf8" });
  }
  pyodide.globals.set("__pylab_entry", entry);
  pyodide.globals.set("__pylab_stdin_text", stdin);
  pyodide.globals.set("__pylab_output_limit", MAX_OUTPUT_CHARS);
  pyodide.globals.set("__pylab_module_names", files
    .filter((file) => file.name.endsWith(".py"))
    .map((file) => file.name.slice(0, -3)));

  const resultJson = await pyodide.runPythonAsync(`
import io
import json
import os
import sys
import traceback
from contextlib import redirect_stdout, redirect_stderr

class _PyLabWriter(io.TextIOBase):
    def __init__(self, limit):
        self.limit = limit
        self.parts = []
        self.length = 0
        self.truncated = False

    def writable(self):
        return True

    def write(self, value):
        value = str(value)
        remaining = self.limit - self.length
        if remaining > 0:
            chunk = value[:remaining]
            self.parts.append(chunk)
            self.length += len(chunk)
        if len(value) > remaining:
            self.truncated = True
        return len(value)

    def flush(self):
        pass

    def getvalue(self):
        value = "".join(self.parts)
        if self.truncated:
            value += "\\n[Output truncated at 200 KB]"
        return value

os.chdir("${PROJECT_DIR}")
if "${PROJECT_DIR}" not in sys.path:
    sys.path.insert(0, "${PROJECT_DIR}")

for _module_name in list(__pylab_module_names):
    sys.modules.pop(_module_name, None)

sys.stdin = io.StringIO(__pylab_stdin_text)
sys.argv = [__pylab_entry]
_stdout = _PyLabWriter(__pylab_output_limit)
_stderr = _PyLabWriter(__pylab_output_limit)
_success = True
_namespace = {
    "__name__": "__main__",
    "__file__": __pylab_entry,
    "__package__": None,
}

with redirect_stdout(_stdout), redirect_stderr(_stderr):
    try:
        with open(__pylab_entry, "rb") as _source_file:
            _source = _source_file.read()
        exec(compile(_source, __pylab_entry, "exec"), _namespace)
    except SystemExit as _exit:
        if _exit.code not in (None, 0):
            _success = False
            traceback.print_exc()
    except BaseException:
        _success = False
        traceback.print_exc()

json.dumps({
    "success": _success,
    "stdout": _stdout.getvalue(),
    "stderr": _stderr.getvalue(),
})
  `);
  return JSON.parse(resultJson);
}

function formatError(error) {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}
