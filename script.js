// ---------- Elements ----------
const displayEl = document.querySelector(".display");
const exprEl = document.getElementById("expression");
const previewEl = document.getElementById("preview");
const historyEl = document.getElementById("history");
const historyList = document.getElementById("historyList");

// ---------- State ----------
let expr = "";            // internal expression, e.g. "12+3*-4"
let justEvaluated = false; // true right after pressing "="
let history = [];

const OPS = "+-*/";
const isOp = (c) => OPS.includes(c);

// ---------- Safe evaluator (no eval) ----------
function tokenize(str) {
  const tokens = [];
  let i = 0;
  while (i < str.length) {
    const c = str[i];
    const prev = tokens[tokens.length - 1];
    const unary = c === "-" && (prev === undefined || isOp(prev));
    if (/[\d.]/.test(c) || unary) {
      let num = unary ? "-" : "";
      if (unary) i++;
      while (i < str.length && /[\d.]/.test(str[i])) num += str[i++];
      if (num === "-" || num === "" || num === ".") throw new Error("Bad number");
      tokens.push(parseFloat(num));
    } else if (isOp(c)) {
      tokens.push(c);
      i++;
    } else {
      throw new Error("Bad char");
    }
  }
  return tokens;
}

function evaluate(str) {
  const tokens = tokenize(str);
  const prec = { "+": 1, "-": 1, "*": 2, "/": 2 };
  const nums = [];
  const ops = [];

  const apply = () => {
    const b = nums.pop(), a = nums.pop(), op = ops.pop();
    if (op === "/" && b === 0) throw new Error("Divide by zero");
    nums.push(op === "+" ? a + b : op === "-" ? a - b : op === "*" ? a * b : a / b);
  };

  for (const t of tokens) {
    if (typeof t === "number") nums.push(t);
    else {
      while (ops.length && prec[ops[ops.length - 1]] >= prec[t]) apply();
      ops.push(t);
    }
  }
  while (ops.length) apply();
  if (nums.length !== 1 || !isFinite(nums[0])) throw new Error("Invalid");
  return parseFloat(nums[0].toPrecision(12)); // tame floating-point noise
}

// ---------- Display ----------
const pretty = (s) =>
  s.replace(/\*/g, "×").replace(/\//g, "÷").replace(/-/g, "−");

function render() {
  const text = expr === "" ? "0" : pretty(expr);
  exprEl.textContent = text;
  exprEl.classList.toggle("small", text.length > 10 && text.length <= 16);
  exprEl.classList.toggle("tiny", text.length > 16);

  // Live preview of the result while typing
  previewEl.textContent = "";
  const trimmed = expr.replace(/[+\-*/.]+$/, "");
  if (!justEvaluated && /[+\-*/]/.test(trimmed.slice(1))) {
    try { previewEl.textContent = "= " + pretty(String(evaluate(trimmed))); } catch {}
  }

  // Highlight the pending operator key
  const last = expr.slice(-1);
  document.querySelectorAll(".key.op").forEach((k) =>
    k.classList.toggle("active", isOp(last) && k.dataset.op === last)
  );
}

function flash(cls) {
  displayEl.classList.remove("result", "error");
  void displayEl.offsetWidth; // restart animation
  displayEl.classList.add(cls);
}

// ---------- Actions ----------
function inputDigit(d) {
  if (justEvaluated) { expr = ""; justEvaluated = false; }
  const lastNum = expr.match(/[\d.]*$/)[0];
  if (lastNum === "0") expr = expr.slice(0, -1); // avoid leading zeros
  expr += d;
}

function inputDot() {
  if (justEvaluated) { expr = ""; justEvaluated = false; }
  const lastNum = expr.match(/[\d.]*$/)[0];
  if (lastNum.includes(".")) return;
  expr += lastNum === "" ? "0." : ".";
}

function inputOp(op) {
  justEvaluated = false;
  if (expr === "" || expr === "-") {
    expr = op === "-" ? "-" : expr; // allow a leading negative sign
    return;
  }
  const last = expr.slice(-1);
  if (op === "-" && (last === "*" || last === "/")) {
    expr += op; // e.g. 5 × −3
    return;
  }
  expr = expr.replace(/[+\-*/]+$/, "") + op;
}

function toggleSign() {
  justEvaluated = false;
  const m = expr.match(/[\d.]+$/);
  if (!m) return;
  let before = expr.slice(0, expr.length - m[0].length);
  const prev = before.slice(-1);
  const prevPrev = before.slice(-2, -1);

  if (prev === "-" && (before.length === 1 || isOp(prevPrev))) before = before.slice(0, -1);
  else if (prev === "-") before = before.slice(0, -1) + "+";
  else if (prev === "+") before = before.slice(0, -1) + "-";
  else before += "-";

  expr = before + m[0];
}

function percent() {
  justEvaluated = false;
  const m = expr.match(/[\d.]+$/);
  if (!m) return;
  const value = parseFloat((parseFloat(m[0]) / 100).toPrecision(12));
  expr = expr.slice(0, expr.length - m[0].length) + value;
}

function backspace() {
  if (justEvaluated) { expr = ""; justEvaluated = false; return; }
  expr = expr.slice(0, -1);
}

function clearAll() {
  expr = "";
  justEvaluated = false;
}

function equals() {
  const trimmed = expr.replace(/[+\-*/.]+$/, "");
  if (!trimmed) return;
  try {
    const result = evaluate(trimmed);
    if (trimmed !== String(result)) addHistory(trimmed, result);
    expr = String(result);
    justEvaluated = true;
    flash("result");
  } catch {
    flash("error");
    previewEl.textContent = "Can't calculate that";
    return "error";
  }
}

// ---------- History ----------
function addHistory(e, r) {
  history.unshift({ e, r });
  history = history.slice(0, 20);
  renderHistory();
}

function renderHistory() {
  historyList.innerHTML = "";
  if (!history.length) {
    historyList.innerHTML = '<li class="empty">No calculations yet</li>';
    return;
  }
  history.forEach(({ e, r }) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${pretty(e)} =</span> ${pretty(String(r))}`;
    li.addEventListener("click", () => {
      expr = String(r);
      justEvaluated = true;
      render();
    });
    historyList.appendChild(li);
  });
}

// ---------- Dispatcher ----------
function handle({ num, op, action }) {
  displayEl.classList.remove("error");
  if (num !== undefined) inputDigit(num);
  else if (op) inputOp(op);
  else if (action === "dot") inputDot();
  else if (action === "clear") clearAll();
  else if (action === "sign") toggleSign();
  else if (action === "percent") percent();
  else if (action === "back") backspace();
  else if (action === "equals" && equals() === "error") return;
  render();
}

// Mouse / touch
document.querySelector(".keys").addEventListener("click", (e) => {
  const key = e.target.closest(".key");
  if (!key) return;
  ripple(key, e);
  handle(key.dataset);
});

function ripple(key, e) {
  const r = document.createElement("span");
  const rect = key.getBoundingClientRect();
  const size = rect.width;
  r.className = "ripple";
  r.style.width = r.style.height = size + "px";
  r.style.left = (e.clientX ? e.clientX - rect.left : rect.width / 2) - size / 2 + "px";
  r.style.top = (e.clientY ? e.clientY - rect.top : rect.height / 2) - size / 2 + "px";
  key.appendChild(r);
  r.addEventListener("animationend", () => r.remove());
}

// Keyboard
const keyMap = {
  Enter: { action: "equals" }, "=": { action: "equals" },
  Backspace: { action: "back" }, Escape: { action: "clear" }, Delete: { action: "clear" },
  ".": { action: "dot" }, ",": { action: "dot" }, "%": { action: "percent" },
  "+": { op: "+" }, "-": { op: "-" }, "*": { op: "*" }, x: { op: "*" }, "/": { op: "/" },
};

document.addEventListener("keydown", (e) => {
  let data = /^\d$/.test(e.key) ? { num: e.key } : keyMap[e.key];
  if (!data) return;
  e.preventDefault();
  handle(data);

  // Visually press the matching on-screen key
  const sel = data.num ? `[data-num="${data.num}"]`
            : data.op ? `[data-op="${data.op}"]`
            : `[data-action="${data.action}"]`;
  const btn = document.querySelector(`.key${sel}`);
  if (btn) {
    btn.classList.add("pressed");
    setTimeout(() => btn.classList.remove("pressed"), 120);
  }
});

// ---------- Theme & history toggles ----------
const root = document.documentElement;
const savedTheme = (() => { try { return localStorage.getItem("calc-theme"); } catch { return null; } })();
if (savedTheme) root.dataset.theme = savedTheme;
else if (matchMedia("(prefers-color-scheme: dark)").matches) root.dataset.theme = "dark";

document.getElementById("themeToggle").addEventListener("click", () => {
  root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
  try { localStorage.setItem("calc-theme", root.dataset.theme); } catch {}
});

document.getElementById("historyToggle").addEventListener("click", () => {
  historyEl.hidden = !historyEl.hidden;
});

document.getElementById("clearHistory").addEventListener("click", () => {
  history = [];
  renderHistory();
});

renderHistory();
render();
