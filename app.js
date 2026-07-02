"use strict";

const STORAGE_KEY = "pylab-project-v1";
const SESSION_COOKIE = "pylab_browser_session_v1";
const RUN_TIMEOUT_MS = 5_000;
const LIMITS = Object.freeze({
  maxFiles: 20,
  maxFileBytes: 100 * 1024,
  maxProjectBytes: 500 * 1024,
  maxStdinBytes: 50 * 1024,
});

const DEFAULT_PROJECT = Object.freeze({
  activeFile: "main.py",
  files: [{ name: "main.py", content: "" }],
  stdin: "",
});

const LEGACY_STARTER = Object.freeze({
  main: "from helpers import greet\n\nname = input(\"What is your name? \")\nprint(greet(name))\n",
  helpers: "def greet(name):\n    return f\"Hello, {name}! Welcome to PyLab.\"\n",
});

const elements = {
  runtimeStatus: document.querySelector("#runtime-status"),
  fileList: document.querySelector("#file-list"),
  fileSize: document.querySelector("#file-size"),
  newFile: document.querySelector("#new-file"),
  copyFile: document.querySelector("#copy-file"),
  renameFile: document.querySelector("#rename-file"),
  deleteFile: document.querySelector("#delete-file"),
  resetProject: document.querySelector("#reset-project"),
  saveStatus: document.querySelector("#save-status"),
  stdin: document.querySelector("#stdin-input"),
  run: document.querySelector("#run-code"),
  stop: document.querySelector("#stop-code"),
  clearOutput: document.querySelector("#clear-output"),
  output: document.querySelector("#output"),
};

const editor = CodeMirror.fromTextArea(document.querySelector("#code-editor"), {
  mode: "python",
  theme: "material-darker",
  lineNumbers: true,
  indentUnit: 4,
  tabSize: 4,
  indentWithTabs: false,
  lineWrapping: false,
  matchBrackets: true,
  autoCloseBrackets: true,
  extraKeys: {
    "Ctrl-Enter": runProject,
    "Cmd-Enter": runProject,
    Tab(cm) {
      if (cm.somethingSelected()) cm.indentSelection("add");
      else cm.replaceSelection("    ", "end");
    },
  },
});

initializeBrowserSession();

let project = loadProject();
let worker = null;
let workerReady = false;
let running = false;
let timeoutId = null;
let saveTimer = null;

renderProject();
elements.stdin.value = project.stdin;
createWorker();

editor.on("change", () => {
  const file = activeFile();
  if (!file) return;
  file.content = editor.getValue();
  updateFileSize();
  scheduleSave();
});

elements.stdin.addEventListener("input", () => {
  project.stdin = elements.stdin.value;
  scheduleSave();
});
elements.newFile.addEventListener("click", createFile);
elements.copyFile.addEventListener("click", copyActiveCode);
elements.renameFile.addEventListener("click", renameActiveFile);
elements.deleteFile.addEventListener("click", deleteActiveFile);
elements.resetProject.addEventListener("click", resetProject);
elements.run.addEventListener("click", runProject);
elements.stop.addEventListener("click", stopProject);
elements.clearOutput.addEventListener("click", clearOutput);

window.addEventListener("beforeunload", () => {
  if (saveTimer) saveProject();
});

function cloneDefaultProject() {
  return JSON.parse(JSON.stringify(DEFAULT_PROJECT));
}

function initializeBrowserSession() {
  if (hasSessionCookie()) return;

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${SESSION_COOKIE}=active; Path=/; SameSite=Lax${secure}`;

  // Only clear the autosave if cookies are available. Otherwise, clearing on
  // every page load would make PyLab unusable in browsers that block cookies.
  if (hasSessionCookie()) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage may also be unavailable in a restricted browser context.
    }
  }
}

function hasSessionCookie() {
  return document.cookie
    .split(";")
    .some((cookie) => cookie.trim().startsWith(`${SESSION_COOKIE}=`));
}

function loadProject() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || !Array.isArray(saved.files) || saved.files.length === 0) return cloneDefaultProject();
    if (isLegacyStarter(saved)) return cloneDefaultProject();
    const files = saved.files
      .filter((file) => file && typeof file.name === "string" && typeof file.content === "string")
      .slice(0, LIMITS.maxFiles);
    if (files.length === 0) return cloneDefaultProject();
    return {
      files,
      activeFile: files.some((file) => file.name === saved.activeFile) ? saved.activeFile : files[0].name,
      stdin: typeof saved.stdin === "string" ? saved.stdin : "",
    };
  } catch {
    return cloneDefaultProject();
  }
}

function isLegacyStarter(saved) {
  if (saved.stdin !== "Ada" || saved.files.length !== 2) return false;
  const main = saved.files.find((file) => file.name === "main.py");
  const helpers = saved.files.find((file) => file.name === "helpers.py");
  return main?.content === LEGACY_STARTER.main && helpers?.content === LEGACY_STARTER.helpers;
}

function saveProject() {
  clearTimeout(saveTimer);
  saveTimer = null;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    elements.saveStatus.textContent = "Saved for this browser session";
  } catch {
    elements.saveStatus.textContent = "Could not save — storage is full";
  }
}

function scheduleSave() {
  elements.saveStatus.textContent = "Saving…";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveProject, 350);
}

function activeFile() {
  return project.files.find((file) => file.name === project.activeFile);
}

function renderProject() {
  const file = activeFile() || project.files[0];
  project.activeFile = file.name;
  elements.fileList.replaceChildren(...project.files.map((item) => {
    const listItem = document.createElement("li");
    listItem.className = "file-item";
    const button = document.createElement("button");
    button.type = "button";
    button.className = `file-button${item.name === project.activeFile ? " active" : ""}`;
    button.title = item.name;
    button.setAttribute("aria-current", item.name === project.activeFile ? "page" : "false");
    const type = document.createElement("span");
    type.className = `file-type${item.name.endsWith(".py") ? "" : " text"}`;
    type.textContent = item.name.endsWith(".py") ? "Py" : "Tx";
    const name = document.createElement("span");
    name.className = "file-name";
    name.textContent = item.name;
    button.append(type, name);
    button.addEventListener("click", () => selectFile(item.name));
    listItem.append(button);
    return listItem;
  }));
  editor.setOption("mode", file.name.endsWith(".py") ? "python" : null);
  if (editor.getValue() !== file.content) editor.setValue(file.content);
  updateFileSize();
}

async function copyActiveCode() {
  const originalLabel = elements.copyFile.textContent;
  try {
    await navigator.clipboard.writeText(activeFile().content);
    elements.copyFile.textContent = "Copied";
  } catch {
    elements.copyFile.textContent = "Copy failed";
  }
  window.setTimeout(() => {
    elements.copyFile.textContent = originalLabel;
  }, 1400);
}

function selectFile(name) {
  if (name === project.activeFile) return;
  project.activeFile = name;
  renderProject();
  scheduleSave();
  editor.focus();
}

function createFile() {
  if (project.files.length >= LIMITS.maxFiles) {
    window.alert(`A project can contain at most ${LIMITS.maxFiles} files.`);
    return;
  }
  const proposed = window.prompt("New filename", nextFilename());
  if (proposed === null) return;
  const error = validateFilename(proposed);
  if (error) {
    window.alert(error);
    return;
  }
  project.files.push({ name: proposed, content: "" });
  project.activeFile = proposed;
  renderProject();
  scheduleSave();
  editor.focus();
}

function renameActiveFile() {
  const file = activeFile();
  const proposed = window.prompt("Rename file", file.name);
  if (proposed === null || proposed === file.name) return;
  const error = validateFilename(proposed, file.name);
  if (error) {
    window.alert(error);
    return;
  }
  file.name = proposed;
  project.activeFile = proposed;
  renderProject();
  scheduleSave();
}

function deleteActiveFile() {
  const file = activeFile();
  if (project.files.length === 1) {
    window.alert("A project must contain at least one file.");
    return;
  }
  if (!window.confirm(`Delete ${file.name}?`)) return;
  const index = project.files.indexOf(file);
  project.files.splice(index, 1);
  project.activeFile = project.files[Math.min(index, project.files.length - 1)].name;
  renderProject();
  scheduleSave();
}

function resetProject() {
  if (!window.confirm("Reset PyLab to the starter project? Your current files will be replaced.")) return;
  if (running) stopProject();
  project = cloneDefaultProject();
  elements.stdin.value = project.stdin;
  renderProject();
  saveProject();
  clearOutput();
}

function nextFilename() {
  let number = 1;
  let name = "untitled.py";
  while (project.files.some((file) => file.name === name)) {
    number += 1;
    name = `untitled-${number}.py`;
  }
  return name;
}

function validateFilename(name, currentName = null) {
  if (!name || name.trim() !== name) return "Filenames cannot be empty or start or end with spaces.";
  if (name === "." || name === "..") return "That filename is not allowed.";
  if (name.length > 80) return "Filenames must be 80 characters or fewer.";
  if (!/^[A-Za-z0-9 _.-]+$/.test(name)) return "Use only letters, numbers, spaces, underscores, hyphens, and periods.";
  if (project.files.some((file) => file.name === name && file.name !== currentName)) return "A file with that name already exists.";
  return null;
}

function validateProject() {
  const encoder = new TextEncoder();
  let totalBytes = 0;
  for (const file of project.files) {
    const error = validateFilename(file.name, file.name);
    if (error) return `${file.name}: ${error}`;
    const bytes = encoder.encode(file.content).byteLength;
    if (bytes > LIMITS.maxFileBytes) return `${file.name} is larger than the 100 KB file limit.`;
    totalBytes += bytes;
  }
  if (totalBytes > LIMITS.maxProjectBytes) return "This project is larger than the 500 KB project limit.";
  if (encoder.encode(elements.stdin.value).byteLength > LIMITS.maxStdinBytes) return "Standard input is larger than the 50 KB limit.";
  const entry = project.files.some((file) => file.name === "main.py") ? "main.py" : project.activeFile;
  if (!entry.endsWith(".py")) return "Add main.py or select a Python file to run.";
  return null;
}

function createWorker() {
  workerReady = false;
  updateRuntimeStatus("loading", "Loading Python…");
  updateControls();
  const localAssets = new URLSearchParams(window.location.search).has("localAssets");
  worker = new Worker(`./python-worker.js${localAssets ? "?localAssets=1" : ""}`);
  worker.addEventListener("message", handleWorkerMessage);
  worker.addEventListener("error", () => {
    clearRunTimer();
    running = false;
    workerReady = false;
    updateRuntimeStatus("error", "Python failed to load");
    showOutput("PyLab could not load the Python runtime. Check your connection and reload the page.", true);
    updateControls();
  });
}

function handleWorkerMessage(event) {
  const message = event.data;
  if (message.type === "ready") {
    workerReady = true;
    updateRuntimeStatus("ready", "Python ready");
    updateControls();
    return;
  }
  if (message.type === "result") {
    clearRunTimer();
    running = false;
    const combined = [message.stdout, message.stderr].filter(Boolean).join(message.stdout && message.stderr ? "\n" : "");
    showOutput(combined || "Program finished with no output.", !message.success);
    updateRuntimeStatus("ready", "Python ready");
    updateControls();
    return;
  }
  if (message.type === "fatal") {
    clearRunTimer();
    running = false;
    workerReady = false;
    showOutput(message.error || "The Python worker stopped unexpectedly.", true);
    updateRuntimeStatus("error", "Python error");
    updateControls();
  }
}

function runProject() {
  if (!workerReady || running) return;
  const error = validateProject();
  if (error) {
    showOutput(error, true);
    return;
  }
  saveProject();
  running = true;
  showOutput("Running…");
  updateRuntimeStatus("loading", "Running…");
  updateControls();
  const entry = project.files.some((file) => file.name === "main.py") ? "main.py" : project.activeFile;
  worker.postMessage({
    type: "run",
    files: project.files,
    entry,
    stdin: elements.stdin.value,
  });
  timeoutId = setTimeout(() => {
    terminateAndRestart();
    showOutput("Execution stopped after reaching the 5-second time limit.", true);
  }, RUN_TIMEOUT_MS);
}

function stopProject() {
  if (!running) return;
  terminateAndRestart();
  showOutput("Execution stopped by user.", true);
}

function terminateAndRestart() {
  clearRunTimer();
  running = false;
  workerReady = false;
  worker?.terminate();
  createWorker();
}

function clearRunTimer() {
  clearTimeout(timeoutId);
  timeoutId = null;
}

function updateControls() {
  elements.run.disabled = !workerReady || running;
  elements.stop.disabled = !running;
}

function updateRuntimeStatus(state, text) {
  elements.runtimeStatus.className = `runtime-status is-${state}`;
  elements.runtimeStatus.lastElementChild.textContent = text;
}

function showOutput(text, isError = false) {
  elements.output.textContent = text;
  elements.output.classList.toggle("has-error", isError);
}

function clearOutput() {
  elements.output.classList.remove("has-error");
  elements.output.replaceChildren();
  const placeholder = document.createElement("span");
  placeholder.className = "output-placeholder";
  placeholder.textContent = "Run your code to see its output here.";
  elements.output.append(placeholder);
}

function updateFileSize() {
  const bytes = new TextEncoder().encode(activeFile().content).byteLength;
  elements.fileSize.textContent = bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}
