const express = require('express');
const session = require('express-session');
const multer = require('multer');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Database setup
const dbPath = path.join(__dirname, 'database', 'linkhub.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS menus (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    image TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Multer setup
const storage = multer.diskStorage({
  destination: path.join(__dirname, 'uploads'),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|svg/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    cb(null, ext && mime);
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'r3life-linkhub-secret-key-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Admin credentials (change these)
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';

// Auth middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// --- API Routes ---

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.isAdmin = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Check auth
app.get('/api/auth', (req, res) => {
  res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

// Get all menus
app.get('/api/menus', (req, res) => {
  const menus = db.prepare('SELECT * FROM menus ORDER BY sort_order ASC, id ASC').all();
  res.json(menus);
});

// Add menu
app.post('/api/menus', requireAuth, upload.single('image'), (req, res) => {
  const { name, url } = req.body;
  if (!name || !url) return res.status(400).json({ error: 'Name and URL are required' });

  const image = req.file ? '/uploads/' + req.file.filename : null;
  const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM menus').get();
  const sortOrder = (maxOrder.max || 0) + 1;

  const result = db.prepare('INSERT INTO menus (name, url, image, sort_order) VALUES (?, ?, ?, ?)')
    .run(name, url, image, sortOrder);

  const menu = db.prepare('SELECT * FROM menus WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(menu);
});

// Reorder menus (must be before :id route)
app.put('/api/menus/reorder', requireAuth, (req, res) => {
  const { order } = req.body; // array of ids in new order
  if (!Array.isArray(order)) return res.status(400).json({ error: 'Order must be an array' });

  const update = db.prepare('UPDATE menus SET sort_order = ? WHERE id = ?');
  const reorder = db.transaction((ids) => {
    ids.forEach((id, index) => update.run(index + 1, id));
  });
  reorder(order);

  res.json({ success: true });
});

// Update menu
app.put('/api/menus/:id', requireAuth, upload.single('image'), (req, res) => {
  const { id } = req.params;
  const { name, url } = req.body;
  const existing = db.prepare('SELECT * FROM menus WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Menu not found' });

  let image = existing.image;
  if (req.file) {
    // Delete old image
    if (existing.image) {
      const oldPath = path.join(__dirname, existing.image);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    image = '/uploads/' + req.file.filename;
  }

  db.prepare('UPDATE menus SET name = ?, url = ?, image = ? WHERE id = ?')
    .run(name || existing.name, url || existing.url, image, id);

  const menu = db.prepare('SELECT * FROM menus WHERE id = ?').get(id);
  res.json(menu);
});

// Delete menu
app.delete('/api/menus/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM menus WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Menu not found' });

  // Delete image file
  if (existing.image) {
    const imgPath = path.join(__dirname, existing.image);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }

  db.prepare('DELETE FROM menus WHERE id = ?').run(id);
  res.json({ success: true });
});

// Serve admin page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
