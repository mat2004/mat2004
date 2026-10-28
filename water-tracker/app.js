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

  // A drink is { ml, t } where t is when it was logged. Drinks logged before times were
  // saved (and ones added later to a past day) are plain numbers or have no t.
  function mlOf(drink) {
    return typeof drink === "number" ? drink : drink.ml;
  }

  function timeOf(drink) {
    return typeof drink === "number" ? null : drink.t || null;
  }

  function sumMl(drinks) {
    return drinks.reduce(function (sum, drink) { return sum + mlOf(drink); }, 0);
  }

  function todayEntries() {
    return state.days[todayKey()] || [];
  }

  function todayTotalMl() {
    return sumMl(todayEntries());
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
    (state.days[key] = state.days[key] || []).push({ ml: ml, t: Date.now() });
    rememberGoal();
    prune();
    save();
    render();
    toast("+" + ml + " ml");
  }

  function undo() {
    var entries = todayEntries();
    if (!entries.length) return;
    var ml = mlOf(entries.pop());
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
    $("day-sheet").hidden = true;
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

  function dayTotalMl(key) {
    return sumMl(state.days[key] || []);
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
  var selectedDay = todayKey();

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

    // Calendar: each day is a small circle that fills with water. Tap one to see its stats.
    var html = "";
    var blanks = (new Date(year, month, 1).getDay() + 6) % 7; // weeks start on Monday
    for (var b = 0; b < blanks; b++) html += "<span></span>";
    var goalsMet = 0;
    for (var day = 1; day <= daysInMonth; day++) {
      var key = dateKey(new Date(year, month, day));
      var pct = Math.min(Math.round((dayTotalMl(key) / dayGoalMl(key)) * 100), 100);
      var met = goalMet(key);
      if (met) goalsMet++;
      var cls = "cal-day" + (met ? " met" : "") + (key === today ? " today" : "") +
        (key > today ? " future" : "") + (key === selectedDay ? " selected" : "");
      html += '<button class="' + cls + '" data-day="' + key + '" style="--fill:' + pct + '%">' + day + "</button>";
    }
    $("cal").innerHTML = html;
    $("stat-goals").textContent = goalsMet;
    $("stat-goals-label").textContent = "goals reached in " + MONTHS[month].slice(0, 3);
    renderDayStats();
  }

  function keyToDate(key) {
    var p = key.split("-");
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function longDate(key) {
    return keyToDate(key).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  }

  function clock(t) {
    return new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }

  function hourLabel(h) {
    return (h < 10 ? "0" : "") + h + ":00";
  }

  // ---------- selected day: stats + line chart of water through the day ----------

  var CHART_W = 340;
  var CHART_H = 170;
  var PLOT_LEFT = 34; // room for the y labels
  var PLOT_RIGHT = 6;
  var PLOT_TOP = 12;
  var PLOT_BOTTOM = 22; // room for the x labels
  var MINUTES_IN_DAY = 24 * 60;
  var chartDrinks = []; // the selected day's drinks that have a time: { min, ml, total }
  var chartGoal = 0;
  var chartEndMin = MINUTES_IN_DAY;

  function renderDayStats() {
    var key = selectedDay;
    var today = todayKey();
    var y = new Date();
    y.setDate(y.getDate() - 1);
    var drinks = state.days[key] || [];
    var total = sumMl(drinks);
    var future = key > today;

    $("sel-title").textContent = key === today ? "Today" : key === dateKey(y) ? "Yesterday" : longDate(key);
    $("sel-date").textContent = key === today || key === dateKey(y) ? longDate(key) : "";
    $("sel-edit").hidden = future;
    $("sel-total").textContent = litres(total) + " L";
    $("sel-goal").textContent = "of " + litres(dayGoalMl(key)) + " L" + (goalMet(key) ? " ✓" : "");
    $("sel-goal").classList.toggle("met", goalMet(key));
    $("sel-count").textContent = drinks.length;
    $("sel-count-label").textContent = drinks.length === 1 ? "drink" : "drinks";
    $("sel-avg").textContent = drinks.length ? Math.round(total / drinks.length) + " ml" : "–";

    // Timed drinks in order, each with the running total after it.
    var dayStart = keyToDate(key).getTime();
    var untimedMl = 0;
    var untimedCount = 0;
    chartDrinks = [];
    drinks.forEach(function (drink) {
      var t = timeOf(drink);
      if (t) {
        chartDrinks.push({ min: Math.min(MINUTES_IN_DAY, Math.max(0, (t - dayStart) / 60000)), ml: mlOf(drink), t: t });
      } else {
        untimedMl += mlOf(drink);
        untimedCount++;
      }
    });
    chartDrinks.sort(function (a, b) { return a.min - b.min; });
    var running = 0;
    chartDrinks.forEach(function (d) {
      running += d.ml;
      d.total = running;
    });
    chartGoal = dayGoalMl(key);
    // Today the line stops at the current time; other days run to midnight.
    chartEndMin = key === today ? Math.max((Date.now() - dayStart) / 60000, chartDrinks.length ? chartDrinks[chartDrinks.length - 1].min : 0) : MINUTES_IN_DAY;

    var message = "";
    if (future) message = "This day hasn't come yet.";
    else if (!drinks.length) message = "No water logged this day.";
    else if (!chartDrinks.length) message = "This day has no drink times saved, so there's no chart for it.";
    $("sel-chart-wrap").hidden = !!message;
    $("sel-empty").textContent = message;
    $("sel-empty").hidden = !message;
    $("sel-note").hidden = !(chartDrinks.length && untimedCount);
    $("sel-note").textContent = untimedCount
      ? "+ " + untimedMl + " ml from " + untimedCount + (untimedCount === 1 ? " drink" : " drinks") + " without a time, not shown in the chart."
      : "";
    if (!message) renderChart(null);
  }

  function renderChart(active) {
    var plotW = CHART_W - PLOT_LEFT - PLOT_RIGHT;
    var plotH = CHART_H - PLOT_TOP - PLOT_BOTTOM;
    var baseY = PLOT_TOP + plotH;
    var last = chartDrinks[chartDrinks.length - 1];
    // The y axis always reaches the goal, in half-litre steps.
    var max = Math.ceil(Math.max(chartGoal, last.total) / 500) * 500;
    var xOf = function (min) { return PLOT_LEFT + (min / MINUTES_IN_DAY) * plotW; };
    var yOf = function (ml) { return baseY - (ml / max) * plotH; };
    var f = function (n) { return Math.round(n * 10) / 10; };
    var svg = "";

    // Recessive grid with litre labels, and hour labels along the bottom.
    var stepMl = max > 3000 ? 1000 : 500;
    for (var v = 0; v <= max; v += stepMl) {
      svg += '<line class="grid' + (v === 0 ? " base" : "") + '" x1="' + PLOT_LEFT + '" x2="' + (CHART_W - PLOT_RIGHT) + '" y1="' + f(yOf(v)) + '" y2="' + f(yOf(v)) + '"/>';
      svg += '<text class="axis" x="' + (PLOT_LEFT - 6) + '" y="' + f(yOf(v) + 3.5) + '" text-anchor="end">' + v / 1000 + " L</text>";
    }
    [0, 6, 12, 18, 24].forEach(function (h) {
      var anchor = h === 0 ? "start" : h === 24 ? "end" : "middle";
      svg += '<text class="axis" x="' + f(xOf(h * 60)) + '" y="' + (CHART_H - 6) + '" text-anchor="' + anchor + '">' + hourLabel(h) + "</text>";
    });

    // Dashed goal line, labelled in text colour.
    var goalY = f(yOf(chartGoal));
    svg += '<line class="goal-line" x1="' + PLOT_LEFT + '" x2="' + (CHART_W - PLOT_RIGHT) + '" y1="' + goalY + '" y2="' + goalY + '"/>';
    svg += '<text class="goal-label" x="' + (PLOT_LEFT + 4) + '" y="' + (goalY - 5) + '">Goal ' + litres(chartGoal) + " L</text>";

    // The line: flat between drinks, stepping up at each one.
    var line = "M" + f(xOf(0)) + " " + f(baseY);
    chartDrinks.forEach(function (d) {
      line += " H" + f(xOf(d.min)) + " V" + f(yOf(d.total));
    });
    line += " H" + f(xOf(chartEndMin));
    svg += '<path class="area" d="' + line + " V" + f(baseY) + ' Z"/>';
    svg += '<path class="line" d="' + line + '"/>';

    // Crosshair for the tapped drink.
    if (active !== null) {
      var ax = f(xOf(chartDrinks[active].min));
      svg += '<line class="cross" x1="' + ax + '" x2="' + ax + '" y1="' + PLOT_TOP + '" y2="' + baseY + '"/>';
    }

    // A dot for each drink, with a white ring so close dots stay apart.
    chartDrinks.forEach(function (d, i) {
      svg += '<circle class="dot' + (i === active ? " active" : "") + '" cx="' + f(xOf(d.min)) + '" cy="' + f(yOf(d.total)) + '" r="' + (i === active ? 6 : 4) + '"/>';
    });
    $("sel-chart").innerHTML = svg;

    var tip = $("sel-tip");
    if (active !== null) {
      var d = chartDrinks[active];
      tip.innerHTML = "<b>" + clock(d.t) + "</b> · +" + d.ml + " ml · " + litres(d.total) + " L so far";
    } else {
      tip.textContent = "Water through the day. Tap the chart to see each drink.";
    }
  }

  // Tapping anywhere on the chart picks the nearest drink.
  $("sel-chart").addEventListener("click", function (e) {
    if (!chartDrinks.length) return;
    var box = $("sel-chart").getBoundingClientRect();
    var x = ((e.clientX - box.left) / box.width) * CHART_W;
    var min = ((x - PLOT_LEFT) / (CHART_W - PLOT_LEFT - PLOT_RIGHT)) * MINUTES_IN_DAY;
    var best = 0;
    chartDrinks.forEach(function (d, i) {
      if (Math.abs(d.min - min) < Math.abs(chartDrinks[best].min - min)) best = i;
    });
    renderChart(best);
  });

  $("cal").addEventListener("click", function (e) {
    var btn = e.target.closest("[data-day]");
    if (!btn) return;
    selectedDay = btn.dataset.day;
    renderHistory();
    $("day-card").scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  $("sel-edit").addEventListener("click", function () {
    openDay(selectedDay);
  });

  // ---------- edit a day (sheet) ----------
  // Lets you add forgotten water or remove a mistake.
  var openDayKey = null;

  function renderDaySheet() {
    var key = openDayKey;
    var entries = state.days[key] || [];
    var total = dayTotalMl(key);
    $("day-title").textContent = longDate(key);
    $("day-summary").innerHTML = "<b>" + litres(total) + " L</b> of " + litres(dayGoalMl(key)) + " L" +
      (goalMet(key) ? ' <span class="check">✓</span>' : "");
    $("day-drinks").innerHTML = entries.length
      ? entries.map(function (drink, i) {
          var ml = mlOf(drink);
          var t = timeOf(drink);
          return '<li><span>' + (t ? '<time>' + clock(t) + "</time>" : "") + ml + ' ml</span><button data-remove="' + i + '" aria-label="Remove ' + ml + ' ml">×</button></li>';
        }).join("")
      : '<li class="drinks-empty">No water logged this day.</li>';
  }

  function openDay(key) {
    openDayKey = key;
    $("day-custom-ml").value = "";
    renderDaySheet();
    openSheet("day-sheet");
  }

  function changeDay(key, change) {
    var entries = state.days[key] || [];
    change(entries);
    if (entries.length) {
      state.days[key] = entries;
      if (!state.dayGoals[key]) state.dayGoals[key] = state.goal;
    } else {
      delete state.days[key];
    }
    prune();
    save();
    render();
    renderHistory();
    renderDaySheet();
  }

  // Water added to today gets the current time; water added to a past day has no time.
  function addToDay(ml) {
    ml = Math.round(ml);
    if (!(ml > 0)) return;
    var drink = openDayKey === todayKey() ? { ml: ml, t: Date.now() } : { ml: ml };
    changeDay(openDayKey, function (entries) { entries.push(drink); });
  }

  $("day-drinks").addEventListener("click", function (e) {
    var btn = e.target.closest("[data-remove]");
    if (!btn) return;
    var i = Number(btn.dataset.remove);
    changeDay(openDayKey, function (entries) { entries.splice(i, 1); });
  });

  document.querySelectorAll("[data-day-ml]").forEach(function (btn) {
    btn.addEventListener("click", function () { addToDay(Number(btn.dataset.dayMl)); });
  });

  $("day-custom-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var ml = Number($("day-custom-ml").value);
    if (ml > 0 && ml <= 5000) {
      addToDay(ml);
      $("day-custom-ml").value = "";
      $("day-custom-ml").blur();
    } else {
      $("day-custom-ml").focus();
    }
  });

  // ---------- tabs ----------

  function showTab(name) {
    $("intake").hidden = name !== "intake";
    $("history").hidden = name !== "history";
    $("toast").hidden = true;
    $("tabbar").dataset.active = name;
    document.querySelectorAll("[data-tab]").forEach(function (btn) {
      var active = btn.dataset.tab === name;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", String(active));
    });
    if (name === "history") {
      shownMonth = new Date();
      shownMonth.setDate(1);
      selectedDay = todayKey();
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
