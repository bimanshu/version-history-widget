# Habit 30

A 30-day habit tracker for your phone. The challenge runs from **Thursday, October 1** to
**Friday, October 30, 2026**. You can change the start date in **Setup**.

- Check off each habit with one tap. Days you've done everything get a confetti burst.
- Streaks, completion percentage, and "perfect days" for each habit and overall.
- A 30-day calendar heatmap. Tap any past day to fill in a check-in you missed.
- Works offline once installed. Your data is kept on your phone only (browser storage)
  and is never uploaded.
- Save a backup to a JSON file and restore it later from **Setup → Your data**.
- Follows your phone's light or dark mode.
- An optional large iPhone Home Screen widget (see below).

It's plain HTML, CSS, and JS with no build step and no dependencies.

## Put it on your phone

The app has to be opened once from an `https://` address. After that it's cached on the
phone and runs offline. The easiest free way is GitHub Pages:

1. On GitHub, open the repo's **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**. Pick the branch that has
   this folder and **/ (root)**, then click **Save**.
3. After about a minute, open this address on your phone:
   **https://bimanshu.github.io/version-history-widget/habit-tracker/**
4. Add it to your home screen:
   - **iPhone (Safari):** tap **Share**, then **Add to Home Screen**.
   - **Android (Chrome):** tap **Install** in the app's banner, or use **⋮ → Add to Home
     screen / Install app**.

Open it from the home-screen icon from then on. It opens full-screen like a normal app and
works in airplane mode.

> Your check-ins are stored in the browser that installed the app. Clearing that browser's
> site data, or opening the app in a different browser, starts you from zero. Use
> **Save backup** now and then to keep a copy.

## iPhone Home Screen widget

iOS only allows widgets from App Store apps, so the widget runs in
[Scriptable](https://apps.apple.com/app/scriptable/id1405459188), a free app that runs small
JavaScript widgets. The large widget shows the day you're on, today's check-ins with a
progress ring, a 30-day heatmap, completion %, perfect days, streak, and days left.

1. Install **Scriptable** from the App Store.
2. In Habit 30, open **Setup → iPhone widget** and tap **Copy widget script**. In
   Scriptable, tap **＋**, paste, then tap the name at the top and rename it to **Habit30**.
   (The script is [`scriptable-widget.js`](scriptable-widget.js) if you'd rather copy it
   from here.)
3. Touch and hold your Home Screen, tap **Edit → Add Widget**, choose **Scriptable**, pick
   the **large** size, and add it. Touch and hold the widget, tap **Edit Widget**, and set
   **Script** to **Habit30**.
4. Back in Habit 30, tap **Update widget**. This opens Scriptable with your progress, which
   the script saves for the widget. Tap **◀** in the top-left corner to go back.

The widget can't read the app's storage directly, so check-ins reach it only when you tap
**Update widget**. After you check in, the Today screen shows a "Your widget is behind"
button. The day counter moves on by itself at midnight. iOS decides exactly when widgets
redraw, so changes can take a few minutes to appear.

## Try it on a computer

```bash
npx serve habit-tracker
# or: python3 -m http.server -d habit-tracker 8000
```

Then open the printed `localhost` address. To get the phone layout, use your browser's
device toolbar.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The whole app: markup, styles, and logic |
| `sw.js` | Service worker that caches the app so it works offline |
| `scriptable-widget.js` | Home Screen widget script for the Scriptable app |
| `manifest.webmanifest` | Lets the phone install it with a name and icon |
| `icon*.png`, `icon.svg`, `apple-touch-icon.png` | App icons |

If you change `index.html`, the installed app picks up the new version the next time it's
opened while online. If you add new files, list them in `ASSETS` in `sw.js` and bump
`CACHE` (for example to `habit30-v2`).
