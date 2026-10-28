# Water

A very simple iPhone app for tracking how much water you drink each day.

- White screen with a water bottle that fills up as you drink.
- The bottle represents your daily goal. The marks on its side show every 0.5 L.
- **+ Add water** adds a quick amount (100–750 ml) or any amount you type in.
- The **target** button (bottom left) sets your daily goal (0.5–6 L).
- The **undo** button (bottom right) removes the last drink if you made a mistake.
- Starts from an empty bottle every new day.
- The **calendar** button (top left) opens your history: day streak, 7-day average,
  a month calendar where each day fills with water, and a list of every day with how much you drank.
- Everything is saved on the phone. No account, works offline.

It's a web app: plain HTML/CSS/JavaScript with no build step. You add it to your
iPhone home screen from Safari, and after that it opens full-screen like a normal app.

## Put it on your iPhone

1. Host this folder anywhere that serves HTTPS. The easiest is GitHub Pages:
   repo **Settings → Pages → Deploy from a branch**, pick the branch and `/ (root)`.
   The app will be at `https://<user>.github.io/<repo>/water-tracker/`.
2. Open that link in **Safari** on the iPhone.
3. Tap **Share → Add to Home Screen → Add**.

## Reminders

The bell (top right) turns on reminders to drink: one every 1.5–2 hours, at random,
only between the hours you pick. Needs iOS 16.4 or newer.

A web app can't wake itself up on iPhone, so the reminders are sent by GitHub Actions
(`.github/workflows/water-reminders.yml` running `reminders/send.js` every 10 minutes).
The messages are in `reminders/messages.json`.

One-time setup:

1. The workflow must be on the repo's **default branch**. GitHub only runs schedules from there.
2. Repo **Settings → Secrets and variables → Actions → New repository secret**:
   name `VAPID_PRIVATE_KEY`, value = the private key that pairs with `VAPID_PUBLIC_KEY` in `app.js`.
3. On the iPhone, open the app from the home screen, tap the bell, pick your hours,
   tap **Turn on reminders**, allow notifications, then tap **Copy code**.
4. Add another secret: name `REMINDER_CODE`, value = the copied code.
5. Test it: **Actions → Water reminders → Run workflow**. A reminder arrives right away.

If you change your hours, do steps 3–4 again (update the `REMINDER_CODE` secret).
If a run fails saying the phone is no longer subscribed, do the same.

## Try it on a computer

```bash
cd water-tracker
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The screen: numbers, bottle, buttons, and the two pop-up sheets |
| `style.css` | Look and layout |
| `app.js` | Logic: adding water, goal, undo, history page, reminders, saving, new-day reset |
| `sw.js` | Makes it work offline. Bump `CACHE` when you change files |
| `manifest.json`, `icons/` | Home screen name and icon |
