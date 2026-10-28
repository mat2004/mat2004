(function () {
  "use strict";

  var STORAGE_KEY = "water-tracker-v1";
  var MIN_GOAL = 0.5;
  var MAX_GOAL = 6;
  var GOAL_STEP = 0.25;

  // Public half of the key pair used to send reminders. Must match reminders/send.js.
  var VAPID_PUBLIC_KEY = "BD7PeS3r7QaKA6pfj01DFfQEQRFFDBRz9ytluVbKRkr_csL06DvnMFe9Lki76yictDFhxYGHS8GCed_quWA4sQw";

  // Bottle geometry, in SVG units (see viewBox in index.html).
  var WATER_BOTTOM = 408;
  var WATER_TOP = 108;

  var $ = function (id) { return document.getElementById(id); };

  // ---------- storage ----------

  function load() {
    try {
      var data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (data && typeof data.goal === "number" && data.days) return data;
    } catch (e) {}
    return { goal: 2.5, days: {} };
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function dateKey(d) {
    var pad = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function todayKey() {
    return dateKey(new Date());
  }

  // Keep about two years of history, so storage never grows forever.
  function prune() {
    var keys = Object.keys(state.days).sort();
    while (keys.length > 730) {
      var old = keys.shift();
      delete state.days[old];
      delete state.dayGoals[old];
    }
  }

  // Remember what the goal was on each day, so history stays right after the goal changes.
  function rememberGoal() {
    state.dayGoals[todayKey()] = state.goal;
  }

  var state = load();
  state.dayGoals = state.dayGoals || {};

  function todayEntries() {
    return state.days[todayKey()] || [];
  }

  function todayTotalMl() {
    return todayEntries().reduce(function (sum, ml) { return sum + ml; }, 0);
  }

  // ---------- formatting ----------

  function litres(ml) {
    return String(Math.round(ml / 10) / 100);
  }

  // ---------- rendering ----------

  function renderTicks() {
    var g = $("ticks");
    var goal = state.goal;
    var step = goal > 4 ? 1 : 0.5;
    var html = "";
    for (var l = step; l < goal - 0.001; l += step) {
      var y = WATER_BOTTOM - (l / goal) * (WATER_BOTTOM - WATER_TOP);
      var whole = Math.abs(l - Math.round(l)) < 0.001;
      html += '<line class="tick-line" x1="44" x2="' + (whole ? 62 : 54) + '" y1="' + y + '" y2="' + y + '"/>';
      if (whole) html += '<text class="tick-label" x="68" y="' + (y + 4.5) + '">' + l + " L</text>";
    }
    g.innerHTML = html;
  }

  function render() {
    var goalMl = state.goal * 1000;
    var drankMl = todayTotalMl();
    var pct = Math.min(drankMl / goalMl, 1);
    var left = goalMl - drankMl;

    $("drank").textContent = litres(drankMl);
    $("goal").textContent = litres(goalMl);
    $("status").textContent = left > 0 ? litres(left) + " L to go" : "Goal reached! 🎉";
    $("status").parentNode.classList.toggle("reached", left <= 0);
    $("undo-btn").disabled = todayEntries().length === 0;

    // Leave a sliver of the wave visible at 0% so the bottle doesn't look broken.
    var y = WATER_BOTTOM - pct * (WATER_BOTTOM - WATER_TOP) + (pct === 0 ? 6 : 0);
    $("water").style.transform = "translateY(" + y + "px)";

    renderTicks();
  }

  // ---------- actions ----------

  function addWater(ml) {
    ml = Math.round(ml);
    if (!(ml > 0)) return;
    var key = todayKey();
    (state.days[key] = state.days[key] || []).push(ml);
    rememberGoal();
    prune();
    save();
    render();
    toast("+" + ml + " ml");
  }

  function undo() {
    var entries = todayEntries();
    if (!entries.length) return;
    var ml = entries.pop();
    save();
    render();
    toast("Removed " + ml + " ml");
  }

  var toastTimer;
  function toast(text) {
    var el = $("toast");
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 1600);
  }

  // ---------- sheets ----------

  function openSheet(id) {
    $(id).hidden = false;
  }

  function closeSheets() {
    $("add-sheet").hidden = true;
    $("goal-sheet").hidden = true;
    $("remind-sheet").hidden = true;
    document.activeElement && document.activeElement.blur();
  }

  document.querySelectorAll("[data-close]").forEach(function (el) {
    el.addEventListener("click", closeSheets);
  });

  // Add water
  $("add-btn").addEventListener("click", function () {
    $("custom-ml").value = "";
    openSheet("add-sheet");
  });

  document.querySelectorAll("[data-ml]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      addWater(Number(btn.dataset.ml));
      closeSheets();
    });
  });

  $("custom-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var ml = Number($("custom-ml").value);
    if (ml > 0 && ml <= 5000) {
      addWater(ml);
      closeSheets();
    } else {
      $("custom-ml").focus();
    }
  });

  $("undo-btn").addEventListener("click", undo);

  // Goal
  var draftGoal = state.goal;

  function renderGoalSheet() {
    $("goal-value").textContent = draftGoal;
    $("goal-minus").disabled = draftGoal <= MIN_GOAL;
    $("goal-plus").disabled = draftGoal >= MAX_GOAL;
    document.querySelectorAll("[data-goal]").forEach(function (btn) {
      btn.classList.toggle("active", Number(btn.dataset.goal) === draftGoal);
    });
  }

  function setDraft(value) {
    draftGoal = Math.min(MAX_GOAL, Math.max(MIN_GOAL, Math.round(value / GOAL_STEP) * GOAL_STEP));
    renderGoalSheet();
  }

  $("goal-btn").addEventListener("click", function () {
    draftGoal = state.goal;
    renderGoalSheet();
    openSheet("goal-sheet");
  });

  $("goal-minus").addEventListener("click", function () { setDraft(draftGoal - GOAL_STEP); });
  $("goal-plus").addEventListener("click", function () { setDraft(draftGoal + GOAL_STEP); });

  document.querySelectorAll("[data-goal]").forEach(function (btn) {
    btn.addEventListener("click", function () { setDraft(Number(btn.dataset.goal)); });
  });

  $("goal-save").addEventListener("click", function () {
    state.goal = draftGoal;
    if (todayEntries().length) rememberGoal();
    save();
    render();
    closeSheets();
    toast("Goal set to " + draftGoal + " L");
  });

  // Reminders
  // The app only produces a "reminder code" (where to send notifications + your hours).
  // GitHub Actions uses it to send the actual reminders, see reminders/send.js.

  function remindError(text) {
    $("remind-error").textContent = text;
    $("remind-error").hidden = !text;
  }

  function base64UrlToBytes(s) {
    var b64 = (s + "===".slice((s.length + 3) % 4)).replace(/-/g, "+").replace(/_/g, "/");
    var raw = atob(b64);
    var bytes = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
  }

  $("remind-btn").addEventListener("click", function () {
    var r = state.remind || {};
    $("remind-from").value = r.from || "08:00";
    $("remind-to").value = r.to || "22:00";
    $("remind-code-box").hidden = true;
    remindError("");
    openSheet("remind-sheet");
  });

  $("remind-on").addEventListener("click", function () {
    remindError("");
    var from = $("remind-from").value || "08:00";
    var to = $("remind-to").value || "22:00";

    if (!("Notification" in window) || !("PushManager" in window) || !("serviceWorker" in navigator)) {
      remindError(navigator.standalone === false
        ? "Open Water from its home screen icon (not from Safari) to turn on reminders."
        : "Reminders need iOS 16.4 or newer.");
      return;
    }

    // Must be the first thing after the tap, or iOS won't show the permission prompt.
    Notification.requestPermission()
      .then(function (permission) {
        if (permission !== "granted") {
          var denied = new Error("Notifications are turned off. Turn them on in iPhone Settings → Notifications → Water, then try again.");
          denied.friendly = true;
          throw denied;
        }
        return navigator.serviceWorker.ready;
      })
      .then(function (reg) {
        return reg.pushManager.getSubscription().then(function (sub) {
          return sub || reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY)
          });
        });
      })
      .then(function (sub) {
        state.remind = { from: from, to: to };
        save();
        $("remind-code").value = JSON.stringify({
          s: sub.toJSON(),
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
          from: from,
          to: to
        });
        $("remind-code-box").hidden = false;
      })
      .catch(function (err) {
        remindError(err && err.friendly ? err.message : "Couldn't turn on reminders, please try again." + (err && err.message ? " (" + err.message + ")" : ""));
      });
  });

  $("remind-copy").addEventListener("click", function () {
    var code = $("remind-code").value;
    var copied = navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject();
    copied.then(function () {
      toast("Code copied");
    }, function () {
      $("remind-code").select();
      toast("Select the code and copy it");
    });
  });

  // ---------- history page ----------

  var MONTHS = ["January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"];
  var WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function dayTotalMl(key) {
    return (state.days[key] || []).reduce(function (sum, ml) { return sum + ml; }, 0);
  }

  function dayGoalMl(key) {
    return (state.dayGoals[key] || state.goal) * 1000;
  }

  function goalMet(key) {
    var total = dayTotalMl(key);
    return total > 0 && total >= dayGoalMl(key);
  }

  // Days in a row the goal was reached. Today only counts once it's reached,
  // so the streak doesn't drop to 0 every morning.
  function streak() {
    var d = new Date();
    if (!goalMet(dateKey(d))) d.setDate(d.getDate() - 1);
    var n = 0;
    while (goalMet(dateKey(d))) {
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }

  // Average over the last 7 days that have any water logged.
  function weekAverageMl() {
    var d = new Date();
    var sum = 0;
    var count = 0;
    for (var i = 0; i < 7; i++) {
      var total = dayTotalMl(dateKey(d));
      if (total > 0) {
        sum += total;
        count++;
      }
      d.setDate(d.getDate() - 1);
    }
    return count ? sum / count : 0;
  }

  var shownMonth = new Date();
  shownMonth.setDate(1);

  function renderHistory() {
    var year = shownMonth.getFullYear();
    var month = shownMonth.getMonth();
    var today = todayKey();
    var now = new Date();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

    $("stat-streak").textContent = streak();
    $("stat-avg").textContent = litres(weekAverageMl()) + " L";
    $("month-title").textContent = MONTHS[month] + " " + year;
    $("month-next").disabled = isCurrentMonth;

    // Calendar: each day is a small circle that fills with water.
    var html = "";
    var blanks = (new Date(year, month, 1).getDay() + 6) % 7; // weeks start on Monday
    for (var b = 0; b < blanks; b++) html += "<span></span>";
    var goalsMet = 0;
    var listHtml = "";
    for (var day = 1; day <= daysInMonth; day++) {
      var key = dateKey(new Date(year, month, day));
      var total = dayTotalMl(key);
      var goal = dayGoalMl(key);
      var pct = Math.min(Math.round((total / goal) * 100), 100);
      var met = goalMet(key);
      if (met) goalsMet++;
      var cls = "cal-day" + (met ? " met" : "") + (key === today ? " today" : "") + (key > today ? " future" : "");
      html += '<span class="' + cls + '" style="--fill:' + pct + '%">' + day + "</span>";

      if (total > 0) {
        var weekday = WEEKDAYS[new Date(year, month, day).getDay()];
        listHtml = '<li class="day-row' + (met ? " met" : "") + '">' +
          '<div class="day-date"><b>' + day + "</b><span>" + weekday + "</span></div>" +
          '<div class="day-main">' +
            '<div class="day-amount"><b>' + litres(total) + " L</b> of " + litres(goal) + " L" + (met ? ' <span class="check">✓</span>' : "") + "</div>" +
            '<div class="day-bar"><i style="width:' + pct + '%"></i></div>' +
          "</div></li>" + listHtml; // newest first
      }
    }
    $("cal").innerHTML = html;
    $("stat-goals").textContent = goalsMet;
    $("stat-goals-label").textContent = "goals reached in " + MONTHS[month].slice(0, 3);
    $("day-list").innerHTML = listHtml || '<li class="day-empty">No water logged in ' + MONTHS[month] + ".</li>";
  }

  // ---------- tabs ----------

  function showTab(name) {
    $("intake").hidden = name !== "intake";
    $("history").hidden = name !== "history";
    $("toast").hidden = true;
    document.querySelectorAll("[data-tab]").forEach(function (btn) {
      var active = btn.dataset.tab === name;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", String(active));
    });
    if (name === "history") {
      shownMonth = new Date();
      shownMonth.setDate(1);
      renderHistory();
      $("history").scrollTop = 0;
    }
  }

  document.querySelectorAll("[data-tab]").forEach(function (btn) {
    btn.addEventListener("click", function () { showTab(btn.dataset.tab); });
  });

  $("month-prev").addEventListener("click", function () {
    shownMonth.setMonth(shownMonth.getMonth() - 1);
    renderHistory();
  });

  $("month-next").addEventListener("click", function () {
    shownMonth.setMonth(shownMonth.getMonth() + 1);
    renderHistory();
  });

  // ---------- new day ----------

  // When the app comes back from the background on a new day, show the fresh (empty) bottle.
  var shownDay = todayKey();
  function checkNewDay() {
    if (todayKey() !== shownDay) {
      shownDay = todayKey();
      render();
      if (!$("history").hidden) renderHistory();
    }
  }
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) checkNewDay();
  });
  setInterval(checkNewDay, 60 * 1000);

  // ---------- no zooming ----------

  // iOS ignores user-scalable=no, so block pinch-zoom here.
  document.addEventListener("gesturestart", function (e) { e.preventDefault(); });

  // ---------- start ----------

  render();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }
})();
