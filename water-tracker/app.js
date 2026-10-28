(function () {
  "use strict";

  var STORAGE_KEY = "water-tracker-v1";
  var MIN_GOAL = 0.5;
  var MAX_GOAL = 6;
  var GOAL_STEP = 0.25;

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

  function todayKey() {
    var d = new Date();
    var pad = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  // Keep the last 60 days only, so storage never grows forever.
  function prune() {
    var keys = Object.keys(state.days).sort();
    while (keys.length > 60) delete state.days[keys.shift()];
  }

  var state = load();

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
    save();
    render();
    closeSheets();
    toast("Goal set to " + draftGoal + " L");
  });

  // ---------- new day ----------

  // When the app comes back from the background on a new day, show the fresh (empty) bottle.
  var shownDay = todayKey();
  function checkNewDay() {
    if (todayKey() !== shownDay) {
      shownDay = todayKey();
      render();
    }
  }
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) checkNewDay();
  });
  setInterval(checkNewDay, 60 * 1000);

  // ---------- start ----------

  render();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }
})();
