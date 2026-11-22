const fs = require('fs');
const path = require('path');

const userList = [
  "САНЯ",
  "Abubakr",
  "abu_mohammad777",
  "MESSI",
  "TYRRRRRR6",
  "Eabngst",
  "Jordan",
  "Pitorico321456",
  "Uz_BESTchiter",
  "Habibi13",
  "PARIS-SG",
  "REDHAWK||",
  "Jeniik_",
  "Mohamed_Osama",
  "ggdrop",
  "midhunn",
  "Slothx8",
  "jasur",
  "Omar",
  "Иван",
  "REALMADRID",
  "Chelsea",
  "yazaaa_ya",
  "ureaa",
  "Rogelio",
  "Mike",
  "BOBURBEK02211",
  "Grego",
  "PSG",
  "Abirsh07",
  "Murodjon2013",
  "SPECIALPLAYER",
  "XxEv1lxX",
  "vadormirea",
  "sahil",
  "Ahrorardaguler15",
  "Argentina",
  "DOXIBER0",
  "XIEJINPING",
  "NotDvthes",
  "ghsoheil",
  "KOUSTAV_007",
  "RAM.-.LM10.-.-",
  "Dip",
  "blake",
  "elpepe",
  "real_madrid",
  "Fares",
  "Ramos",
  "CR7-PXBLQ",
  "alilou",
  "Тима",
  "abdoAshra",
  "Amonov",
  "facts.bou3",
  "John_Tomy",
  "GOAT",
  "Ace",
  "Aizen777",
  "MEE",
  "ronaldo7",
  "PRASHANT",
  "elgoatMessi",
  "Ronaldo7",
  "Ahmed214",
  "FUNKO_XH10",
  "Zema",
  "Fischer",
  "Aldo.A.G",
  "Karem",
  "FF777",
  "ProGamer",
  "DOXIBER01"
];

function normalize(s) {
  if (!s) return '';
  return s.toLowerCase()
    .replace(/[éèêë]/g, 'e')
    .replace(/[áàâä]/g, 'a')
    .replace(/[íìîï]/g, 'i')
    .replace(/[óòôö]/g, 'o')
    .replace(/[úùûü]/g, 'u')
    .replace(/[^a-z0-9а-яё]/gi, '')
    .trim();
}

const userNormalized = new Set(userList.map(normalize));

function processDirectory(baseDir) {
  console.log(`\nProcessing: ${baseDir}`);
  const playersDir = path.join(baseDir, 'players');
  const indexDir = path.join(baseDir, 'index');
  const trashDir = path.join(baseDir, '_trash');
  const trashPlayersDir = path.join(trashDir, 'players');
  const trashIndexDir = path.join(trashDir, 'index');

  if (!fs.existsSync(trashPlayersDir)) fs.mkdirSync(trashPlayersDir, { recursive: true });
  if (!fs.existsSync(trashIndexDir)) fs.mkdirSync(trashIndexDir, { recursive: true });

  const indexPath = path.join(indexDir, 'players_index.json');
  if (!fs.existsSync(indexPath)) return;

  const activeIndex = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const trashIndexPath = path.join(trashIndexDir, 'players_index.json');
  let trashIndex = {};
  if (fs.existsSync(trashIndexPath)) {
    trashIndex = JSON.parse(fs.readFileSync(trashIndexPath, 'utf8'));
  }

  const remainingIndex = {};

  for (const [pId, pSummary] of Object.entries(activeIndex)) {
    const normId = normalize(pId);
    const normName = normalize(pSummary.display_name);

    let isMatch = userList.find(u => normalize(u) === normName || normalize(u) === normId);
    if (!isMatch) {
      if (pId === 'sanya' || pSummary.display_name.toLowerCase().includes('саня')) isMatch = true;
      if (pId === 'doxibro' && userNormalized.has('doxiber0')) isMatch = true;
      if ((pId === 'roxtover' || pId === 'doxibero1') && (userNormalized.has('roxtover') || userNormalized.has('doxiber01') || userNormalized.has('roxt0ver'))) isMatch = true;
    }

    const pFilePath = path.join(playersDir, `${pId}.json`);

    if (isMatch) {
      // Keep active
      remainingIndex[pId] = pSummary;
      console.log(`  [ACTIVE] ${pId} (${pSummary.display_name})`);
    } else {
      // Move to trash
      trashIndex[pId] = {
        ...pSummary,
        archived_at: new Date().toISOString(),
        reason: 'Not present on active league roster sheet'
      };

      if (fs.existsSync(pFilePath)) {
        const destPath = path.join(trashPlayersDir, `${pId}.json`);
        fs.copyFileSync(pFilePath, destPath);
        fs.unlinkSync(pFilePath);
        console.log(`  [MOVED TO TRASH] ${pId} (${pSummary.display_name}) -> _trash/players/${pId}.json`);
      }
    }
  }

  // Write updated active index
  fs.writeFileSync(indexPath, JSON.stringify(remainingIndex, null, 2), 'utf8');
  // Write updated trash index
  fs.writeFileSync(trashIndexPath, JSON.stringify(trashIndex, null, 2), 'utf8');

  // Save active roster registry
  const rosterRegistryPath = path.join(baseDir, '_active_roster.json');
  fs.writeFileSync(rosterRegistryPath, JSON.stringify({
    last_updated: new Date().toISOString(),
    total_members: userList.length,
    members: userList
  }, null, 2), 'utf8');

  console.log(`Updated ${baseDir}: ${Object.keys(remainingIndex).length} active players, ${Object.keys(trashIndex).length} archived in _trash.`);
}

processDirectory('docs/league-data');
if (fs.existsSync('league-data')) {
  processDirectory('league-data');
}
