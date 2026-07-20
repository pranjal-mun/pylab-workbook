"use strict";

const DATABASE_NAME = "pylab-workbook";
const DATABASE_VERSION = 1;
const SOLUTION_STORE = "solutions";
const RUN_TIMEOUT_MS = 5_000;
const XP_REWARDS = Object.freeze({ Beginner: 20, Intermediate: 60, Advanced: 100 });
const CATALOG_URLS = [
  "./problems/problems.json",
  "./problems/basics.json",
  "./problems/conditionals.json",
  "./problems/loops.json",
  "./problems/functions.json",
  "./problems/dictionaries.json",
  "./problems/files.json",
];
const LIMITS = Object.freeze({
  maxFiles: 20,
  maxFileBytes: 100 * 1024,
  maxProjectBytes: 500 * 1024,
  maxStdinBytes: 50 * 1024,
});

const elements = {
  progressCount: document.querySelector("#progress-count"),
  progressBar: document.querySelector("#progress-bar"),
  xpCount: document.querySelector("#xp-count"),
  streakCount: document.querySelector("#streak-count"),
  themeToggle: document.querySelector("#theme-toggle"),
  sectionNav: document.querySelector("#section-nav"),
  exportWork: document.querySelector("#export-work"),
  importWork: document.querySelector("#import-work"),
  importFile: document.querySelector("#import-file"),
  problemNumber: document.querySelector("#problem-number"),
  problemDifficulty: document.querySelector("#problem-difficulty"),
  problemReward: document.querySelector("#problem-reward"),
  problemCategory: document.querySelector("#problem-category"),
  problemTitle: document.querySelector("#problem-title"),
  problemPrompt: document.querySelector("#problem-prompt"),
  problemSignature: document.querySelector("#problem-signature"),
  problemExamples: document.querySelector("#problem-examples"),
  problemConcepts: document.querySelector("#problem-concepts"),
  unlockHint: document.querySelector("#unlock-hint"),
  problemHint: document.querySelector("#problem-hint"),
  visibleTests: document.querySelector("#visible-test-list"),
  previousProblem: document.querySelector("#previous-problem"),
  resetSolution: document.querySelector("#reset-solution"),
  nextProblem: document.querySelector("#next-problem"),
  fileTabs: document.querySelector("#file-tabs"),
  newFile: document.querySelector("#new-file"),
  renameFile: document.querySelector("#rename-file"),
  deleteFile: document.querySelector("#delete-file"),
  zenMode: document.querySelector("#zen-mode"),
  copyFile: document.querySelector("#copy-file"),
  runTests: document.querySelector("#run-tests"),
  runCode: document.querySelector("#run-code"),
  stopCode: document.querySelector("#stop-code"),
  stdin: document.querySelector("#stdin-input"),
  testSummary: document.querySelector("#test-summary"),
  testResults: document.querySelector("#test-results"),
  clearOutput: document.querySelector("#clear-output"),
  output: document.querySelector("#output"),
  runtimeStatus: document.querySelector("#runtime-status"),
  fileSize: document.querySelector("#file-size"),
  saveStatus: document.querySelector("#save-status"),
  achievementToast: document.querySelector("#achievement-toast"),
  achievementTitle: document.querySelector("#achievement-title"),
  achievementMessage: document.querySelector("#achievement-message"),
  previewRain: document.querySelector("#preview-rain"),
  matrixRain: document.querySelector("#matrix-rain"),
};

const editor = CodeMirror.fromTextArea(document.querySelector("#code-editor"), {
  mode: "python",
  theme: document.documentElement.dataset.theme === "dark" ? "material-darker" : "default",
  lineNumbers: true,
  indentUnit: 4,
  tabSize: 4,
  indentWithTabs: false,
  lineWrapping: false,
  matchBrackets: true,
  autoCloseBrackets: true,
  extraKeys: {
    "Ctrl-Enter": runTests,
    "Cmd-Enter": runTests,
    Tab(cm) {
      if (cm.somethingSelected()) cm.indentSelection("add");
      else cm.replaceSelection("    ", "end");
    },
  },
});

let database;
let sections = [];
let problems = [];
let solutions = new Map();
let currentProblem = null;
let solution = null;
let worker = null;
let workerReady = false;
let running = false;
let timeoutId = null;
let saveTimer = null;
let suppressEditorChange = false;
let backupUrl = null;
let achievementTimer = null;
let matrixAnimationId = null;
let matrixStopTimer = null;
let matrixHideTimer = null;
let zenModeActive = false;

bindEvents();
createWorker();
initializeWorkbook();

async function initializeWorkbook() {
  try {
    const [openedDatabase, ...responses] = await Promise.all([
      openDatabase(),
      ...CATALOG_URLS.map((url) => fetch(url, { cache: "no-cache" })),
    ]);
    for (const response of responses) {
      if (!response.ok) throw new Error(`Problem catalog returned ${response.status}`);
    }
    const catalogs = await Promise.all(responses.map((response) => response.json()));
    const catalog = catalogs[0];
    const loadedProblems = catalogs.flatMap((item) => Array.isArray(item.problems) ? item.problems : []);
    if (loadedProblems.length === 0) throw new Error("Problem catalog is empty.");

    database = openedDatabase;
    sections = Array.isArray(catalog.sections) ? catalog.sections : [];
    problems = loadedProblems;
    solutions = new Map((await getAllSolutions()).map((item) => [item.id, item]));
    renderProblemList();
    renderProgress();

    const requestedId = decodeURIComponent(window.location.hash.slice(1));
    const initial = problems.find((problem) => problem.id === requestedId) || problems[0];
    await selectProblem(initial.id);
    elements.saveStatus.textContent = "Saved on this device";
  } catch (error) {
    elements.problemTitle.textContent = "Workbook could not open";
    elements.problemPrompt.textContent = error instanceof Error ? error.message : String(error);
    elements.saveStatus.textContent = "Storage unavailable";
    showOutput("PyLab Workbook could not load its problem catalog or local database.", true);
  }
}

function bindEvents() {
  updateThemeToggle();
  elements.themeToggle.addEventListener("click", toggleTheme);
  editor.on("change", () => {
    if (suppressEditorChange || !solution) return;
    const file = activeFile();
    if (!file) return;
    const wasCompleted = solution.completed;
    if (wasCompleted && !Number(solution.xpAwarded)) solution.xpAwarded = xpReward(currentProblem);
    file.content = editor.getValue();
    solution.completed = false;
    solution.completedAt = null;
    solution.lastResults = null;
    if (wasCompleted) {
      solutions.set(solution.id, clone(solution));
      renderProgress();
      renderProblemList();
    }
    updateFileSize();
    renderTestResults(null);
    scheduleSave();
  });

  elements.stdin.addEventListener("input", () => {
    if (!solution) return;
    solution.stdin = elements.stdin.value;
    scheduleSave();
  });
  elements.previousProblem.addEventListener("click", () => moveProblem(-1));
  elements.resetSolution.addEventListener("click", resetCurrentSolution);
  elements.nextProblem.addEventListener("click", () => moveProblem(1));
  elements.newFile.addEventListener("click", createFile);
  elements.renameFile.addEventListener("click", renameActiveFile);
  elements.deleteFile.addEventListener("click", deleteActiveFile);
  elements.zenMode.addEventListener("click", toggleZenMode);
  elements.copyFile.addEventListener("click", copyActiveCode);
  elements.runTests.addEventListener("click", runTests);
  elements.runCode.addEventListener("click", runCode);
  elements.stopCode.addEventListener("click", stopExecution);
  elements.clearOutput.addEventListener("click", clearOutput);
  elements.exportWork.addEventListener("click", prepareBackupDownload);
  elements.importWork.addEventListener("click", () => elements.importFile.click());
  elements.importFile.addEventListener("change", importBackup);
  elements.previewRain.addEventListener("click", () => playMatrixRain({ force: true }));
  elements.unlockHint.addEventListener("click", unlockCurrentHint);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && zenModeActive) toggleZenMode();
  });
  document.addEventListener("pointermove", (event) => {
    if (elements.sectionNav.contains(event.target)) return;
    for (const menu of elements.sectionNav.querySelectorAll("details[open]")) menu.open = false;
  });
  window.addEventListener("beforeunload", () => {
    if (saveTimer && solution) saveSolutionNow();
  });
}

function toggleTheme() {
  const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("pylab-theme", theme);
  } catch {
    // The selected theme still applies for this tab when storage is unavailable.
  }
  editor.setOption("theme", theme === "dark" ? "material-darker" : "default");
  updateThemeToggle();
  window.setTimeout(() => editor.refresh(), 0);
}

function updateThemeToggle() {
  const dark = document.documentElement.dataset.theme === "dark";
  elements.themeToggle.setAttribute("aria-pressed", String(dark));
  elements.themeToggle.setAttribute("aria-label", `Switch to ${dark ? "light" : "dark"} mode`);
  elements.themeToggle.title = `Switch to ${dark ? "light" : "dark"} mode`;
  elements.themeToggle.querySelector(".theme-icon").textContent = dark ? "☀" : "☾";
  elements.themeToggle.querySelector(".theme-label").textContent = dark ? "Light" : "Dark";
}

function renderProblemList() {
  elements.sectionNav.replaceChildren(...sections.map((section) => {
    const menu = document.createElement("details");
    menu.className = "section-menu";

    const summary = document.createElement("summary");
    const summaryLabel = document.createElement("span");
    summaryLabel.textContent = `${section.number}. ${section.title}`;
    const availableIds = section.problems.map((entry) => entry.id).filter((id) => id && problems.some((problem) => problem.id === id));
    const completedCount = availableIds.filter((id) => solutions.get(id)?.completed).length;
    const sectionProgress = document.createElement("span");
    sectionProgress.className = "section-progress";
    sectionProgress.textContent = availableIds.length ? `${completedCount}/${availableIds.length}` : "";
    summary.append(summaryLabel, sectionProgress);

    const dropdown = document.createElement("div");
    dropdown.className = "section-dropdown";
    if (section.problems.length === 0) {
      const message = document.createElement("p");
      message.className = "coming-soon";
      message.textContent = "Problems coming soon.";
      dropdown.append(message);
    } else {
      dropdown.append(...section.problems.map((entry) => {
        const available = entry.id && problems.some((problem) => problem.id === entry.id);
        const button = document.createElement("button");
        button.type = "button";
        button.className = `section-problem${entry.id === currentProblem?.id ? " active" : ""}`;
        button.disabled = !available;
        button.setAttribute("aria-current", entry.id === currentProblem?.id ? "page" : "false");

        const number = document.createElement("span");
        number.className = "section-problem-number";
        number.textContent = entry.number;
        const title = document.createElement("span");
        title.className = "section-problem-title";
        title.textContent = entry.title;
        const state = document.createElement("span");
        state.className = "section-problem-state";
        state.textContent = available ? (solutions.get(entry.id)?.completed ? "✓" : "") : "Soon";
        button.append(number, title, state);
        if (available) button.addEventListener("click", () => {
          menu.open = false;
          selectProblem(entry.id);
        });
        return button;
      }));
    }

    const positionDropdown = () => {
      const left = menu.getBoundingClientRect().left;
      const headerBottom = document.querySelector(".topbar").getBoundingClientRect().bottom;
      dropdown.style.left = `${Math.max(8, Math.min(left, window.innerWidth - dropdown.offsetWidth - 8))}px`;
      dropdown.style.top = `${headerBottom}px`;
    };
    menu.addEventListener("pointerenter", positionDropdown);
    menu.addEventListener("pointerleave", () => {
      menu.open = false;
      if (menu.contains(document.activeElement)) document.activeElement.blur();
    });
    menu.addEventListener("focusin", positionDropdown);
    menu.addEventListener("focusout", (event) => {
      if (!menu.contains(event.relatedTarget)) menu.open = false;
    });
    menu.addEventListener("toggle", () => {
      if (!menu.open) return;
      for (const other of elements.sectionNav.querySelectorAll("details[open]")) {
        if (other !== menu) other.open = false;
      }
      positionDropdown();
    });
    menu.append(summary, dropdown);
    return menu;
  }));
}

async function selectProblem(id) {
  const nextProblem = problems.find((problem) => problem.id === id);
  if (!nextProblem || nextProblem.id === currentProblem?.id) return;
  if (solution) await saveSolutionNow();

  currentProblem = nextProblem;
  const saved = solutions.get(id);
  solution = saved ? clone(saved) : createStarterSolution(nextProblem);
  if (!solution.files.some((file) => file.name === solution.activeFile)) solution.activeFile = solution.files[0].name;

  window.history.replaceState(null, "", `#${encodeURIComponent(id)}`);
  renderProblem();
  renderProblemList();
  renderEditor();
  elements.stdin.value = solution.stdin || "";
  renderTestResults(solution.lastResults || null);
  clearOutput();
  updateControls();
}

function createStarterSolution(problem) {
  return {
    id: problem.id,
    files: clone(problem.starterFiles),
    activeFile: problem.starterFiles[0].name,
    stdin: "",
    completed: false,
    completedAt: null,
    lastResults: null,
    xpAwarded: 0,
    hintUnlocked: false,
    hintCostPaid: 0,
    updatedAt: new Date().toISOString(),
  };
}

function renderProblem() {
  const index = problems.indexOf(currentProblem);
  elements.problemNumber.textContent = `Exercise ${currentProblem.number}`;
  elements.problemDifficulty.textContent = currentProblem.difficulty;
  elements.problemDifficulty.className = `difficulty-badge ${currentProblem.difficulty.toLowerCase()}`;
  elements.problemReward.textContent = `+${xpReward(currentProblem)} XP`;
  elements.problemCategory.textContent = currentProblem.category;
  elements.problemTitle.textContent = currentProblem.title;
  elements.problemPrompt.textContent = currentProblem.prompt;
  elements.problemSignature.textContent = currentProblem.signature;

  elements.problemExamples.replaceChildren(...currentProblem.examples.map((example) => {
    const container = document.createElement("div");
    container.className = "example";
    const input = document.createElement("div");
    input.append(Object.assign(document.createElement("strong"), { textContent: "Input: " }), example.input);
    const output = document.createElement("div");
    output.append(Object.assign(document.createElement("strong"), { textContent: "Output: " }), example.output);
    container.append(input, output);
    return container;
  }));

  elements.problemConcepts.replaceChildren(...currentProblem.concepts.map((concept) => {
    const tag = document.createElement("span");
    tag.className = "concept";
    tag.textContent = concept;
    return tag;
  }));
  renderHint();

  elements.visibleTests.replaceChildren(...currentProblem.tests.map((test) => {
    const item = document.createElement("li");
    item.textContent = test.name;
    const code = document.createElement("code");
    code.textContent = test.code;
    item.append(code);
    return item;
  }));

  elements.previousProblem.disabled = index === 0;
  elements.nextProblem.disabled = index === problems.length - 1;
}

function moveProblem(offset) {
  const index = problems.indexOf(currentProblem);
  const next = problems[index + offset];
  if (next) selectProblem(next.id);
}

async function resetCurrentSolution() {
  if (!currentProblem || !window.confirm(`Reset your solution for ${currentProblem.title}?`)) return;
  const earned = awardedXp(currentProblem, solution);
  const hintUnlocked = Boolean(solution?.hintUnlocked);
  const hintCostPaid = Number(solution?.hintCostPaid) || 0;
  solution = createStarterSolution(currentProblem);
  solution.xpAwarded = earned;
  solution.hintUnlocked = hintUnlocked;
  solution.hintCostPaid = hintCostPaid;
  solutions.set(solution.id, clone(solution));
  await putSolution(solution);
  renderEditor();
  elements.stdin.value = "";
  renderTestResults(null);
  clearOutput();
  renderProgress();
  renderHint();
  renderProblemList();
  elements.saveStatus.textContent = "Solution reset";
}

function renderEditor() {
  elements.fileTabs.replaceChildren(...solution.files.map((file) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `file-tab${file.name === solution.activeFile ? " active" : ""}`;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", file.name === solution.activeFile ? "true" : "false");
    button.title = file.name;
    button.textContent = file.name;
    button.addEventListener("click", () => selectFile(file.name));
    return button;
  }));

  const file = activeFile();
  editor.setOption("mode", file.name.endsWith(".py") ? "python" : null);
  suppressEditorChange = true;
  editor.setValue(file.content);
  suppressEditorChange = false;
  editor.clearHistory();
  updateFileSize();
  window.setTimeout(() => editor.refresh(), 0);
}

function activeFile() {
  return solution?.files.find((file) => file.name === solution.activeFile);
}

function selectFile(name) {
  if (!solution || name === solution.activeFile) return;
  solution.activeFile = name;
  renderEditor();
  scheduleSave();
  editor.focus();
}

function createFile() {
  if (!solution) return;
  if (solution.files.length >= LIMITS.maxFiles) {
    window.alert(`A solution can contain at most ${LIMITS.maxFiles} files.`);
    return;
  }
  const proposed = window.prompt("New filename", nextFilename());
  if (proposed === null) return;
  const error = validateFilename(proposed);
  if (error) return window.alert(error);
  solution.files.push({ name: proposed, content: "" });
  solution.activeFile = proposed;
  solution.completed = false;
  renderEditor();
  scheduleSave();
  editor.focus();
}

function renameActiveFile() {
  if (!solution) return;
  const file = activeFile();
  const proposed = window.prompt("Rename file", file.name);
  if (proposed === null || proposed === file.name) return;
  const error = validateFilename(proposed, file.name);
  if (error) return window.alert(error);
  file.name = proposed;
  solution.activeFile = proposed;
  solution.completed = false;
  renderEditor();
  scheduleSave();
}

function deleteActiveFile() {
  if (!solution) return;
  if (solution.files.length === 1) return window.alert("A solution must contain at least one file.");
  const file = activeFile();
  if (!window.confirm(`Delete ${file.name}?`)) return;
  const index = solution.files.indexOf(file);
  solution.files.splice(index, 1);
  solution.activeFile = solution.files[Math.min(index, solution.files.length - 1)].name;
  solution.completed = false;
  renderEditor();
  scheduleSave();
}

function nextFilename() {
  let number = 1;
  let name = "helpers.py";
  while (solution.files.some((file) => file.name === name)) {
    number += 1;
    name = `helpers-${number}.py`;
  }
  return name;
}

function validateFilename(name, currentName = null) {
  if (!name || name.trim() !== name) return "Filenames cannot be empty or start or end with spaces.";
  if (name === "." || name === "..") return "That filename is not allowed.";
  if (name.length > 80) return "Filenames must be 80 characters or fewer.";
  if (!/^[A-Za-z0-9 _.-]+$/.test(name)) return "Use only letters, numbers, spaces, underscores, hyphens, and periods.";
  if (solution.files.some((file) => file.name === name && file.name !== currentName)) return "A file with that name already exists.";
  return null;
}

function validateSolution() {
  const encoder = new TextEncoder();
  let totalBytes = 0;
  for (const file of solution.files) {
    const error = validateFilename(file.name, file.name);
    if (error) return `${file.name}: ${error}`;
    const bytes = encoder.encode(file.content).byteLength;
    if (bytes > LIMITS.maxFileBytes) return `${file.name} is larger than the 100 KB file limit.`;
    totalBytes += bytes;
  }
  if (totalBytes > LIMITS.maxProjectBytes) return "This solution is larger than the 500 KB project limit.";
  if (encoder.encode(elements.stdin.value).byteLength > LIMITS.maxStdinBytes) return "Standard input is larger than the 50 KB limit.";
  const entry = solution.files.some((file) => file.name === "main.py") ? "main.py" : solution.activeFile;
  if (!entry.endsWith(".py")) return "Add main.py or select a Python file to run.";
  return null;
}

async function copyActiveCode() {
  const original = elements.copyFile.textContent;
  try {
    await navigator.clipboard.writeText(activeFile().content);
    elements.copyFile.textContent = "Copied";
  } catch {
    elements.copyFile.textContent = "Copy failed";
  }
  window.setTimeout(() => { elements.copyFile.textContent = original; }, 1400);
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
    showOutput("The Python runtime could not load. Check your connection and reload.", true);
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
    finishExecution();
    const combined = [message.stdout, message.stderr].filter(Boolean).join(message.stdout && message.stderr ? "\n" : "");
    showOutput(combined || "Program finished with no output.", !message.success);
    return;
  }
  if (message.type === "tests") {
    finishExecution();
    applyTestResults(message.results || []);
    return;
  }
  if (message.type === "fatal") {
    clearRunTimer();
    running = false;
    workerReady = false;
    updateRuntimeStatus("error", "Python error");
    showOutput(message.error || "The Python worker stopped unexpectedly.", true);
    updateControls();
  }
}

function runCode() {
  revealZenPanel("output");
  startExecution("run");
}

function runTests() {
  revealZenPanel("tests");
  startExecution("test");
}

function toggleZenMode() {
  zenModeActive = !zenModeActive;
  document.body.classList.toggle("zen-mode", zenModeActive);
  if (!zenModeActive) {
    document.body.classList.remove("zen-show-output", "zen-show-tests");
  }
  elements.zenMode.setAttribute("aria-pressed", String(zenModeActive));
  elements.zenMode.textContent = zenModeActive ? "Exit Zen" : "Zen mode";
  window.setTimeout(() => editor.refresh(), 0);
}

function revealZenPanel(panel) {
  if (!zenModeActive) return;
  document.body.classList.toggle("zen-show-output", panel === "output");
  document.body.classList.toggle("zen-show-tests", panel === "tests");
  window.setTimeout(() => editor.refresh(), 0);
}

function startExecution(type) {
  if (!workerReady || running || !solution) return;
  const error = validateSolution();
  if (error) return showOutput(error, true);
  saveSolutionNow();
  running = true;
  updateRuntimeStatus("loading", type === "test" ? "Running tests…" : "Running code…");
  updateControls();
  if (type === "test") {
    elements.testSummary.className = "test-summary";
    elements.testSummary.textContent = "Running…";
    elements.testResults.innerHTML = '<p class="empty-state">Checking your solution…</p>';
  } else {
    showOutput("Running…");
  }
  const entry = solution.files.some((file) => file.name === "main.py") ? "main.py" : solution.activeFile;
  worker.postMessage({
    type,
    files: solution.files,
    entry,
    stdin: elements.stdin.value,
    tests: currentProblem.tests,
  });
  timeoutId = window.setTimeout(() => {
    terminateAndRestart();
    const message = "Execution stopped after reaching the 5-second time limit.";
    showOutput(message, true);
    if (type === "test") {
      elements.testSummary.className = "test-summary failed";
      elements.testSummary.textContent = "Timed out";
      elements.testResults.innerHTML = `<p class="empty-state">${message}</p>`;
    }
  }, RUN_TIMEOUT_MS);
}

function finishExecution() {
  clearRunTimer();
  running = false;
  updateRuntimeStatus("ready", "Python ready");
  updateControls();
}

function stopExecution() {
  if (!running) return;
  terminateAndRestart();
  showOutput("Execution stopped by user.", true);
  elements.testSummary.className = "test-summary failed";
  elements.testSummary.textContent = "Stopped";
}

function terminateAndRestart() {
  clearRunTimer();
  running = false;
  workerReady = false;
  worker?.terminate();
  createWorker();
}

function clearRunTimer() {
  window.clearTimeout(timeoutId);
  timeoutId = null;
}

function updateControls() {
  const disabled = !workerReady || running || !solution;
  elements.runTests.disabled = disabled;
  elements.runCode.disabled = disabled;
  elements.stopCode.disabled = !running;
}

function updateRuntimeStatus(state, text) {
  elements.runtimeStatus.className = `runtime-status is-${state}`;
  elements.runtimeStatus.lastElementChild.textContent = text;
}

function applyTestResults(results) {
  const passed = results.filter((result) => result.passed).length;
  const allPassed = results.length > 0 && passed === results.length;
  const wasCompleted = solution.completed;
  let earnedNow = 0;
  solution.completed = allPassed;
  if (allPassed && !wasCompleted) solution.completedAt = new Date().toISOString();
  if (!allPassed) solution.completedAt = null;
  if (allPassed && !Number(solution.xpAwarded)) {
    earnedNow = xpReward(currentProblem);
    solution.xpAwarded = earnedNow;
  }
  solution.lastResults = results;
  renderTestResults(results);
  solutions.set(solution.id, clone(solution));
  saveSolutionNow();
  renderProgress();
  renderHint();
  renderProblemList();
  showOutput(allPassed ? `All ${results.length} tests passed.` : `${passed} of ${results.length} tests passed.`, !allPassed);
  if (allPassed && (!wasCompleted || earnedNow > 0)) celebrateCompletion(earnedNow);
}

function renderTestResults(results) {
  if (!results || results.length === 0) {
    elements.testSummary.className = "test-summary";
    elements.testSummary.textContent = "Not run";
    elements.testResults.innerHTML = '<p class="empty-state">Run the tests when your solution is ready.</p>';
    return;
  }
  const passed = results.filter((result) => result.passed).length;
  const allPassed = passed === results.length;
  elements.testSummary.className = `test-summary ${allPassed ? "passed" : "failed"}`;
  elements.testSummary.textContent = `${passed} / ${results.length} passed`;
  elements.testResults.replaceChildren(...results.map((result) => {
    const card = document.createElement("article");
    card.className = `test-result${result.passed ? "" : " failed"}`;
    const heading = document.createElement("div");
    heading.className = "test-result-heading";
    const icon = document.createElement("span");
    icon.className = "test-result-icon";
    icon.textContent = result.passed ? "✓" : "×";
    const name = document.createElement("span");
    name.textContent = result.name;
    heading.append(icon, name);
    card.append(heading);
    if (result.message) {
      const message = document.createElement("pre");
      message.className = "test-message";
      message.textContent = result.message;
      card.append(message);
    }
    if (result.output) {
      const output = document.createElement("pre");
      output.className = "test-output";
      output.textContent = result.output;
      card.append(output);
    }
    return card;
  }));
}

function renderProgress() {
  const completed = problems.filter((problem) => solutions.get(problem.id)?.completed).length;
  elements.progressCount.textContent = `${completed} / ${problems.length}`;
  elements.progressBar.style.width = `${problems.length ? (completed / problems.length) * 100 : 0}%`;
  elements.xpCount.textContent = `${xpBalance()} XP`;
  elements.streakCount.textContent = String(computeStreak());
}

function xpReward(problem) {
  return XP_REWARDS[problem?.difficulty] || XP_REWARDS.Beginner;
}

function hintCost(problem) {
  return xpReward(problem) / 4;
}

function awardedXp(problem, savedSolution) {
  const stored = Number(savedSolution?.xpAwarded) || 0;
  if (stored > 0) return stored;
  return savedSolution?.completed ? xpReward(problem) : 0;
}

function xpBalance() {
  let earned = 0;
  let spent = 0;
  for (const problem of problems) {
    const saved = solutions.get(problem.id);
    earned += awardedXp(problem, saved);
    if (saved?.hintUnlocked) spent += Number(saved.hintCostPaid) || hintCost(problem);
  }
  return Math.max(0, earned - spent);
}

function renderHint() {
  if (!currentProblem || !solution) return;
  const cost = hintCost(currentProblem);
  const unlocked = Boolean(solution.hintUnlocked);
  elements.problemHint.hidden = !unlocked;
  elements.problemHint.textContent = unlocked ? createProblemHint(currentProblem) : "";
  if (unlocked) {
    elements.unlockHint.textContent = "Unlocked";
    elements.unlockHint.disabled = true;
    elements.unlockHint.title = "This hint is permanently unlocked.";
    return;
  }
  const affordable = xpBalance() >= cost;
  elements.unlockHint.textContent = `Unlock for ${cost} XP`;
  elements.unlockHint.disabled = !affordable;
  elements.unlockHint.title = affordable ? "Spend XP to reveal this hint." : `You need ${cost} XP to unlock this hint.`;
}

async function unlockCurrentHint() {
  if (!currentProblem || !solution || solution.hintUnlocked) return;
  const cost = hintCost(currentProblem);
  if (xpBalance() < cost) return;
  if (!window.confirm(`Spend ${cost} XP to unlock this hint?`)) return;
  solution.hintUnlocked = true;
  solution.hintCostPaid = cost;
  solutions.set(solution.id, clone(solution));
  await saveSolutionNow();
  renderHint();
  renderProgress();
}

function createProblemHint(problem) {
  const concepts = problem.concepts.slice(0, 3).join(", ");
  const firstTest = problem.tests[0]?.name || "the simplest example";
  const lastTest = problem.tests.at(-1)?.name || "the boundary case";
  const strategies = {
    Basics: "Write down the formula and units before translating each operation into Python.",
    Conditionals: "List the cases from most specific to most general, then check each boundary once.",
    Loops: "Identify the state that changes each iteration: usually an accumulator, counter, or previous value.",
    Functions: "Implement the return contract first, then separate validation from the main calculation.",
    Lists: "Trace how one small input list changes and decide whether the original list may be modified.",
    Dictionaries: "Choose what belongs in each key and value before writing the traversal logic.",
    "Files & Exceptions": "Separate reading and writing from the transformation so each part can be checked independently.",
    Recursion: "Define the smallest base case first, then make the recursive call solve a strictly smaller input.",
  };
  return `${strategies[problem.category] || strategies.Functions} Focus on ${concepts || "the function contract"}. Make “${firstTest}” work first, then check “${lastTest}” without hard-coding either result.`;
}

function computeStreak() {
  const completedDays = new Set([...solutions.values()]
    .filter((item) => item.completed && item.completedAt)
    .map((item) => localDateKey(new Date(item.completedAt))));
  if (completedDays.size === 0) return 0;

  const cursor = new Date();
  if (!completedDays.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (completedDays.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function celebrateCompletion(earnedNow = 0) {
  const completed = problems.filter((problem) => solutions.get(problem.id)?.completed).length;
  const milestones = {
    1: ["First Steps", "First exercise complete."],
    5: ["Momentum", "Five exercises complete. Keep the streak alive!"],
    10: ["On a Roll", "Ten exercises complete. Your Python fundamentals are growing."],
    25: ["Problem Solver", "Twenty-five exercises complete."],
    50: ["Python Pathfinder", "Fifty exercises complete."],
    100: ["Century Club", "One hundred exercises complete."],
  };
  const [title, milestoneMessage] = milestones[completed] || ["Exercise complete", `${completed} solved so far.`];
  const message = `${earnedNow ? `You earned ${earnedNow} XP. ` : ""}${milestoneMessage}`;
  elements.achievementTitle.textContent = title;
  elements.achievementMessage.textContent = message;
  elements.achievementToast.hidden = false;
  window.clearTimeout(achievementTimer);
  achievementTimer = window.setTimeout(() => { elements.achievementToast.hidden = true; }, 3600);
  playMatrixRain();
}

function playMatrixRain({ force = false } = {}) {
  if (!force && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const canvas = elements.matrixRain;
  const context = canvas.getContext("2d");
  if (!context) return;

  window.cancelAnimationFrame(matrixAnimationId);
  window.clearTimeout(matrixStopTimer);
  window.clearTimeout(matrixHideTimer);

  canvas.hidden = false;
  canvas.classList.remove("is-fading");

  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const bounds = canvas.getBoundingClientRect();
  const width = bounds.width;
  const height = bounds.height;
  canvas.width = Math.floor(width * pixelRatio);
  canvas.height = Math.floor(height * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  const fontSize = width < 700 ? 13 : 16;
  const columns = Math.ceil(width / fontSize);
  const drops = Array.from({ length: columns }, () => -Math.random() * (height / fontSize));
  const glyphs = "01PYTHON{}[]()<>:=+-*/#λ";
  const startedAt = performance.now();
  const duration = force ? 6000 : 2800;
  let previousFrame = 0;

  context.fillStyle = "rgba(5, 12, 9, .94)";
  context.fillRect(0, 0, width, height);
  context.font = `700 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  context.textBaseline = "top";

  function draw(timestamp) {
    if (timestamp - previousFrame < 42) {
      matrixAnimationId = window.requestAnimationFrame(draw);
      return;
    }
    previousFrame = timestamp;
    context.fillStyle = "rgba(5, 12, 9, .14)";
    context.fillRect(0, 0, width, height);

    for (let column = 0; column < columns; column += 1) {
      const glyph = glyphs[Math.floor(Math.random() * glyphs.length)];
      const x = column * fontSize;
      const y = drops[column] * fontSize;
      context.shadowBlur = 0;
      context.fillStyle = "#45b982";
      context.fillText(glyph, x, y);
      drops[column] += .7 + Math.random() * .75;
      if (y > height && Math.random() > .965) drops[column] = -Math.random() * 18;
    }

    if (timestamp - startedAt < duration) matrixAnimationId = window.requestAnimationFrame(draw);
  }

  matrixAnimationId = window.requestAnimationFrame(draw);
  matrixStopTimer = window.setTimeout(() => canvas.classList.add("is-fading"), duration - 520);
  matrixHideTimer = window.setTimeout(() => {
    window.cancelAnimationFrame(matrixAnimationId);
    matrixAnimationId = null;
    canvas.hidden = true;
    canvas.classList.remove("is-fading");
  }, duration);
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
  placeholder.textContent = "Run code to see its output.";
  elements.output.append(placeholder);
}

function updateFileSize() {
  const bytes = new TextEncoder().encode(activeFile()?.content || "").byteLength;
  elements.fileSize.textContent = bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

function scheduleSave() {
  if (!solution || !database) return;
  elements.saveStatus.textContent = "Saving…";
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveSolutionNow, 350);
}

async function saveSolutionNow() {
  if (!solution || !database) return;
  window.clearTimeout(saveTimer);
  saveTimer = null;
  solution.updatedAt = new Date().toISOString();
  solutions.set(solution.id, clone(solution));
  try {
    await putSolution(solution);
    elements.saveStatus.textContent = "Saved on this device";
  } catch {
    elements.saveStatus.textContent = "Could not save locally";
  }
}

function prepareBackupDownload(event) {
  if (!database) {
    event.preventDefault();
    return;
  }
  if (solution) {
    solution.updatedAt = new Date().toISOString();
    solutions.set(solution.id, clone(solution));
    void putSolution(solution);
  }
  const backup = {
    format: "pylab-workbook-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    solutions: [...solutions.values()].map(clone),
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  if (backupUrl) URL.revokeObjectURL(backupUrl);
  backupUrl = URL.createObjectURL(blob);
  elements.exportWork.href = backupUrl;
  elements.exportWork.download = `pylab-workbook-${new Date().toISOString().slice(0, 10)}.json`;
}

async function importBackup(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file || !database) return;
  try {
    const backup = JSON.parse(await file.text());
    if (backup.format !== "pylab-workbook-backup" || !Array.isArray(backup.solutions)) throw new Error("This is not a PyLab Workbook backup.");
    const knownIds = new Set(problems.map((problem) => problem.id));
    const valid = backup.solutions.filter((item) => item && knownIds.has(item.id) && Array.isArray(item.files));
    if (!valid.length) throw new Error("The backup contains no solutions for this workbook.");
    if (!window.confirm(`Import ${valid.length} saved solution${valid.length === 1 ? "" : "s"}? Existing versions will be replaced.`)) return;
    for (const item of valid) await putSolution(item);
    solutions = new Map((await getAllSolutions()).map((item) => [item.id, item]));
    const activeId = currentProblem.id;
    currentProblem = null;
    solution = null;
    renderProgress();
    renderProblemList();
    await selectProblem(activeId);
    elements.saveStatus.textContent = "Backup imported";
  } catch (error) {
    window.alert(error instanceof Error ? error.message : String(error));
  }
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SOLUTION_STORE)) db.createObjectStore(SOLUTION_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAllSolutions() {
  return databaseRequest("readonly", (store) => store.getAll());
}

function putSolution(item) {
  return databaseRequest("readwrite", (store) => store.put(clone(item)));
}

function databaseRequest(mode, operation) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(SOLUTION_STORE, mode);
    const request = operation(transaction.objectStore(SOLUTION_STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
