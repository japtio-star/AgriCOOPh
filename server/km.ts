// Knowledge Management (KM) unit: knowledge library, dissemination log,
// information requests, market price monitoring and member data quality.
// Some KM KPIs are calculated from these records (see kmKpiValue).
import type { Express, RequestHandler } from "express";
import type Database from "better-sqlite3";

type DB = Database.Database;

export const KM_PRODUCT_TYPES = [
  "Technical guide", "Training module", "Policy brief", "Market bulletin", "Case study / success story",
  "Research report", "Infographic", "Video", "Manual / SOP",
];
export const KM_PRODUCT_STATUS = ["Draft", "Under review", "Published", "Archived"];
export const KM_CHANNELS = [
  "Training / seminar", "Field visit", "Facebook page", "SMS blast", "Radio", "Printed copies", "Email", "Digital platform", "Meeting / assembly",
];
export const KM_REQUEST_STATUS = ["New", "In progress", "Answered", "Closed"];
export const REGIONS = ["Luzon", "Visayas", "Mindanao", "National"];

export function initKmSchema(db: DB) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS KMProducts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      commodity TEXT,
      topic TEXT,
      region TEXT,
      language TEXT,
      audience TEXT,
      summary TEXT,
      link TEXT,
      author TEXT,
      source_dept_id INTEGER,
      status TEXT CHECK(status IN ('Draft', 'Under review', 'Published', 'Archived')) NOT NULL DEFAULT 'Draft',
      published_date TEXT,
      views INTEGER NOT NULL DEFAULT 0,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS KMDisseminations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER,
      date TEXT NOT NULL,
      channel TEXT NOT NULL,
      region TEXT,
      coops_reached INTEGER NOT NULL DEFAULT 0,
      people_reached INTEGER NOT NULL DEFAULT 0,
      women_reached INTEGER NOT NULL DEFAULT 0,
      youth_reached INTEGER NOT NULL DEFAULT 0,
      feedback_score REAL,
      notes TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(product_id) REFERENCES KMProducts(id)
    );

    CREATE TABLE IF NOT EXISTS KMRequests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requester TEXT NOT NULL,
      requester_type TEXT NOT NULL DEFAULT 'Internal unit',
      requesting_dept_id INTEGER,
      category TEXT NOT NULL DEFAULT 'Data / statistics',
      request TEXT NOT NULL,
      date_received TEXT NOT NULL,
      date_needed TEXT,
      assigned_to TEXT,
      status TEXT CHECK(status IN ('New', 'In progress', 'Answered', 'Closed')) NOT NULL DEFAULT 'New',
      response TEXT,
      date_answered TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS KMPrices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      commodity TEXT NOT NULL,
      unit TEXT NOT NULL DEFAULT 'kg',
      price_type TEXT NOT NULL DEFAULT 'Farmgate',
      region TEXT NOT NULL,
      market TEXT,
      price REAL NOT NULL,
      date TEXT NOT NULL,
      source TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

// ---------- Calculated values ----------
const periodBounds = (period: string) => {
  const [y, m] = period.split("-").map(Number);
  const end = new Date(y, m, 0).getDate();
  return [`${period}-01`, `${period}-${String(end).padStart(2, "0")}`];
};

export function memberDataQuality(db: DB) {
  const coops = db.prepare("SELECT * FROM Cooperatives ORDER BY name").all() as any[];
  const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  const rows = coops.map((c) => {
    const m = db.prepare(
      `SELECT count(*) AS members,
              sum(CASE WHEN coalesce(birthdate,'') != '' THEN 1 ELSE 0 END) AS with_birthdate,
              sum(CASE WHEN coalesce(gender,'') != '' THEN 1 ELSE 0 END) AS with_gender,
              sum(CASE WHEN coalesce(contact,'') != '' THEN 1 ELSE 0 END) AS with_contact
         FROM Members WHERE coop_id = ?`
    ).get(c.id) as any;
    const rep = db.prepare(
      "SELECT max(date_submitted) AS last_report, sum(CASE WHEN date_submitted >= ? THEN 1 ELSE 0 END) AS recent FROM Reports WHERE coop_id = ?"
    ).get(yearAgo, c.id) as any;
    const profileFields = [c.location, c.type, c.date_joined].filter((v) => v && String(v).trim()).length;
    const memberPct = m.members ? ((m.with_birthdate + m.with_gender + m.with_contact) / (m.members * 3)) * 100 : 0;
    const profilePct = (profileFields / 3) * 100;
    const missing: string[] = [];
    if (m.members === 0) missing.push("no members encoded");
    else {
      if (m.with_birthdate < m.members) missing.push(`${m.members - m.with_birthdate} without birthdate`);
      if (m.with_gender < m.members) missing.push(`${m.members - m.with_gender} without gender`);
      if (m.with_contact < m.members) missing.push(`${m.members - m.with_contact} without contact`);
    }
    if (profileFields < 3) missing.push("coop profile incomplete");
    if (!rep.recent) missing.push("no report in last 12 months");
    return {
      coop_id: c.id, name: c.name, location: c.location, members: m.members,
      member_completeness: Math.round(memberPct), profile_completeness: Math.round(profilePct),
      score: Math.round(memberPct * 0.6 + profilePct * 0.2 + (rep.recent ? 20 : 0)),
      last_report: rep.last_report, reports_last_12m: rep.recent || 0, missing,
    };
  });
  const totalMembers = rows.reduce((s, r) => s + r.members, 0);
  const overall = totalMembers
    ? Math.round(rows.reduce((s, r) => s + r.member_completeness * r.members, 0) / totalMembers)
    : 0;
  return { overall, coops: rows.sort((a, b) => a.score - b.score) };
}

// Values for KPIs whose `source` points at KM records.
export function kmKpiValue(db: DB, source: string, period: string): number | null {
  const [from, to] = periodBounds(period);
  switch (source) {
    case "km.products_published":
      return (db.prepare("SELECT count(*) AS c FROM KMProducts WHERE status IN ('Published','Archived') AND published_date BETWEEN ? AND ?").get(from, to) as any).c;
    case "km.requests_served":
      return (db.prepare("SELECT count(*) AS c FROM KMRequests WHERE date_answered BETWEEN ? AND ?").get(from, to) as any).c;
    case "km.people_reached":
      return (db.prepare("SELECT coalesce(sum(people_reached),0) AS c FROM KMDisseminations WHERE date BETWEEN ? AND ?").get(from, to) as any).c;
    case "km.request_turnaround": {
      const r = db.prepare(
        "SELECT avg(julianday(date_answered) - julianday(date_received)) AS d FROM KMRequests WHERE date_answered BETWEEN ? AND ?"
      ).get(from, to) as any;
      return r.d === null ? null : Math.round(r.d * 10) / 10;
    }
    case "km.member_data_completeness":
      return memberDataQuality(db).overall;
    default:
      return null;
  }
}

// ---------- Demo records ----------
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

export function seedKmDemo(db: DB) {
  if ((db.prepare("SELECT count(*) AS c FROM KMProducts").get() as any).c > 0) return;
  const rand = rng(7);
  const today = new Date();
  const daysAgo = (n: number) => new Date(today.getTime() - n * 86400000).toISOString().slice(0, 10);
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
  const dept = (code: string) => (db.prepare("SELECT id FROM Departments WHERE code = ?").get(code) as any)?.id ?? null;

  db.transaction(() => {
    // More sample cooperatives and members, so data quality has something to show.
    if ((db.prepare("SELECT count(*) AS c FROM Cooperatives").get() as any).c <= 2) {
      const coops: [string, string, string | null, string | null][] = [
        ["Nueva Ecija Palay Growers MPC", "Nueva Ecija, Luzon", "Agricultural", "2019-06-01"],
        ["Benguet Highland Vegetable Farmers Coop", "Benguet, Luzon", "Agricultural", "2018-02-15"],
        ["Iloilo Rice and Corn Producers Coop", "Iloilo, Visayas", "Agricultural", "2020-09-20"],
        ["Bohol Coconut Farmers MPC", "Bohol, Visayas", "Agricultural", null],
        ["Davao Cacao Growers Cooperative", "Davao, Mindanao", "Agricultural", "2021-11-05"],
        ["Bukidnon Corn Farmers Coop", "Bukidnon, Mindanao", null, "2022-04-12"],
        ["Cotabato Banana Growers MPC", "Cotabato, Mindanao", "Agricultural", "2017-08-30"],
      ];
      const insCoop = db.prepare("INSERT INTO Cooperatives (name, location, type, date_joined) VALUES (?, ?, ?, ?)");
      const insMember = db.prepare("INSERT INTO Members (name, birthdate, gender, contact, coop_id, status) VALUES (?, ?, ?, ?, ?, ?)");
      const first = ["Ana", "Ben", "Carlo", "Dina", "Elena", "Fe", "Gil", "Hilda", "Isko", "Joy", "Lito", "Mila", "Nestor", "Olive", "Pedro", "Rosa"];
      const last = ["Santos", "Reyes", "Cruz", "Bautista", "Garcia", "Mendoza", "Torres", "Villanueva", "Ramos", "Aquino"];
      const quality = [0.95, 0.9, 0.7, 0.5, 0.85, 0.6, 0.8];
      coops.forEach((c, i) => {
        const id = insCoop.run(...c).lastInsertRowid;
        const n = 5 + Math.floor(rand() * 6);
        for (let j = 0; j < n; j++) {
          const q = quality[i];
          const female = rand() < 0.45;
          insMember.run(
            `${pick(first)} ${pick(last)}`,
            rand() < q ? `19${60 + Math.floor(rand() * 40)}-0${1 + Math.floor(rand() * 9)}-1${Math.floor(rand() * 9)}` : null,
            rand() < q + 0.05 ? (female ? "Female" : "Male") : null,
            rand() < q ? `09${Math.floor(100000000 + rand() * 899999999)}` : null,
            id, rand() < 0.9 ? "Active" : "Inactive"
          );
        }
        if (i % 3 !== 1) {
          db.prepare("INSERT INTO Reports (coop_id, type, file_path, status, date_submitted) VALUES (?, ?, ?, ?, ?)")
            .run(id, i % 2 ? "CAIS" : "CAPAR", null, "Submitted", daysAgo(20 + i * 30));
        }
      });
    }

    const products: [string, string, string, string, string, string, string, number][] = [
      ["Palay Production Guide: PSB Rc18 and NSIC Rc222 varieties", "Technical guide", "Rice", "Production", "Luzon", "Filipino", "Published", 320],
      ["Cacao Fermentation and Drying for Better Bean Prices", "Technical guide", "Cacao", "Post-harvest", "Mindanao", "Cebuano", "Published", 290],
      ["Monthly Market Bulletin: Farmgate Prices of Key Commodities", "Market bulletin", "Multiple", "Marketing", "National", "English", "Published", 250],
      ["Highland Vegetable Post-harvest Handling to Cut Losses", "Training module", "Vegetables", "Post-harvest", "Luzon", "Ilocano", "Published", 210],
      ["Success Story: How Iloilo Rice Coop Won an Institutional Buyer", "Case study / success story", "Rice", "Marketing", "Visayas", "Hiligaynon", "Published", 180],
      ["Policy Brief: Rice Tariffication and Palay Prices for Small Farmers", "Policy brief", "Rice", "Policy", "National", "English", "Published", 150],
      ["Coconut Intercropping with Cacao and Coffee", "Infographic", "Coconut", "Production", "Visayas", "Cebuano", "Published", 130],
      ["Cooperative Bookkeeping Basics (CDA compliance)", "Manual / SOP", "None", "Coop governance", "National", "Filipino", "Published", 120],
      ["Climate-smart Corn Farming: Planting Calendar", "Video", "Corn", "Climate adaptation", "Mindanao", "Cebuano", "Published", 95],
      ["Fall Armyworm Management in Corn", "Technical guide", "Corn", "Pest management", "Mindanao", "Filipino", "Published", 70],
      ["Member Coop Profiling Survey 2026: Results", "Research report", "Multiple", "Membership", "National", "English", "Published", 40],
      ["Organic Fertilizer Production from Farm Waste", "Training module", "Multiple", "Production", "National", "Filipino", "Under review", 0],
      ["Credit Readiness Checklist for Member Coops", "Manual / SOP", "None", "Finance", "National", "English", "Draft", 0],
      ["Banana Bunchy Top Virus: Early Detection", "Infographic", "Banana", "Pest management", "Mindanao", "Cebuano", "Draft", 0],
    ];
    const insProduct = db.prepare(
      `INSERT INTO KMProducts (title, type, commodity, topic, region, language, audience, summary, author, source_dept_id, status, published_date, views)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const sources = ["KM", "AGB", "SMS", "TRN", "KM", "KM", "AGB", "ACC", "TRN", "AGB", "MRD", "AGB", "CRD", "AGB"];
    const productIds = products.map((p, i) =>
      Number(insProduct.run(
        p[0], p[1], p[2], p[3], p[4], p[5], "Member farmers and coop officers",
        "Sample summary of the knowledge product.", "KM Officer", dept(sources[i]), p[6],
        p[6] === "Published" ? daysAgo(15 + i * 24) : null, p[7]
      ).lastInsertRowid)
    );
    // A market bulletin is published every month.
    for (let k = 1; k <= 11; k++) {
      productIds.push(Number(insProduct.run(
        `Market Bulletin No. ${k}`, "Market bulletin", "Multiple", "Marketing", "National", "English",
        "Member coops", "Monthly farmgate and retail prices.", "KM Officer", dept("KM"), "Published", daysAgo(5 + k * 30), Math.floor(60 + rand() * 80)
      ).lastInsertRowid));
    }

    const insDiss = db.prepare(
      `INSERT INTO KMDisseminations (product_id, date, channel, region, coops_reached, people_reached, women_reached, youth_reached, feedback_score, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (let i = 0; i < 48; i++) {
      const channel = pick(KM_CHANNELS);
      const people = channel === "Facebook page" || channel === "Radio" || channel === "SMS blast"
        ? 300 + Math.floor(rand() * 1200) : 20 + Math.floor(rand() * 90);
      insDiss.run(
        pick(productIds.slice(0, 11).concat(productIds.slice(14))), daysAgo(3 + Math.floor(i * 7.4 + rand() * 5)), channel, pick(REGIONS.slice(0, 3)),
        1 + Math.floor(rand() * 12), people, Math.floor(people * (0.35 + rand() * 0.2)), Math.floor(people * (0.1 + rand() * 0.15)),
        channel.includes("Training") || channel.includes("Field") ? Math.round((3.6 + rand() * 1.3) * 10) / 10 : null, null
      );
    }

    const insReq = db.prepare(
      `INSERT INTO KMRequests (requester, requester_type, requesting_dept_id, category, request, date_received, date_needed, assigned_to, status, response, date_answered)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const reqs: [string, string, string | null, string, string, number, number | null][] = [
      ["CEO", "Internal unit", null, "Analysis", "Revenue per member coop served by SMS, last 12 months", 4, null],
      ["SMS Unit Head", "Internal unit", "SMS", "Data / statistics", "Volume of palay supplied per coop, Luzon", 6, null],
      ["Credit Unit Head", "Internal unit", "CRD", "Analysis", "Repayment history of coops with late payments", 12, 5],
      ["Davao Cacao Growers Cooperative", "Member coop", null, "Technical information", "Buyers paying premium for fermented cacao", 20, 6],
      ["Board of Directors", "Board", null, "Report", "Membership growth summary for general assembly", 34, 9],
      ["Training Unit Head", "Internal unit", "TRN", "Data / statistics", "Training participants by gender and region", 41, 3],
      ["Bohol Coconut Farmers MPC", "Member coop", null, "Technical information", "Copra drying standards and current prices", 55, 4],
      ["Partner NGO", "Partner", null, "Data / statistics", "Number of women farmers in member coops", 63, 8],
      ["Digital Unit Head", "Internal unit", "DIG", "Analysis", "Which coops use the platform most", 80, 6],
      ["Agribusiness Unit Head", "Internal unit", "AGB", "Report", "Coops ready for business plan support", 96, 7],
      ["MRD Unit Head", "Internal unit", "MRD", "Data / statistics", "Coops with no M&E report this year", 130, 2],
      ["CEO", "Internal unit", null, "Analysis", "Cost of services per income unit", 170, 10],
    ];
    reqs.forEach(([who, type, d, cat, text, ago, took]) => {
      const answered = took !== null ? daysAgo(ago - took) : null;
      insReq.run(who, type, d ? dept(d) : null, cat, text, daysAgo(ago), daysAgo(ago - 10), "KM Officer",
        answered ? (ago > 60 ? "Closed" : "Answered") : ago > 5 ? "In progress" : "New",
        answered ? "Sample answer sent." : null, answered);
    });

    const insPrice = db.prepare(
      "INSERT INTO KMPrices (commodity, unit, price_type, region, market, price, date, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    const commodities: [string, number][] = [
      ["Palay (fresh)", 19], ["Yellow corn (dried)", 17], ["Copra", 42], ["Cacao (dried beans)", 175], ["Red onion", 85],
    ];
    const regionFactor: Record<string, number> = { Luzon: 1.04, Visayas: 1.0, Mindanao: 0.95 };
    commodities.forEach(([name, base]) => {
      ["Luzon", "Visayas", "Mindanao"].forEach((region) => {
        let level = base * regionFactor[region];
        for (let w = 12; w >= 0; w--) {
          level *= 1 + (rand() - 0.48) * (name === "Red onion" ? 0.12 : 0.04);
          insPrice.run(name, "kg", "Farmgate", region, `${region} buying stations`, Math.round(level * 100) / 100, daysAgo(w * 7 + 1), "Member coop reports");
        }
      });
    });
  })();
}

// ---------- Routes ----------
export function registerKmRoutes(app: Express, db: DB, auth: RequestHandler, isExec: (u: any) => boolean) {
  const kmId = () => (db.prepare("SELECT id FROM Departments WHERE code = 'KM'").get() as any)?.id;
  const kmAccess: RequestHandler = (req: any, res, next) => {
    const u = req.user;
    if (isExec(u) || (u?.role === "Department Head" && Number(u.dept_id) === Number(kmId()))) return next();
    res.status(403).json({ error: "Only the CEO and the KM unit can use this." });
  };
  const log = (userId: number, action: string) =>
    db.prepare("INSERT INTO AuditLogs (user_id, action) VALUES (?, ?)").run(userId, action);
  const str = (v: any) => (v === undefined || v === null || v === "" ? null : String(v));
  const num = (v: any) => (v === undefined || v === null || v === "" ? null : Number(v));

  app.get("/api/km/options", auth, kmAccess, (_req, res) => {
    res.json({ productTypes: KM_PRODUCT_TYPES, productStatus: KM_PRODUCT_STATUS, channels: KM_CHANNELS, requestStatus: KM_REQUEST_STATUS, regions: REGIONS });
  });

  // Knowledge library
  app.get("/api/km/products", auth, kmAccess, (_req, res) => {
    res.json(db.prepare(
      `SELECT p.*, d.name AS source_dept,
              (SELECT coalesce(sum(people_reached),0) FROM KMDisseminations x WHERE x.product_id = p.id) AS people_reached,
              (SELECT count(*) FROM KMDisseminations x WHERE x.product_id = p.id) AS times_shared
         FROM KMProducts p LEFT JOIN Departments d ON d.id = p.source_dept_id
        ORDER BY CASE p.status WHEN 'Draft' THEN 0 WHEN 'Under review' THEN 1 ELSE 2 END, coalesce(p.published_date, p.created_at) DESC`
    ).all());
  });

  const productFields = (b: any) => {
    if (!b.title || !KM_PRODUCT_TYPES.includes(b.type)) throw new Error("Title and a valid type are required.");
    const status = KM_PRODUCT_STATUS.includes(b.status) ? b.status : "Draft";
    const published = status === "Published" || status === "Archived" ? str(b.published_date) || new Date().toISOString().slice(0, 10) : str(b.published_date);
    return [b.title, b.type, str(b.commodity), str(b.topic), str(b.region), str(b.language), str(b.audience), str(b.summary), str(b.link), str(b.author), num(b.source_dept_id), status, published];
  };

  app.post("/api/km/products", auth, kmAccess, (req: any, res) => {
    try {
      const info = db.prepare(
        `INSERT INTO KMProducts (title, type, commodity, topic, region, language, audience, summary, link, author, source_dept_id, status, published_date, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(...productFields(req.body), req.user.id);
      log(req.user.id, `Added knowledge product ${info.lastInsertRowid}`);
      res.json({ id: info.lastInsertRowid });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/km/products/:id", auth, kmAccess, (req: any, res) => {
    try {
      db.prepare(
        `UPDATE KMProducts SET title = ?, type = ?, commodity = ?, topic = ?, region = ?, language = ?, audience = ?, summary = ?, link = ?,
           author = ?, source_dept_id = ?, status = ?, published_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).run(...productFields(req.body), req.params.id);
      log(req.user.id, `Updated knowledge product ${req.params.id}`);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Dissemination log
  app.get("/api/km/disseminations", auth, kmAccess, (_req, res) => {
    res.json(db.prepare(
      `SELECT x.*, p.title AS product_title, p.type AS product_type FROM KMDisseminations x
         LEFT JOIN KMProducts p ON p.id = x.product_id ORDER BY x.date DESC, x.id DESC`
    ).all());
  });

  app.post("/api/km/disseminations", auth, kmAccess, (req: any, res) => {
    const b = req.body;
    if (!b.date || !b.channel) return res.status(400).json({ error: "Date and channel are required." });
    const people = num(b.people_reached) ?? 0;
    if ((num(b.women_reached) ?? 0) > people || (num(b.youth_reached) ?? 0) > people) {
      return res.status(400).json({ error: "Women or youth reached cannot be more than total people reached." });
    }
    const info = db.prepare(
      `INSERT INTO KMDisseminations (product_id, date, channel, region, coops_reached, people_reached, women_reached, youth_reached, feedback_score, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(num(b.product_id), b.date, b.channel, str(b.region), num(b.coops_reached) ?? 0, people, num(b.women_reached) ?? 0,
      num(b.youth_reached) ?? 0, num(b.feedback_score), str(b.notes), req.user.id);
    log(req.user.id, `Logged dissemination ${info.lastInsertRowid}`);
    res.json({ id: info.lastInsertRowid });
  });

  // Information requests
  app.get("/api/km/requests", auth, kmAccess, (_req, res) => {
    res.json(db.prepare(
      `SELECT r.*, d.name AS requesting_dept FROM KMRequests r LEFT JOIN Departments d ON d.id = r.requesting_dept_id
        ORDER BY CASE r.status WHEN 'New' THEN 0 WHEN 'In progress' THEN 1 WHEN 'Answered' THEN 2 ELSE 3 END, r.date_needed, r.date_received DESC`
    ).all());
  });

  app.post("/api/km/requests", auth, kmAccess, (req: any, res) => {
    const b = req.body;
    if (!b.requester || !b.request) return res.status(400).json({ error: "Requester and request are required." });
    const info = db.prepare(
      `INSERT INTO KMRequests (requester, requester_type, requesting_dept_id, category, request, date_received, date_needed, assigned_to, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(b.requester, str(b.requester_type) || "Internal unit", num(b.requesting_dept_id), str(b.category) || "Data / statistics", b.request,
      str(b.date_received) || new Date().toISOString().slice(0, 10), str(b.date_needed), str(b.assigned_to), req.user.id);
    log(req.user.id, `Logged information request ${info.lastInsertRowid}`);
    res.json({ id: info.lastInsertRowid });
  });

  app.put("/api/km/requests/:id", auth, kmAccess, (req: any, res) => {
    const b = req.body;
    if (b.status && !KM_REQUEST_STATUS.includes(b.status)) return res.status(400).json({ error: "Invalid status." });
    const current = db.prepare("SELECT * FROM KMRequests WHERE id = ?").get(req.params.id) as any;
    if (!current) return res.status(404).json({ error: "Request not found." });
    const status = b.status || current.status;
    const answered = status === "Answered" || status === "Closed"
      ? current.date_answered || str(b.date_answered) || new Date().toISOString().slice(0, 10)
      : null;
    db.prepare("UPDATE KMRequests SET status = ?, response = coalesce(?, response), assigned_to = coalesce(?, assigned_to), date_answered = ? WHERE id = ?")
      .run(status, str(b.response), str(b.assigned_to), answered, req.params.id);
    log(req.user.id, `Updated information request ${req.params.id}`);
    res.json({ ok: true });
  });

  // Market prices
  app.get("/api/km/prices", auth, kmAccess, (_req, res) => {
    res.json(db.prepare("SELECT * FROM KMPrices ORDER BY date DESC, commodity, region").all());
  });

  app.post("/api/km/prices", auth, kmAccess, (req: any, res) => {
    const b = req.body;
    const price = num(b.price);
    if (!b.commodity || !b.region || !b.date || price === null || !(price > 0)) {
      return res.status(400).json({ error: "Commodity, region, date and a price above zero are required." });
    }
    const info = db.prepare(
      "INSERT INTO KMPrices (commodity, unit, price_type, region, market, price, date, source, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(b.commodity, str(b.unit) || "kg", str(b.price_type) || "Farmgate", b.region, str(b.market), price, b.date, str(b.source), req.user.id);
    log(req.user.id, `Recorded price ${info.lastInsertRowid}`);
    res.json({ id: info.lastInsertRowid });
  });

  // Member data quality (calculated from the membership database)
  app.get("/api/km/data-quality", auth, kmAccess, (_req, res) => {
    res.json(memberDataQuality(db));
  });
}
