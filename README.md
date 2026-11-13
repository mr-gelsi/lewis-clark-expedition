# The Lewis & Clark Expedition — A Corps of Discovery Survival Simulation

A browser game for 8th grade U.S. History. Students lead the Corps of Discovery from Camp Wood to Fort Clatsop across 4 levels, log animals and landmarks in a paper field journal, and earn President Jefferson's approval. Runs on **Cloudflare Pages + D1** (free tier is plenty for a school).

## Folder layout
```
public/            the website (student game = index.html, teacher page = admin.html)
  css/ js/ img/
functions/api/     the server code (Cloudflare Pages Functions)
functions/_lib/    default game settings (codes, prices, rates, quiz)
schema.sql         database tables (optional, created automatically)
wrangler.toml      only for command-line deploys
```

## Setup (about 10 minutes)

1. **GitHub** – Create a new repository (e.g. `lewis-clark-expedition`). Upload everything in this folder, keeping the folder structure (drag the folder contents into "Add file > Upload files").
2. **Create the database** – Cloudflare dashboard > **Storage & Databases > D1** > **Create database**. Name it `lewis-clark-db`.
3. **Create the site** – **Workers & Pages > Create > Pages > Connect to Git**, choose the repository.
   - Framework preset: **None**
   - Build command: *(leave blank)*
   - Build output directory: **`public`**
   - Click **Save and Deploy**.
4. **Connect the database** – Open the Pages project > **Settings > Bindings > Add > D1 database**.
   Variable name: **`DB`** (capital letters), database: `lewis-clark-db`. Save.
5. **Teacher password** – **Settings > Variables and Secrets > Add**. Type: Secret, name **`TEACHER_PASSWORD`**, value: your password. Save.
6. **Redeploy** – **Deployments** > the latest deployment's **⋯** menu > **Retry deployment** (bindings and secrets only take effect after a new deploy).
7. Visit `https://<your-project>.pages.dev` for the game and `https://<your-project>.pages.dev/admin.html` for the teacher page.

Tables are created automatically on the first request. (To create them by hand: D1 > your database > Console, paste `schema.sql`.)

## Before class
On the teacher page:
- **Levels & codes** – Level 1's code is `828000`. Levels 2–4 start as `MANDAN`, `FALLS`, `NEZPERCE`; change them. Tick "Gate open" to release a level with no code.
- **Game-wide** – change the starting grant or how many real seconds a travel day takes.
- Press **Save settings**. Students get new settings the next time they load the page.

## During class
- **Students** tab: see each team's level, day, miles, party size, funds and approval.
- **Adjust** – award approval points for great journal entries or maps, add money/days/food/water/energy, or leave a note students see at their starting location.
- **More** – restart a level, move a student to the start of a level (for absences), reset a password, erase progress, delete.

## How scoring works
Jefferson's approval = Journal (5 animals, 30) + Mapping (8 landmarks, 25; +1 each with survey equipment) + Diplomacy (4 achievements, 20) + Survival bonus at the end (up to 15) + Time efficiency (+1 per 5 unused days per level) + decision points (funeral, saving Sacagawea, the vote, helping trappers, recruiting guides) − 1 per crew member lost + teacher points. All values are editable.

## Updating the game
Edit files in GitHub; Cloudflare redeploys automatically in about a minute. Student progress is kept in D1 and is not affected.
