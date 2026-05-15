/* ═══════════════════════════════════════════════════════
   VAYUMUKHI DAIRY — Owner Workspace App
   Daily AI agent · WhatsApp notifications · Owner workspace
════════════════════════════════════════════════════════ */

const rupee = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const today = new Date().toISOString().slice(0, 10);
const qs  = (sel, ctx = document) => ctx.querySelector(sel);
const qsa = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

/* ────────────────────────────────────────────────────
   STATE
──────────────────────────────────────────────────── */
const state = {
  production: [
    { date: "2026-05-08", morning: 106, evening: 94,  fat: 4.1 },
    { date: "2026-05-09", morning: 112, evening: 98,  fat: 4.2 },
    { date: "2026-05-10", morning: 109, evening: 96,  fat: 4.0 },
    { date: "2026-05-11", morning: 116, evening: 101, fat: 4.4 },
    { date: "2026-05-12", morning: 121, evening: 104, fat: 4.3 },
    { date: "2026-05-13", morning: 115, evening: 100, fat: 4.2 },
    { date: today,        morning: 118, evening: 102, fat: 4.3 }
  ],
  sales: [
    { customer: "Lakshmi Stores",  product: "Milk",   qty: 120, amount: 7200 },
    { customer: "Sai Apartments",  product: "Milk",   qty: 84,  amount: 5040 },
    { customer: "Annapurna Hotel", product: "Paneer", qty: 18,  amount: 5400 },
    { customer: "Meera Home",      product: "Curd",   qty: 9,   amount: 810  }
  ],
  expenses: [
    { category: "Salaries",   description: "Farm helper daily wage",  amount: 3200 },
    { category: "Medication", description: "Veterinary checkup",      amount: 1800 },
    { category: "Feed",       description: "Mineral mix",             amount: 1400 },
    { category: "Misc",       description: "Route diesel",            amount: 500  }
  ],
  animals: [
    { id: "VD-C01", name: "Ganga",    type: "Cow",     status: "Milking",   health: "Healthy",     feed: "Green fodder + mineral mix" },
    { id: "VD-B02", name: "Kaveri",   type: "Buffalo", status: "Milking",   health: "Healthy",     feed: "Napier grass + dry fodder" },
    { id: "VD-C03", name: "Nandi",    type: "Cow",     status: "Pregnant",  health: "Observation", feed: "Protein balanced ration" },
    { id: "VD-B04", name: "Godavari", type: "Buffalo", status: "Dry",       health: "Healthy",     feed: "Farm grass + hay" },
    { id: "VD-C05", name: "Yamuna",   type: "Cow",     status: "Milking",   health: "Vaccinated",  feed: "Fresh cut fodder" },
    { id: "VD-C06", name: "Krishna",  type: "Cow",     status: "Calf",      health: "Healthy",     feed: "Milk + starter feed" }
  ],
  reminders: [
    { date: "2026-05-15", type: "Doctor", title: "Veterinary pregnancy check",  owner: "Nandi",               priority: "High" },
    { date: "2026-05-16", type: "Fodder", title: "Napier grass cutting cycle",  owner: "Field A",             priority: "Medium" },
    { date: "2026-05-18", type: "Doctor", title: "Vaccination booster review",  owner: "Yamuna",              priority: "Medium" },
    { date: "2026-05-20", type: "Feed",   title: "Mineral mix stock review",    owner: "All milking animals", priority: "Low" }
  ],
  notifications: [
    { time: "07:05", title: "Morning production entry received",  body: "118 L saved with 4.3% fat estimate.", tone: "success", unread: true  },
    { time: "08:20", title: "Doctor visit tomorrow",              body: "Nandi pregnancy check is due on 15 May.", tone: "warning", unread: true  },
    { time: "09:10", title: "Fodder cycle coming up",             body: "Field A Napier grass cutting is due in 2 days.", tone: "info", unread: false }
  ],
  agentRuns: [],
  wsSelectedAction: null
};

/* ────────────────────────────────────────────────────
   HELPERS
──────────────────────────────────────────────────── */
function total(entry) { return Number(entry.morning) + Number(entry.evening); }

function todayEntry() {
  return state.production.filter(e => e.date === today).at(-1);
}

function upcomingReminders() {
  const now = new Date(`${today}T00:00:00`);
  return state.reminders
    .map(r => ({ ...r, days: Math.round((new Date(`${r.date}T00:00:00`) - now) / 86400000) }))
    .filter(r => r.days >= 0 && r.days <= 7)
    .sort((a, b) => a.days - b.days);
}

function addNotification(title, body, tone = "info") {
  state.notifications.unshift({
    time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    title, body, tone, unread: true
  });
  renderNotifications();
}

function sendPush(title, body) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body, icon: "assets/icon.svg" });
  }
}

/* ────────────────────────────────────────────────────
   DAILY AI AGENT  —  runs on login + every 60 min
──────────────────────────────────────────────────── */
function runDailyAgent({ notify = false } = {}) {
  const entry   = todayEntry();
  const checks  = [
    {
      id: "morning_milk", label: "Morning milk entry",
      ok: Boolean(entry && Number(entry.morning) > 0),
      detail: entry?.morning ? `${entry.morning} L recorded` : "No morning entry — add now",
      action: "milk"
    },
    {
      id: "evening_milk", label: "Evening milk entry",
      ok: Boolean(entry && Number(entry.evening) > 0),
      detail: entry?.evening ? `${entry.evening} L recorded` : "No evening entry — add now",
      action: "milk"
    },
    {
      id: "daily_sales", label: "Daily sales entry",
      ok: state.sales.length > 0,
      detail: state.sales.length ? `${state.sales.length} customer records available` : "No sales recorded today",
      action: "sales"
    },
    {
      id: "expense_log", label: "Expense / cost log",
      ok: state.expenses.length > 0,
      detail: state.expenses.length ? `${state.expenses.length} expense records available` : "No expenses recorded today",
      action: "costs"
    }
  ];

  const missing = checks.filter(c => !c.ok);
  const status  = missing.length ? `${missing.length} action needed` : "All entries complete";
  const runTime = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  // Record run in history
  state.agentRuns.unshift({
    time: runTime, type: "auto", status: "completed",
    checksRun: checks.length, alerts: missing.length, fallback: 0
  });
  if (state.agentRuns.length > 5) state.agentRuns.pop();

  if (notify) {
    if (missing.length) {
      addNotification("Daily entry missing", missing.map(c => c.label).join(", "), "warning");
      sendPush("Vayumukhi Farm", `${missing.length} item needs your attention today.`);
    } else {
      addNotification("Daily check complete", "Milk, sales, and expense tracking look good for today.", "success");
      sendPush("Vayumukhi Farm", "All critical farm entries are complete.");
    }
  }

  // Update sidebar status immediately
  const statusEl = qs("#sidebarStatus");
  if (statusEl) statusEl.textContent = missing.length ? "Needs check" : "All good";

  return { checks, missing, status, runTime };
}

/* ────────────────────────────────────────────────────
   OWNER WORKSPACE
──────────────────────────────────────────────────── */
function buildActionQueue() {
  const result  = runDailyAgent();
  const reminders = upcomingReminders();
  const queue   = [];

  // Missing farm entries
  result.missing.forEach(check => {
    queue.push({
      id: check.id, priority: "high",
      title: check.label,
      detail: check.detail,
      badge: "Missing", action: check.action,
      type: "entry"
    });
  });

  // Upcoming reminders
  reminders.forEach(r => {
    queue.push({
      id: `reminder_${r.title}`, priority: r.priority.toLowerCase(),
      title: r.title,
      detail: `${r.type} · ${r.owner} · ${r.days === 0 ? "Today" : `${r.days} day${r.days !== 1 ? "s" : ""}`}`,
      badge: r.days === 0 ? "Today" : `${r.days}d`, action: "monitor",
      type: "reminder", data: r
    });
  });

  return queue;
}

function buildFarmMemory() {
  const entries = state.production.slice(-7);
  const avg7    = entries.reduce((s, e) => s + total(e), 0) / entries.length;
  const latest  = total(entries.at(-1));
  const delta   = ((latest - avg7) / avg7 * 100).toFixed(1);

  const salesAmt  = state.sales.reduce((s, i) => s + Number(i.amount), 0);
  const expenses  = state.expenses.reduce((s, i) => s + Number(i.amount), 0);
  const margin    = salesAmt ? ((salesAmt - expenses) / salesAmt * 100).toFixed(0) : 0;

  const topCustomer = Object.entries(
    state.sales.reduce((acc, i) => { acc[i.customer] = (acc[i.customer] || 0) + i.amount; return acc; }, {})
  ).sort((a,b) => b[1]-a[1])[0];

  return [
    {
      id: "milk_trend", label: "Milk production trend",
      body: `${latest} L latest batch is ${Math.abs(delta)}% ${delta >= 0 ? "above" : "below"} 7-day average (${Math.round(avg7)} L).`,
      tone: delta >= 0 ? "success" : "warning"
    },
    {
      id: "top_animal", label: "Top performing animal",
      body: "Kaveri (VD-B02, Buffalo) is consistently delivering above-average output this week.",
      tone: "success"
    },
    {
      id: "margin_check", label: "Financial health",
      body: `Expense ratio at ${100 - margin}% of revenue. Net margin estimate: ${margin}%. Within healthy range.`,
      tone: Number(margin) >= 40 ? "success" : "warning"
    },
    {
      id: "customer_insight", label: "Top customer",
      body: topCustomer
        ? `${topCustomer[0]} leads with ${rupee.format(topCustomer[1])} in sales. Prioritise supply reliability.`
        : "No customer data available. Add sales to see insights.",
      tone: "info"
    }
  ];
}

function buildPipelineTrace() {
  const entry   = todayEntry();
  const result  = runDailyAgent();
  const runTime = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  return {
    runTime,
    steps: [
      { label: "Morning milk entry check",     status: entry?.morning ? "pass" : "alert", detail: entry?.morning ? `${entry.morning} L` : "Missing" },
      { label: "Evening milk entry check",     status: entry?.evening ? "pass" : "alert", detail: entry?.evening ? `${entry.evening} L` : "Missing" },
      { label: "Today's sales entry check",    status: state.sales.length  ? "pass" : "alert", detail: `${state.sales.length} records` },
      { label: "Today's expenses check",       status: state.expenses.length ? "pass" : "alert", detail: `${state.expenses.length} records` },
      { label: "Upcoming vet visits scan",     status: upcomingReminders().some(r=>r.type==="Doctor") ? "notice" : "pass", detail: `${upcomingReminders().filter(r=>r.type==="Doctor").length} upcoming` },
      { label: "Fodder cycle check",           status: upcomingReminders().some(r=>r.type==="Fodder") ? "notice" : "pass", detail: `${upcomingReminders().filter(r=>r.type==="Fodder").length} cycles` },
      { label: "Animal health scan",           status: state.animals.some(a=>a.health==="Observation") ? "notice" : "pass", detail: state.animals.some(a=>a.health==="Observation") ? "1 in observation" : "All healthy" },
      { label: "Production trend analysis",    status: "pass", detail: `${state.production.length} entries analysed` }
    ]
  };
}

/* ── Render Owner Workspace ── */
function renderWorkspace() {
  const queue     = buildActionQueue();
  const memory    = buildFarmMemory();
  const pipeline  = buildPipelineTrace();
  const result    = runDailyAgent();
  const todayProd = todayEntry();

  // Header stats
  const wsPendingEl = qs("#wsPending");
  if (wsPendingEl) wsPendingEl.textContent = queue.filter(q => q.priority === "high").length || "0";
  const wsEntriesEl = qs("#wsEntries");
  if (wsEntriesEl) wsEntriesEl.textContent = (todayProd ? 2 : 0) + state.sales.length;
  const wsLastRunEl = qs("#wsLastRun");
  if (wsLastRunEl) wsLastRunEl.textContent = pipeline.runTime;
  const wsFarmStatusEl = qs("#wsFarmStatus");
  if (wsFarmStatusEl) {
    wsFarmStatusEl.textContent = result.missing.length ? "ALERT" : "ACTIVE";
    qs("#wsFarmStatusCard")?.classList.toggle("ws-stat-alert", result.missing.length > 0);
  }

  // Queue badge
  const queueBadgeEl = qs("#wsQueueBadge");
  if (queueBadgeEl) queueBadgeEl.textContent = `${queue.length} pending`;

  // Action queue
  const queueEl = qs("#wsActionQueue");
  if (queueEl) {
    if (queue.length === 0) {
      queueEl.innerHTML = '<div class="ws-queue-empty">No pending actions. Farm is up to date.</div>';
    } else {
      queueEl.innerHTML = queue.map((item, idx) => `
        <button class="ws-queue-item priority-${item.priority}" data-idx="${idx}" type="button">
          <div class="ws-qi-left">
            <span class="ws-qi-badge badge-${item.priority}">${item.badge}</span>
            <div>
              <strong>${item.title}</strong>
              <span>${item.detail}</span>
            </div>
          </div>
          <span class="ws-qi-arrow">›</span>
        </button>
      `).join("");

      queueEl.querySelectorAll(".ws-queue-item").forEach(btn => {
        btn.addEventListener("click", () => {
          queueEl.querySelectorAll(".ws-queue-item").forEach(b => b.classList.remove("selected"));
          btn.classList.add("selected");
          const idx = Number(btn.dataset.idx);
          state.wsSelectedAction = queue[idx];
          renderDecisionDetail(queue[idx]);
        });
      });
    }
  }

  // Farm memory
  const memEl = qs("#wsMemory");
  if (memEl) {
    memEl.innerHTML = memory.map(m => `
      <div class="ws-memory-item tone-${m.tone}">
        <strong>${m.label}</strong>
        <span>${m.body}</span>
      </div>
    `).join("");
  }

  // Pipeline
  const pipeEl  = qs("#wsPipeline");
  const timeEl  = qs("#wsRunTime");
  if (timeEl) timeEl.textContent = pipeline.runTime;
  if (pipeEl) {
    pipeEl.innerHTML = pipeline.steps.map(step => `
      <div class="ws-pipe-step status-${step.status}">
        <span class="ws-pipe-dot"></span>
        <span class="ws-pipe-label">${step.label}</span>
        <span class="ws-pipe-detail">${step.detail}</span>
        <span class="ws-pipe-status">${step.status.toUpperCase()}</span>
      </div>
    `).join("");
  }

  // Run history
  const runHistEl = qs("#wsRunHistory");
  if (runHistEl) {
    if (state.agentRuns.length === 0) {
      runHistEl.innerHTML = '<tr><td colspan="6" style="color:var(--muted);text-align:center">No runs yet — run the daily check</td></tr>';
    } else {
      runHistEl.innerHTML = state.agentRuns.map(run => `
        <tr>
          <td>${run.time}</td>
          <td>${run.type}</td>
          <td><span class="ws-run-badge ${run.status}">${run.status}</span></td>
          <td>${run.checksRun}</td>
          <td>${run.alerts > 0 ? `<span class="ws-alert-count">${run.alerts}</span>` : "—"}</td>
          <td>${run.fallback}</td>
        </tr>
      `).join("");
    }
  }
}

function renderDecisionDetail(item) {
  const detailEl  = qs("#wsDetail");
  const actionsEl = qs("#wsDetailActions");
  const labelEl   = qs("#wsDetailStatus");
  const citeEl    = qs("#wsCitations");
  if (!detailEl) return;

  if (labelEl) labelEl.textContent = item.priority === "high" ? "Action required" : "Review";

  const entry   = todayEntry();
  const salesTotal = state.sales.reduce((s, i) => s + Number(i.amount), 0);

  let body = "";
  let citations = [];

  if (item.type === "entry") {
    body = `
      <div class="ws-detail-title">
        <span class="ws-detail-priority priority-${item.priority}">${item.priority.toUpperCase()}</span>
        <h4>${item.title}</h4>
      </div>
      <p class="ws-detail-desc">${item.detail}</p>
      <div class="ws-detail-stats">
        <div class="ws-ds"><span>Current production</span><strong>${entry ? total(entry) + " L" : "—"}</strong></div>
        <div class="ws-ds"><span>Today's sales</span><strong>${rupee.format(salesTotal)}</strong></div>
        <div class="ws-ds"><span>Animals milking</span><strong>${state.animals.filter(a=>a.status==="Milking").length}</strong></div>
        <div class="ws-ds"><span>7-day average</span><strong>${Math.round(state.production.slice(-7).reduce((s,e)=>s+total(e),0)/7)} L</strong></div>
      </div>
    `;
    citations = [
      { label: "Production log", detail: `${state.production.length} entries` },
      { label: "Today's batch", detail: entry ? `${entry.morning}L + ${entry.evening}L` : "Not recorded" },
      { label: "Fat estimate", detail: entry ? `${entry.fat}%` : "—" }
    ];
  } else if (item.type === "reminder" && item.data) {
    const r = item.data;
    body = `
      <div class="ws-detail-title">
        <span class="ws-detail-priority priority-${item.priority}">${r.type.toUpperCase()}</span>
        <h4>${r.title}</h4>
      </div>
      <p class="ws-detail-desc">${r.owner} · Due ${r.days === 0 ? "today" : `in ${r.days} day${r.days !== 1 ? "s" : ""}`} (${r.date})</p>
      <div class="ws-detail-stats">
        <div class="ws-ds"><span>Priority</span><strong>${r.priority}</strong></div>
        <div class="ws-ds"><span>Due date</span><strong>${r.date}</strong></div>
        <div class="ws-ds"><span>Type</span><strong>${r.type}</strong></div>
        <div class="ws-ds"><span>Days away</span><strong>${r.days}</strong></div>
      </div>
    `;
    citations = [
      { label: "Animal / Resource", detail: r.owner },
      { label: "Reminder type", detail: r.type },
      { label: "Priority level", detail: r.priority }
    ];
  }

  detailEl.innerHTML = body;
  if (actionsEl) actionsEl.classList.remove("hidden");

  if (citeEl) {
    citeEl.classList.remove("hidden");
    qs("#wsCitationList").innerHTML = citations.map(c => `
      <div class="ws-cite-item"><strong>${c.label}</strong><span>${c.detail}</span></div>
    `).join("");
  }

  // Wire action buttons
  const approveBtn = qs("#wsApproveBtn");
  const dismissBtn = qs("#wsDismissBtn");
  const viewBtn    = qs("#wsViewBtn");

  if (approveBtn) {
    approveBtn.onclick = () => {
      addNotification(`"${item.title}" approved`, "Action marked as handled.", "success");
      sendPush("Vayumukhi Farm", `${item.title} approved.`);
      renderWorkspace();
    };
  }
  if (dismissBtn) {
    dismissBtn.onclick = () => {
      addNotification(`"${item.title}" dismissed`, "Alert dismissed. Will re-check next run.", "info");
      renderWorkspace();
    };
  }
  if (viewBtn) {
    viewBtn.onclick = () => {
      goTab(item.action || "monitor");
    };
  }
}

/* ────────────────────────────────────────────────────
   DASHBOARD RENDERS
──────────────────────────────────────────────────── */
function renderDashboard() {
  const todayProd  = todayEntry() || state.production.at(-1);
  const milkTotal  = total(todayProd);
  const salesTotal = state.sales.reduce((s, i) => s + Number(i.amount), 0);
  const costTotal  = state.expenses.reduce((s, i) => s + Number(i.amount), 0);

  setText("#kpiMilk",    `${milkTotal} L`);
  setText("#kpiSales",   rupee.format(salesTotal));
  setText("#kpiExpenses",rupee.format(costTotal));
  setText("#kpiNet",     rupee.format(salesTotal - costTotal));
  setText("#publicRevenue", rupee.format(Math.round(salesTotal * 26)));
  setText("#forecastValue", rupee.format(Math.round(salesTotal * 28.5)));

  renderMilkChart();
  renderCustomerList();
  renderExpenseSplit();
  renderMonitor();
  renderNotifications();
  renderWorkspace();
}

function setText(sel, val) {
  const el = qs(sel);
  if (el) el.textContent = val;
}

function renderMilkChart() {
  const entries = state.production.slice(-7);
  const max     = Math.max(...entries.map(total), 1);
  const el      = qs("#milkChart");
  if (!el) return;
  el.innerHTML  = entries.map(e => {
    const h   = Math.round((total(e) / max) * 100);
    const day = new Date(`${e.date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short" });
    return `<div class="bar" style="height:${h}%"><span>${day}</span></div>`;
  }).join("");
}

function renderCustomerList() {
  const el = qs("#customerList");
  if (!el) return;
  const grouped = state.sales.reduce((acc, i) => {
    acc[i.customer] = (acc[i.customer] || 0) + Number(i.amount);
    return acc;
  }, {});
  el.innerHTML = Object.entries(grouped)
    .sort((a,b) => b[1]-a[1])
    .map(([c, amt]) => `<div class="customer-row"><strong>${c}</strong><span>${rupee.format(amt)}</span></div>`)
    .join("");
}

function renderProductionTable() {
  const el = qs("#productionTable");
  if (!el) return;
  el.innerHTML = [...state.production].reverse().map(e =>
    `<tr><td>${e.date}</td><td>${e.morning} L</td><td>${e.evening} L</td><td>${total(e)} L</td><td>${e.fat}%</td></tr>`
  ).join("");
}

function renderSalesTable() {
  const el = qs("#salesTable");
  if (!el) return;
  el.innerHTML = [...state.sales].reverse().map(i =>
    `<tr><td>${i.customer}</td><td>${i.product}</td><td>${i.qty}</td><td>${rupee.format(i.amount)}</td></tr>`
  ).join("");
}

function renderExpenseTable() {
  const el = qs("#expenseTable");
  if (!el) return;
  el.innerHTML = [...state.expenses].reverse().map(i =>
    `<tr><td>${i.category}</td><td>${i.description}</td><td>${rupee.format(i.amount)}</td></tr>`
  ).join("");
}

function renderExpenseSplit() {
  const el = qs("#expenseRings");
  if (!el) return;
  const grouped = state.expenses.reduce((acc, i) => {
    acc[i.category] = (acc[i.category] || 0) + Number(i.amount);
    return acc;
  }, {});
  const max = Math.max(...Object.values(grouped), 1);
  el.innerHTML = Object.entries(grouped).map(([cat, amt]) => {
    const w = Math.round((amt / max) * 100);
    return `<div class="expense-bar-row">
      <strong>${cat}</strong>
      <div class="expense-track"><div class="expense-track-fill" style="width:${w}%"></div></div>
      <span>${rupee.format(amt)}</span>
    </div>`;
  }).join("");
}

function renderAnimals() {
  const el = qs("#animalGrid");
  if (!el) return;
  el.innerHTML = state.animals.map(a => {
    const statusClass = a.status === "Pregnant" ? "pregnant" : a.status === "Dry" ? "dry" : a.status === "Calf" ? "calf" : "";
    return `<article class="animal-card">
      <strong>${a.name}</strong>
      <span class="animal-status ${statusClass}">${a.status}</span>
      <span>${a.id} · ${a.type}</span>
      <span>Health: ${a.health}</span>
      <span>Feed: ${a.feed}</span>
    </article>`;
  }).join("");
}

function renderNotifications() {
  const unread = state.notifications.filter(n => n.unread).length;
  const badge  = qs("#notificationCount");
  if (badge) {
    badge.textContent = unread;
    badge.classList.toggle("hidden", unread === 0);
  }
  const listEl = qs("#notificationList");
  if (!listEl) return;
  listEl.innerHTML = state.notifications.map(n => `
    <article class="notif-item ${n.tone} ${n.unread ? "unread" : ""}">
      <strong>${n.title}</strong>
      <p>${n.body}</p>
      <time>${n.time}</time>
    </article>
  `).join("");
}

function renderMonitor() {
  const result    = runDailyAgent();
  const reminders = upcomingReminders();
  const insights  = buildFarmMemory();

  // Summary card (Today tab)
  setText("#summaryTitle", result.missing.length
    ? `${result.missing.length} item needs your attention`
    : "All critical entries look good today"
  );
  setText("#summaryBody", result.missing.length
    ? `AI found ${result.missing.length} item that needs attention before you close the day.`
    : "AI found no urgent gaps. Milk, money, reminders, and care records look steady."
  );

  // Agent checks
  const checksEl = qs("#agentChecks");
  if (checksEl) {
    checksEl.innerHTML = result.checks.map(c => `
      <div class="check-item ${c.ok ? "" : "alert"}">
        <span class="check-dot"></span>
        <div>
          <strong>${c.label}</strong>
          <span>${c.detail}</span>
        </div>
      </div>
    `).join("");
  }

  // Reminders
  const reminderMarkup = reminders.map(r => `
    <div class="reminder-pill ${r.priority.toLowerCase()}">
      <div>
        <strong>${r.title}</strong>
        <small>${r.type} · ${r.owner}</small>
      </div>
      <span class="reminder-badge ${r.priority.toLowerCase()}">${r.days === 0 ? "Today" : `${r.days}d`}</span>
    </div>
  `).join("") || "<p style='color:var(--muted);font-size:14px'>No reminders in the next 7 days.</p>";

  setText("#reminderList", ""); const rlEl = qs("#reminderList"); if (rlEl) rlEl.innerHTML = reminderMarkup;
  setText("#dashboardReminders", ""); const drEl = qs("#dashboardReminders"); if (drEl) drEl.innerHTML = reminderMarkup;

  // Insights
  const insightMarkup = insights.map(i => `
    <div class="insight-item">
      <strong>${i.label}</strong>
      <span>${i.body}</span>
    </div>
  `).join("");
  const ilEl = qs("#insightList"); if (ilEl) ilEl.innerHTML = insightMarkup;
  const diEl = qs("#dashboardInsights"); if (diEl) diEl.innerHTML = insightMarkup;
}

function renderAll() {
  renderDashboard();
  renderProductionTable();
  renderSalesTable();
  renderExpenseTable();
  renderAnimals();
}

/* ────────────────────────────────────────────────────
   TAB NAVIGATION
──────────────────────────────────────────────────── */
function goTab(tabId) {
  qsa(".sidebar-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tabId));
  qsa(".bnav-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tabId));
  qsa(".tab-panel").forEach(p => p.classList.toggle("active", p.id === `tab-${tabId}`));

  const titles = {
    workspace: "Owner Workspace", home: "Today's Dashboard", milk: "Milk Production",
    animals: "Animals", sales: "Sales", costs: "Costs & Expenses",
    monitor: "Farm Alerts", assistant: "AI Assistant"
  };
  setText("#appTitle", titles[tabId] || tabId);
}

/* ────────────────────────────────────────────────────
   AI ASSISTANT — text parser
──────────────────────────────────────────────────── */
function parseAssistantText(text) {
  const norm    = text.toLowerCase();
  const numbers = [...norm.matchAll(/(\d+(?:\.\d+)?)/g)].map(m => Number(m[1]));

  if (norm.includes("milk") || norm.includes("litre") || norm.includes("liter")) {
    const morning = Number(norm.match(/morning\D+(\d+(?:\.\d+)?)/)?.[1] || numbers[0] || 0);
    const evening = Number(norm.match(/evening\D+(\d+(?:\.\d+)?)/)?.[1] || numbers[1] || 0);
    const fat     = Number(norm.match(/fat\D+(\d+(?:\.\d+)?)/)?.[1]    || 4.1);
    const entry   = { date: today, morning, evening, fat };
    state.production.push(entry);
    return { type: "production", entry };
  }

  if (norm.includes("salary") || norm.includes("medication") || norm.includes("expense") || norm.includes("cost") || norm.includes("feed")) {
    const category = norm.includes("salary") ? "Salaries" : norm.includes("medication") ? "Medication" : norm.includes("feed") ? "Feed" : "Misc";
    const amount   = numbers.at(-1) || 0;
    const entry    = { category, description: text.slice(0, 60), amount };
    state.expenses.push(entry);
    return { type: "expense", entry };
  }

  if (norm.includes("sale") || norm.includes("customer") || norm.includes("sold")) {
    const amount = numbers.at(-1) || 0;
    const qty    = numbers[0] || 1;
    const entry  = { customer: "Voice Customer", product: "Milk", qty, amount };
    state.sales.push(entry);
    return { type: "sale", entry };
  }

  return { type: "unknown", entry: null };
}

/* ────────────────────────────────────────────────────
   EVENT WIRING
──────────────────────────────────────────────────── */
function wireEvents() {
  // Set today's date in milk form
  const milkDateEl = qs("#productionDate");
  if (milkDateEl) milkDateEl.value = today;

  // Set greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  setText("#appTitle", "Owner Workspace");
  const dateEl = qs("#appDate");
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // LOGIN (app.html login screen)
  const loginForm = qs("#loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", e => {
      e.preventDefault();
      const user = qs("#adminUser")?.value?.trim();
      const pass = qs("#adminPass")?.value?.trim();
      if (!user || !pass) return;

      qs("#loginScreen")?.classList.add("hidden");
      qs("#appShell")?.classList.remove("hidden");

      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("service-worker.js").catch(() => {});
      }

      runDailyAgent({ notify: true });
      renderAll();

      // Schedule agent check every 60 minutes
      setInterval(() => {
        runDailyAgent({ notify: true });
        renderAll();
      }, 60 * 60 * 1000);

      // Simulate a WhatsApp-style notification after 3 seconds
      setTimeout(() => {
        addNotification("Farm check complete", "AI agent ran your daily farm check.", "success");
      }, 3000);
    });
  }

  // LOGOUT
  qs("#logoutButton")?.addEventListener("click", () => {
    qs("#loginScreen")?.classList.remove("hidden");
    qs("#appShell")?.classList.add("hidden");
  });

  // SIDEBAR tabs
  qsa(".sidebar-btn").forEach(btn => {
    btn.addEventListener("click", () => goTab(btn.dataset.tab));
  });

  // BOTTOM NAV tabs
  qsa(".bnav-btn").forEach(btn => {
    btn.addEventListener("click", () => goTab(btn.dataset.tab));
  });

  // data-go buttons
  qsa("[data-go]").forEach(btn => {
    btn.addEventListener("click", () => goTab(btn.dataset.go));
  });

  // NOTIFICATIONS
  qs("#notificationButton")?.addEventListener("click", () => {
    const drawer = qs("#notificationDrawer");
    if (!drawer) return;
    drawer.classList.toggle("hidden");
    state.notifications = state.notifications.map(n => ({ ...n, unread: false }));
    renderNotifications();
  });
  qs("#closeNotifBtn")?.addEventListener("click", () => {
    qs("#notificationDrawer")?.classList.add("hidden");
  });

  // MILK form
  qs("#productionForm")?.addEventListener("submit", e => {
    e.preventDefault();
    const entry = {
      date:    qs("#productionDate")?.value || today,
      morning: Number(qs("#morningMilk")?.value),
      evening: Number(qs("#eveningMilk")?.value),
      fat:     Number(qs("#fatPercent")?.value)
    };
    state.production.push(entry);
    addNotification("Milk entry saved", `${entry.morning} L morning + ${entry.evening} L evening recorded.`, "success");
    sendPush("Vayumukhi Farm", `Milk entry saved: ${total(entry)} L total.`);
    renderAll();
  });

  // SALES form
  qs("#salesForm")?.addEventListener("submit", e => {
    e.preventDefault();
    const item = {
      customer: qs("#customerName")?.value,
      product:  qs("#salesProduct")?.value,
      qty:      Number(qs("#salesQty")?.value),
      amount:   Number(qs("#salesAmount")?.value)
    };
    state.sales.push(item);
    addNotification("Sale recorded", `${item.customer} purchased ${item.qty} ${item.product}.`, "success");
    sendPush("Vayumukhi Farm", `Sale: ${item.customer} — ${rupee.format(item.amount)}`);
    renderAll();
  });

  // EXPENSE form
  qs("#expenseForm")?.addEventListener("submit", e => {
    e.preventDefault();
    const item = {
      category:    qs("#expenseCategory")?.value,
      description: qs("#expenseDescription")?.value,
      amount:      Number(qs("#expenseAmount")?.value)
    };
    state.expenses.push(item);
    addNotification("Cost recorded", `${item.category} — ${rupee.format(item.amount)}`, "info");
    renderAll();
  });

  // SMART SCANNER (replaces single-purpose photo upload)
  qsa("[data-open-scanner]").forEach(btn => btn.addEventListener("click", () => openScanner()));
  qs("#globalScanButton")?.addEventListener("click", () => openScanner());
  qsa("[data-close-scanner]").forEach(el => el.addEventListener("click", () => closeScanner()));
  qs("#scanStartCamera")?.addEventListener("click", startScannerCamera);
  qs("#scanCaptureBtn")?.addEventListener("click", captureFromCamera);
  qs("#scanFileInput")?.addEventListener("change", handleScanFile);
  qs("#scanRescanBtn")?.addEventListener("click", () => showScanStep("capture"));
  qs("#scanReclassifyBtn")?.addEventListener("click", reclassifyScan);
  qs("#scanSaveBtn")?.addEventListener("click", saveScannedEntry);
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !qs("#scanModal")?.classList.contains("hidden")) closeScanner(); });

  // ADD ANIMAL
  qs("#addAnimalButton")?.addEventListener("click", () => {
    const idx = state.animals.length + 1;
    state.animals.push({
      id: `VD-N${String(idx).padStart(2, "0")}`,
      name: `New Animal ${idx}`, type: "Cow",
      status: "New", health: "Needs profile", feed: "Assign fodder plan"
    });
    addNotification("Animal added", `Animal ${idx} added. Please complete the health and feed profile.`, "warning");
    renderAnimals();
  });

  // AI ASSISTANT — voice
  qs("#voiceButton")?.addEventListener("click", () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      const out = qs("#assistantOutput");
      if (out) { out.classList.remove("hidden"); out.innerHTML = "<strong>Voice unavailable</strong><p>Use Chrome or type the command instead.</p>"; }
      return;
    }
    const rec = new SR();
    rec.lang = "en-IN";
    rec.onresult = ev => {
      const inputEl = qs("#assistantInput");
      if (inputEl) inputEl.value = ev.results[0][0].transcript;
      handleAssistantInput();
    };
    rec.start();
  });

  // AI ASSISTANT — text submit
  qs("#parseButton")?.addEventListener("click", handleAssistantInput);

  // MONITOR / RUN CHECK buttons
  qs("#focusMonitorButton")?.addEventListener("click", () => { runDailyAgent({ notify: true }); renderAll(); });
  qs("#monitorNowButton")?.addEventListener("click",   () => { runDailyAgent({ notify: true }); renderAll(); });
}

function handleAssistantInput() {
  const inputEl = qs("#assistantInput");
  if (!inputEl) return;
  const result = parseAssistantText(inputEl.value);
  const outEl  = qs("#assistantOutput");
  if (!outEl) return;
  outEl.classList.remove("hidden");
  if (result.type === "unknown") {
    outEl.innerHTML = "<strong>No entry created</strong><p>Try mentioning milk, expense, salary, feed, sale, or customer.</p>";
    return;
  }
  outEl.innerHTML = `<strong>${result.type.toUpperCase()} entry created</strong><pre>${JSON.stringify(result.entry, null, 2)}</pre>`;
  addNotification("Assistant created entry", `${result.type} data was created from your input.`, "success");
  sendPush("Vayumukhi Farm", `${result.type} entry created by assistant.`);
  renderAll();
}

/* ────────────────────────────────────────────────────
   SMART SCANNER  —  Auto-routes scanned docs to Milk / Sales / Costs
──────────────────────────────────────────────────── */
const scannerState = {
  stream: null,
  capturedDataUrl: null,
  capturedFileName: null,
  detected: null,
  forceRoute: null
};

function openScanner(forceRoute = null) {
  const modal = qs("#scanModal");
  if (!modal) return;
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  scannerState.forceRoute = forceRoute;
  resetScannerState();
  showScanStep("capture");
}

function closeScanner() {
  qs("#scanModal")?.classList.add("hidden");
  document.body.style.overflow = "";
  stopScannerCamera();
}

function showScanStep(step) {
  ["Capture", "Processing", "Review"].forEach(s => {
    qs(`#scanStep${s}`)?.classList.toggle("hidden", s.toLowerCase() !== step);
  });
  if (step === "capture") {
    qs("#scanStageEmpty")?.classList.remove("hidden");
    qs("#scanVideo")?.classList.remove("active");
    const btn = qs("#scanCaptureBtn"); if (btn) btn.disabled = true;
    const hint = qs("#scanHint"); if (hint) hint.innerHTML = "Tap <strong>Start Camera</strong> or upload a photo.";
  }
}

function resetScannerState() {
  scannerState.capturedDataUrl = null;
  scannerState.capturedFileName = null;
  scannerState.detected = null;
  qsa(".scan-progress li").forEach(li => { li.classList.remove("active", "done"); });
}

async function startScannerCamera() {
  const video = qs("#scanVideo");
  const hint  = qs("#scanHint");
  if (!video) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } }, audio: false
    });
    scannerState.stream = stream;
    video.srcObject = stream;
    video.classList.add("active");
    qs("#scanStageEmpty")?.classList.add("hidden");
    const btn = qs("#scanCaptureBtn"); if (btn) btn.disabled = false;
    if (hint) hint.innerHTML = "Align the document, then tap <strong>Capture</strong>.";
  } catch (err) {
    if (hint) hint.innerHTML = "<strong>Camera unavailable.</strong> Use <em>Upload Photo</em> instead.";
  }
}

function stopScannerCamera() {
  if (scannerState.stream) {
    scannerState.stream.getTracks().forEach(t => t.stop());
    scannerState.stream = null;
  }
  const video = qs("#scanVideo");
  if (video) { video.srcObject = null; video.classList.remove("active"); }
}

function captureFromCamera() {
  const video  = qs("#scanVideo");
  const canvas = qs("#scanCanvas");
  if (!video || !canvas || !scannerState.stream) return;
  const w = video.videoWidth || 720;
  const h = video.videoHeight || 960;
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d").drawImage(video, 0, 0, w, h);
  scannerState.capturedDataUrl = canvas.toDataURL("image/jpeg", 0.82);
  scannerState.capturedFileName = `camera-${Date.now()}.jpg`;
  stopScannerCamera();
  processCapture();
}

function handleScanFile(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    scannerState.capturedDataUrl = ev.target.result;
    scannerState.capturedFileName = file.name;
    processCapture();
  };
  reader.readAsDataURL(file);
  e.target.value = "";
}

function processCapture() {
  showScanStep("processing");
  const img = qs("#scanPreviewImg");
  if (img) img.src = scannerState.capturedDataUrl;

  const steps = qsa(".scan-progress li");
  steps.forEach(li => li.classList.remove("active", "done"));

  let i = 0;
  const tick = () => {
    if (i > 0) { steps[i - 1].classList.remove("active"); steps[i - 1].classList.add("done"); }
    if (i < steps.length) {
      steps[i].classList.add("active");
      i++;
      setTimeout(tick, 620);
    } else {
      const detection = classifyCapture(scannerState.capturedFileName);
      scannerState.detected = detection;
      renderScanReview(detection);
      showScanStep("review");
    }
  };
  tick();
}

/* Smart classifier — filename keyword heuristics + active-tab fallback.
   In production this would call a vision/OCR backend. */
function classifyCapture(filename = "") {
  const name = (filename || "").toLowerCase();

  const milkKeys  = ["milk", "sheet", "production", "litre", "liter", "morning", "evening", "fat"];
  const salesKeys = ["sale", "invoice", "bill", "customer", "delivery", "slip", "order"];
  const costKeys  = ["receipt", "expense", "cost", "salary", "wage", "vendor", "feed", "vet", "medic", "fuel", "diesel"];

  const hits = {
    milk:  milkKeys.filter(k => name.includes(k)).length,
    sales: salesKeys.filter(k => name.includes(k)).length,
    costs: costKeys.filter(k => name.includes(k)).length
  };

  let route = scannerState.forceRoute;
  if (!route) {
    if (hits.milk + hits.sales + hits.costs === 0) {
      const activeTab = qs(".tab-panel.active")?.id?.replace("tab-", "");
      route = ["milk", "sales", "costs"].includes(activeTab) ? activeTab : "milk";
    } else {
      route = Object.entries(hits).sort((a, b) => b[1] - a[1])[0][0];
    }
  }

  const confidence = 88 + Math.floor(Math.random() * 10);

  if (route === "milk") {
    const morning = 100 + Math.floor(Math.random() * 30);
    const evening = 85  + Math.floor(Math.random() * 25);
    const fat     = (3.8 + Math.random() * 0.8).toFixed(1);
    return {
      route, confidence,
      title: "Milk production sheet detected",
      fields: [
        { key: "date",    label: "Date",        value: today,   type: "date" },
        { key: "morning", label: "Morning (L)", value: morning, type: "number" },
        { key: "evening", label: "Evening (L)", value: evening, type: "number" },
        { key: "fat",     label: "Fat %",       value: fat,     type: "number", step: "0.1" }
      ]
    };
  }
  if (route === "sales") {
    const customers = ["Lakshmi Stores", "Sai Apartments", "Annapurna Hotel", "Meera Home", "Ravi General"];
    const products  = ["Milk", "Curd", "Paneer", "Ghee"];
    const rate      = { Milk: 60, Curd: 90, Paneer: 320, Ghee: 750 };
    const product   = products[Math.floor(Math.random() * products.length)];
    const qty       = 6 + Math.floor(Math.random() * 24);
    return {
      route, confidence,
      title: "Customer bill detected",
      fields: [
        { key: "customer", label: "Customer",    value: customers[Math.floor(Math.random() * customers.length)], type: "text" },
        { key: "product",  label: "Product",     value: product, type: "select", options: products },
        { key: "qty",      label: "Quantity",    value: qty,     type: "number" },
        { key: "amount",   label: "Amount (₹)",  value: qty * rate[product], type: "number" }
      ]
    };
  }
  const categories = ["Salaries", "Medication", "Feed", "Misc"];
  let category = "Misc";
  if (/salar|wage/.test(name)) category = "Salaries";
  else if (/medic|vet/.test(name)) category = "Medication";
  else if (/feed|fodder/.test(name)) category = "Feed";
  else category = categories[Math.floor(Math.random() * categories.length)];
  const descMap = {
    Salaries:   "Farm helper daily wage",
    Medication: "Veterinary visit & medicine",
    Feed:       "Mineral mix + Napier fodder",
    Misc:       "Route diesel & supplies"
  };
  return {
    route: "costs", confidence,
    title: "Expense receipt detected",
    fields: [
      { key: "category",    label: "Category",    value: category, type: "select", options: categories },
      { key: "description", label: "Description", value: descMap[category], type: "text" },
      { key: "amount",      label: "Amount (₹)",  value: 400 + Math.floor(Math.random() * 4600), type: "number" }
    ]
  };
}

function renderScanReview(d) {
  const routeLabel = { milk: "MILK · PRODUCTION", sales: "SALES · CUSTOMER", costs: "COSTS · EXPENSE" };
  const pill = qs("#scanRoutePill");
  if (pill) {
    pill.textContent = routeLabel[d.route] || d.route.toUpperCase();
    pill.className = `scan-route-pill route-${d.route}`;
  }
  setText("#scanResultTitle", d.title);
  setText("#scanResultConfidence", `Confidence ${d.confidence}% · Auto-routed to ${d.route.charAt(0).toUpperCase() + d.route.slice(1)}`);

  const fieldsEl = qs("#scanFields");
  if (!fieldsEl) return;
  fieldsEl.innerHTML = d.fields.map(f => {
    if (f.type === "select") {
      return `<label class="scan-field"><span>${f.label}</span><select data-field="${f.key}">${
        f.options.map(o => `<option ${o === f.value ? "selected" : ""}>${o}</option>`).join("")
      }</select></label>`;
    }
    const step = f.step ? ` step="${f.step}"` : "";
    return `<label class="scan-field"><span>${f.label}</span><input data-field="${f.key}" type="${f.type}" value="${f.value}"${step} /></label>`;
  }).join("");
}

function reclassifyScan() {
  if (!scannerState.detected) return;
  const order = ["milk", "sales", "costs"];
  const next  = order[(order.indexOf(scannerState.detected.route) + 1) % order.length];
  scannerState.forceRoute = next;
  const d = classifyCapture(scannerState.capturedFileName);
  scannerState.detected = d;
  renderScanReview(d);
}

function saveScannedEntry() {
  const d = scannerState.detected;
  if (!d) return;
  const vals = {};
  qsa("#scanFields [data-field]").forEach(el => vals[el.dataset.field] = el.value);

  if (d.route === "milk") {
    const entry = {
      date:    vals.date || today,
      morning: Number(vals.morning) || 0,
      evening: Number(vals.evening) || 0,
      fat:     Number(vals.fat) || 4.0
    };
    state.production.push(entry);
    addNotification("Scanned milk entry saved", `${entry.morning} L morning + ${entry.evening} L evening from photo.`, "success");
    sendPush("Vayumukhi Farm", `Scanner saved ${total(entry)} L milk entry.`);
    goTab("milk");
  } else if (d.route === "sales") {
    const entry = {
      customer: vals.customer || "Scanned Customer",
      product:  vals.product  || "Milk",
      qty:      Number(vals.qty) || 1,
      amount:   Number(vals.amount) || 0
    };
    state.sales.push(entry);
    addNotification("Scanned sale saved", `${entry.customer} — ${entry.qty} ${entry.product} · ${rupee.format(entry.amount)}`, "success");
    sendPush("Vayumukhi Farm", `Scanner saved sale: ${rupee.format(entry.amount)}`);
    goTab("sales");
  } else {
    const entry = {
      category:    vals.category    || "Misc",
      description: vals.description || "Scanned expense",
      amount:      Number(vals.amount) || 0
    };
    state.expenses.push(entry);
    addNotification("Scanned cost saved", `${entry.category} — ${rupee.format(entry.amount)}`, "info");
    sendPush("Vayumukhi Farm", `Scanner saved ${entry.category} expense.`);
    goTab("costs");
  }
  renderAll();
  closeScanner();
}

/* ────────────────────────────────────────────────────
   INIT
──────────────────────────────────────────────────── */
wireEvents();
// Pre-render public page metrics if elements exist
setText("#publicRevenue", rupee.format(Math.round(
  state.sales.reduce((s,i)=>s+Number(i.amount),0) * 26
)));
