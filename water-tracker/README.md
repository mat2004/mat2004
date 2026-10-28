# Water

A very simple iPhone app for tracking how much water you drink each day.

- White screen with a water bottle that fills up as you drink.
- The bottle represents your daily goal. The marks on its side show every 0.5 L.
- **+ Add water** adds a quick amount (100–750 ml) or any amount you type in.
- The **target** button (bottom left) sets your daily goal (0.5–6 L).
- The **undo** button (bottom right) removes the last drink if you made a mistake.
- Starts from an empty bottle every new day.
- Everything is saved on the phone. No account, works offline.

It's a web app: plain HTML/CSS/JavaScript with no build step. You add it to your
iPhone home screen from Safari, and after that it opens full-screen like a normal app.

## Put it on your iPhone

1. Host this folder anywhere that serves HTTPS. The easiest is GitHub Pages:
   repo **Settings → Pages → Deploy from a branch**, pick the branch and `/ (root)`.
   The app will be at `https://<user>.github.io/<repo>/water-tracker/`.
2. Open that link in **Safari** on the iPhone.
3. Tap **Share → Add to Home Screen → Add**.

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
| `app.js` | Logic: adding water, goal, undo, saving, new-day reset |
| `sw.js` | Makes it work offline. Bump `CACHE` when you change files |
| `manifest.json`, `icons/` | Home screen name and icon |
