/* =====================================================
   Vayumukhi — Worker Workspace
   Simple UI: Quick Actions • My Activities • Reminders
===================================================== */
(function () {
  "use strict";

  const qs  = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));

  function escapeHTML(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
  }

  /* ─── State ─── */
  const todayISO = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  const state = {
    worker: { name: "Ravi", initial: "R" },
    activities: [
      // pre-seed with a finished morning task so the page never feels empty
      {
        id: "seed-1",
        type: "feed",
        title: "Morning feed — Napier grass",
        detail: "All 28 animals · ~120 kg",
        time: "05:10 AM",
        status: "done"
      }
    ],
    reminders: [
      { id: "r1", title: "Vet visit — Nandi pregnancy check", when: "Today · 11:00 AM",  who: "Dr. Subbu",  priority: "high",   icon: "vet" },
      { id: "r2", title: "Cut Napier from Field A",            when: "Tomorrow · 6:00 AM", who: "Owner Ramaraju", priority: "medium", icon: "fodder" },
      { id: "r3", title: "Yamuna — vaccination booster",       when: "Sat · 9:00 AM",      who: "Dr. Subbu",  priority: "medium", icon: "vet" },
      { id: "r4", title: "Mineral mix stock — re-order",       when: "Mon · any time",     who: "Owner Ramaraju", priority: "low",    icon: "feed" }
    ],
    modal: { action: null }
  };

  /* ─── Login ─── */
  function bindLogin() {
    qs("#loginForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = qs("#workerName").value || "Ravi";
      const pin  = qs("#workerPin").value || "";
      if (!pin) { return; }
      state.worker.name = name;
      state.worker.initial = name.charAt(0).toUpperCase();
      qs("#loginScreen").classList.add("hidden");
      qs("#workerShell").classList.remove("hidden");
      renderHeader();
      renderAll();
    });
  }

  /* ─── Header / greeting ─── */
  function greetingFor(hour) {
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }
  function shiftFor(hour) {
    if (hour < 11) return "Morning shift";
    if (hour < 16) return "Day shift";
    return "Evening shift";
  }
  function renderHeader() {
    const now = new Date();
    qs("#workerWelcomeName").textContent = state.worker.name;
    qs("#workerGreeting").textContent = greetingFor(now.getHours());
    qs("#workerAvatar").textContent = state.worker.initial;
    qs("#workerHelloTitle").textContent = `Hello, ${state.worker.name}`;
    qs("#workerShiftLabel").textContent = shiftFor(now.getHours());
    const dayName = now.toLocaleDateString("en-IN", { weekday: "long" });
    const dateStr = now.toLocaleDateString("en-IN", { day: "numeric", month: "long" });
    qs("#workerHelloSub").textContent = `${dayName}, ${dateStr} · ${shiftFor(now.getHours())} on now`;
  }

  /* ─── Render: activities ─── */
  function activityIcon(type) {
    const map = {
      milk:   '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 2h8l-1 4v3l3 7v6a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-6l3-7V6z"/></svg>',
      feed:   '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 20A7 7 0 0 1 4 13c0-6 9-9 16-9 0 7-3 16-9 16Z"/><path d="M4 20l8-8"/></svg>',
      health: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>',
      clean:  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12c2-4 16-4 18 0M3 12c2 4 16 4 18 0M12 6v12"/></svg>',
      scan:   '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
      voice:  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>'
    };
    return map[type] || map.feed;
  }
  function activityColor(type) {
    return ({
      milk: "wa-green", feed: "wa-leaf", health: "wa-red",
      clean: "wa-blue", scan: "wa-amber", voice: "wa-purple"
    })[type] || "wa-green";
  }
  function renderActivities() {
    const list = qs("#workerActivityList");
    const empty = qs("#workerActivityEmpty");
    const count = qs("#workerActivityCount");
    if (!list || !empty || !count) return;

    if (state.activities.length === 0) {
      list.innerHTML = "";
      empty.style.display = "";
      count.textContent = "0 logged";
      return;
    }
    empty.style.display = "none";
    count.textContent = `${state.activities.length} logged`;
    list.innerHTML = state.activities.map(a => `
      <li class="worker-activity">
        <span class="activity-icon ${activityColor(a.type)}">${activityIcon(a.type)}</span>
        <div class="activity-body">
          <strong>${escapeHTML(a.title)}</strong>
          <span class="activity-detail">${escapeHTML(a.detail || "")}</span>
        </div>
        <div class="activity-meta">
          <span class="activity-time">${escapeHTML(a.time)}</span>
          <span class="activity-status ${a.status === "done" ? "is-done" : ""}">${a.status === "done" ? "Saved" : "Pending"}</span>
        </div>
      </li>
    `).join("");
  }

  /* ─── Render: reminders ─── */
  function reminderIcon(kind) {
    const map = {
      vet:    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 14V8a3 3 0 0 0-6 0v6"/><path d="M5 14h14l-1 7H6z"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></svg>',
      fodder: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 20A7 7 0 0 1 4 13c0-6 9-9 16-9 0 7-3 16-9 16Z"/><path d="M4 20l8-8"/></svg>',
      feed:   '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7h18l-2 12H5z"/><path d="M9 7V4h6v3"/></svg>'
    };
    return map[kind] || map.feed;
  }
  function renderReminders() {
    const list = qs("#workerReminderList");
    if (!list) return;
    list.innerHTML = state.reminders.map(r => `
      <li class="worker-reminder priority-${r.priority}">
        <span class="reminder-icon">${reminderIcon(r.icon)}</span>
        <div class="reminder-body">
          <strong>${escapeHTML(r.title)}</strong>
          <span class="reminder-meta">${escapeHTML(r.when)} · ${escapeHTML(r.who)}</span>
        </div>
        <div class="reminder-side">
          <span class="reminder-priority">${escapeHTML(r.priority)}</span>
          <button class="reminder-done" data-reminder="${r.id}" type="button" title="Mark done">Done</button>
        </div>
      </li>
    `).join("");

    qsa("[data-reminder]", list).forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-reminder");
        const rem = state.reminders.find(x => x.id === id);
        if (!rem) return;
        state.reminders = state.reminders.filter(x => x.id !== id);
        addActivity({
          type: "feed",
          title: `Completed: ${rem.title}`,
          detail: rem.who,
          status: "done"
        });
        renderReminders();
        toast(`Marked done: ${rem.title}`);
      });
    });
  }

  function renderAll() {
    renderActivities();
    renderReminders();
  }

  /* ─── Add activity helper ─── */
  function addActivity(partial) {
    const now = new Date();
    const time = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    state.activities.unshift({
      id: `a-${Date.now()}`,
      time,
      status: "done",
      ...partial
    });
    renderActivities();
  }

  /* ─── Modal ─── */
  const modalForms = {
    milk: {
      title: "Log milk shift",
      fields: `
        <label class="field"><span>Session</span>
          <select id="m-session">
            <option value="Morning">Morning (5:30 AM)</option>
            <option value="Evening">Evening (5:30 PM)</option>
          </select>
        </label>
        <label class="field"><span>Total litres</span>
          <input id="m-litres" type="number" min="0" step="0.1" placeholder="e.g. 118" inputmode="decimal" />
        </label>
        <label class="field"><span>Fat %</span>
          <input id="m-fat" type="number" min="0" step="0.1" placeholder="e.g. 4.3" inputmode="decimal" />
        </label>
        <label class="field"><span>Anything off? (optional)</span>
          <input id="m-note" type="text" placeholder="e.g. Lakshmi gave less today" />
        </label>
      `,
      save: () => {
        const session = qs("#m-session").value;
        const litres  = qs("#m-litres").value || "—";
        const fat     = qs("#m-fat").value || "—";
        const note    = qs("#m-note").value;
        addActivity({
          type: "milk",
          title: `${session} milk — ${litres} L`,
          detail: `Fat ${fat}%${note ? " · " + note : ""}`
        });
        return `${session} milk saved`;
      }
    },
    feed: {
      title: "Mark feed / fodder done",
      fields: `
        <label class="field"><span>What did you feed?</span>
          <select id="f-what">
            <option>Napier grass (fresh cut)</option>
            <option>Maize fodder</option>
            <option>Dry hay</option>
            <option>Mineral mix</option>
            <option>Concentrate ration</option>
          </select>
        </label>
        <label class="field"><span>Approx quantity (kg)</span>
          <input id="f-qty" type="number" min="0" step="1" placeholder="e.g. 120" inputmode="numeric" />
        </label>
        <label class="field"><span>Note (optional)</span>
          <input id="f-note" type="text" placeholder="e.g. Kamala didn't finish hers" />
        </label>
      `,
      save: () => {
        const what = qs("#f-what").value;
        const qty  = qs("#f-qty").value || "—";
        const note = qs("#f-note").value;
        addActivity({
          type: "feed",
          title: `Fed ${what}`,
          detail: `${qty} kg${note ? " · " + note : ""}`
        });
        return "Feeding logged";
      }
    },
    health: {
      title: "Health note",
      fields: `
        <label class="field"><span>Which animal?</span>
          <select id="h-animal">
            <option>Lakshmi</option><option>Ganga</option><option>Saraswati</option>
            <option>Yamuna</option><option>Nandi</option><option>Kaveri</option>
            <option>Godavari</option><option>Krishna</option><option>Kamala</option>
            <option>Other / not sure</option>
          </select>
        </label>
        <label class="field"><span>What did you notice?</span>
          <select id="h-issue">
            <option>Eating less than usual</option>
            <option>Limping or slow</option>
            <option>Coughing / runny nose</option>
            <option>Swollen udder</option>
            <option>Hot to touch / fever</option>
            <option>Other</option>
          </select>
        </label>
        <label class="field"><span>Note (optional)</span>
          <input id="h-note" type="text" placeholder="anything else to add" />
        </label>
      `,
      save: () => {
        const animal = qs("#h-animal").value;
        const issue  = qs("#h-issue").value;
        const note   = qs("#h-note").value;
        addActivity({
          type: "health",
          title: `Health flag: ${animal}`,
          detail: `${issue}${note ? " · " + note : ""}`
        });
        return `Owner notified about ${animal}`;
      }
    },
    clean: {
      title: "Shed wash",
      fields: `
        <label class="field"><span>Session</span>
          <select id="c-session">
            <option>Morning wash</option>
            <option>Evening wash</option>
            <option>Deep clean (weekly)</option>
          </select>
        </label>
        <label class="field"><span>Area</span>
          <select id="c-area">
            <option>Whole shed</option>
            <option>Milking area only</option>
            <option>Feeding troughs</option>
            <option>Calf pen</option>
          </select>
        </label>
      `,
      save: () => {
        const session = qs("#c-session").value;
        const area    = qs("#c-area").value;
        addActivity({
          type: "clean",
          title: `Shed cleaned — ${session}`,
          detail: area
        });
        return "Shed wash marked done";
      }
    },
    scan: {
      title: "Scan paper sheet",
      fields: `
        <div class="worker-scan-stub">
          <div class="scan-frame-mini">
            <span></span><span></span><span></span><span></span>
            <p>Point the camera at the paper sheet.<br><small>This is a demo — in the real app it opens your phone camera and the AI fills in the numbers.</small></p>
          </div>
        </div>
        <label class="field"><span>What is this sheet about?</span>
          <select id="s-kind">
            <option>Milk record sheet</option>
            <option>Vet prescription</option>
            <option>Feed purchase bill</option>
            <option>Other</option>
          </select>
        </label>
      `,
      save: () => {
        const kind = qs("#s-kind").value;
        addActivity({
          type: "scan",
          title: `Scanned: ${kind}`,
          detail: "Sent to owner for review"
        });
        return "Sheet scanned & uploaded";
      }
    },
    voice: {
      title: "Speak your entry",
      fields: `
        <div class="worker-voice-stub">
          <button class="voice-mic-btn" type="button" id="voiceMicBtn">
            <svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>
          </button>
          <p id="voicePromptText">Tap the mic, then say what you did.<br><small>e.g. "Morning milk 118 litres, fat 4.3 percent"</small></p>
        </div>
        <label class="field"><span>Or type it</span>
          <input id="v-text" type="text" placeholder="What did you do?" />
        </label>
      `,
      onOpen: () => {
        const btn = qs("#voiceMicBtn");
        const prompt = qs("#voicePromptText");
        if (!btn) return;
        btn.addEventListener("click", () => {
          btn.classList.add("is-listening");
          prompt.innerHTML = "Listening... <small>(demo)</small>";
          setTimeout(() => {
            btn.classList.remove("is-listening");
            prompt.innerHTML = "Heard: <strong>\"Morning milk 118 litres, fat 4.3 percent\"</strong><br><small>Tap Save to log it.</small>";
            const v = qs("#v-text"); if (v) v.value = "Morning milk 118 L, fat 4.3%";
          }, 1600);
        });
      },
      save: () => {
        const text = (qs("#v-text").value || "").trim();
        if (!text) return null;
        addActivity({
          type: "voice",
          title: "Voice entry",
          detail: text
        });
        return "Voice entry saved";
      }
    }
  };

  function openModal(action) {
    const def = modalForms[action];
    if (!def) return;
    state.modal.action = action;
    qs("#workerModalTitle").textContent = def.title;
    qs("#workerModalBody").innerHTML = def.fields;
    qs("#workerModal").hidden = false;
    document.body.classList.add("worker-modal-open");
    if (typeof def.onOpen === "function") def.onOpen();
  }
  function closeModal() {
    qs("#workerModal").hidden = true;
    document.body.classList.remove("worker-modal-open");
    state.modal.action = null;
  }

  function bindModal() {
    qsa("[data-close-modal]").forEach(el => el.addEventListener("click", closeModal));
    qs("#workerModalSave").addEventListener("click", () => {
      const def = modalForms[state.modal.action];
      if (!def) return;
      const result = def.save();
      if (result === null) {
        toast("Nothing to save — please fill in the entry");
        return;
      }
      closeModal();
      toast(result || "Saved");
    });
  }

  /* ─── Quick action buttons ─── */
  function bindActions() {
    qsa(".worker-action").forEach(btn => {
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-action");
        openModal(action);
      });
    });
    qs("#workerSignOut")?.addEventListener("click", () => {
      qs("#workerShell").classList.add("hidden");
      qs("#loginScreen").classList.remove("hidden");
    });
  }

  /* ─── Toast ─── */
  let toastTimer;
  function toast(msg) {
    const t = qs("#workerToast");
    if (!t) return;
    t.textContent = msg;
    t.hidden = false;
    t.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      t.classList.remove("is-visible");
      setTimeout(() => { t.hidden = true; }, 220);
    }, 2400);
  }

  /* ─── Init ─── */
  document.addEventListener("DOMContentLoaded", () => {
    bindLogin();
    bindActions();
    bindModal();
  });
})();
