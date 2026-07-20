"use strict";

const PYODIDE_VERSION = "0.27.7";
const PYODIDE_CDN_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
const PYODIDE_LOCAL_URL = new URL("./vendor/pyodide/", self.location.href).href;
const PROJECT_DIR = "/home/pyodide/pylab-workbook";
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
  if (!pyodide) return;
  try {
    if (event.data?.type === "run") {
      const result = await runProject(event.data);
      self.postMessage({ type: "result", ...result });
    } else if (event.data?.type === "test") {
      const results = await runTests(event.data);
      self.postMessage({ type: "tests", results });
    }
  } catch (error) {
    if (event.data?.type === "test") {
      self.postMessage({ type: "tests", results: [{ name: "Test runner", passed: false, message: formatError(error), output: "" }] });
    } else {
      self.postMessage({ type: "result", success: false, stdout: "", stderr: formatError(error) });
    }
  }
});

function ensureProjectDirectory() {
  if (!pyodide.FS.analyzePath(PROJECT_DIR).exists) pyodide.FS.mkdirTree(PROJECT_DIR);
}

function prepareProject(files) {
  for (const name of pyodide.FS.readdir(PROJECT_DIR)) {
    if (name !== "." && name !== "..") pyodide.FS.unlink(`${PROJECT_DIR}/${name}`);
  }
  for (const file of files) {
    pyodide.FS.writeFile(`${PROJECT_DIR}/${file.name}`, file.content, { encoding: "utf8" });
  }
  pyodide.globals.set("__pylab_module_names", files
    .filter((file) => file.name.endsWith(".py"))
    .map((file) => file.name.slice(0, -3)));
}

function setCommonGlobals({ entry, stdin }) {
  pyodide.globals.set("__pylab_entry", entry);
  pyodide.globals.set("__pylab_stdin_text", stdin || "");
  pyodide.globals.set("__pylab_output_limit", MAX_OUTPUT_CHARS);
}

async function runProject({ files, entry, stdin }) {
  prepareProject(files);
  setCommonGlobals({ entry, stdin });
  const resultJson = await pyodide.runPythonAsync(`${pythonPrelude()}

_pylab_reset_modules()
sys.stdin = io.StringIO(__pylab_stdin_text)
sys.argv = [__pylab_entry]
_stdout = _PyLabWriter(__pylab_output_limit)
_stderr = _PyLabWriter(__pylab_output_limit)
_success = True
_namespace = {"__name__": "__main__", "__file__": __pylab_entry, "__package__": None}

with redirect_stdout(_stdout), redirect_stderr(_stderr):
    try:
        exec(compile(_pylab_source, __pylab_entry, "exec"), _namespace)
    except SystemExit as _exit:
        if _exit.code not in (None, 0):
            _success = False
            traceback.print_exc()
    except BaseException:
        _success = False
        traceback.print_exc()

json.dumps({"success": _success, "stdout": _stdout.getvalue(), "stderr": _stderr.getvalue()})
  `);
  return JSON.parse(resultJson);
}

async function runTests({ files, entry, tests }) {
  prepareProject(files);
  setCommonGlobals({ entry, stdin: "" });
  pyodide.globals.set("__pylab_tests_json", JSON.stringify(tests || []));

  const resultJson = await pyodide.runPythonAsync(`${pythonPrelude()}

_tests = json.loads(__pylab_tests_json)
_results = []

for _test in _tests:
    _pylab_reset_modules()
    sys.stdin = io.StringIO(_test.get("stdin", ""))
    sys.argv = [__pylab_entry]
    _stdout = _PyLabWriter(__pylab_output_limit)
    _stderr = _PyLabWriter(__pylab_output_limit)
    _namespace = {"__name__": "__pylab_test__" if _test.get("moduleMode") else "__main__", "__file__": __pylab_entry, "__package__": None}
    _passed = True
    _message = ""

    with redirect_stdout(_stdout), redirect_stderr(_stderr):
        try:
            exec(compile(_pylab_source, __pylab_entry, "exec"), _namespace)
            _namespace["output"] = _stdout.getvalue()
            exec(compile(_test["code"], "<test>", "exec"), _namespace)
        except AssertionError as _error:
            _passed = False
            _message = str(_error) or "Assertion failed"
        except BaseException:
            _passed = False
            _message = traceback.format_exc(limit=4)

    _captured = _stdout.getvalue()
    _captured_error = _stderr.getvalue()
    if _captured_error:
        _captured = (_captured + "\\n" + _captured_error).strip()
    _results.append({
        "name": _test.get("name", "Test"),
        "passed": _passed,
        "message": _message,
        "output": _captured,
    })

json.dumps(_results)
  `);
  return JSON.parse(resultJson);
}

function pythonPrelude() {
  return `
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

def _pylab_reset_modules():
    for _module_name in list(__pylab_module_names):
        sys.modules.pop(_module_name, None)

with open(__pylab_entry, "rb") as _source_file:
    _pylab_source = _source_file.read()
`;
}

function formatError(error) {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}
