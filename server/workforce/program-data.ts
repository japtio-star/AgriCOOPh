import type Database from 'better-sqlite3';

// Programme evidence base for the AgriCOOPh–CSA DGD Programme 2022–2026.
// Transcribed from two Drive documents (October 2026):
//   S1  Endline Logframe Update (Endline Contribution to the Programme Logframe)
//   S2  AgriCOOPh–CSA Endline Assessment Final Report
// Logframe values are quoted "as logged" in the M&E logframe workbook.
// Individuals named in the reports are replaced by their role because this
// repository is public.

export const PROGRAMME = {
  name: 'AgriCOOPh–CSA DGD Programme 2022–2026',
  outcome:
    '14 professionalized family farming cooperatives with viable structures delivering efficient sustainable agriculture production ' +
    'and business development services to members, and an enabling farmer-friendly policy environment, together with the Federation in 13 provinces.',
  endlinePeriod: '14 July – 25 September 2026',
};

export const SOURCES = [
  { id: 'S1', title: 'Endline Logframe Update (input to the terminal logframe report)', kind: 'logframe', date: '2026-10-09',
    url: 'https://drive.google.com/file/d/16h7XY6RhtBstyGZWB1TbYmi796zM5gHI/view' },
  { id: 'S2', title: 'AgriCOOPh–CSA Endline Assessment Final Report', kind: 'endline', date: '2026-10-09',
    url: 'https://drive.google.com/file/d/1g5JV5I7URTFfCTVm0MjmlDZAxeWYwzLY/view' },
];

type TargetKind = 'growth' | 'level' | 'count';

interface IndicatorSeed {
  code: string; name: string; level: string; unit: 'count' | 'percent' | 'peso';
  baseline: string; v2024: number | null; v2025: number | null; target: number; target_kind: TargetKind;
  coverage: 'Direct' | 'Indirect' | 'Not covered'; full: number; partial: number; none: number;
  department: string; comment: string;
}

export const INDICATORS: IndicatorSeed[] = [
  { code: '0.1A', name: 'Services delivery to farmer-members', level: 'Outcome', unit: 'count', baseline: '30%', v2024: 23787, v2025: 37155, target: 60, target_kind: 'growth',
    coverage: 'Direct', full: 7, partial: 2, none: 0, department: 'inclusion',
    comment: "Based on partner cooperatives' reports of all farmers who availed of products and services; 2024 and 2025 achievements not yet fully reported." },
  { code: '0.1B', name: 'Services delivery to women farmer-members', level: 'Outcome', unit: 'count', baseline: '50%', v2024: 737, v2025: 900, target: 50, target_kind: 'growth',
    coverage: 'Direct', full: 4, partial: 5, none: 0, department: 'inclusion',
    comment: '20% of the 60,942 farmers reached, taken from the farmer survey; sex-disaggregated data not consistently recorded by cooperatives.' },
  { code: '0.1C', name: 'Services delivery to young farmer-members', level: 'Outcome', unit: 'count', baseline: '20%', v2024: 101, v2025: 200, target: 20, target_kind: 'growth',
    coverage: 'Direct', full: 3, partial: 4, none: 2, department: 'inclusion',
    comment: 'Target attained by 2024, citing 444 youth beneficiaries.' },
  { code: '0.2A', name: 'Increased income of farmer-members', level: 'Outcome', unit: 'count', baseline: '0', v2024: 1277, v2025: 2170, target: 30, target_kind: 'growth',
    coverage: 'Direct', full: 4, partial: 3, none: 2, department: 'inclusion',
    comment: 'Based solely on the farmer survey; cooperatives do not record income changes. About 20% of farmers who availed of services.' },
  { code: '0.2B', name: 'Increased income of women farmer-members', level: 'Outcome', unit: 'count', baseline: '50%', v2024: 737, v2025: 900, target: 50, target_kind: 'growth',
    coverage: 'Direct', full: 1, partial: 4, none: 4, department: 'inclusion',
    comment: 'Derived from the farmer survey; cooperatives do not record sex-disaggregated income changes.' },
  { code: '0.3', name: 'Policy advocacy cases', level: 'Outcome', unit: 'count', baseline: '-', v2024: 1, v2025: 8, target: 10, target_kind: 'count',
    coverage: 'Indirect', full: 0, partial: 0, none: 0, department: 'mne', comment: '' },
  { code: '1.1', name: 'Organizational professionalism (Level 3, RAMT)', level: 'Result 1', unit: 'percent', baseline: '-', v2024: 61.5, v2025: 76.9, target: 60, target_kind: 'level',
    coverage: 'Not covered', full: 0, partial: 0, none: 0, department: 'enterprise', comment: '' },
  { code: '1.2', name: 'Funds and resources accessing capacity', level: 'Result 1', unit: 'percent', baseline: '30%', v2024: 53.8, v2025: 61.5, target: 80, target_kind: 'level',
    coverage: 'Direct', full: 3, partial: 4, none: 2, department: 'enterprise',
    comment: '62% in 2025; continued support needed in resource mobilization and investment readiness.' },
  { code: '1.3', name: 'Products purchased from members', level: 'Result 1', unit: 'peso', baseline: '0', v2024: 98621894, v2025: 123971083, target: 30, target_kind: 'growth',
    coverage: 'Direct', full: 2, partial: 0, none: 6, department: 'enterprise',
    comment: "Based on cooperatives' application of Programme interventions; calculated from net surplus (differs from the indicator definition)." },
  { code: '1.4', name: 'Patronage dividends paid to members', level: 'Result 1', unit: 'peso', baseline: '-', v2024: 44370000, v2025: 50150000, target: 30, target_kind: 'growth',
    coverage: 'Indirect', full: 0, partial: 0, none: 0, department: 'enterprise', comment: '' },
  { code: '2.1', name: 'Farmers receiving technical advice (extension)', level: 'Result 2', unit: 'count', baseline: '0', v2024: 10201, v2025: 11955, target: 25, target_kind: 'growth',
    coverage: 'Direct', full: 4, partial: 4, none: 1, department: 'extension', comment: '' },
  { code: '2.2', name: 'Farmers applying 2+ agroecological practices', level: 'Result 2', unit: 'count', baseline: '0', v2024: 196, v2025: 371, target: 45, target_kind: 'growth',
    coverage: 'Direct', full: 3, partial: 3, none: 3, department: 'extension',
    comment: 'Baseline underrepresents practice (headcount); 2025 readiness assessment found 15% of partner cooperatives\' farmers practicing agroecology.' },
  { code: '3.1', name: 'Knowledge management tools', level: 'Result 3', unit: 'count', baseline: '-', v2024: 9, v2025: 15, target: 10, target_kind: 'count',
    coverage: 'Indirect', full: 0, partial: 0, none: 0, department: 'mne', comment: '' },
  { code: '3.2', name: 'New project funding proposals secured', level: 'Result 3', unit: 'count', baseline: '-', v2024: 3, v2025: 2, target: 5, target_kind: 'count',
    coverage: 'Indirect', full: 0, partial: 0, none: 0, department: 'mne',
    comment: 'Funded proposals include SNMPC (RPC2), HMPC (RPC2), OFMPC (PRDP banana chips), DACO (UNDP Small Grant), DISADECO (RPC3), FASRMCO (Inspire).' },
  { code: '4.1', name: 'Multi-stakeholder consultation themes', level: 'Result 4', unit: 'count', baseline: '-', v2024: null, v2025: null, target: 8, target_kind: 'count',
    coverage: 'Indirect', full: 0, partial: 0, none: 0, department: 'mne', comment: 'Listed in the logframe (not numeric).' },
  { code: '4.2', name: 'Platforms participated in or organized', level: 'Result 4', unit: 'count', baseline: '-', v2024: null, v2025: null, target: 5, target_kind: 'count',
    coverage: 'Indirect', full: 0, partial: 0, none: 0, department: 'mne', comment: 'Listed in the logframe (not numeric).' },
];

export const COOPS = [
  { code: 'PERAC', name: 'PERAC', location: 'Pamplona, Camarines Sur', dates: '14–15 July', status: 'recorded' },
  { code: 'DACO', name: 'DiCaDi Agriculture Cooperative', location: '', dates: '10–11 August', status: 'recorded' },
  { code: 'DISADECO', name: 'DISADECO', location: 'Diffun, Quirino', dates: '13–14 August', status: 'recorded' },
  { code: 'BMPC', name: 'BMPC', location: 'Barbaza, Antique', dates: '25–26 August', status: 'recorded' },
  { code: 'HMPC', name: 'HMPC', location: 'Hamtic, Antique', dates: '27–28 August', status: 'recorded' },
  { code: 'FEDARCCO', name: 'FEDARCCO', location: '', dates: '9–10 September', status: 'pending' },
  { code: 'BUSEPCO', name: 'BUSEPCO', location: '', dates: '11 September', status: 'recorded' },
  { code: 'SNMPC', name: 'SNMPC', location: '', dates: '12 September', status: 'recorded' },
  { code: 'FASRMCO', name: 'FASRMCO', location: 'Prosperidad, Agusan del Sur', dates: '13–14 September', status: 'recorded' },
  { code: 'OFMPC', name: 'OFMPC', location: '', dates: '24–25 September', status: 'recorded' },
];

// Per-cooperative 2024 values from the logframe workbook's Baseline sheet (S1, Table 12). null = blank.
export const COOP_VALUES: [string, string, number | null][] = [
  ['PERAC', '1.3', null], ['PERAC', '2.1', 0], ['PERAC', '2.2', 0],
  ['DACO', '1.3', 583164], ['DACO', '2.1', 48], ['DACO', '2.2', 10],
  ['DISADECO', '1.3', 189989], ['DISADECO', '2.1', 3218], ['DISADECO', '2.2', 0],
  ['BMPC', '1.3', 177954242], ['BMPC', '2.1', 0], ['BMPC', '2.2', 15],
  ['HMPC', '1.3', 110262], ['HMPC', '2.1', 3888], ['HMPC', '2.2', 2500],
  ['FEDARCCO', '1.3', 0], ['FEDARCCO', '2.1', 0], ['FEDARCCO', '2.2', 0],
  ['BUSEPCO', '1.3', 4243151], ['BUSEPCO', '2.1', 0], ['BUSEPCO', '2.2', 0],
  ['SNMPC', '1.3', 9365881], ['SNMPC', '2.1', 28], ['SNMPC', '2.2', 0],
  ['FASRMCO', '1.3', 8383064], ['FASRMCO', '2.1', 446], ['FASRMCO', '2.2', 80],
  ['OFMPC', '1.3', 5455116], ['OFMPC', '2.1', 0], ['OFMPC', '2.2', 0],
];

// Endline evidence. kind: finding | example | constraint | gap | adjacent (relevant but recorded under another heading).
type Ev = [coop: string, indicator: string, kind: string, text: string, source: string];

export const EVIDENCE: Ev[] = [
  // 0.1A services
  ['PERAC', '0.1A', 'finding', 'Machinery rental, irrigation support, rice milling and palay trading; membership grew from 116 to 126.', 'S2'],
  ['PERAC', '0.1A', 'constraint', 'Spare parts and fuel costs.', 'S1'],
  ['DACO', '0.1A', 'finding', 'Hauling service, member seminars and an SGP7 native-chicken project reaching about 35 farmers.', 'S2'],
  ['DISADECO', '0.1A', 'finding', 'Rice handling, agricultural loans, milling, processing and drying; members cite co-ownership, dividends and patronage refunds.', 'S2'],
  ['DISADECO', '0.1A', 'constraint', 'Logistics and hauling.', 'S1'],
  ['BMPC', '0.1A', 'finding', 'Agricultural credit programme and other loan windows, palay procurement and a corn hammer mill; members value low interest and in-kind palay repayment.', 'S2'],
  ['HMPC', '0.1A', 'finding', 'Agricultural loans and machinery; more than 3,000 additional members availing of agricultural loans, with 5% cashback, dividends and patronage refunds.', 'S2'],
  ['BUSEPCO', '0.1A', 'finding', 'Agricultural loans are the major service; members value patronage returns and dividends.', 'S2'],
  ['BUSEPCO', '0.1A', 'constraint', 'Long repayment periods.', 'S1'],
  ['SNMPC', '0.1A', 'finding', 'Agricultural loans, marketing and machinery; irrigation reaches 76 members and 35 non-members.', 'S2'],
  ['SNMPC', '0.1A', 'constraint', 'Denied crop-insurance claims.', 'S1'],
  ['FASRMCO', '0.1A', 'finding', 'Loans, trading, processing and merchandising of abaca, palay, copra, charcoal and tilapia, with a point-of-sale inventory system.', 'S2'],
  ['FASRMCO', '0.1A', 'constraint', 'Pricing, input availability and order delays.', 'S1'],
  ['OFMPC', '0.1A', 'finding', '3% loans for productive, micro-agriculture and micro-enterprise purposes, plus a banana (SAGING) loan, across five branches.', 'S2'],
  // 0.1B women
  ['PERAC', '0.1B', 'finding', 'Rural Empowerment Club supports women\'s enterprises (chips, soya coffee); administrative staff are all women.', 'S2'],
  ['DACO', '0.1B', 'example', 'A woman serves on the Board; a woman member\'s native-chicken and tilapia income covers school and medical costs.', 'S2'],
  ['DISADECO', '0.1B', 'finding', 'Standing Gender and Development committee with plan, budget and gender-sensitivity training.', 'S2'],
  ['BMPC', '0.1B', 'finding', 'GAD programming; a woman member was recognized as Most Outstanding Cooperative Member Champion in Agriculture.', 'S2'],
  ['HMPC', '0.1B', 'example', 'Women members own dairy carabaos; one grew her herd from 2 to 15.', 'S2'],
  ['BUSEPCO', '0.1B', 'finding', '36 women recorded as seed producers.', 'S2'],
  ['SNMPC', '0.1B', 'gap', 'Participation is not counted by gender.', 'S1'],
  ['FASRMCO', '0.1B', 'finding', 'GAD plan and budget; women\'s livelihood programme planned; women employed at the rubber plantation and on the management committee.', 'S2'],
  ['OFMPC', '0.1B', 'gap', 'The figure "423 under banana farming" is unclear as a count of women.', 'S1'],
  // 0.1C youth
  ['BMPC', '0.1C', 'finding', 'Kabarko youth group led by a Board member and a Laboratory Cooperative for members 17 and under, recognized in NATCCO contests; Youth Congress planned.', 'S2'],
  ['DISADECO', '0.1C', 'finding', 'Silnag cooperative laboratory has led to some young people being employed as staff; no dedicated youth programme.', 'S1'],
  ['HMPC', '0.1C', 'finding', 'Youth poultry group supplies eggs to the cooperative.', 'S2'],
  ['SNMPC', '0.1C', 'finding', 'Five young members.', 'S1'],
  ['BUSEPCO', '0.1C', 'finding', 'One young seed producer cultivating two hectares.', 'S2'],
  ['DACO', '0.1C', 'finding', 'AYA youth camp.', 'S1'],
  ['PERAC', '0.1C', 'gap', 'No dedicated youth programme; PMES invitation to youth planned.', 'S1'],
  ['FASRMCO', '0.1C', 'gap', 'No youth programme and no youth focal person.', 'S1'],
  // 0.2A income
  ['HMPC', '0.2A', 'finding', 'Rice farmers in the mechanization programme report 30–40% income gains; dairy income tracked per litre (about 5 L/day at ₱150/L over a 7-month lactation).', 'S2'],
  ['BUSEPCO', '0.2A', 'finding', 'Income up about 15–20%, with seed price rising from ₱41.80 to ₱44.00 per kilo.', 'S2'],
  ['PERAC', '0.2A', 'finding', 'Income lower in the first cropping, recovering later; red and black rice diversification protects against price swings.', 'S1'],
  ['BMPC', '0.2A', 'finding', 'Believes income has risen, based on lending and transaction patterns.', 'S1'],
  ['SNMPC', '0.2A', 'constraint', 'Reported a decrease in member income in 2026 (insects, drought, pests, weather).', 'S1'],
  ['DACO', '0.2A', 'constraint', 'Typhoon-related losses.', 'S1'],
  ['OFMPC', '0.2A', 'constraint', 'Bugtok disease affected more than 679 hectares of banana.', 'S2'],
  // 0.2B women's income
  ['BMPC', '0.2B', 'finding', 'Women\'s income gains described from observation only.', 'S1'],
  ['DACO', '0.2B', 'gap', 'States there is "no record" of women\'s income.', 'S1'],
  ['PERAC', '0.2B', 'example', 'Women manage household and cooperative income; SLP-linked chips and soya coffee enterprises.', 'S1'],
  ['BUSEPCO', '0.2B', 'gap', 'Figure given repeats the general-member figure.', 'S1'],
  ['SNMPC', '0.2B', 'gap', 'Figure given repeats the general-member figure.', 'S1'],
  // 1.2 funds
  ['PERAC', '1.2', 'finding', 'External partners DA, NIA, PhilMech, LGU, CDA, PhilRice and AgriCOOPh; 67% of assets from donations and grants.', 'S2'],
  ['PERAC', '1.2', 'gap', 'No formal Capital Build-Up scheme yet.', 'S1'],
  ['DACO', '1.2', 'finding', 'ARISE fund via the Asian Farmers\' Association bought a chicken-coop enclosure, laptop, printer and projector.', 'S2'],
  ['DACO', '1.2', 'constraint', 'Finances described as "still a weakness".', 'S1'],
  ['BMPC', '1.2', 'finding', 'Funding from government agencies, LGUs and financial institutions.', 'S1'],
  ['SNMPC', '1.2', 'finding', '₱30 million credit limit through AgriCOOPh and Landbank; 3% CBU allocation on agricultural loans.', 'S2'],
  ['FASRMCO', '1.2', 'finding', 'Capital from SBC, Landbank and DBP; 5% capital build-up and 1% savings built into approved loans.', 'S2'],
  ['BUSEPCO', '1.2', 'finding', 'Funding from AgriCOOPh, Landbank and Rizal Micro Bank.', 'S2'],
  ['HMPC', '1.2', 'constraint', 'Education Committee described as ineffective.', 'S1'],
  // 1.3 purchases
  ['FASRMCO', '1.3', 'finding', 'Increased purchases of palay, copra and rubber: above-market price, patronage and dividends, pick-up at members\' farms, cash payment, calibrated scales.', 'S2'],
  ['DACO', '1.3', 'finding', 'Acts as consolidator; member-marketing enterprise "not yet started".', 'S1'],
  ['PERAC', '1.3', 'adjacent', 'Rice trading began in the February–May cropping season using SLP capital via NIA; referred to the Business Development Officer\'s report.', 'S2'],
  ['BMPC', '1.3', 'adjacent', 'Palay procurement (not recorded under this indicator).', 'S1'],
  ['HMPC', '1.3', 'adjacent', 'Rice procurement with a ₱1-per-kilo incentive above market; terminal draft cites ₱4,187,400.', 'S1'],
  ['DISADECO', '1.3', 'adjacent', 'Rice handling for members.', 'S1'],
  ['OFMPC', '1.3', 'adjacent', 'Cluster sales logbooks and volume contracts; green banana marketing in Manila reaches about 20% of farmers.', 'S2'],
  ['SNMPC', '1.3', 'adjacent', 'IFR contracts worth ₱23 million (six in 2025, one in 2026).', 'S2'],
  // 1.4 patronage
  ['PERAC', '1.4', 'finding', '5% patronage refund.', 'S1'],
  ['HMPC', '1.4', 'finding', '5% cashback with dividends and patronage refunds.', 'S1'],
  ['DISADECO', '1.4', 'finding', 'Dividends and patronage refunds cited by members.', 'S1'],
  // 2.1 extension
  ['DACO', '2.1', 'finding', 'One named extension worker; cluster leaders being developed into para-agri-extension workers.', 'S2'],
  ['DISADECO', '2.1', 'finding', 'Clusters of ten members, central farmer contact point, phone access to a technician, support aligned with the planting calendar.', 'S2'],
  ['PERAC', '2.1', 'finding', 'Extension worker position created after the ACSSW, not yet filled; informal peer visits.', 'S1'],
  ['HMPC', '2.1', 'finding', 'Extension position created after the ACSSW; fertilizer-application advice.', 'S1'],
  ['OFMPC', '2.1', 'finding', 'Extension worker bundled with the loan package; follows banana clusters from planting to harvest across five branches.', 'S2'],
  ['BMPC', '2.1', 'finding', 'More organized, responsive and accessible extension than in previous years.', 'S1'],
  ['FASRMCO', '2.1', 'finding', 'Gradual introduction of organic application.', 'S1'],
  ['SNMPC', '2.1', 'gap', 'No validated answer for extension.', 'S1'],
  ['BUSEPCO', '2.1', 'constraint', 'Scouting is conditional on loan and warehouse.', 'S1'],
  // 2.2 agroecology
  ['PERAC', '2.2', 'finding', 'Red and black rice, three DA greenhouses and a solar water pump (July 2026) toward IDOFS, bio-solution training.', 'S2'],
  ['PERAC', '2.2', 'constraint', 'Dry loam soil.', 'S1'],
  ['DACO', '2.2', 'finding', 'IDOFS and organic agriculture; SGP7 native-chicken project under IDOFS.', 'S2'],
  ['BMPC', '2.2', 'finding', 'Organic fertilizer, compost, soil management and diversification.', 'S1'],
  ['BMPC', '2.2', 'constraint', 'Hesitation to change habits and added labour.', 'S1'],
  ['FASRMCO', '2.2', 'finding', 'Bio-compost, bio-solution, vermicast and cocopeat via farmer meetings and a demonstration farm.', 'S2'],
  ['FASRMCO', '2.2', 'constraint', 'Slow adoption.', 'S1'],
  ['SNMPC', '2.2', 'finding', 'Organic farming and Good Agricultural Practices promoted.', 'S2'],
  ['SNMPC', '2.2', 'constraint', 'Pests.', 'S1'],
  ['BUSEPCO', '2.2', 'finding', 'Organic farming promoted.', 'S2'],
  ['OFMPC', '2.2', 'finding', 'GAP training for 108 cluster leaders with the DA; banana peel planned as compost.', 'S2'],
  // 3.1 knowledge management
  ['BMPC', '3.1', 'finding', 'Cooperative Scoping Tool and inventory and sales monitoring tool used in regular operations.', 'S2'],
  ['OFMPC', '3.1', 'finding', 'Business performance and production-planning tool shared and in use.', 'S2'],
  ['PERAC', '3.1', 'finding', 'Enterprise and strategic plan review.', 'S1'],
  ['DACO', '3.1', 'finding', 'Agri-enterprise assessment and planning practices.', 'S1'],
  ['FASRMCO', '3.1', 'finding', 'Sustainability planning.', 'S1'],
  // 3.2 funding
  ['DACO', '3.2', 'finding', 'SGP7 project appears consistent with the UNDP Small Grant listed in the logframe (to confirm).', 'S1'],
  ['PERAC', '3.2', 'finding', 'Sustainable Livelihood Program capital through NIA; DA greenhouses.', 'S1'],
  // 0.3 / 4.x policy and platforms
  ['BMPC', '0.3', 'finding', 'Plans to enroll in the FFEDIS programme and the Sagip Saka Program.', 'S1'],
  ['SNMPC', '0.3', 'finding', 'DepEd had not yet adopted the Sagip Saka Law (three-year transition).', 'S1'],
  ['HMPC', '4.1', 'finding', 'Partnership with ACAHP, a consultation theme under 4.1.', 'S1'],
  ['PERAC', '4.2', 'finding', 'ACSSW workshop led to an extension position.', 'S1'],
  // FEDARCCO
  ['FEDARCCO', '0.1A', 'gap', 'Engaged during the endline; data pending a leadership transition and document review.', 'S2'],
];

export function initProgrammeSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS PrgSources (id TEXT PRIMARY KEY, title TEXT NOT NULL, kind TEXT, date TEXT, url TEXT);
    CREATE TABLE IF NOT EXISTS PrgIndicators (
      code TEXT PRIMARY KEY, name TEXT NOT NULL, level TEXT, unit TEXT, baseline TEXT,
      v2024 REAL, v2025 REAL, target REAL, target_kind TEXT,
      coverage TEXT, cov_full INTEGER, cov_partial INTEGER, cov_none INTEGER,
      department TEXT, comment TEXT
    );
    CREATE TABLE IF NOT EXISTS PrgCoops (code TEXT PRIMARY KEY, name TEXT, location TEXT, endline_dates TEXT, endline_status TEXT);
    CREATE TABLE IF NOT EXISTS PrgCoopValues (coop TEXT, indicator TEXT, year INTEGER, value REAL, PRIMARY KEY (coop, indicator, year));
    CREATE TABLE IF NOT EXISTS PrgEvidence (
      id INTEGER PRIMARY KEY AUTOINCREMENT, coop TEXT, indicator TEXT, kind TEXT, text TEXT NOT NULL, source TEXT
    );
  `);
  const has = (db.prepare('SELECT COUNT(*) AS n FROM PrgIndicators').get() as { n: number }).n;
  if (has) return;
  const tx = db.transaction(() => {
    const s = db.prepare('INSERT INTO PrgSources VALUES (?, ?, ?, ?, ?)');
    for (const x of SOURCES) s.run(x.id, x.title, x.kind, x.date, x.url);
    const i = db.prepare('INSERT INTO PrgIndicators VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const x of INDICATORS) i.run(x.code, x.name, x.level, x.unit, x.baseline, x.v2024, x.v2025, x.target, x.target_kind,
      x.coverage, x.full, x.partial, x.none, x.department, x.comment);
    const c = db.prepare('INSERT INTO PrgCoops VALUES (?, ?, ?, ?, ?)');
    for (const x of COOPS) c.run(x.code, x.name, x.location, x.dates, x.status);
    const v = db.prepare('INSERT INTO PrgCoopValues VALUES (?, ?, 2024, ?)');
    for (const [coop, ind, val] of COOP_VALUES) v.run(coop, ind, val);
    const e = db.prepare('INSERT INTO PrgEvidence (coop, indicator, kind, text, source) VALUES (?, ?, ?, ?, ?)');
    for (const [coop, ind, kind, text, src] of EVIDENCE) e.run(coop, ind, kind, text, src);
  });
  tx();
}
