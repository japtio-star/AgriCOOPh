import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";
import path from "path";
import multer from "multer";
import fs from "fs";
import { initExecutive, registerExecutiveRoutes, isExec } from "./server/executive";

// Initialize SQLite database
const db = new Database('amds.db', { verbose: console.log });

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize tables
function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS Cooperatives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      location TEXT,
      type TEXT,
      date_joined TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS Users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT CHECK(role IN ('Super Admin', 'Executive', 'Department Head', 'Cooperative Admin', 'Data Encoder', 'Viewer')) NOT NULL,
      coop_id INTEGER,
      dept_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(coop_id) REFERENCES Cooperatives(id)
    );

    CREATE TABLE IF NOT EXISTS Members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      birthdate TEXT,
      gender TEXT,
      contact TEXT,
      coop_id INTEGER NOT NULL,
      status TEXT CHECK(status IN ('Active', 'Inactive')) DEFAULT 'Active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(coop_id) REFERENCES Cooperatives(id)
    );

    CREATE TABLE IF NOT EXISTS Reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      coop_id INTEGER NOT NULL,
      type TEXT CHECK(type IN ('CAPAR', 'CAIS', 'Other')) NOT NULL,
      file_path TEXT,
      status TEXT DEFAULT 'Submitted',
      date_submitted TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(coop_id) REFERENCES Cooperatives(id)
    );

    CREATE TABLE IF NOT EXISTS Activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      location TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS Attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      activity_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(member_id) REFERENCES Members(id),
      FOREIGN KEY(activity_id) REFERENCES Activities(id)
    );

    CREATE TABLE IF NOT EXISTS Documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_type TEXT CHECK(owner_type IN ('Cooperative', 'Member')) NOT NULL,
      owner_id INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS AuditLogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES Users(id)
    );
  `);

  // Seed data if empty
  const coopCount = db.prepare('SELECT count(*) as count FROM Cooperatives').get() as { count: number };
  if (coopCount.count === 0) {
    const insertCoop = db.prepare('INSERT INTO Cooperatives (name, location, type, date_joined) VALUES (?, ?, ?, ?)');
    const coop1 = insertCoop.run('AgriFirst Coop', 'Manila, PH', 'Agricultural', '2020-01-15');
    const coop2 = insertCoop.run('GreenFarmers Union', 'Quezon City, PH', 'Agricultural', '2021-03-10');

    const insertUser = db.prepare('INSERT INTO Users (name, email, password, role, coop_id) VALUES (?, ?, ?, ?, ?)');
    const hashedPwd = bcrypt.hashSync('admin123', 10);
    insertUser.run('Super Admin User', 'admin@agricooph.com', hashedPwd, 'Super Admin', null);
    insertUser.run('Coop Admin User 1', 'coop1@agricooph.com', hashedPwd, 'Cooperative Admin', coop1.lastInsertRowid);
    
    const insertMember = db.prepare('INSERT INTO Members (name, birthdate, gender, contact, coop_id, status) VALUES (?, ?, ?, ?, ?, ?)');
    insertMember.run('Juan Dela Cruz', '1985-05-12', 'Male', '09123456789', coop1.lastInsertRowid, 'Active');
    insertMember.run('Maria Clara', '1990-08-20', 'Female', '09987654321', coop1.lastInsertRowid, 'Active');
    insertMember.run('Jose Rizal', '1975-12-30', 'Male', '09112223333', coop2.lastInsertRowid, 'Inactive');

    const insertReport = db.prepare('INSERT INTO Reports (coop_id, type, file_path, status, date_submitted) VALUES (?, ?, ?, ?, ?)');
    insertReport.run(coop1.lastInsertRowid, 'CAPAR', '/uploads/mock.pdf', 'Approved', '2023-11-01');
    insertReport.run(coop2.lastInsertRowid, 'CAIS', '/uploads/mock2.pdf', 'Submitted', '2023-11-05');
  }
}

initializeDatabase();
initExecutive(db);

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_123';
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());
  app.use('/uploads', express.static(UPLOADS_DIR));

  // --- API Routes ---

  // Auth Middleware
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.sendStatus(401);
      req.user = user;
      next();
    });
  };

  // Auth: Login
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM Users WHERE email = ?').get(email) as any;
    
    if (!user) return res.status(400).json({ error: 'User not found.' });

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Invalid password.' });

    const token = jwt.sign({ id: user.id, role: user.role, coop_id: user.coop_id, dept_id: user.dept_id }, JWT_SECRET, { expiresIn: '24h' });
    
    db.prepare('INSERT INTO AuditLogs (user_id, action) VALUES (?, ?)').run(user.id, 'User logged in');

    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, coop_id: user.coop_id, dept_id: user.dept_id } });
  });

  // Dashboard Summary
  app.get('/api/dashboard', authenticateToken, (req: any, res) => {
    const user = req.user;
    let coopQuery = '';
    let params: any[] = [];
    if (!isExec(user) && user.coop_id) {
      coopQuery = 'WHERE coop_id = ?';
      params.push(user.coop_id);
    }

    const totalMembers = (db.prepare(`SELECT count(*) as count FROM Members ${coopQuery}`).get(...params) as any).count;
    const activeMembers = (db.prepare(`SELECT count(*) as count FROM Members WHERE status = 'Active' ${coopQuery.replace('WHERE', 'AND')}`).get(...params) as any).count;
    const totalCoops = (db.prepare('SELECT count(*) as count FROM Cooperatives').get() as any).count;
    
    const genderDist = db.prepare(`SELECT gender, count(*) as count FROM Members ${coopQuery} GROUP BY gender`).all(...params);

    res.json({
      totalMembers,
      activeMembers,
      inactiveMembers: totalMembers - activeMembers,
      totalCoops: isExec(user) ? totalCoops : 1,
      genderDistribution: genderDist
    });
  });

  // Members API
  app.get('/api/members', authenticateToken, (req: any, res) => {
    const user = req.user;
    if (isExec(user)) {
      const members = db.prepare('SELECT m.*, c.name as coop_name FROM Members m LEFT JOIN Cooperatives c ON m.coop_id = c.id').all();
      res.json(members);
    } else {
      const members = db.prepare('SELECT m.*, c.name as coop_name FROM Members m LEFT JOIN Cooperatives c ON m.coop_id = c.id WHERE m.coop_id = ?').all(user.coop_id);
      res.json(members);
    }
  });

  app.post('/api/members', authenticateToken, (req: any, res) => {
    const { name, birthdate, gender, contact, coop_id, status } = req.body;
    const info = db.prepare('INSERT INTO Members (name, birthdate, gender, contact, coop_id, status) VALUES (?, ?, ?, ?, ?, ?)')
      .run(name, birthdate, gender, contact, coop_id || req.user.coop_id, status || 'Active');
    
    db.prepare('INSERT INTO AuditLogs (user_id, action) VALUES (?, ?)').run(req.user.id, `Created member ${info.lastInsertRowid}`);
    res.json({ id: info.lastInsertRowid });
  });

  // Cooperatives API
  app.get('/api/cooperatives', authenticateToken, (req: any, res) => {
    const coops = db.prepare('SELECT * FROM Cooperatives').all();
    res.json(coops);
  });

  app.post('/api/cooperatives', authenticateToken, (req: any, res) => {
    if (!isExec(req.user)) return res.status(403).json({ error: 'Unauthorized' });
    const { name, location, type, date_joined } = req.body;
    const info = db.prepare('INSERT INTO Cooperatives (name, location, type, date_joined) VALUES (?, ?, ?, ?)')
      .run(name, location, type, date_joined);
    res.json({ id: info.lastInsertRowid });
  });

  // Reports API
  app.get('/api/reports', authenticateToken, (req: any, res) => {
    const user = req.user;
    if (isExec(user)) {
      const reports = db.prepare('SELECT r.*, c.name as coop_name FROM Reports r LEFT JOIN Cooperatives c ON r.coop_id = c.id').all();
      res.json(reports);
    } else {
      const reports = db.prepare('SELECT r.*, c.name as coop_name FROM Reports r LEFT JOIN Cooperatives c ON r.coop_id = c.id WHERE r.coop_id = ?').all(user.coop_id);
      res.json(reports);
    }
  });

  app.post('/api/reports', authenticateToken, upload.single('file'), (req: any, res) => {
    const { coop_id, type, date_submitted } = req.body;
    const file_path = req.file ? `/uploads/${req.file.filename}` : null;
    
    const info = db.prepare('INSERT INTO Reports (coop_id, type, file_path, date_submitted) VALUES (?, ?, ?, ?)')
      .run(coop_id || req.user.coop_id, type, file_path, date_submitted || new Date().toISOString());
      
    db.prepare('INSERT INTO AuditLogs (user_id, action) VALUES (?, ?)').run(req.user.id, `Submitted report ${info.lastInsertRowid}`);
    res.json({ id: info.lastInsertRowid, file_path });
  });

  // Executive management layer (CEO command center, departments, issues, decisions)
  registerExecutiveRoutes(app, db, authenticateToken);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, Vite produces dist/
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
