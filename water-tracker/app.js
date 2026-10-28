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

  // ---------- no zooming ----------

  // iOS ignores user-scalable=no, so block pinch-zoom here.
  document.addEventListener("gesturestart", function (e) { e.preventDefault(); });

  // ---------- start ----------

  render();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }
})();
