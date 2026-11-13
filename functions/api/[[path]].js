// Cloudflare Pages Function: handles every request to /api/*
// Bindings needed (Pages project > Settings): D1 database bound as DB,
// environment variable (secret) TEACHER_PASSWORD.
import { DEFAULT_CONFIG } from '../_lib/defaults.js';

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
});
const bad = (msg, status = 400) => json({ error: msg }, status);

let schemaReady = false;
async function ensureSchema(db) {
  if (schemaReady) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      partner TEXT DEFAULT '',
      pass_hash TEXT NOT NULL, salt TEXT NOT NULL,
      state TEXT, rev INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1, approval REAL DEFAULT 0, miles INTEGER DEFAULT 0, days INTEGER DEFAULT 0,
      party INTEGER DEFAULT 2, money REAL DEFAULT 0, phase TEXT DEFAULT '', finished INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY, role TEXT NOT NULL, student_id INTEGER, expires_at INTEGER NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`)
  ]);
  schemaReady = true;
}

// ---------- crypto helpers ----------
const hex = (buf) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const unhex = (h) => new Uint8Array(h.match(/.{2}/g).map(x => parseInt(x, 16)));
async function hashPassword(pw, saltHex) {
  const salt = saltHex ? unhex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256);
  return { hash: hex(bits), salt: hex(salt) };
}
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
const newToken = () => hex(crypto.getRandomValues(new Uint8Array(32)));

// ---------- config ----------
function isObj(x) { return x && typeof x === 'object' && !Array.isArray(x); }
function merge(base, over) {
  if (over === undefined) return structuredClone(base);
  if (Array.isArray(base) && Array.isArray(over)) {
    // arrays of objects with the same length (levels) merge item by item; others are replaced
    if (base.length === over.length && base.every(isObj)) return base.map((b, i) => merge(b, over[i]));
    return structuredClone(over);
  }
  if (isObj(base) && isObj(over)) {
    const out = {};
    for (const k of new Set([...Object.keys(base), ...Object.keys(over)])) out[k] = k in base ? merge(base[k], over[k]) : structuredClone(over[k]);
    return out;
  }
  return over;
}
async function getConfig(db) {
  const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind('config').first();
  let stored; try { stored = row ? JSON.parse(row.value) : undefined; } catch { stored = undefined; }
  return merge(DEFAULT_CONFIG, stored);
}
function publicConfig(cfg) {
  const c = structuredClone(cfg);
  c.levels.forEach(l => { l.hasPassword = !!l.password && !l.gateOpen; delete l.password; });
  return c;
}

// ---------- sessions ----------
async function createSession(db, role, studentId) {
  const token = newToken();
  const ttl = role === 'teacher' ? 12 * 3600e3 : 30 * 24 * 3600e3;
  await db.prepare('INSERT INTO sessions (token, role, student_id, expires_at) VALUES (?,?,?,?)')
    .bind(token, role, studentId ?? null, Date.now() + ttl).run();
  return token;
}
async function getSession(db, request) {
  const h = request.headers.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return null;
  const s = await db.prepare('SELECT * FROM sessions WHERE token = ?').bind(token).first();
  if (!s || s.expires_at < Date.now()) return null;
  return s;
}

function summarize(state) {
  const s = state || {};
  const run = s.run || {};
  const p = s.pts || {};
  const approval = ['journal', 'mapping', 'diplomacy', 'time', 'bonus', 'deaths', 'survival', 'teacher']
    .reduce((t, k) => t + (Number(p[k]) || 0), 0);
  return {
    level: s.level || 1, approval: Math.round(approval * 10) / 10, miles: Math.round(run.miles || 0), days: run.days || 0,
    party: s.party ?? 2, money: s.money ?? 0, phase: s.phase || '', finished: s.finished ? 1 : 0
  };
}
async function saveState(db, id, state, rev) {
  const sum = summarize(state);
  await db.prepare(`UPDATE students SET state=?, rev=?, level=?, approval=?, miles=?, days=?, party=?, money=?, phase=?, finished=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .bind(JSON.stringify(state), rev, sum.level, sum.approval, sum.miles, sum.days, sum.party, sum.money, sum.phase, sum.finished, id).run();
}
const cleanName = (s, max = 40) => String(s || '').replace(/[<>]/g, '').trim().slice(0, max);

// ---------- router ----------
export async function onRequest(ctx) {
  const { request, env, params } = ctx;
  if (!env.DB) return bad('The D1 database is not bound. In Cloudflare Pages > Settings > Bindings, add a D1 binding named DB.', 500);
  const db = env.DB;
  const path = '/' + (params.path || []).join('/');
  const method = request.method;
  let body = {};
  if (method !== 'GET' && method !== 'DELETE') { try { body = await request.json(); } catch { body = {}; } }

  try {
    await ensureSchema(db);

    // ----- public / student -----
    if (path === '/register' && method === 'POST') {
      const username = cleanName(body.username, 30);
      const password = String(body.password || '');
      if (username.length < 2) return bad('Explorer name must be at least 2 characters.');
      if (password.length < 4) return bad('Password must be at least 4 characters.');
      const exists = await db.prepare('SELECT id FROM students WHERE username = ?').bind(username).first();
      if (exists) return bad('That explorer name is already taken. Try adding your last initial.');
      const { hash, salt } = await hashPassword(password);
      const r = await db.prepare('INSERT INTO students (username, partner, pass_hash, salt, state) VALUES (?,?,?,?,NULL)')
        .bind(username, cleanName(body.partner), hash, salt).run();
      const id = r.meta.last_row_id;
      return json({ token: await createSession(db, 'student', id) });
    }
    if (path === '/login' && method === 'POST') {
      const username = cleanName(body.username, 30);
      const row = await db.prepare('SELECT * FROM students WHERE username = ?').bind(username).first();
      if (!row) return bad('No explorer with that name. Check the spelling or create a new explorer.', 401);
      const { hash } = await hashPassword(String(body.password || ''), row.salt);
      if (!safeEqual(hash, row.pass_hash)) return bad('Wrong password for that explorer.', 401);
      return json({ token: await createSession(db, 'student', row.id) });
    }
    if (path === '/admin/login' && method === 'POST') {
      if (!env.TEACHER_PASSWORD) return bad('TEACHER_PASSWORD is not set. Add it in Cloudflare Pages > Settings > Variables and Secrets.', 500);
      if (!safeEqual(String(body.password || ''), env.TEACHER_PASSWORD)) return bad('Wrong teacher password.', 401);
      return json({ token: await createSession(db, 'teacher') });
    }

    const session = await getSession(db, request);
    if (path === '/logout' && method === 'POST') {
      if (session) await db.prepare('DELETE FROM sessions WHERE token = ?').bind(session.token).run();
      return json({ ok: true });
    }
    if (!session) return bad('Please log in again.', 401);

    if (session.role === 'student') {
      const me = await db.prepare('SELECT * FROM students WHERE id = ?').bind(session.student_id).first();
      if (!me) return bad('Explorer not found.', 401);

      if (path === '/me' && method === 'GET') {
        const cfg = await getConfig(db);
        return json({
          student: { id: me.id, username: me.username, partner: me.partner },
          state: me.state ? JSON.parse(me.state) : null, rev: me.rev, config: publicConfig(cfg)
        });
      }
      if (path === '/state' && method === 'PUT') {
        if (!isObj(body.state)) return bad('Missing game state.');
        if (Number(body.rev) !== Number(me.rev)) {
          // the teacher changed this explorer; send the fresh copy back
          return json({ conflict: true, state: me.state ? JSON.parse(me.state) : null, rev: me.rev }, 409);
        }
        const rev = me.rev + 1;
        await saveState(db, me.id, body.state, rev);
        return json({ ok: true, rev });
      }
      if (path === '/unlock' && method === 'POST') {
        const cfg = await getConfig(db);
        const lvl = cfg.levels[Number(body.level) - 1];
        if (!lvl) return bad('Unknown level.');
        if (lvl.gateOpen || !lvl.password) return json({ ok: true });
        if (String(body.code || '').trim().toLowerCase() !== String(lvl.password).trim().toLowerCase())
          return bad('That level code is not right. Check with your teacher.', 403);
        return json({ ok: true });
      }
      if (path === '/leaderboard' && method === 'GET') {
        const { results } = await db.prepare('SELECT username, partner, level, approval, finished FROM students ORDER BY approval DESC, level DESC LIMIT 100').all();
        return json({ rows: results, me: me.username });
      }
      return bad('Not found.', 404);
    }

    // ----- teacher -----
    if (session.role !== 'teacher') return bad('Teacher access only.', 403);

    if (path === '/admin/config' && method === 'GET') return json({ config: await getConfig(db), defaults: DEFAULT_CONFIG });
    if (path === '/admin/config' && method === 'PUT') {
      if (!isObj(body.config)) return bad('Missing config.');
      await db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
        .bind('config', JSON.stringify(body.config)).run();
      return json({ ok: true, config: await getConfig(db) });
    }
    if (path === '/admin/config/reset' && method === 'POST') {
      await db.prepare('DELETE FROM settings WHERE key = ?').bind('config').run();
      return json({ ok: true, config: await getConfig(db) });
    }
    if (path === '/admin/students' && method === 'GET') {
      const { results } = await db.prepare('SELECT id, username, partner, level, approval, miles, days, party, money, phase, finished, updated_at FROM students ORDER BY username').all();
      return json({ rows: results });
    }
    if (path === '/admin/students' && method === 'POST') {
      const username = cleanName(body.username, 30);
      const password = String(body.password || '');
      if (username.length < 2 || password.length < 4) return bad('Name needs 2+ characters and password 4+ characters.');
      const exists = await db.prepare('SELECT id FROM students WHERE username = ?').bind(username).first();
      if (exists) return bad('That explorer name already exists.');
      const { hash, salt } = await hashPassword(password);
      await db.prepare('INSERT INTO students (username, partner, pass_hash, salt) VALUES (?,?,?,?)').bind(username, cleanName(body.partner), hash, salt).run();
      return json({ ok: true });
    }
    const m = path.match(/^\/admin\/students\/(\d+)(?:\/(\w+))?$/);
    if (m) {
      const id = Number(m[1]); const action = m[2] || '';
      const row = await db.prepare('SELECT * FROM students WHERE id = ?').bind(id).first();
      if (!row) return bad('Student not found.', 404);
      const state = row.state ? JSON.parse(row.state) : null;

      if (!action && method === 'GET') return json({ student: { id: row.id, username: row.username, partner: row.partner }, state });
      if (!action && method === 'DELETE') {
        await db.batch([db.prepare('DELETE FROM sessions WHERE student_id = ?').bind(id), db.prepare('DELETE FROM students WHERE id = ?').bind(id)]);
        return json({ ok: true });
      }
      if (action === 'password' && method === 'POST') {
        const pw = String(body.password || '');
        if (pw.length < 4) return bad('Password must be at least 4 characters.');
        const { hash, salt } = await hashPassword(pw);
        await db.prepare('UPDATE students SET pass_hash = ?, salt = ? WHERE id = ?').bind(hash, salt, id).run();
        return json({ ok: true });
      }
      if (action === 'adjust' && method === 'POST') {
        if (!state) return bad('This student has not started the game yet.');
        const n = (k) => Number(body[k]) || 0;
        state.money = Math.round(((state.money || 0) + n('money')) * 100) / 100;
        state.pts = state.pts || {};
        state.pts.teacher = (state.pts.teacher || 0) + n('points');
        if (state.run) state.run.maxDays = (state.run.maxDays || 0) + n('days');
        if (n('days') && state.snap?.run) state.snap.run.maxDays += n('days');
        if (n('food')) state.inv.food = Math.max(0, (state.inv.food || 0) + n('food'));
        if (n('water')) state.inv.water = Math.max(0, (state.inv.water || 0) + n('water'));
        if (n('energy') && state.run) state.run.energy = Math.max(1, Math.min(100, (state.run.energy || 0) + n('energy')));
        state.teacherNote = cleanName(body.note, 200) || state.teacherNote;
        await saveState(db, id, state, row.rev + 1);
        return json({ ok: true });
      }
      if (action === 'reset' && method === 'POST') {
        let next = null;
        if (body.scope === 'level') {
          if (!state?.snap) return bad('Nothing to reset yet.');
          next = structuredClone(state.snap); next.snap = structuredClone(state.snap);
          next.pts.teacher = state.pts?.teacher || 0;
        } else if (body.scope === 'jump') {
          if (!state) return bad('This student has not started the game yet.');
          const lv = Math.max(1, Math.min(4, Number(body.level) || 1));
          next = state; next.level = lv; next.phase = 'gate'; next.run = null; next.snap = null; next.finished = false;
          if ((next.party || 0) <= 2) { next.party = 33; next.peakParty = 33; next.crew = next.crew && next.crew !== 'none' && next.crew !== 'trappers' ? next.crew : 'soldiers'; }
        } // scope 'all' -> next stays null (fresh game)
        await saveState(db, id, next || {}, row.rev + 1);
        if (!next) await db.prepare('UPDATE students SET state = NULL WHERE id = ?').bind(id).run();
        return json({ ok: true });
      }
    }
    return bad('Not found.', 404);
  } catch (e) {
    return bad('Server error: ' + (e && e.message ? e.message : String(e)), 500);
  }
}
