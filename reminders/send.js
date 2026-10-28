// Sends one water reminder to the phone when it's due.
// GitHub Actions runs this every ~10 minutes (see .github/workflows/water-reminders.yml).
//
// Usage: node send.js <state.json>
// Secrets (env): VAPID_PRIVATE_KEY, REMINDER_CODE (copied from the app's Reminders screen).
// FORCE=true sends a reminder right away, ignoring the schedule (used for testing).

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

function fmt(ms, timeZone) {
  return new Date(ms).toLocaleTimeString("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" });
}

async function main() {
  const stateFile = process.argv[2];
  const force = process.env.FORCE === "true";

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
      state.nextAt = now + randomMinutes(0, FIRST_DELAY_MAX);
      save();
      console.log(`First reminder today at ${fmt(state.nextAt, code.tz)}.`);
      return;
    }
    if (now < state.nextAt) {
      console.log(`Next reminder at ${fmt(state.nextAt, code.tz)}.`);
      return;
    }
  }

  const index = pickMessage(messages, state.recent);
  webpush.setVapidDetails("https://github.com/mat2004/mat2004", VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

  try {
    await webpush.sendNotification(code.s, JSON.stringify({ title: "Water", body: messages[index] }), { TTL: 30 * 60 });
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) {
      console.error("The phone is no longer subscribed. Open the app, tap the bell, turn reminders on again and update the REMINDER_CODE secret.");
    } else {
      console.error("Sending failed:", err.statusCode || "", err.body || err.message);
    }
    process.exit(1);
  }

  state.lastSentAt = now;
  state.nextAt = now + randomMinutes(MIN_GAP, MAX_GAP);
  state.recent = [index].concat(state.recent).slice(0, NO_REPEAT);
  save();
  console.log(`Sent: "${messages[index]}". Next reminder at ${fmt(state.nextAt, code.tz)}.`);
}

main();
