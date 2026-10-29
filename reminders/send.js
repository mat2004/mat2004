// Sends water reminders to the phone when they're due, plus one creatine reminder a day.
// GitHub Actions runs this every ~10 minutes (see .github/workflows/water-reminders.yml).
//
// Usage: node send.js <state.json>
// Secrets (env): VAPID_PRIVATE_KEY, REMINDER_CODE (copied from the app's Reminders screen).
// FORCE=true sends a water reminder right away, ignoring the schedule (used for testing).
// FORCE_CREATINE=true sends the creatine reminder right away.

"use strict";

const fs = require("fs");
const path = require("path");
const webpush = require("web-push");

// Must match VAPID_PUBLIC_KEY in water-tracker/app.js.
const VAPID_PUBLIC_KEY = "BD7PeS3r7QaKA6pfj01DFfQEQRFFDBRz9ytluVbKRkr_csL06DvnMFe9Lki76yictDFhxYGHS8GCed_quWA4sQw";

// Random gap between two reminders, in minutes.
const MIN_GAP = 90;
const MAX_GAP = 120;

// The first reminder of the day comes up to this many minutes after the "from" time.
const FIRST_DELAY_MAX = 30;

// Don't repeat any of the last few messages.
const NO_REPEAT = 5;

// Daily creatine reminder, on the phone's clock. If GitHub's runs are late it can still
// go out until CREATINE_UNTIL; after that it's skipped for the day rather than sent at night.
const CREATINE_AT = "19:00";
const CREATINE_UNTIL = "21:00";
const CREATINE_MESSAGE = "Time for your creatine 💪 Take it with a glass of water.";

const MINUTE = 60 * 1000;

function randomMinutes(min, max) {
  return (min + Math.random() * (max - min)) * MINUTE;
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function localMinutes(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return get("hour") * 60 + get("minute");
}

// True when it's between "from" and "to" on the phone's clock. Handles windows past midnight.
function isAwake(now, code) {
  const mins = localMinutes(now, code.tz);
  const from = toMinutes(code.from);
  const to = toMinutes(code.to);
  return from <= to ? mins >= from && mins < to : mins >= from || mins < to;
}

function pickMessage(messages, recent) {
  const fresh = messages.map((_, i) => i).filter((i) => !recent.includes(i));
  const pool = fresh.length ? fresh : messages.map((_, i) => i);
  return pool[Math.floor(Math.random() * pool.length)];
}

// The phone's date, like 2026-10-28.
function localDate(date, timeZone) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function fmt(ms, timeZone) {
  return new Date(ms).toLocaleTimeString("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" });
}

async function main() {
  const stateFile = process.argv[2];
  const force = process.env.FORCE === "true";
  const forceCreatine = process.env.FORCE_CREATINE === "true";

  if (!process.env.VAPID_PRIVATE_KEY || !process.env.REMINDER_CODE) {
    console.log("Reminders are not set up yet (missing VAPID_PRIVATE_KEY or REMINDER_CODE secret).");
    return;
  }

  const code = JSON.parse(process.env.REMINDER_CODE);
  const messages = JSON.parse(fs.readFileSync(path.join(__dirname, "messages.json"), "utf8"));
  let state = {};
  try {
    state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  } catch (e) {}
  state.recent = state.recent || [];

  const now = Date.now();
  const save = () => fs.writeFileSync(stateFile, JSON.stringify(state, null, 2) + "\n");
  webpush.setVapidDetails("https://github.com/mat2004/mat2004", VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

  const send = async (payload) => {
    try {
      await webpush.sendNotification(code.s, JSON.stringify(payload), { TTL: 30 * 60 });
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        console.error("The phone is no longer subscribed. Open the app, tap the bell, turn reminders on again and update the REMINDER_CODE secret.");
      } else {
        console.error("Sending failed:", err.statusCode || "", err.body || err.message);
      }
      process.exit(1);
    }
  };

  // Creatine: once a day at CREATINE_AT, whatever the water reminder hours are.
  const today = localDate(new Date(now), code.tz);
  const mins = localMinutes(new Date(now), code.tz);
  const creatineDue = state.creatineSentOn !== today && mins >= toMinutes(CREATINE_AT) && mins < toMinutes(CREATINE_UNTIL);
  if (forceCreatine || (!force && creatineDue)) {
    await send({ title: "Creatine", body: CREATINE_MESSAGE, tag: "creatine-reminder" });
    if (!forceCreatine) state.creatineSentOn = today;
    // Don't let a water reminder land at the same moment.
    if (state.nextAt && state.nextAt < now + 15 * MINUTE) state.nextAt = now + 15 * MINUTE;
    save();
    console.log("Sent the creatine reminder.");
    if (forceCreatine) return;
  }

  if (!force) {
    if (!isAwake(new Date(now), code)) {
      console.log(`Outside reminder hours (${code.from}–${code.to} ${code.tz}).`);
      if (state.nextAt) {
        state.nextAt = null;
        save();
      }
      return;
    }
    if (!state.nextAt) {
      // First reminder of the day: up to FIRST_DELAY_MAX minutes after the "from" time.
      // GitHub sometimes runs this hours late; if that moment has already passed, send now.
      const sinceStart = (mins - toMinutes(code.from) + 24 * 60) % (24 * 60);
      state.nextAt = now + Math.max(0, randomMinutes(0, FIRST_DELAY_MAX) - sinceStart * MINUTE);
      if (state.nextAt > now) {
        save();
        console.log(`First reminder today at ${fmt(state.nextAt, code.tz)}.`);
        return;
      }
    }
    if (now < state.nextAt) {
      console.log(`Next reminder at ${fmt(state.nextAt, code.tz)}.`);
      return;
    }
  }

  const index = pickMessage(messages, state.recent);
  await send({ title: "Water", body: messages[index], tag: "water-reminder" });

  state.lastSentAt = now;
  state.nextAt = now + randomMinutes(MIN_GAP, MAX_GAP);
  state.recent = [index].concat(state.recent).slice(0, NO_REPEAT);
  save();
  console.log(`Sent: "${messages[index]}". Next reminder at ${fmt(state.nextAt, code.tz)}.`);
}

main();
