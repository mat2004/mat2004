# Glow-Up OS

A personal system for getting your life together when you're busy (work + uni), a bit lazy, and disorganised.

It has three parts:

| Part | What it is | Where |
|---|---|---|
| **The app** | Daily habits, grooming reminders, tasks, a social challenge ladder, a weekly free-time map and a monthly budget with a wishlist. It has XP and streaks, and an "Ask Claude" button on almost everything. | [`app/index.html`](app/index.html), and the published link (see below) |
| **The plan** | A 12-week game plan, split into phases so you don't try to change everything at once. | [`PLAN.md`](PLAN.md) |
| **The guides** | Short, practical how-tos for grooming, clothes, fragrance, social life, money and using Claude as your assistant. | [`guides/`](guides/) |

`CLAUDE.md` sets Claude up as your coach whenever you open this repo with Claude Code.

## How to use it (the short version)

**Every day (5 minutes total)**
1. Open the app and look at **Next smallest step** on the Today tab. Do that one thing.
2. Tick off habits as you do them. You need 60% to keep your streak going.
3. Before bed, lay out tomorrow's outfit and take 2 minutes to plan tomorrow.

**Every Sunday (30 minutes, the "Sunday reset")**
1. **Week tab:** check your hours are still right. See how much free time you have.
2. Press **Build my weekly schedule** and put 2 to 3 social things into your calendar.
3. **Style tab:** do anything that's due (laundry, trims, sheets).
4. **Tasks tab:** dump everything in your head into tasks and give each one a date.

**Every payday**
1. **Budget tab:** press **Payday**. It adds your monthly upgrade fund to your wishlist, top priority first.
2. Buy something only when it shows **ready to buy**.

## Where Claude fits in

Every task in the app has two buttons:

- **Break into steps** asks Claude right inside the app (when you open it on claude.ai). Claude splits the task into small steps and says which parts it can do for you.
- **Open in Claude** opens a new Claude chat with the request already written. This works everywhere.

Tasks Claude is especially good at for you:

- planning your week around work and classes
- writing messages, like inviting someone out or replying to a group chat you've ignored
- picking outfits from what you own, choosing a haircut, choosing a first fragrance
- study plans before exams
- checking your budget and the order to buy things in
- breaking a task you've been avoiding into 10-minute pieces

There are more ready-made requests in [`guides/claude-prompts.md`](guides/claude-prompts.md).

## Running the app

- **Easiest:** open the published claude.ai link. Your data is saved to your Claude account, so it works on your phone and laptop. Add it to your phone's home screen.
- **Offline / local:** open `app/index.html` in a browser. Data is saved in that browser only, so use **Settings → Copy backup** now and then.
- **GitHub Pages (optional):** Settings → Pages → deploy from branch, folder `/app`.
