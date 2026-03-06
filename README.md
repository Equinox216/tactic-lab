# ⚽ Bandidos Tactic Lab — PWA

A Football 7 Tactical Simulator. Drag players, assign roles, plan phases & set pieces. Works offline as an installable PWA.

## 🚀 Deploying to GitHub Pages

### 1. Create a GitHub repo

Go to [github.com/new](https://github.com/new) and create a new **public** repo (e.g. `tactic-lab`).

### 2. Update the base path

Open `vite.config.js` and change `BASE_PATH` to match your repo name:

```js
// vite.config.js
const BASE_PATH = '/tactic-lab/'   // ← change this to '/YOUR-REPO-NAME/'
```

### 3. Install dependencies

```bash
npm install
```

### 4. Test locally

```bash
npm run dev
```

Open [http://localhost:5173/tactic-lab/](http://localhost:5173/tactic-lab/) in your browser.

### 5. Deploy

```bash
npm run deploy
```

This builds the app and pushes to the `gh-pages` branch automatically.

### 6. Enable GitHub Pages

- Go to your repo → **Settings** → **Pages**
- Set **Source** to `Deploy from a branch`
- Set **Branch** to `gh-pages` / `/ (root)`
- Click **Save**

After ~60 seconds your app will be live at:
```
https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/
```

---

## 📱 Installing as PWA

On **mobile** (Chrome/Safari): tap the browser menu → "Add to Home Screen"  
On **desktop** (Chrome/Edge): click the install icon in the address bar

Once installed, the app works fully **offline**.

---

## 🛠 Local Development

```bash
npm install     # install deps
npm run dev     # dev server with hot reload
npm run build   # production build → dist/
npm run preview # preview the production build locally
```

---

## 📁 Project Structure

```
tactic-lab/
├── public/
│   └── icons/          # App icons (192px, 512px, SVG favicon)
├── src/
│   ├── main.jsx        # React entry point
│   └── App.jsx         # Full tactical simulator component
├── index.html          # HTML shell
├── vite.config.js      # Vite + PWA config (update BASE_PATH here)
└── package.json
```

---

## ✨ Features

- Drag-and-drop player positioning on a 7-a-side pitch
- Multiple formations (2-3-1, 3-2-1, Diamond, etc.)
- 3-phase tactical planning with animation
- Set piece editor (corners, free kicks, throw-ins, goal kicks)
- Player roles (primary + secondary), instructions, movement presets
- Freehand zone drawing per player
- Opponent team with marking assignments
- Team shape stats (width, depth, avg spacing, defensive line)
- Export/Import tactics as JSON
- Fully offline-capable PWA — installable on any device

## Tech Stack

- React 18
- D3 (convex hull + geometry)
- Vite + vite-plugin-pwa
- Deployed via gh-pages
