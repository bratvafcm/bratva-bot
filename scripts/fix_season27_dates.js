import fs from 'fs';
import path from 'path';

const tDir = path.join(process.cwd(), 'docs', 'league-data', 'tournaments');
const tIndexPath = path.join(process.cwd(), 'docs', 'league-data', 'index', 'tournaments_index.json');

// Exact 9 continuous tournaments for Season 27 (24h per tournament):
// 1. 2026-09-25: GARUDA INDONESIA
// 2. 2026-09-26: Ujedinjeni Strim
// 3. 2026-09-27: Shaidul
// 4. 2026-09-28: اليمن السعيد
// 5. 2026-09-29: BLIVION (was 2026-09-30)
// 6. 2026-09-30: The eagles@egypt
// 7. 2026-10-01: БАНДА БЛОХЕРА
// 8. 2026-10-02: the king (was 2026-10-01)
// 9. 2026-10-03: Legends League (was 2026-10-01)

const migrations = [
  {
    oldId: '2026-09-30_blivion',
    newId: '2026-09-29_blivion',
    newDate: '2026-09-29',
    newTimestamp: new Date('2026-09-29T12:00:00Z').getTime()
  },
  {
    oldId: '2026-10-01_the_king',
    newId: '2026-10-02_the_king',
    newDate: '2026-10-02',
    newTimestamp: new Date('2026-10-02T12:00:00Z').getTime()
  },
  {
    oldId: '2026-10-01_legends_league',
    newId: '2026-10-03_legends_league',
    newDate: '2026-10-03',
    newTimestamp: new Date('2026-10-03T12:00:00Z').getTime()
  }
];

// Perform file renames and content updates
for (const m of migrations) {
  const oldPath = path.join(tDir, `${m.oldId}.json`);
  const newPath = path.join(tDir, `${m.newId}.json`);

  let data = null;
  if (fs.existsSync(oldPath)) {
    data = JSON.parse(fs.readFileSync(oldPath, 'utf8'));
    fs.unlinkSync(oldPath);
  } else if (fs.existsSync(newPath)) {
    data = JSON.parse(fs.readFileSync(newPath, 'utf8'));
  }

  if (data) {
    data.id = m.newId;
    data.tournament_id = m.newId;
    data.date = m.newDate;
    data.timestamp = m.newTimestamp;
    fs.writeFileSync(newPath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Migrated ${m.oldId} -> ${m.newId}`);
  }
}

// Rebuild tournaments_index.json
const correctIndex = {
  "2026-09-25_garuda_indonesia": {
    "date": "2026-09-25",
    "timestamp": new Date('2026-09-25T12:00:00Z').getTime(),
    "opponent_league": "GARUDA INDONESIA",
    "our_total_goals": 214,
    "opponent_total_goals": 194,
    "result": "win",
    "status": "complete"
  },
  "2026-09-26_ujedinjeni_strim": {
    "date": "2026-09-26",
    "timestamp": new Date('2026-09-26T12:00:00Z').getTime(),
    "opponent_league": "Ujedinjeni Strim",
    "our_total_goals": 184,
    "opponent_total_goals": 238,
    "result": "loss",
    "status": "complete"
  },
  "2026-09-27_shaidul": {
    "date": "2026-09-27",
    "timestamp": new Date('2026-09-27T12:00:00Z').getTime(),
    "opponent_league": "Shaidul",
    "our_total_goals": 167,
    "opponent_total_goals": 163,
    "result": "win",
    "status": "complete"
  },
  "2026-09-28_alymn_alsayd": {
    "date": "2026-09-28",
    "timestamp": new Date('2026-09-28T12:00:00Z').getTime(),
    "opponent_league": "اليمن السعيد",
    "our_total_goals": 172,
    "opponent_total_goals": 131,
    "result": "win",
    "status": "complete"
  },
  "2026-09-29_blivion": {
    "date": "2026-09-29",
    "timestamp": new Date('2026-09-29T12:00:00Z').getTime(),
    "opponent_league": "BLIVION",
    "our_total_goals": 289,
    "opponent_total_goals": 318,
    "result": "loss",
    "status": "complete"
  },
  "2026-09-30_the_eagles_egypt": {
    "date": "2026-09-30",
    "timestamp": new Date('2026-09-30T12:00:00Z').getTime(),
    "opponent_league": "The eagles@egypt",
    "our_total_goals": 184,
    "opponent_total_goals": 184,
    "result": "draw",
    "status": "complete"
  },
  "2026-10-01_banda_blokhera": {
    "date": "2026-10-01",
    "timestamp": new Date('2026-10-01T12:00:00Z').getTime(),
    "opponent_league": "БАНДА БЛОХЕРА",
    "our_total_goals": 192,
    "opponent_total_goals": 165,
    "result": "win",
    "status": "complete"
  },
  "2026-10-02_the_king": {
    "date": "2026-10-02",
    "timestamp": new Date('2026-10-02T12:00:00Z').getTime(),
    "opponent_league": "the king",
    "our_total_goals": 159,
    "opponent_total_goals": 204,
    "result": "loss",
    "status": "complete"
  },
  "2026-10-03_legends_league": {
    "date": "2026-10-03",
    "timestamp": new Date('2026-10-03T12:00:00Z').getTime(),
    "opponent_league": "Legends League",
    "our_total_goals": 208,
    "opponent_total_goals": 121,
    "result": "win",
    "status": "complete"
  }
};

fs.writeFileSync(tIndexPath, JSON.stringify(correctIndex, null, 2), 'utf8');
console.log('Successfully updated tournaments_index.json!');
