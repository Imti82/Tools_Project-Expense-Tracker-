// ---------- Data ----------
const CATS = {
  expense: ["Food", "Transport", "Shopping", "Bills", "Health", "Entertainment", "Other"],
  income: ["Salary", "Freelance", "Gift", "Other"],
};
const COLORS = {
  Food: "#f97316", Transport: "#3b82f6", Shopping: "#ec4899", Bills: "#eab308",
  Health: "#10b981", Entertainment: "#8b5cf6", Other: "#64748b",
};
const ICONS = {
  Food: "🍔", Transport: "🚌", Shopping: "🛍️", Bills: "💡", Health: "💊",
  Entertainment: "🎬", Salary: "💼", Freelance: "💻", Gift: "🎁", Other: "📦",
};

const $ = (id) => document.getElementById(id);
const load = (key, fallback) => {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; }
  catch { return fallback; }
};
const store = (key, val) => localStorage.setItem(key, JSON.stringify(val));
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let transactions = load("tx", []);
let budget = load("budget", 0);
let currency = load("currency", "$");
let editId = null;

const money = (n) => currency + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);

// ---------- UI helpers ----------
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2000);
}

function fillCategories(select, list, withAll) {
  select.innerHTML = (withAll ? '<option value="all">All categories</option>' : "") +
    list.map((c) => `<option>${c}</option>`).join("");
}

function applyTheme(dark) {
  document.documentElement.classList.toggle("dark", dark);
  $("theme").textContent = dark ? "☀️" : "🌙";
  store("dark", dark);
}

// ---------- Filtering ----------
function getFiltered() {
  const q = $("search").value.trim().toLowerCase();
  const type = $("fType").value, cat = $("fCategory").value, month = $("month").value;
  const list = transactions.filter((t) =>
    (!q || t.title.toLowerCase().includes(q)) &&
    (type === "all" || t.type === type) &&
    (cat === "all" || t.category === cat) &&
    (!month || t.date.startsWith(month)));

  const sorts = {
    new: (a, b) => b.date.localeCompare(a.date) || b.id - a.id,
    old: (a, b) => a.date.localeCompare(b.date) || a.id - b.id,
    high: (a, b) => b.amount - a.amount,
    low: (a, b) => a.amount - b.amount,
  };
  return list.sort(sorts[$("sort").value]);
}

// ---------- Render ----------
function renderList(shown) {
  $("list").innerHTML = shown.map((t) => `
    <li class="item ${t.type} flex items-center justify-between rounded-lg p-3 bg-white/60 dark:bg-slate-700/50">
      <div class="flex items-center gap-3 min-w-0">
        <span class="text-2xl">${ICONS[t.category] || "📦"}</span>
        <div class="min-w-0">
          <p class="font-medium truncate">${esc(t.title)}</p>
          <p class="text-xs opacity-60">${t.category} • ${t.date}</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <span class="font-semibold ${t.type === "income" ? "text-green-500" : "text-red-500"}">
          ${t.type === "income" ? "+" : "-"}${money(t.amount)}</span>
        <button data-edit="${t.id}" title="Edit" class="opacity-60 hover:opacity-100">✏️</button>
        <button data-del="${t.id}" title="Delete" class="opacity-60 hover:opacity-100">🗑️</button>
      </div>
    </li>`).join("");
  $("empty").classList.toggle("hidden", shown.length > 0);
  $("count").textContent = `(${shown.length})`;
}

function renderSummary() {
  const sum = (type) => transactions.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);
  const inc = sum("income"), exp = sum("expense"), bal = inc - exp;
  $("income").textContent = money(inc);
  $("expense").textContent = money(exp);
  $("balance").textContent = money(bal);
  $("balance").className = "text-2xl font-bold " + (bal < 0 ? "text-red-500" : "");
}

function renderBudget() {
  const month = today().slice(0, 7);
  const spent = transactions.filter((t) => t.type === "expense" && t.date.startsWith(month))
    .reduce((s, t) => s + t.amount, 0);
  const bar = $("budgetBar");
  if (!budget) {
    bar.style.width = "0%";
    $("budgetText").textContent = "No budget set";
    return;
  }
  const pct = (spent / budget) * 100;
  bar.style.width = Math.min(pct, 100) + "%";
  bar.style.background = pct >= 100 ? "#ef4444" : pct >= 70 ? "#f59e0b" : "#22c55e";
  $("budgetText").textContent = pct >= 100
    ? `⚠️ Over budget! ${money(spent)} of ${money(budget)}`
    : `${money(spent)} of ${money(budget)} (${pct.toFixed(0)}%) this month`;
}

function renderChart(shown) {
  const totals = {};
  shown.filter((t) => t.type === "expense").forEach((t) => (totals[t.category] = (totals[t.category] || 0) + t.amount));
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0);

  if (!total) {
    $("donut").style.background = "#cbd5e1";
    $("donutTotal").textContent = "No data";
    $("legend").innerHTML = '<li class="opacity-60">No expenses yet</li>';
    return;
  }
  let acc = 0;
  const stops = entries.map(([c, v]) => {
    const start = acc; acc += (v / total) * 100;
    return `${COLORS[c]} ${start}% ${acc}%`;
  });
  $("donut").style.background = `conic-gradient(${stops.join(",")})`;
  $("donutTotal").textContent = money(total);
  $("legend").innerHTML = entries.map(([c, v]) =>
    `<li class="flex items-center gap-2"><span class="w-3 h-3 rounded-full" style="background:${COLORS[c]}"></span>${c} <span class="opacity-60">${((v / total) * 100).toFixed(0)}%</span></li>`).join("");
}

function render() {
  const shown = getFiltered();
  renderList(shown);
  renderSummary();
  renderBudget();
  renderChart(shown);
}

function save() { store("tx", transactions); render(); }

// ---------- Form (add / edit) ----------
function resetForm() {
  editId = null;
  $("form").reset();
  $("date").value = today();
  fillCategories($("category"), CATS[$("type").value]);
  $("formTitle").textContent = "Add Transaction";
  $("submitBtn").textContent = "Add Transaction";
  $("cancelEdit").classList.add("hidden");
  $("error").classList.add("hidden");
}

function showError(msg) {
  $("error").textContent = msg;
  $("error").classList.remove("hidden");
}

$("type").addEventListener("change", () => fillCategories($("category"), CATS[$("type").value]));

$("form").addEventListener("submit", (e) => {
  e.preventDefault();
  const title = $("title").value.trim();
  const amount = parseFloat($("amount").value);
  const date = $("date").value;
  if (!title) return showError("Please enter a title.");
  if (isNaN(amount) || amount <= 0) return showError("Amount must be greater than 0.");
  if (!date) return showError("Please choose a date.");

  const data = { title, amount, date, type: $("type").value, category: $("category").value };
  if (editId) {
    transactions = transactions.map((t) => (t.id === editId ? { ...t, ...data } : t));
    toast("Transaction updated ✏️");
  } else {
    transactions.push({ id: Date.now(), ...data });
    toast("Transaction added ✅");
  }
  save();
  resetForm();
});

$("cancelEdit").addEventListener("click", resetForm);

// ---------- List actions (edit / delete) ----------
$("list").addEventListener("click", (e) => {
  const del = e.target.closest("[data-del]"), edit = e.target.closest("[data-edit]");
  if (del) {
    transactions = transactions.filter((t) => t.id !== Number(del.dataset.del));
    save();
    toast("Transaction deleted 🗑️");
  } else if (edit) {
    const t = transactions.find((x) => x.id === Number(edit.dataset.edit));
    if (!t) return;
    editId = t.id;
    $("title").value = t.title;
    $("amount").value = t.amount;
    $("type").value = t.type;
    fillCategories($("category"), CATS[t.type]);
    $("category").value = t.category;
    $("date").value = t.date;
    $("formTitle").textContent = "Edit Transaction";
    $("submitBtn").textContent = "Update Transaction";
    $("cancelEdit").classList.remove("hidden");
    $("form").scrollIntoView({ behavior: "smooth" });
  }
});

// ---------- Toolbar ----------
["search", "fType", "fCategory", "month", "sort"].forEach((id) => {
  $(id).addEventListener("input", render);
  $(id).addEventListener("change", render);
});

$("clear").addEventListener("click", () => {
  if (transactions.length && confirm("Delete ALL transactions?")) {
    transactions = [];
    save();
    toast("All data cleared");
  }
});

$("sample").addEventListener("click", () => {
  const d = (n) => { const x = new Date(); x.setDate(x.getDate() - n); return x.toISOString().slice(0, 10); };
  const rows = [
    ["Monthly Salary", 1500, "income", "Salary", 10], ["Freelance Project", 300, "income", "Freelance", 6],
    ["Groceries", 85.5, "expense", "Food", 5], ["Bus Pass", 30, "expense", "Transport", 4],
    ["Electricity Bill", 60, "expense", "Bills", 3], ["Movie Night", 25, "expense", "Entertainment", 2],
    ["New Shoes", 70, "expense", "Shopping", 1], ["Pharmacy", 18, "expense", "Health", 0],
  ];
  rows.forEach(([title, amount, type, category, ago], i) =>
    transactions.push({ id: Date.now() + i, title, amount, type, category, date: d(ago) }));
  save();
  toast("Sample data loaded");
});

$("budgetInput").addEventListener("input", () => {
  budget = Math.max(0, parseFloat($("budgetInput").value) || 0);
  store("budget", budget);
  renderBudget();
});

$("currency").addEventListener("change", () => {
  currency = $("currency").value;
  store("currency", currency);
  render();
});

$("theme").addEventListener("click", () => applyTheme(!document.documentElement.classList.contains("dark")));

$("export").addEventListener("click", () => {
  if (!transactions.length) return toast("Nothing to export");
  const rows = [["Date", "Title", "Type", "Category", "Amount"],
    ...transactions.map((t) => [t.date, `"${t.title.replace(/"/g, '""')}"`, t.type, t.category, t.amount])];
  const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "expenses.csv";
  a.click();
  URL.revokeObjectURL(a.href);
  toast("CSV downloaded ⬇");
});

// ---------- Start ----------
fillCategories($("fCategory"), [...new Set([...CATS.expense, ...CATS.income])], true);
$("currency").value = currency;
$("budgetInput").value = budget || "";
applyTheme(load("dark", window.matchMedia("(prefers-color-scheme: dark)").matches));
resetForm();
render();
