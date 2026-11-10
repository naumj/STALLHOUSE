'use strict';
/*
 * Stallhouse server. No dependencies, needs Node 18 or newer.
 *   node server.js
 * Serves the shop at /, the admin at /admin, and a small JSON API.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1');
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PUB = path.join(__dirname, 'public');
const MAX_BODY = 100 * 1024;
const SESSION_MS = 8 * 60 * 60 * 1000;

const DB_FILE = path.join(DATA_DIR, 'db.json');
const AUTH_FILE = path.join(DATA_DIR, 'auth.json');
fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });

/* ---------------- data ---------------- */
const SEED = [
  ['p01', 'Arc Desk Lamp', 'HM-1001', 'Home', 64, 85, 18, 'lamp', 38, 'Weighted base, dimmable warm light, and an arm that stays where you put it.'],
  ['p02', 'Stoneware Mug Set', 'KT-2002', 'Kitchen', 28, 0, 42, 'mug', 18, 'Four glazed 350 ml mugs that stack neatly and go in the dishwasher.'],
  ['p03', 'Studio Headphones', 'TC-3003', 'Tech', 129, 169, 4, 'headphones', 230, 'Closed-back, 40-hour battery, and a cable for when the battery runs out.'],
  ['p04', 'Daypack 22L', 'OD-4004', 'Outdoors', 79, 0, 26, 'backpack', 150, 'Water-resistant shell with a padded laptop sleeve and a hidden back pocket.'],
  ['p05', 'Lounge Chair', 'HM-1005', 'Home', 240, 0, 7, 'chair', 12, 'Solid ash frame and a deep wool-blend seat. Assembles in ten minutes.'],
  ['p06', 'Trailing Pothos', 'HM-1006', 'Home', 24, 0, 35, 'plant', 130, 'Forgiving, happy in low light, and ships in a 12 cm pot.'],
  ['p07', 'Court Sneaker', 'FS-5007', 'Fashion', 95, 0, 22, 'sneaker', 340, 'Leather upper, cushioned insole, and a sole that grips indoor courts.'],
  ['p08', 'Field Watch', 'FS-5008', 'Fashion', 149, 189, 9, 'watch', 200, '38 mm steel case, sapphire glass, and a second hand you can read at a glance.'],
  ['p09', 'Pocket Atlas', 'ST-6009', 'Stationery', 18, 0, 60, 'book', 48, 'Fold-out regional maps in a cover small enough for a jacket pocket.'],
  ['p10', 'Gooseneck Kettle', 'KT-2010', 'Kitchen', 58, 0, 14, 'kettle', 195, 'Pour-over control with a temperature dial from 40 to 100 °C.'],
  ['p11', 'Instant Camera', 'TC-3011', 'Tech', 119, 0, 3, 'camera', 280, 'Prints a photo in under a minute. Film is sold separately.'],
  ['p12', 'Steel Bottle 750 ml', 'OD-4012', 'Outdoors', 26, 0, 80, 'bottle', 170, 'Keeps drinks cold for 24 hours or hot for 12. Fits most cup holders.'],
  ['p13', 'Shelf Speaker', 'TC-3013', 'Tech', 89, 0, 16, 'speaker', 260, 'Room-filling sound from a speaker the width of a paperback.'],
  ['p14', 'Two-Person Tent', 'OD-4014', 'Outdoors', 199, 249, 6, 'tent', 25, 'Pitches in five minutes, packs down to 45 cm, and handles steady rain.'],
  ['p15', 'Brass Fountain Pen', 'ST-6015', 'Stationery', 42, 0, 28, 'pen', 45, 'Smooth medium nib that improves with use. Takes standard cartridges.'],
  ['p16', 'Wooden Blocks, 36 pc', 'PL-7016', 'Play', 34, 0, 31, 'blocks', 355, 'Beech blocks in a cotton bag, finished with a non-toxic oil.'],
  ['p17', 'Soy Candle, Cedar', 'WL-8017', 'Wellness', 22, 0, 2, 'candle', 30, 'Hand-poured, burns for 45 hours, scented with cedar and a little smoke.'],
  ['p18', 'Magnesium Balm', 'WL-8018', 'Wellness', 19, 0, 44, 'jar', 150, 'A whipped balm for tired legs and shoulders. 100 ml jar.'],
  ['p19', 'Mechanical Keyboard', 'TC-3019', 'Tech', 99, 129, 12, 'keyboard', 215, 'Hot-swappable switches, an aluminum plate, and a USB-C cable.'],
  ['p20', 'Heavy Cotton Tee', 'FS-5020', 'Fashion', 29, 0, 55, 'shirt', 100, '240 gsm cotton that holds its shape wash after wash.'],
  ['p21', 'Linen Notebook', 'ST-6021', 'Stationery', 14, 0, 70, 'book', 330, '192 dotted pages, a lay-flat spine, and a linen cover in six colors.'],
  ['p22', 'Puzzle, 500 Pieces', 'PL-7022', 'Play', 21, 0, 19, 'blocks', 200, 'Thick-cut pieces with a reference poster inside the box lid.'],
  ['p23', 'Cold Brew Jar', 'KT-2023', 'Kitchen', 31, 0, 11, 'jar', 20, 'Two-liter glass jar with a fine mesh filter. Makes eight cups.'],
  ['p24', 'Slim Studio Bottle', 'WL-8024', 'Wellness', 33, 0, 23, 'bottle', 290, '600 ml bottle with a loop cap that clips to a mat strap.']
];

function seed() {
  const d = {
    settings: { name: 'Stallhouse', email: 'naumjuma63@gmail.com', phone: '0728236852', address: 'Nairobi, Kenya', currency: 'USD', lowStock: 5, freeShipAt: 50, shipFee: 5.95 },
    products: {},
    orders: {}
  };
  const now = new Date().toISOString();
  SEED.forEach(function (s) {
    d.products[s[0]] = { name: s[1], sku: s[2], cat: s[3], price: s[4], was: s[5], stock: s[6], status: 'live', desc: s[9], icon: s[7], hue: s[8], sample: true, updated: now };
  });
  return d;
}
function writeAtomic(file, text, mode) {
  const tmp = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, text, { mode: mode || 0o600 });
  fs.renameSync(tmp, file);
}
let db;
try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) { db = seed(); writeAtomic(DB_FILE, JSON.stringify(db)); }
db.settings = db.settings || seed().settings;
db.products = db.products || {};
db.orders = db.orders || {};
function save() { writeAtomic(DB_FILE, JSON.stringify(db)); }

/* ---------------- auth ---------------- */
function hashPw(pw, salt) { return crypto.scryptSync(pw, salt, 64); }
let auth;
try { auth = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8')); } catch (e) {
  const pw = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
  const salt = crypto.randomBytes(16);
  auth = { salt: salt.toString('hex'), hash: hashPw(pw, salt).toString('hex') };
  writeAtomic(AUTH_FILE, JSON.stringify(auth));
  if (process.env.ADMIN_PASSWORD) console.log('Admin password set from ADMIN_PASSWORD.');
  else console.log('\n  First run. Your admin password is:  ' + pw + '\n  Sign in at /admin, then change it under Shop info. It is shown only once.\n');
}
function checkPw(pw) {
  if (typeof pw !== 'string' || pw.length > 128) return false;
  const h = hashPw(pw, Buffer.from(auth.salt, 'hex'));
  return crypto.timingSafeEqual(h, Buffer.from(auth.hash, 'hex'));
}
const sessions = new Map();
function newSession() {
  const t = crypto.randomBytes(32).toString('base64url');
  sessions.set(t, Date.now() + SESSION_MS);
  return t;
}
function cookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach(function (c) {
    const i = c.indexOf('=');
    if (i > 0) out[c.slice(0, i).trim()] = c.slice(i + 1).trim();
  });
  return out;
}
function sessionOf(req) {
  const t = cookies(req).sid;
  if (!t) return null;
  const exp = sessions.get(t);
  if (!exp || exp < Date.now()) { sessions.delete(t); return null; }
  return t;
}

/* ---------------- helpers ---------------- */
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const bad = (m) => new HttpError(400, m);

const buckets = new Map();
function hit(key, limit, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.reset < now) { b = { n: 0, reset: now + windowMs }; buckets.set(key, b); }
  b.n++;
  return b.n <= limit;
}
function peek(key) { const b = buckets.get(key); return b && b.reset > Date.now() ? b.n : 0; }
setInterval(function () {
  const now = Date.now();
  buckets.forEach(function (b, k) { if (b.reset < now) buckets.delete(k); });
  sessions.forEach(function (e, k) { if (e < now) sessions.delete(k); });
}, 60 * 1000).unref();

function clientIp(req) {
  if (TRUST_PROXY) { const x = req.headers['x-forwarded-for']; if (x) return String(x).split(',')[0].trim(); }
  return req.socket.remoteAddress || '';
}
function isHttps(req) {
  return !!req.socket.encrypted || (TRUST_PROXY && req.headers['x-forwarded-proto'] === 'https') || process.env.COOKIE_SECURE === '1';
}
function setHeaders(req, res) {
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (isHttps(req)) res.setHeader('Strict-Transport-Security', 'max-age=15552000');
}
function sendJson(res, code, obj, headers) {
  const body = JSON.stringify(obj);
  res.writeHead(code, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(body) }, headers || {}));
  res.end(body);
}
function readJson(req) {
  return new Promise(function (resolve, reject) {
    if (!/^application\/json/i.test(req.headers['content-type'] || '')) return reject(new HttpError(415, 'Send JSON.'));
    let size = 0; const chunks = [];
    req.on('data', function (c) {
      size += c.length;
      if (size > MAX_BODY) { reject(new HttpError(413, 'Request too large.')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', function () {
      try {
        const v = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        if (!v || typeof v !== 'object' || Array.isArray(v)) return reject(bad('Send a JSON object.'));
        resolve(v);
      } catch (e) { reject(bad('Invalid JSON.')); }
    });
    req.on('error', function () { reject(bad('Request failed.')); });
  });
}
function sameOrigin(req) {
  const o = req.headers.origin;
  if (!o) return true;
  try { return new URL(o).host === req.headers.host; } catch (e) { return false; }
}

/* ---------------- validation ---------------- */
const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
function text(v, max, required, multiline, label) {
  if (v == null || v === '') { if (required) throw bad((label || 'A field') + ' is required.'); return ''; }
  if (typeof v !== 'string') throw bad((label || 'A field') + ' must be text.');
  const t = (multiline ? v.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ') : v.replace(/[\u0000-\u001f\u007f]/g, ' ')).trim();
  if (t.length > max) throw bad((label || 'A field') + ' is too long.');
  if (required && !t) throw bad((label || 'A field') + ' is required.');
  return t;
}
function number(v, min, max, label, int) {
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  if (!isFinite(n) || n < min || n > max) throw bad((label || 'A number') + ' is out of range.');
  if (int && !Number.isInteger(n)) throw bad((label || 'A number') + ' must be a whole number.');
  return int ? n : Math.round(n * 100) / 100;
}
const CURRENCIES = ['KES', 'USD', 'EUR', 'GBP'];
const STATUSES = ['new', 'paid', 'shipped', 'delivered', 'cancelled'];
const PAYS = ['mpesa', 'card', 'cod', 'bank'];

function cleanProduct(i, old) {
  const price = number(i.price, 0, 10000000, 'Price');
  const was = i.was ? number(i.was, 0, 10000000, 'Compare-at price') : 0;
  if (was && was <= price) throw bad('The compare-at price must be higher than the price.');
  const p = {
    name: text(i.name, 80, true, false, 'Name'),
    sku: text(i.sku, 24, false, false, 'SKU'),
    cat: text(i.cat, 30, true, false, 'Category'),
    price: price,
    was: was,
    stock: number(i.stock, 0, 1000000, 'Stock', true),
    status: i.status === 'draft' ? 'draft' : 'live',
    desc: text(i.desc, 300, false, false, 'Description'),
    sample: i.sample === true,
    updated: new Date().toISOString()
  };
  const icon = i.icon != null ? i.icon : old && old.icon;
  const hue = i.hue != null ? i.hue : old && old.hue;
  if (typeof icon === 'string' && /^[a-z]{2,20}$/.test(icon)) p.icon = icon;
  if (typeof hue === 'number' && hue >= 0 && hue <= 360) p.hue = Math.round(hue);
  return p;
}
function orderNo() {
  const d = new Date(), pad = (n) => String(n).padStart(2, '0');
  for (let k = 0; k < 20; k++) {
    const no = 'ORD-' + String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + (100 + crypto.randomInt(900));
    if (!Object.values(db.orders).some((o) => o.no === no)) return no;
  }
  return 'ORD-' + Date.now().toString(36).toUpperCase();
}
function cleanOrder(i, old) {
  const o = {
    no: old ? old.no : orderNo(),
    customer: text(i.customer, 80, true, false, 'Customer name'),
    phone: text(i.phone, 30, false, false, 'Phone'),
    email: text(i.email, 120, false, false, 'Email'),
    city: text(i.city, 140, false, false, 'Address'),
    items: text(i.items, 400, false, true, 'Items'),
    total: number(i.total, 0, 100000000, 'Total'),
    pay: PAYS.indexOf(i.pay) >= 0 ? i.pay : 'cod',
    status: STATUSES.indexOf(i.status) >= 0 ? i.status : 'new',
    note: text(i.note, 300, false, true, 'Note'),
    created: old ? old.created : new Date().toISOString()
  };
  if (old && old.source) o.source = old.source;
  if (old && old.lines) o.lines = old.lines;
  return o;
}
function cleanSettings(i) {
  const email = text(i.email, 120, false, false, 'Email');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad('Enter a valid email address.');
  const cur = CURRENCIES.indexOf(i.currency) >= 0 ? i.currency : 'USD';
  return {
    name: text(i.name, 60, true, false, 'Shop name'),
    email: email,
    phone: text(i.phone, 30, false, false, 'Phone'),
    address: text(i.address, 140, false, false, 'Address'),
    currency: cur,
    lowStock: number(i.lowStock, 0, 100000, 'Low-stock alert', true),
    freeShipAt: number(i.freeShipAt, 0, 10000000, 'Free shipping amount'),
    shipFee: number(i.shipFee, 0, 1000000, 'Shipping fee')
  };
}
function list(map) { return Object.keys(map).map((id) => Object.assign({ id: id }, map[id])); }

/* ---------------- API ---------------- */
async function api(req, res, p) {
  const method = req.method;
  const ip = clientIp(req);
  if (!hit('api:' + ip, 300, 60 * 1000)) throw new HttpError(429, 'Too many requests. Wait a minute.');
  const write = method !== 'GET' && method !== 'HEAD';
  if (write && !sameOrigin(req)) throw new HttpError(403, 'Blocked.');

  /* public */
  if (p === '/api/shop' && method === 'GET') {
    const s = db.settings;
    return sendJson(res, 200, { name: s.name, email: s.email, phone: s.phone, address: s.address, currency: s.currency, freeShipAt: s.freeShipAt, shipFee: s.shipFee });
  }
  if (p === '/api/products' && method === 'GET') {
    const out = list(db.products).filter((x) => x.status === 'live').map((x) => ({ id: x.id, name: x.name, sku: x.sku, cat: x.cat, price: x.price, was: x.was, stock: x.stock, desc: x.desc, icon: x.icon, hue: x.hue }));
    return sendJson(res, 200, out);
  }
  if (p === '/api/orders' && method === 'POST') {
    if (!hit('order:' + ip, 10, 60 * 60 * 1000)) throw new HttpError(429, 'Too many orders from this connection. Try again later.');
    return placeOrder(res, await readJson(req));
  }

  /* admin: sign in */
  if (p === '/api/admin/login' && method === 'POST') {
    if (peek('login:' + ip) >= 5) throw new HttpError(429, 'Too many attempts. Try again in 15 minutes.');
    const body = await readJson(req);
    if (!checkPw(body.password)) {
      hit('login:' + ip, 5, 15 * 60 * 1000);
      await new Promise((r) => setTimeout(r, 400));
      throw new HttpError(401, 'Wrong password.');
    }
    buckets.delete('login:' + ip);
    const t = newSession();
    const cookie = 'sid=' + t + '; HttpOnly; SameSite=Strict; Path=/; Max-Age=' + (SESSION_MS / 1000) + (isHttps(req) ? '; Secure' : '');
    return sendJson(res, 200, { ok: true }, { 'Set-Cookie': cookie });
  }
  if (!p.startsWith('/api/admin/')) throw new HttpError(404, 'Not found.');

  /* admin: everything below needs a session */
  const sid = sessionOf(req);
  if (!sid) throw new HttpError(401, 'Sign in required.');
  if (p === '/api/admin/session' && method === 'GET') return sendJson(res, 200, { ok: true });
  if (p === '/api/admin/logout' && method === 'POST') {
    sessions.delete(sid);
    return sendJson(res, 200, { ok: true }, { 'Set-Cookie': 'sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
  }
  if (p === '/api/admin/password' && method === 'POST') {
    const b = await readJson(req);
    if (!hit('pw:' + ip, 5, 15 * 60 * 1000)) throw new HttpError(429, 'Too many attempts. Try again later.');
    if (!checkPw(b.current)) throw new HttpError(403, 'The current password is wrong.');
    if (typeof b.next !== 'string' || b.next.length < 10 || b.next.length > 128) throw bad('The new password must be 10 to 128 characters.');
    if (b.next === b.current) throw bad('Choose a password that is different from the current one.');
    const salt = crypto.randomBytes(16);
    auth = { salt: salt.toString('hex'), hash: hashPw(b.next, salt).toString('hex') };
    writeAtomic(AUTH_FILE, JSON.stringify(auth));
    sessions.clear();
    const t = newSession();
    const cookie = 'sid=' + t + '; HttpOnly; SameSite=Strict; Path=/; Max-Age=' + (SESSION_MS / 1000) + (isHttps(req) ? '; Secure' : '');
    return sendJson(res, 200, { ok: true }, { 'Set-Cookie': cookie });
  }
  if (p === '/api/admin/settings') {
    if (method === 'GET') return sendJson(res, 200, db.settings);
    if (method === 'PUT') { db.settings = cleanSettings(await readJson(req)); save(); return sendJson(res, 200, db.settings); }
  }
  if (p === '/api/admin/products' && method === 'GET') return sendJson(res, 200, list(db.products));
  if (p === '/api/admin/orders' && method === 'GET') return sendJson(res, 200, list(db.orders));

  const m = /^\/api\/admin\/(products|orders)\/([^/]+)$/.exec(p);
  if (m) {
    const kind = m[1];
    let id;
    try { id = decodeURIComponent(m[2]); } catch (e) { throw bad('Bad id.'); }
    if (!ID_RE.test(id)) throw bad('Bad id.');
    const map = db[kind];
    const clean = kind === 'products' ? cleanProduct : cleanOrder;
    if (method === 'DELETE') { delete map[id]; save(); return sendJson(res, 200, { ok: true }); }
    if (method === 'PUT') {
      if (Object.keys(map).length >= 20000 && !map[id]) throw bad('The database is full.');
      map[id] = clean(await readJson(req), map[id]); save();
      return sendJson(res, 200, Object.assign({ id: id }, map[id]));
    }
    if (method === 'PATCH') {
      if (!map[id]) throw new HttpError(404, 'That item no longer exists.');
      map[id] = clean(Object.assign({}, map[id], await readJson(req)), map[id]); save();
      return sendJson(res, 200, Object.assign({ id: id }, map[id]));
    }
  }
  throw new HttpError(404, 'Not found.');
}

function placeOrder(res, b) {
  const name = text(b.name, 80, true, false, 'Your name');
  const phone = text(b.phone, 20, true, false, 'Phone');
  if (!/^[0-9+()\-\s]{7,20}$/.test(phone)) throw bad('Enter a valid phone number.');
  const email = text(b.email, 120, false, false, 'Email');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad('Enter a valid email address.');
  const address = text(b.address, 140, true, false, 'Delivery address');
  const note = text(b.note, 300, false, true, 'Note');
  const pay = b.pay === 'mpesa' ? 'mpesa' : 'cod';
  if (!Array.isArray(b.items) || !b.items.length || b.items.length > 30) throw bad('Your bag is empty.');
  const want = {};
  b.items.forEach(function (it) {
    if (!it || typeof it.id !== 'string' || !ID_RE.test(it.id)) throw bad('Invalid item.');
    const q = number(it.qty, 1, 99, 'Quantity', true);
    want[it.id] = (want[it.id] || 0) + q;
  });
  const lines = []; let cents = 0;
  Object.keys(want).forEach(function (id) {
    const p = db.products[id];
    if (!p || p.status !== 'live') throw new HttpError(409, 'An item in your bag is no longer available. Refresh the page.');
    if (want[id] > p.stock) throw new HttpError(409, p.stock > 0 ? 'Only ' + p.stock + ' left of ' + p.name + '.' : p.name + ' is sold out.');
    lines.push({ id: id, name: p.name, qty: want[id], price: p.price });
    cents += Math.round(p.price * 100) * want[id];
  });
  const s = db.settings;
  const sub = cents / 100;
  const ship = sub >= s.freeShipAt ? 0 : s.shipFee;
  const total = Math.round((sub + ship) * 100) / 100;
  lines.forEach(function (l) { db.products[l.id].stock -= l.qty; db.products[l.id].updated = new Date().toISOString(); });
  const id = 'o-' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
  const order = {
    no: orderNo(), customer: name, phone: phone, email: email, city: address,
    items: lines.map((l) => l.qty + ' x ' + l.name).join('\n').slice(0, 400),
    total: total, pay: pay, status: 'new', note: note, created: new Date().toISOString(),
    source: 'website', lines: lines
  };
  db.orders[id] = order;
  save();
  sendJson(res, 201, { ok: true, no: order.no, total: total, currency: s.currency });
}

/* ---------------- static files ---------------- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };
function serveStatic(req, res, p) {
  let file;
  if (p === '/') file = 'index.html';
  else if (p === '/admin' || p === '/admin/') file = 'admin.html';
  else {
    const name = p.slice(1);
    if (name.indexOf('/') >= 0 || name.indexOf('\\') >= 0 || name === 'admin.html' || name === 'index.html') { res.writeHead(404); return res.end('Not found'); }
    file = name;
  }
  const allowed = fs.readdirSync(PUB);
  if (allowed.indexOf(file) < 0) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
  const full = path.join(PUB, file);
  const ext = path.extname(file).toLowerCase();
  const isAdmin = file.startsWith('admin');
  const headers = { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' || isAdmin ? 'no-store' : 'public, max-age=300' };
  if (isAdmin) headers['X-Robots-Tag'] = 'noindex, nofollow';
  res.writeHead(200, headers);
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(full).pipe(res);
}

/* ---------------- server ---------------- */
const server = http.createServer(async function (req, res) {
  setHeaders(req, res);
  try {
    let p;
    try { p = new URL(req.url, 'http://localhost').pathname; } catch (e) { throw bad('Bad URL.'); }
    if (p.startsWith('/api/')) return await api(req, res, p);
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method not allowed.');
    return serveStatic(req, res, p);
  } catch (e) {
    if (res.headersSent) return res.end();
    if (e instanceof HttpError) return sendJson(res, e.status, { error: e.message });
    console.error(e);
    return sendJson(res, 500, { error: 'Something went wrong on the server.' });
  }
});
server.headersTimeout = 15000;
server.requestTimeout = 20000;
server.listen(PORT, HOST, function () {
  console.log('Stallhouse is running at http://' + (HOST === '0.0.0.0' ? 'localhost' : HOST) + ':' + PORT + '  (admin at /admin)');
});
process.on('SIGTERM', function () { server.close(function () { process.exit(0); }); });
