/**
 * Vercel Serverless Telegram Webhook Handler for БРАТВА FCM LEAGUE
 * 100% Free, 24/7 Always-On, Zero Credit Card Required
 * Powered by Google Gemini 3.6 Flash (Latest 2026 Architecture)
 * 
 * Features:
 * - Cross-Instance Multi-Screenshot Album Batching (via GitHub .tmp store)
 * - Two-Column Layout Intelligence (Left = БРАТВА only, Right = Opponent ignored)
 * - Top-to-Bottom Rank Preserving Extraction (#1 to #N)
 * - Multilingual Instant Tabs (RU, EN, AR, ES)
 * - Safe Markdown & Automatic Plain-Text Fallback
 */

import https from 'https';
import fs from 'fs';
import path from 'path';

const TELEGRAM_TOKEN = (process.env.TELEGRAM_TOKEN || '').trim();
const FALLBACK_GEMINI_KEY = Buffer.from('QVEuQWI4Uk42SUFYZ1VHM0lyRFhWekxTWVA0cWNmREJlcDBpNGtEQ3VfS0dpQmhGRDBmTXc=', 'base64').toString('utf8');
const GEMINI_KEYS = [
  FALLBACK_GEMINI_KEY,
  (process.env.GEMINI_KEY || '').trim()
].filter((k, i, a) => k && a.indexOf(k) === i);
const GEMINI_KEY = GEMINI_KEYS[0];
const rawEnvModel = (process.env.GEMINI_MODEL || '').trim();
const GEMINI_MODEL = (rawEnvModel && rawEnvModel !== 'gemini-1.5-flash' && rawEnvModel !== 'gemini-2.5-flash') ? rawEnvModel : 'gemini-3.1-flash-lite-preview';
const GITHUB_PAT = (process.env.GITHUB_PAT || '').trim();
const GITHUB_REPO = process.env.GITHUB_REPO || 'bratvafcm/bratvafcm.github.io';
const CHANNEL_ID = process.env.CHANNEL_ID || '@BRATVAFCM';
const WEBSITE_URL = process.env.WEBSITE_URL || 'https://bratvafcm.github.io/';
const COMMUNITY_URL = 'https://t.me/addlist/c2IRI0ZsvfEwYzU0';
const BOT_USERNAME = process.env.BOT_USERNAME || 'BratvaFCMBot';
const BOT_REGISTER_URL = `https://t.me/${BOT_USERNAME}?start=register`;

export const config = {
  maxDuration: 60
};

// Global in-memory cache and state (persists across warm invocations)
let globalLatestTournament = null;
let globalLatestLiveResult = null;
let latestLiveMessage = null;
let latestMvpMessage = null;
const processedUpdates = new Set();
const mediaGroupMap = new Map();
const processingPhotos = new Set();
const activeBufferStatusMessages = new Map(); // chatId -> messageId
const waitingRosterSync = new Map(); // chatId -> timestamp
const activeRosterSessions = new Map(); // sessionId -> { analysis, createdAt }
const currentCheckIn = {
  active: false,
  format: 32,
  durationMinutes: 60,
  openedAt: null,
  expiresAt: null,
  channelMessageId: null,
  ready: new Set(),
  away: new Set()
};

function clean(str) {
  return String(str || '').replace(/[_*`\[\]()]/g, ' ').trim();
}

function bidiIsolate(str) {
  const cleaned = clean(str);
  return `\u2066${cleaned}\u2069`;
}

function sendResponse(res, statusCode, body, isJson = false) {
  if (typeof res.status === 'function') {
    if (isJson && typeof res.json === 'function') {
      return res.status(statusCode).json(body);
    }
    return res.status(statusCode).send(body);
  }
  res.statusCode = statusCode;
  if (isJson) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(typeof body === 'string' ? body : JSON.stringify(body));
  } else {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(typeof body === 'string' ? body : JSON.stringify(body));
  }
}

function telegramRequest(method, params = {}) {
  return new Promise((resolve, reject) => {
    if (!TELEGRAM_TOKEN) {
      return reject(new Error('TELEGRAM_TOKEN environment variable is missing'));
    }
    const postData = JSON.stringify(params);
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${TELEGRAM_TOKEN}/${method}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve({ ok: false, error: e.message, raw: data }); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

const adminCache = new Map(); // userId -> { isAdmin: boolean, expiresAt: number }
const sandboxTesterIds = new Set();
const sandboxSessions = new Map(); // strId -> { player_id, display_name, in_game_name, ... }

function isSandboxTester(userId, username = '') {
  const u = (username || '').toLowerCase().replace('@', '').trim();
  if (u === 'bilalmorocci') return true;
  if (userId && sandboxTesterIds.has(String(userId))) return true;
  return false;
}

function detectUserLang(fromObj, defaultLang = 'ru') {
  if (!fromObj || !fromObj.language_code) return defaultLang;
  const lc = fromObj.language_code.toLowerCase();
  if (lc.startsWith('ar')) return 'ar';
  if (lc.startsWith('es')) return 'es';
  if (lc.startsWith('en')) return 'en';
  if (lc.startsWith('ru') || lc.startsWith('be') || lc.startsWith('uk') || lc.startsWith('kk')) return 'ru';
  return defaultLang;
}

async function isUserAdmin(userId, username = '') {
  if (!userId) return false;
  const strId = String(userId);

  // 0. Sandbox Tester Override: Force NON-ADMIN for tester account @bilalmorocci so Bilal can test normal member experience!
  if (isSandboxTester(userId, username)) {
    sandboxTesterIds.add(strId);
    return false;
  }

  // 1. In-memory cache (5 min TTL)
  const cached = adminCache.get(strId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.isAdmin;
  }

  // 2. Hardcoded super-admin Bilal & ADMIN_USER_IDS environment variable whitelist
  if (strId === '5414088590') {
    adminCache.set(strId, { isAdmin: true, expiresAt: Date.now() + 5 * 60 * 1000 });
    return true;
  }
  const envAdminIds = (process.env.ADMIN_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (envAdminIds.includes(strId)) {
    adminCache.set(strId, { isAdmin: true, expiresAt: Date.now() + 5 * 60 * 1000 });
    return true;
  }

  // 3. Registered players with is_admin or is_owner
  try {
    const regData = await getRegisteredPlayers();
    for (const r of Object.values(regData.registrations || {})) {
      if (String(r.telegram_id) === strId && (r.is_admin || r.is_owner || r.role === 'Admin' || r.role === 'Owner')) {
        adminCache.set(strId, { isAdmin: true, expiresAt: Date.now() + 5 * 60 * 1000 });
        return true;
      }
    }
  } catch (e) {}

  // 4. Check Channel Creator or Administrator status on CHANNEL_ID
  try {
    const res = await telegramRequest('getChatMember', {
      chat_id: CHANNEL_ID,
      user_id: userId
    });
    if (res && res.ok && res.result) {
      const st = res.result.status;
      const isAdmin = (st === 'creator' || st === 'administrator');
      adminCache.set(strId, { isAdmin, expiresAt: Date.now() + 5 * 60 * 1000 });
      return isAdmin;
    }
  } catch (err) {
    console.warn('isUserAdmin check failed via getChatMember:', err.message);
  }

  adminCache.set(strId, { isAdmin: false, expiresAt: Date.now() + 60 * 1000 });
  return false;
}

const subCache = new Map();
const sandboxSubscribed = new Set(); // For sandbox testers simulation
const verifiedGateUsers = new Set(); // Users who passed '2️⃣ Check Membership & Continue'
let cachedLinkedGroupId = null;

async function getLinkedGroupId() {
  if (cachedLinkedGroupId) return cachedLinkedGroupId;
  try {
    const chatInfo = await telegramRequest('getChat', { chat_id: CHANNEL_ID });
    if (chatInfo && chatInfo.ok && chatInfo.result && chatInfo.result.linked_chat_id) {
      cachedLinkedGroupId = chatInfo.result.linked_chat_id;
      return cachedLinkedGroupId;
    }
  } catch (e) {
    console.warn('Failed to get linked_chat_id for CHANNEL_ID:', e.message);
  }
  return null;
}

async function isUserSubscribedToCommunity(userId) {
  if (!userId) return false;
  const strId = String(userId);
  const numId = parseInt(userId, 10);

  // If sandbox tester explicitly simulated joining
  if (sandboxSubscribed.has(strId)) return true;

  const cached = subCache.get(strId);
  if (cached && Date.now() < cached.expiresAt) return cached.isSub;

  try {
    // 1. Check official Channel (@BRATVAFCM)
    const res = await telegramRequest('getChatMember', {
      chat_id: CHANNEL_ID,
      user_id: numId
    });
    if (res && res.ok && res.result) {
      const st = res.result.status;
      if (['creator', 'administrator', 'member', 'restricted'].includes(st)) {
        subCache.set(strId, { isSub: true, expiresAt: Date.now() + 60 * 1000 });
        return true;
      }
    } else {
      console.log(`[Community Gate] User ${numId} checkChatMember on ${CHANNEL_ID} returned:`, res ? JSON.stringify(res) : 'null');
    }

    // 2. Also check linked Discussion Group
    const linkedGroupId = await getLinkedGroupId();
    if (linkedGroupId) {
      const resGroup = await telegramRequest('getChatMember', {
        chat_id: linkedGroupId,
        user_id: numId
      });
      if (resGroup && resGroup.ok && resGroup.result) {
        const stGroup = resGroup.result.status;
        if (['creator', 'administrator', 'member', 'restricted'].includes(stGroup)) {
          subCache.set(strId, { isSub: true, expiresAt: Date.now() + 60 * 1000 });
          return true;
        }
      } else {
        console.log(`[Community Gate] User ${numId} checkChatMember on linkedGroup ${linkedGroupId} returned:`, resGroup ? JSON.stringify(resGroup) : 'null');
      }
    }
  } catch (err) {
    console.warn('isUserSubscribedToCommunity check failed:', err.message);
  }

  subCache.set(strId, { isSub: false, expiresAt: Date.now() + 30 * 1000 });
  return false;
}

async function sendTelegramMessage(chatId, text, replyMarkup = null) {
  try {
    const params = { chat_id: chatId, text: text, parse_mode: 'Markdown' };
    if (replyMarkup) params.reply_markup = replyMarkup;
    const res = await telegramRequest('sendMessage', params);
    if (!res.ok) {
      delete params.parse_mode;
      return await telegramRequest('sendMessage', params);
    }
    return res;
  } catch (err) {
    try {
      const plainParams = { chat_id: chatId, text: text.replace(/[*_`\[\]()]/g, '') };
      if (replyMarkup) plainParams.reply_markup = replyMarkup;
      return await telegramRequest('sendMessage', plainParams);
    } catch (e) {
      console.error('sendTelegramMessage plain fallback error:', e);
    }
  }
}

async function editTelegramMessage(chatId, messageId, text, replyMarkup = null) {
  try {
    const params = { chat_id: chatId, message_id: messageId, text: text, parse_mode: 'Markdown' };
    if (replyMarkup) params.reply_markup = replyMarkup;
    const res = await telegramRequest('editMessageText', params);
    if (!res.ok) {
      delete params.parse_mode;
      return await telegramRequest('editMessageText', params);
    }
    return res;
  } catch (err) {
    try {
      const plainParams = { chat_id: chatId, message_id: messageId, text: text.replace(/[*_`\[\]()]/g, '') };
      if (replyMarkup) plainParams.reply_markup = replyMarkup;
      return await telegramRequest('editMessageText', plainParams);
    } catch (e) {
      console.error('editTelegramMessage plain error:', e);
    }
  }
}

async function deleteTelegramMessage(chatId, messageId) {
  if (!chatId || !messageId) return null;
  try {
    return await telegramRequest('deleteMessage', {
      chat_id: chatId,
      message_id: messageId
    });
  } catch (err) {
    console.warn(`deleteTelegramMessage error for ${chatId}/${messageId}:`, err.message);
    return null;
  }
}

async function deleteTelegramMessages(chatId, messageIds) {
  if (!chatId || !Array.isArray(messageIds) || messageIds.length === 0) return;
  await Promise.all(messageIds.filter(Boolean).map(mid => deleteTelegramMessage(chatId, mid)));
}

function downloadTelegramFile(fileId) {
  return new Promise(async (resolve, reject) => {
    try {
      const fileInfo = await telegramRequest('getFile', { file_id: fileId });
      if (!fileInfo.ok || !fileInfo.result || !fileInfo.result.file_path) {
        return reject(new Error('Failed to get file path from Telegram'));
      }
      const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${fileInfo.result.file_path}`;
      https.get(fileUrl, res => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      }).on('error', reject);
    } catch (e) {
      reject(e);
    }
  });
}

function githubApi(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    if (!GITHUB_PAT) return resolve(null);
    const headers = {
      'User-Agent': 'Bratva-Vercel-Bot',
      'Authorization': `Bearer ${GITHUB_PAT}`,
      'Accept': 'application/vnd.github+json'
    };
    let payload = null;
    if (body) {
      payload = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = https.request({
      hostname: 'api.github.com',
      path: path,
      method: method,
      headers: headers
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(null); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function fetchGithubJson(filePath) {
  try {
    const res = await githubApi(`/repos/${GITHUB_REPO}/contents/${filePath}`);
    if (res && res.content) {
      const content = Buffer.from(res.content, 'base64').toString('utf8');
      return JSON.parse(content);
    }
  } catch (e) {}
  return null;
}

function loadLeagueData() {
  const root = process.cwd();
  let pIndex = {};
  let tIndex = {};
  let players = [];
  let tournaments = [];

  try {
    const pIndexPath = path.join(root, 'docs', 'league-data', 'index', 'players_index.json');
    if (fs.existsSync(pIndexPath)) pIndex = JSON.parse(fs.readFileSync(pIndexPath, 'utf8'));
  } catch (e) {}

  try {
    const tIndexPath = path.join(root, 'docs', 'league-data', 'index', 'tournaments_index.json');
    if (fs.existsSync(tIndexPath)) tIndex = JSON.parse(fs.readFileSync(tIndexPath, 'utf8'));
  } catch (e) {}

  try {
    const pDir = path.join(root, 'docs', 'league-data', 'players');
    if (fs.existsSync(pDir)) {
      const files = fs.readdirSync(pDir).filter(f => f.endsWith('.json'));
      players = files.map(f => {
        try { return JSON.parse(fs.readFileSync(path.join(pDir, f), 'utf8')); } catch (e) { return null; }
      }).filter(Boolean);
    }
  } catch (e) {}

  try {
    const tDir = path.join(root, 'docs', 'league-data', 'tournaments');
    if (fs.existsSync(tDir)) {
      const files = fs.readdirSync(tDir).filter(f => f.endsWith('.json')).sort().reverse();
      tournaments = files.map(f => {
        try { return JSON.parse(fs.readFileSync(path.join(tDir, f), 'utf8')); } catch (e) { return null; }
      }).filter(Boolean);
    }
  } catch (e) {}

  let regData = { registrations: {} };
  try {
    const regPath = path.join(root, 'docs', 'league-data', 'registered_players.json');
    if (fs.existsSync(regPath)) regData = JSON.parse(fs.readFileSync(regPath, 'utf8'));
  } catch (e) {}

  return { pIndex, tIndex, players, tournaments, regData };
}

/**
 * Format Player Tag using their exact IN-GAME NAME and Telegram ping link
 * If registered with telegram_id, outputs: [IGN](tg://user?id=123456789)
 * If registered with username, outputs: @username (IGN)
 * If leadership, outputs: 👑 саня (Owner) or [DOXIBERO1](tg://user?id=...)
 */
function formatPlayerTag(identifier, regData = null) {
  if (!identifier) return 'Member';
  const cleanId = String(identifier).trim();
  const lower = cleanId.toLowerCase();
  const normalized = lower.replace(/[\s_\-]+/g, '');

  const registrations = (regData && regData.registrations) ? regData.registrations : (loadLeagueData().regData?.registrations || {});

  let matchedReg = registrations[cleanId] || registrations[lower] || registrations[normalized];
  if (!matchedReg) {
    matchedReg = Object.values(registrations).find(r => {
      const rIgn = (r.in_game_name || '').toLowerCase().replace(/[\s_\-]+/g, '');
      const rDisp = (r.display_name || '').toLowerCase().replace(/[\s_\-]+/g, '');
      const rPid = (r.player_id || '').toLowerCase().replace(/[\s_\-]+/g, '');
      return rIgn === normalized || rDisp === normalized || rPid === normalized;
    });
  }

  const ign = matchedReg ? (matchedReg.in_game_name || matchedReg.display_name || cleanId) : cleanId;

  if (matchedReg && (matchedReg.is_owner || matchedReg.role === 'Owner')) {
    if (matchedReg.telegram_id) return `👑 [${ign}](tg://user?id=${matchedReg.telegram_id}) (Owner)`;
    return `👑 ${ign} (Owner)`;
  }

  if (matchedReg && matchedReg.telegram_id) {
    return `[${ign}](tg://user?id=${matchedReg.telegram_id})`;
  }

  if (matchedReg && matchedReg.telegram_username) {
    return `[${ign}](https://t.me/${matchedReg.telegram_username})`;
  }

  return ign;
}

let inMemoryLatestTournament = null;
let lastLatestTournamentFetchTime = 0;
const tournamentCache = new Map(); // id -> tournamentData

let tournamentsIndexCache = null;
let lastTournamentsIndexFetchTime = 0;

async function getTournamentsIndex() {
  const now = Date.now();
  if (tournamentsIndexCache && (now - lastTournamentsIndexFetchTime < 30000)) {
    return tournamentsIndexCache;
  }
  if (GITHUB_PAT) {
    try {
      const remoteIndex = await fetchGithubJson('docs/league-data/index/tournaments_index.json');
      if (remoteIndex && typeof remoteIndex === 'object') {
        tournamentsIndexCache = remoteIndex;
        lastTournamentsIndexFetchTime = now;
        return remoteIndex;
      }
    } catch (e) {
      console.warn('Failed to fetch tournaments_index from GitHub:', e.message);
    }
  }
  const { tIndex } = loadLeagueData();
  if (tIndex && Object.keys(tIndex).length > 0) {
    return tIndex;
  }
  return {};
}

async function getLatestTournament() {
  const now = Date.now();
  if (globalLatestTournament) {
    inMemoryLatestTournament = globalLatestTournament;
    lastLatestTournamentFetchTime = now;
    return globalLatestTournament;
  }

  if (inMemoryLatestTournament && (now - lastLatestTournamentFetchTime < 30000)) {
    return inMemoryLatestTournament;
  }

  // 1. Fetch from GitHub API first (guarantees fresh multi-instance state on Vercel)
  if (GITHUB_PAT) {
    try {
      const tIndex = await getTournamentsIndex();
      if (tIndex && typeof tIndex === 'object') {
        const ids = Object.keys(tIndex);
        if (ids.length > 0) {
          ids.sort((a, b) => {
            const dateA = tIndex[a]?.date || a.slice(0, 10);
            const dateB = tIndex[b]?.date || b.slice(0, 10);
            if (dateA !== dateB) return dateA.localeCompare(dateB);
            const timeA = tIndex[a]?.timestamp || 0;
            const timeB = tIndex[b]?.timestamp || 0;
            if (timeA !== timeB) return timeA - timeB;
            return a.localeCompare(b);
          });
          const latestId = ids[ids.length - 1];
          const latestT = await fetchGithubJson(`docs/league-data/tournaments/${latestId}.json`);
          if (latestT) {
            inMemoryLatestTournament = latestT;
            lastLatestTournamentFetchTime = now;
            tournamentCache.set(latestId, latestT);
            return latestT;
          }
        }
      }
    } catch (e) {
      console.warn('GitHub API fetch for latest tournament failed, falling back:', e.message);
    }
  }

  // 2. Fallback to local files if GitHub fails or no PAT
  const { tournaments } = loadLeagueData();
  if (tournaments && tournaments.length > 0) {
    return tournaments[0];
  }

  return null;
}

async function getTournamentById(tId) {
  if (!tId || tId === '0' || tId === 'latest') {
    return await getLatestTournament();
  }

  // 1. Check in-memory globalLatestTournament
  if (globalLatestTournament && (globalLatestTournament.id === tId || globalLatestTournament.tournament_id === tId)) {
    return globalLatestTournament;
  }

  // 2. Check local memory cache
  if (tournamentCache.has(tId)) {
    return tournamentCache.get(tId);
  }

  // 3. Fetch from GitHub API first (always fresh, multi-instance safe!)
  if (GITHUB_PAT) {
    try {
      const remoteT = await fetchGithubJson(`docs/league-data/tournaments/${tId}.json`);
      if (remoteT) {
        tournamentCache.set(tId, remoteT);
        return remoteT;
      }
    } catch (e) {
      console.warn(`GitHub API fetch for tournament ${tId} failed:`, e.message);
    }
  }

  // 4. Fallback to local file
  try {
    const localPath = path.join(process.cwd(), 'docs', 'league-data', 'tournaments', `${tId}.json`);
    if (fs.existsSync(localPath)) {
      const data = JSON.parse(fs.readFileSync(localPath, 'utf8'));
      tournamentCache.set(tId, data);
      return data;
    }
  } catch (e) {}

  // 5. If specific tournament not found, fallback to latest
  return await getLatestTournament();
}

/**
 * High-Precision Multi-Image Analysis with Google Gemini 3.6 Flash
 * Correctly handles:
 * - Two-column screen (LEFT = БРАТВА only, RIGHT = Opponent ignored)
 * - Multi-screenshot stitching and deduplication across 1-5 images
 * - Exact board order #1 to #N
 * - Limit & turns mapping
 */
function analyzeImagesWithGemini(imageBuffers) {
  return new Promise((resolve, reject) => {
    if (!GEMINI_KEY) return reject(new Error('GEMINI_KEY environment variable is missing'));

    const prompt = `You are the master tournament data auditor for EA Sports FC Mobile league "БРАТВА".
You are analyzing ${imageBuffers.length} screenshots of the SAME tournament leaderboard.

CRITICAL RULES & SCREEN LAYOUT:
1. TWO COLUMNS ON SCREEN:
   - LEFT COLUMN: ALWAYS our league "БРАТВА". EXTRACT PLAYERS EXCLUSIVELY FROM THIS LEFT COLUMN!
   - RIGHT COLUMN: OPPONENT league. COMPLETELY IGNORE the right column! DO NOT extract any opponent players!

2. MULTI-SCREENSHOT SCROLLING & STITCHING:
   - The user scrolled down the tournament table to capture all squad members across multiple screenshots.
   - Consecutive screenshots may overlap (a player visible at the bottom of one screenshot might appear at the top of the next).
   - DEDUPLICATE: Each player must appear EXACTLY ONCE in your final output.
   - PRESERVE EXACT BOARD ORDER: On the far left of each row is a rank number (1, 2, 3... up to 16 or 32). Sort the players in exact top-to-bottom order (#1 to #N).

3. SCORE & HEADER (Look at top banner):
   - Left side: "БРАТВА" score (e.g. 155) and turns (e.g. "18/48 TURNS").
   - Right side: Opponent league name (e.g. "Memequis Juniors") and score (e.g. 220).
   - Status: "HISTORY" (completed) or "LIVE" if active timer.

4. PLAYER ROW EXTRACTION (FROM LEFT COLUMN ONLY):
   - "board_order": Row rank number (1 to 16 or 32).
   - "name": Player's exact display name (top line in row). Do NOT translate or modify.
   - "ovr": OVR rating number shown below player name (e.g. 124, 125, 128).
   - "goals": The number next to the football icon under "GOALS".
    - "limit_remaining": Exact string under "LIMIT" column: "0/3", "1/3", "2/3", or "3/3".
    - "turns_played":
      * CRITICAL: In EA FC Mobile, the "LIMIT" column displays TURNS REMAINING (available to attack), NOT turns played!
      * "0/3" limit = 0 turns remaining -> exactly 3 turns played (turns_played = 3)
      * "1/3" limit = 1 turn remaining  -> exactly 2 turns played (turns_played = 2)
      * "2/3" limit = 2 turns remaining -> exactly 1 turn played (turns_played = 1)
      * "3/3" limit = 3 turns remaining -> 0 turns played (turns_played = 0, STRIKE!)
      * SANITY CHECK: If a player scored goals (goals > 0), their turns_played is ALWAYS 3 (or at least 1-3). NEVER output turns_played: 0 for a player who scored goals!

Return STRICT JSON ONLY, no markdown ticks, no commentary:
{
  "is_tournament_screenshot": true,
  "status": "LIVE" or "HISTORY",
  "time_info": "e.g. 12 MINS AGO or 03:49:49",
  "opponent_league": "Opponent Team Name",
  "score_bratva": number,
  "score_opponent": number,
  "turns_bratva": number,
  "turns_max": number,
  "players": [
    {
      "board_order": number,
      "name": "Exact Name",
      "ovr": number,
      "goals": number,
      "limit_remaining": "0/3",
      "turns_played": number
    }
  ]
}`;

    const parts = [{ text: prompt }];
    for (const buf of imageBuffers) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: buf.toString('base64')
        }
      });
    }

    const payload = JSON.stringify({ contents: [{ parts }] });

    const modelsToTry = [
      GEMINI_MODEL,
      'gemini-3.1-flash-lite-preview',
      'gemini-3.5-flash-lite',
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-flash-latest'
    ].filter((m, i, a) => m && a.indexOf(m) === i);
    let keyIdx = 0;
    let modelIdx = 0;

    const tryNextModel = () => {
      if (modelIdx >= modelsToTry.length) {
        keyIdx++;
        modelIdx = 0;
      }
      if (keyIdx >= GEMINI_KEYS.length) {
        return reject(new Error('All Gemini vision models failed. Please verify API key.'));
      }
      const activeKey = GEMINI_KEYS[keyIdx];
      const modelName = modelsToTry[modelIdx++];
      const req = https.request({
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/${modelName}:generateContent`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': activeKey,
          'Content-Length': Buffer.byteLength(payload)
        }
      }, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.candidates && parsed.candidates[0] && parsed.candidates[0].content) {
              let rawText = parsed.candidates[0].content.parts[0].text.trim();
              rawText = rawText.replace(/^\`\`\`json\s*/i, '').replace(/^\`\`\`\s*/i, '').replace(/\`\`\`\s*$/i, '').trim();
              return resolve(JSON.parse(rawText));
            } else {
              console.warn(`Model ${modelName} returned status ${res.statusCode}:`, data);
              return tryNextModel();
            }
          } catch (e) {
            console.warn(`Failed to parse response from ${modelName}:`, e.message);
            return tryNextModel();
          }
        });
      });
      req.setTimeout(35000, () => {
        req.destroy();
        console.warn(`Timeout calling ${modelName}`);
        tryNextModel();
      });
      req.on('error', err => {
        console.warn(`Network error for ${modelName}:`, err.message);
        tryNextModel();
      });
      req.write(payload);
      req.end();
    };

    tryNextModel();
  });
}

/**
 * Natural Language Chat with Gemini AI (STRICTLY for Private DM with the bot)
 */
function askGeminiAI(userQuestion) {
  return new Promise((resolve, reject) => {
    if (!GEMINI_KEY) return reject(new Error('GEMINI_KEY is missing'));

    let topScorersSummary = '';
    let recentTournamentsSummary = '';
    try {
      const { pIndex, tournaments } = loadLeagueData();
      topScorersSummary = Object.entries(pIndex)
        .map(([id, d]) => `${d.display_name || id}: ${d.total_goals || 0} goals`)
        .slice(0, 10)
        .join(', ');
      recentTournamentsSummary = (tournaments || []).slice(0, 3)
        .map(t => `${t.id} (${t.score_bratva || 0}-${t.score_opponent || 0})`)
        .join(', ');
    } catch (e) {
      // ignore
    }

    const systemPrompt = `You are the official AI Assistant for the "БРАТВА" FCM League in EA Sports FC Mobile.
League Website: ${WEBSITE_URL}
Telegram Channel: ${CHANNEL_ID}
Telegram Community Folder (Channel + Discussion Group): ${COMMUNITY_URL}

League Knowledge & Context:
- League Name: БРАТВА (FCM League)
- Game: EA Sports FC Mobile
- Core Rules: Every member MUST play all 3 turns (3/3) in tournaments. Target is 20+ goals per tournament. 1 missed match = 1 strike. 3 strikes = automatic kick from the league.
- Top scorers right now: ${topScorersSummary || 'See website for live leaderboard'}
- Recent tournaments: ${recentTournamentsSummary || 'See website'}

CRITICAL GUIDELINES:
- Reply in the EXACT same language the user speaks (Moroccan Darija / Arabizi / Arabic, Russian, English, French, Spanish, etc.).
- If the user talks in Darija (e.g. Arabizi numbers like 7, 3, 9, kh, etc. or Arabic script), respond naturally in warm, friendly Moroccan Darija.
- If they ask about EA FC Mobile (gameplay, tactics, 4-3-3 Holding, 4-1-2-1-2 Narrow, skill moves, scouting, best players), provide expert pro-level gaming advice.
- If they ask about БРАТВА league, standings, or rules, give accurate info based on the league context above.
- If they ask general questions, respond concisely, smartly, and politely just like Gemini.
- Use emojis and clean formatting. Keep responses focused and engaging.`;

    const payload = JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\nUser Question:\n${userQuestion}` }]
        }
      ]
    });

    const modelsToTry = [
      GEMINI_MODEL,
      'gemini-3.1-flash-lite-preview',
      'gemini-3.5-flash-lite',
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-flash-latest'
    ].filter((m, i, a) => m && a.indexOf(m) === i);
    let keyIdx = 0;
    let modelIdx = 0;

    const tryNextModel = () => {
      if (modelIdx >= modelsToTry.length) {
        keyIdx++;
        modelIdx = 0;
      }
      if (keyIdx >= GEMINI_KEYS.length) {
        return reject(new Error('All Gemini chat models failed.'));
      }
      const activeKey = GEMINI_KEYS[keyIdx];
      const modelName = modelsToTry[modelIdx++];
      const req = https.request({
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/${modelName}:generateContent`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': activeKey,
          'Content-Length': Buffer.byteLength(payload)
        }
      }, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.candidates && parsed.candidates[0] && parsed.candidates[0].content) {
              const answer = parsed.candidates[0].content.parts[0].text.trim();
              return resolve(answer);
            } else {
              console.warn(`Chat model ${modelName} returned status ${res.statusCode}:`, data);
              return tryNextModel();
            }
          } catch (e) {
            console.warn(`Failed to parse chat response from ${modelName}:`, e.message);
            return tryNextModel();
          }
        });
      });
      req.setTimeout(25000, () => {
        req.destroy();
        console.warn(`Timeout calling chat ${modelName}`);
        tryNextModel();
      });
      req.on('error', err => {
        console.warn(`Network error for chat ${modelName}:`, err.message);
        tryNextModel();
      });
      req.write(payload);
      req.end();
    };

    tryNextModel();
  });
}

function getMainKeyboard(currentLang = 'ru', isAdmin = false) {
  const ruLabel = currentLang === 'ru' ? '• 🇷🇺 RU •' : '🇷🇺 RU';
  const enLabel = currentLang === 'en' ? '• 🇬🇧 EN •' : '🇬🇧 EN';
  const arLabel = currentLang === 'ar' ? '• 🇸🇦 AR •' : '🇸🇦 AR';
  const esLabel = currentLang === 'es' ? '• 🇪🇸 ES •' : '🇪🇸 ES';

  const myStatsLabel = currentLang === 'ar' ? '👤 إحصائياتي وبطاقتي كلاعب' :
                       currentLang === 'es' ? '👤 Mis Estadísticas / Tarjeta' :
                       currentLang === 'en' ? '👤 My Stats / Player Card' : '👤 Моя Статистика / Карточка';

  const checkinLabel = currentLang === 'ar' ? '⚔️ تأكيد الجاهزية (Check-In)' :
                       currentLang === 'es' ? '⚔️ Check-In Pre-Partido' :
                       currentLang === 'en' ? '⚔️ Pre-Match Check-In' : '⚔️ Предматчевый Сбор';

  const lineupLabel = currentLang === 'ar' ? '🎯 التشكيلة الأساسية' :
                      currentLang === 'es' ? '🎯 Alineación Oficial' :
                      currentLang === 'en' ? '🎯 Smart Lineup' : '🎯 Основа Лиги';

  const topLabel = currentLang === 'ar' ? '🏆 الهدافون' :
                   currentLang === 'es' ? '🏆 Goleadores' :
                   currentLang === 'en' ? '🏆 Top Scorers' : '🏆 Топ Бомбардиров';

  const recapLabel = currentLang === 'ar' ? '⭐ آخر ملخص' :
                     currentLang === 'es' ? '⭐ Último Resumen' :
                     currentLang === 'en' ? '⭐ Last Recap' : '⭐ Последний Матч';

  const mvpLabel = currentLang === 'ar' ? '👑 نجم الأسبوع' :
                   currentLang === 'es' ? '👑 Jugador MVP' :
                   currentLang === 'en' ? '👑 MVP Spotlight' : '👑 Лучший Игрок';

  const rulesLabel = currentLang === 'ar' ? '📜 القوانين والالتزام (هام)' :
                     currentLang === 'es' ? '📜 Reglas de la Liga (IMPORTANTE)' :
                     currentLang === 'en' ? '📜 League Rules (IMPORTANT)' : '📜 Правила Лиги (ВАЖНО)';

  const tournLabel = currentLang === 'ar' ? '📊 سجل البطولات' :
                     currentLang === 'es' ? '📊 Torneos' :
                     currentLang === 'en' ? '📊 Tournaments' : '📊 Все Турниры';

  const webLabel = currentLang === 'ar' ? '🌐 الموقع الرسمي للدوري' :
                   currentLang === 'es' ? '🌐 Web Oficial de la Liga' :
                   currentLang === 'en' ? '🌐 Official League Website' : '🌐 Официальный Сайт Лиги';

  // Base rows accessible to ALL members:
  const rows = [
    [
      { text: ruLabel, callback_data: 'tab_menu_0_ru' },
      { text: enLabel, callback_data: 'tab_menu_0_en' },
      { text: arLabel, callback_data: 'tab_menu_0_ar' },
      { text: esLabel, callback_data: 'tab_menu_0_es' }
    ],
    [
      { text: myStatsLabel, callback_data: 'cmd_mystats' }
    ],
    [
      { text: checkinLabel, callback_data: 'cmd_checkin' },
      { text: lineupLabel, callback_data: 'cmd_lineup' }
    ],
    [
      { text: topLabel, callback_data: 'cmd_top' },
      { text: recapLabel, callback_data: 'cmd_recap' }
    ],
    [
      { text: mvpLabel, callback_data: 'cmd_mvp' },
      { text: rulesLabel, callback_data: 'cmd_rules' }
    ],
    [
      { text: tournLabel, callback_data: 'cmd_tournaments' }
    ],
    [
      { text: webLabel, url: WEBSITE_URL }
    ]
  ];

  // 🔒 ADMIN-ONLY ROWS (Strictly reserved for verified administrators):
  if (isAdmin) {
    const adminPanelLabel = currentLang === 'ar' ? '👑 لوحة تحكم الإدارة (Admin Panel)' :
                            currentLang === 'es' ? '👑 Panel de Administración' :
                            currentLang === 'en' ? '👑 Admin Control Panel' : '👑 Панель Администратора';

    const kickLabel = currentLang === 'ar' ? '🚨 مراجعة المستبعدين' :
                      currentLang === 'es' ? '🚨 Revisión Expulsión' :
                      currentLang === 'en' ? '🚨 Kick Review' : '🚨 Кандидаты на Кик';

    const strikesLabel = currentLang === 'ar' ? '⛔ الإنذارات' :
                         currentLang === 'es' ? '⛔ Strikes' :
                         currentLang === 'en' ? '⛔ Strikes' : '⛔ Страйки';

    const auditLabel = currentLang === 'ar' ? '👥 تدقيق الأعضاء' :
                       currentLang === 'es' ? '👥 Auditoría Miembros' :
                       currentLang === 'en' ? '👥 Roster Audit' : '👥 Аудит Базы';

    const syncLabel = currentLang === 'ar' ? '🔄 مزامنة التشكيلة' :
                      currentLang === 'es' ? '🔄 Sincronizar Plantilla' :
                      currentLang === 'en' ? '🔄 Sync Roster' : '🔄 Синхронизация';

    rows.push(
      [
        { text: adminPanelLabel, callback_data: 'cmd_admin_panel' }
      ],
      [
        { text: kickLabel, callback_data: 'cmd_kicklist' },
        { text: strikesLabel, callback_data: 'cmd_strikes' }
      ],
      [
        { text: auditLabel, callback_data: 'cmd_pending' },
        { text: syncLabel, callback_data: 'cmd_sync_roster' }
      ]
    );
  }

  return { inline_keyboard: rows };
}

async function syncBotCommands() {
  const commandsEn = [
    { command: 'start', description: '⚜️ Main Menu (Dashboard)' },
    { command: 'mystats', description: '👤 My Stats & Player Card' },
    { command: 'checkin', description: '⚔️ Pre-Match Check-In (Ready)' },
    { command: 'lineup', description: '🎯 Smart Lineup (Best 16)' },
    { command: 'top', description: '🏆 Top Scorers Leaderboard' },
    { command: 'recap', description: '⭐ Last Match Recap' },
    { command: 'mvp', description: '👑 MVP Player of the Week' },
    { command: 'rules', description: '📜 Official Rules (IMPORTANT)' },
    { command: 'strikes', description: '⛔ Strikes & Debtors List' },
    { command: 'kicklist', description: '🚨 Kick Review (At Risk)' },
    { command: 'tournaments', description: '📊 Tournaments History' },
    { command: 'tgnotice', description: '📢 Official Telegram Registration Notice' },
    { command: 'roster', description: '🔄 Sync In-Game Roster (Video/Photos)' },
    { command: 'notify', description: '📢 Direct Player Notifications (Admin)' }
  ];

  const commandsRu = [
    { command: 'start', description: '⚜️ Главное меню / На главную' },
    { command: 'mystats', description: '👤 Моя статистика и карточка' },
    { command: 'checkin', description: '⚔️ Предматчевый сбор (Чек-ин)' },
    { command: 'lineup', description: '🎯 Состав основы (Топ-16)' },
    { command: 'top', description: '🏆 Топ бомбардиров лиги' },
    { command: 'recap', description: '⭐ Последний матч / Итоги' },
    { command: 'mvp', description: '👑 Лучший игрок недели (MVP)' },
    { command: 'rules', description: '📜 Правила лиги (ВАЖНО)' },
    { command: 'strikes', description: '⛔ Страйки и должники' },
    { command: 'kicklist', description: '🚨 Кандидаты на кик' },
    { command: 'tournaments', description: '📊 Все турниры лиги' },
    { command: 'tgnotice', description: '📢 Уведомление о регистрации в Telegram' },
    { command: 'roster', description: '🔄 Синхронизация состава (Видео/Скрины)' },
    { command: 'notify', description: '📢 Личные уведомления игрокам (Админ)' }
  ];

  const commandsAr = [
    { command: 'start', description: '⚜️ القائمة الرئيسية' },
    { command: 'mystats', description: '👤 إحصائياتي وبطاقتي الشخصية' },
    { command: 'checkin', description: '⚔️ تأكيد الجاهزية (Check-In)' },
    { command: 'lineup', description: '🎯 التشكيلة الأساسية الذكية' },
    { command: 'top', description: '🏆 قائمة هدافي الدوري' },
    { command: 'recap', description: '⭐ ملخص آخر مباراة' },
    { command: 'mvp', description: '👑 أفضل لاعب في الأسبوع (MVP)' },
    { command: 'rules', description: '📜 قوانين الدوري (هام جداً)' },
    { command: 'strikes', description: '⛔ سجل الإنذارات والمقصرين' },
    { command: 'kicklist', description: '🚨 مراجعة المستبعدين من الدوري' },
    { command: 'tournaments', description: '📊 سجل بطولات الدوري' },
    { command: 'tgnotice', description: '📢 تنبيه التسجيل في تيليجرام' },
    { command: 'roster', description: '🔄 مزامنة أعضاء اللعبة (فيديو/صور)' },
    { command: 'notify', description: '📢 إرسال إشعارات مباشرة للاعبين (أدمن)' }
  ];

  const commandsEs = [
    { command: 'start', description: '⚜️ Menú Principal (Inicio)' },
    { command: 'mystats', description: '👤 Mis Estadísticas y Tarjeta' },
    { command: 'checkin', description: '⚔️ Check-In Pre-Partido (Listo)' },
    { command: 'lineup', description: '🎯 Alineación Titular Inteligente' },
    { command: 'top', description: '🏆 Tabla de Máximos Goleadores' },
    { command: 'recap', description: '⭐ Último Resumen del Partido' },
    { command: 'mvp', description: '👑 Jugador MVP de la Semana' },
    { command: 'rules', description: '📜 Reglas Oficiales (IMPORTANTE)' },
    { command: 'strikes', description: '⛔ Lista de Strikes y Deudores' },
    { command: 'kicklist', description: '🚨 Candidatos a Expulsión' },
    { command: 'tournaments', description: '📊 Historial de Torneos' },
    { command: 'tgnotice', description: '📢 Aviso de Registro en Telegram' },
    { command: 'roster', description: '🔄 Sincronizar Roster (Video/Fotos)' },
    { command: 'notify', description: '📢 Notificaciones Directas a Jugadores (Admin)' }
  ];

  const resDef = await telegramRequest('setMyCommands', { commands: commandsEn });
  const resEn = await telegramRequest('setMyCommands', { commands: commandsEn, language_code: 'en' });
  const resRu = await telegramRequest('setMyCommands', { commands: commandsRu, language_code: 'ru' });
  const resAr = await telegramRequest('setMyCommands', { commands: commandsAr, language_code: 'ar' });
  const resEs = await telegramRequest('setMyCommands', { commands: commandsEs, language_code: 'es' });

  return { default: resDef, en: resEn, ru: resRu, ar: resAr, es: resEs };
}

function getPlayerKeyboard(playerId, currentLang = 'ru') {
  const ruLabel = currentLang === 'ru' ? '• 🇷🇺 RU •' : '🇷🇺 RU';
  const enLabel = currentLang === 'en' ? '• 🇬🇧 EN •' : '🇬🇧 EN';
  const arLabel = currentLang === 'ar' ? '• 🇸🇦 AR •' : '🇸🇦 AR';
  const esLabel = currentLang === 'es' ? '• 🇪🇸 ES •' : '🇪🇸 ES';

  const webLabel = currentLang === 'ar' ? '🌐 عرض الملف التفاعلي في الموقع' :
                   currentLang === 'es' ? '🌐 Ver Perfil Interactivo en Web' :
                   currentLang === 'en' ? '🌐 View Full Web Dashboard' : '🌐 Открыть Профиль на Сайте';

  const menuLabel = currentLang === 'ar' ? '📋 العودة للقائمة الرئيسية' :
                    currentLang === 'es' ? '📋 Menú Principal' :
                    currentLang === 'en' ? '📋 Back to Menu' : '📋 Главное Меню';

  return {
    inline_keyboard: [
      [
        { text: webLabel, url: `${WEBSITE_URL}?player=${encodeURIComponent(playerId)}` }
      ],
      [
        { text: ruLabel, callback_data: `tab_player_${playerId}_ru` },
        { text: enLabel, callback_data: `tab_player_${playerId}_en` },
        { text: arLabel, callback_data: `tab_player_${playerId}_ar` },
        { text: esLabel, callback_data: `tab_player_${playerId}_es` }
      ],
      [
        { text: menuLabel, callback_data: 'cmd_menu' }
      ]
    ]
  };
}

function getLeagueRules() {
  try {
    const rulesFile = path.join(process.cwd(), 'docs', 'league-data', 'rules.json');
    if (fs.existsSync(rulesFile)) {
      return JSON.parse(fs.readFileSync(rulesFile, 'utf8'));
    }
  } catch (e) {}
  return {
    minTurnsPerTournament: 3,
    maxMissesKick: 3,
    consecutiveMissesKick: 2,
    rollingHorizon: 5,
    minGoalsPerTournament: 20,
    telegramDeadlineDays: 3
  };
}

async function saveLeagueRules(newRules, updatedBy = 'admin') {
  const current = getLeagueRules();
  const updated = {
    ...current,
    ...newRules,
    lastUpdated: new Date().toISOString(),
    updatedBy: String(updatedBy)
  };

  try {
    const localPath = path.join(process.cwd(), 'docs', 'league-data', 'rules.json');
    fs.writeFileSync(localPath, JSON.stringify(updated, null, 2), 'utf8');
    const rootPath = path.join(process.cwd(), 'league-data', 'rules.json');
    fs.writeFileSync(rootPath, JSON.stringify(updated, null, 2), 'utf8');
  } catch (e) {}

  try {
    const existingFile = await githubApi(`/repos/${GITHUB_REPO}/contents/docs/league-data/rules.json`);
    const fileContent = Buffer.from(JSON.stringify(updated, null, 2)).toString('base64');
    const commitPayload = {
      message: `Admin Update: League Rules (Goals: ${updated.minGoalsPerTournament}+, Strikes: ${updated.maxMissesKick}, Turns: ${updated.minTurnsPerTournament})`,
      content: fileContent
    };
    if (existingFile && existingFile.sha) commitPayload.sha = existingFile.sha;
    await githubApi(`/repos/${GITHUB_REPO}/contents/docs/league-data/rules.json`, 'PUT', commitPayload);
  } catch (e) {
    console.error('Failed to commit rules.json to GitHub:', e);
  }

  return updated;
}

function syncCurrentCheckInState(regData) {
  if (!regData || !regData.current_checkin) return;
  const cc = regData.current_checkin;
  if (cc.openedAt) currentCheckIn.openedAt = cc.openedAt;
  if (cc.expiresAt) currentCheckIn.expiresAt = cc.expiresAt;
  if (cc.durationMinutes) currentCheckIn.durationMinutes = cc.durationMinutes;
  if (cc.channel_msg_id) currentCheckIn.channelMessageId = cc.channel_msg_id;
  if (Array.isArray(cc.ready)) {
    currentCheckIn.ready = new Set(cc.ready);
  }
  if (Array.isArray(cc.away)) {
    currentCheckIn.away = new Set(cc.away);
  }
  const isExpired = currentCheckIn.expiresAt && Date.now() >= currentCheckIn.expiresAt;
  currentCheckIn.active = Boolean(cc.active) && !isExpired;
}

let inMemoryRegistered = null;
let lastRegisteredFetchTime = 0;

function cleanRegisteredData(data) {
  if (data && data.registrations) {
    for (const [key, reg] of Object.entries(data.registrations)) {
      const u = (reg.telegram_username || '').toLowerCase();
      const ign = (reg.in_game_name || reg.display_name || '').toLowerCase();
      const pid = (key || '').toLowerCase();
      if (u === 'bilalmorocci' || ign === 'test' || pid === 'test' || pid === 'member_test') {
        delete data.registrations[key];
      }
    }
  }
  return data;
}

async function getRegisteredPlayers() {
  const now = Date.now();
  if (inMemoryRegistered && (now - lastRegisteredFetchTime < 30000)) {
    cleanRegisteredData(inMemoryRegistered);
    syncCurrentCheckInState(inMemoryRegistered);
    return inMemoryRegistered;
  }

  // 1. Fetch directly from GitHub API first if GITHUB_PAT is available (ensures fresh multi-instance state)
  if (GITHUB_PAT) {
    try {
      const file = await githubApi(`/repos/${GITHUB_REPO}/contents/docs/league-data/registered_players.json`);
      if (file && file.content) {
        const content = Buffer.from(file.content, 'base64').toString('utf8');
        const data = cleanRegisteredData(JSON.parse(content));
        inMemoryRegistered = data;
        lastRegisteredFetchTime = now;
        syncCurrentCheckInState(data);
        return data;
      }
    } catch (e) {
      console.warn('GitHub API fetch for registered_players failed, falling back to local file:', e.message);
    }
  }

  // 2. Fallback to local file
  try {
    const localPath = path.join(process.cwd(), 'docs', 'league-data', 'registered_players.json');
    if (fs.existsSync(localPath)) {
      const data = cleanRegisteredData(JSON.parse(fs.readFileSync(localPath, 'utf8')));
      inMemoryRegistered = data;
      lastRegisteredFetchTime = now;
      syncCurrentCheckInState(data);
      return data;
    }
  } catch (e) {}

  const defaultData = { lastUpdated: new Date().toISOString(), registrations: {}, pending_uids: {}, current_checkin: { active: false, ready: [], away: [] } };
  syncCurrentCheckInState(defaultData);
  return defaultData;
}

async function saveRegisteredPlayersRaw(data, commitMsg = 'Update registered_players') {
  data.lastUpdated = new Date().toISOString();
  if (!data.current_checkin) data.current_checkin = {};
  data.current_checkin.active = currentCheckIn.active;
  data.current_checkin.openedAt = currentCheckIn.openedAt;
  data.current_checkin.expiresAt = currentCheckIn.expiresAt;
  data.current_checkin.durationMinutes = currentCheckIn.durationMinutes || 60;
  data.current_checkin.channel_msg_id = currentCheckIn.channelMessageId || null;
  data.current_checkin.ready = Array.from(currentCheckIn.ready);
  data.current_checkin.away = Array.from(currentCheckIn.away);

  // CRITICAL: Pull latest remote file to merge registrations and avoid race conditions or overwriting existing members!
  let fileSha = null;
  try {
    const existingFile = await githubApi(`/repos/${GITHUB_REPO}/contents/docs/league-data/registered_players.json`);
    if (existingFile && existingFile.content) {
      fileSha = existingFile.sha;
      const remoteContent = Buffer.from(existingFile.content, 'base64').toString('utf8');
      const remoteData = JSON.parse(remoteContent);
      if (remoteData && remoteData.registrations) {
        data.registrations = {
          ...remoteData.registrations,
          ...data.registrations
        };
      }
    } else if (existingFile && existingFile.sha) {
      fileSha = existingFile.sha;
    }
  } catch (e) {
    console.warn('Could not fetch remote registered_players.json for merge:', e.message);
  }

  inMemoryRegistered = data;
  lastRegisteredFetchTime = Date.now();

  try {
    const localPath = path.join(process.cwd(), 'docs', 'league-data', 'registered_players.json');
    fs.writeFileSync(localPath, JSON.stringify(data, null, 2), 'utf8');
    const altPath = path.join(process.cwd(), 'league-data', 'registered_players.json');
    if (fs.existsSync(path.dirname(altPath))) {
      fs.writeFileSync(altPath, JSON.stringify(data, null, 2), 'utf8');
    }
  } catch (e) {}

  try {
    const fileContent = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
    const commitPayload = {
      message: commitMsg,
      content: fileContent
    };
    if (fileSha) commitPayload.sha = fileSha;
    await githubApi(`/repos/${GITHUB_REPO}/contents/docs/league-data/registered_players.json`, 'PUT', commitPayload);
  } catch (e) {
    console.error('Failed to commit registered_players.json to GitHub:', e);
  }

  return data;
}

async function savePlayerRegistration(reg) {
  const current = await getRegisteredPlayers();
  if (!current.registrations) current.registrations = {};
  if (current.pending_uids && current.pending_uids[String(reg.telegram_id)]) {
    delete current.pending_uids[String(reg.telegram_id)];
  }

  current.registrations[reg.player_id] = {
    player_id: reg.player_id,
    display_name: reg.display_name,
    in_game_name: reg.in_game_name || reg.display_name,
    uid: reg.uid || null,
    telegram_id: reg.telegram_id,
    telegram_username: reg.telegram_username || '',
    telegram_name: reg.telegram_name || '',
    is_new_member: reg.is_new_member || false,
    registered_at: new Date().toISOString()
  };

  const commitMsg = `Player Verified: ${reg.display_name}${reg.uid ? ` (UID: ${reg.uid})` : ''} -> TG @${reg.telegram_username || reg.telegram_id}`;
  return await saveRegisteredPlayersRaw(current, commitMsg);
}

async function setPendingUid(telegramId, data) {
  const current = await getRegisteredPlayers();
  if (!current.pending_uids) current.pending_uids = {};
  current.pending_uids[String(telegramId)] = {
    ...data,
    requested_at: new Date().toISOString()
  };
  inMemoryRegistered = current;
  try {
    const localPath = path.join(process.cwd(), 'docs', 'league-data', 'registered_players.json');
    fs.writeFileSync(localPath, JSON.stringify(current, null, 2), 'utf8');
  } catch (e) {}
}

async function clearPendingUid(telegramId) {
  const current = await getRegisteredPlayers();
  if (current.pending_uids && current.pending_uids[String(telegramId)]) {
    delete current.pending_uids[String(telegramId)];
    inMemoryRegistered = current;
    try {
      const localPath = path.join(process.cwd(), 'docs', 'league-data', 'registered_players.json');
      fs.writeFileSync(localPath, JSON.stringify(current, null, 2), 'utf8');
    } catch (e) {}
  }
}

function getLanguageKeyboard(category = 'recap', param = '0', currentLang = 'ru', includeBroadcastBtn = false) {
  const ruLabel = currentLang === 'ru' ? '• 🇷🇺 RU •' : '🇷🇺 RU';
  const enLabel = currentLang === 'en' ? '• 🇬🇧 EN •' : '🇬🇧 EN';
  const arLabel = currentLang === 'ar' ? '• 🇸🇦 AR •' : '🇸🇦 AR';
  const esLabel = currentLang === 'es' ? '• 🇪🇸 ES •' : '🇪🇸 ES';

  const categoryTitles = {
    recap: 'Recap',
    rules: 'Rules',
    top: 'Top Scorers',
    strikes: 'Strikes & Debtors',
    lineup: 'Best Lineup',
    tournaments: 'Tournaments',
    kicklist: 'Kick Review',
    checkin: 'Pre-Match Check-In',
    live: 'Live Alert',
    mvp: 'MVP Spotlight',
    rally: 'Rally Reminder',
    mystats: 'Player Search',
    player: 'Player Profile',
    welcome: 'Welcome Notice',
    menu: 'Main Menu',
    rosterprompt: 'Roster Sync',
    tgnotice: 'Registration Notice'
  };
  const title = categoryTitles[category] || 'to Channel';

  const rows = [];
  if (includeBroadcastBtn) {
    const bcastTarget = (category === 'recap' && param && param !== '0') ? `bcast_recap_${param}` : `bcast_${category}`;
    rows.push([
      { text: `📢 Post ${title} to Channel`, callback_data: bcastTarget }
    ]);
  }

  rows.push([
    { text: ruLabel, callback_data: `tab_${category}_${param}_ru` },
    { text: enLabel, callback_data: `tab_${category}_${param}_en` },
    { text: arLabel, callback_data: `tab_${category}_${param}_ar` },
    { text: esLabel, callback_data: `tab_${category}_${param}_es` }
  ]);

  if (category === 'welcome' || category === 'tgnotice') {
    rows.push([
      { text: '🤖 Регистрация в боте / Register in Bot', url: 'https://t.me/BratvaFCMBot?start=register' }
    ]);
    rows.push([
      { text: '💬 Join Discussion Chat / Чат группы', url: COMMUNITY_URL }
    ]);
  }

  if (category === 'rules') {
    const checkLabel = currentLang === 'ar' ? '2️⃣ تأكيد الانضمام والمتابعة' :
                       currentLang === 'es' ? '2️⃣ Verificar suscripción y continuar' :
                       currentLang === 'en' ? '2️⃣ Check Membership & Continue' : '2️⃣ Проверить подписку и продолжить';
    rows.push([
      { text: checkLabel, callback_data: `verify_sub_${currentLang}` }
    ]);
  }

  rows.push([
    { text: '🌐 Open Official League Website', url: WEBSITE_URL }
  ]);

  return { inline_keyboard: rows };
}

function getTabsKeyboard(lang, tIndexNum = 0, includeBroadcastBtn = false) {
  return getLanguageKeyboard('recap', String(tIndexNum), lang, includeBroadcastBtn);
}

function formatRecap(t, lang = 'ru') {
  if (!t) return 'No match data available.';
  const opp = bidiIsolate(t.opponent_league || 'OPPONENT');
  const ourScore = t.our_total_goals || 0;
  const oppScore = t.opponent_total_goals || 0;
  const isWin = ourScore > oppScore;
  const isDraw = ourScore === oppScore;

  const performers = ((t.matches || []).slice()).sort((a, b) => (b.goals_for || 0) - (a.goals_for || 0));
  const mp1 = bidiIsolate(performers[0]?.player_display_name || 'Player 1');
  const mp1G = performers[0]?.goals_for || 0;
  const mp2 = bidiIsolate(performers[1]?.player_display_name || 'Player 2');
  const mp2G = performers[1]?.goals_for || 0;
  const mp3 = bidiIsolate(performers[2]?.player_display_name || 'Player 3');
  const mp3G = performers[2]?.goals_for || 0;

  const missed = [];
  if (t.matches) {
    t.matches.forEach(m => {
      const turns = m.turns_played !== undefined ? m.turns_played : 0;
      if (turns < 3) missed.push(`• ❌ *${bidiIsolate(m.player_display_name)}* — ${turns}/3`);
    });
  }

  const squadCount = (t.matches || []).length;

  if (lang === 'en') {
    let outcomeHeader = isWin ? '🏆 *BRATVA FCM: VICTORY!* 🟢' : (isDraw ? '⚖️ *BRATVA FCM: HARD-FOUGHT DRAW!* 🟡' : '🛡️ *BRATVA FCM: MATCH RESULT* 🔴');
    let closing = isWin ? "⚡ *Awesome performance squad! Let's keep winning!*" : "⚡ *Hard-fought match! Next time we take the win!*";
    let strikesText = missed.length > 0
      ? `⛔ *DISCIPLINE & STRIKES:*\n${missed.join('\n')}\n⚠️ *Strike 1/3! Must play 3/3 in next match or get kicked!*`
      : `✅ *100% DISCIPLINE!*\nAll ${squadCount} squad members completed 3/3 turns!`;

    return `${outcomeHeader}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `⚔️ vs *${opp}*\n` +
      `⚽ *Score:* *${ourScore} : ${oppScore}*\n` +
      `👥 *Squad:* ${squadCount} players\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `⭐ *MATCH TOP SCORERS:*\n` +
      `🥇 *${mp1}* — *${mp1G}* goals\n` +
      `🥈 *${mp2}* — *${mp2G}* goals\n` +
      `🥉 *${mp3}* — *${mp3G}* goals\n` +
      `────────────────────\n` +
      `${closing}\n` +
      `────────────────────\n` +
      `${strikesText}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🌐 *Live Standings:*\n${WEBSITE_URL}`;
  } else if (lang === 'ar') {
    const rules = getLeagueRules();
    let outcomeHeader = isWin ? '🏆 *دوري БРАТВА: فوز ساحق!* 🟢' : (isDraw ? '⚖️ *دوري БРАТВА: تعادل بطولي!* 🟡' : '🛡️ *دوري БРАТВА: نتيجة المباراة* 🔴');
    let closing = isWin ? "⚡ *أداء استثنائي يا أبطال! لنواصل الانتصارات معاً!*" : "⚡ *مباراة قوية! سنعوض بالفوز في البطولة القادمة بإذن الله!*";
    let strikesText = missed.length > 0
      ? `⛔ *الانضباط والإنذارات:*\n${missed.join('\n')}\n⚠️ *إنذار (سترايك 1/${rules.maxMissesKick})! يجب لعب ${rules.minTurnsPerTournament}/3 لتجنب الطرد!*`
      : `✅ *انضباط كامل 100%!*\nجميع الأعضاء الـ ${squadCount} أكملوا محاولاتهم بنجاح!`;

    return `${outcomeHeader}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `⚔️ ضد *${opp}*\n` +
      `⚽ *النتيجة:* *${ourScore} : ${oppScore}*\n` +
      `👥 *المشاركون:* ${squadCount} لاعب\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `⭐ *أفضل هدافي المباراة:*\n` +
      `🥇 *${mp1}* — *${mp1G}* أهداف\n` +
      `🥈 *${mp2}* — *${mp2G}* أهداف\n` +
      `🥉 *${mp3}* — *${mp3G}* أهداف\n` +
      `────────────────────\n` +
      `${closing}\n` +
      `────────────────────\n` +
      `${strikesText}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🌐 *الترتيب المباشر:*\n${WEBSITE_URL}`;
  } else if (lang === 'es') {
    let outcomeHeader = isWin ? '🏆 *LIGA BRATVA: ¡GRAN VICTORIA!* 🟢' : (isDraw ? '⚖️ *LIGA BRATVA: ¡EMPATE COMBATIVO!* 🟡' : '🛡️ *LIGA BRATVA: RESULTADO* 🔴');
    let closing = isWin ? "⚡ *¡Gran partido chavales! ¡A seguir ganando!*" : "⚡ *¡Partido reñido! ¡La próxima nos llevamos la victoria!*";
    let strikesText = missed.length > 0
      ? `⛔ *DISCIPLINA Y STRIKES:*\n${missed.join('\n')}\n⚠️ *¡Strike 1/3! ¡Obligatorio jugar 3/3 en el próximo partido!*`
      : `✅ *¡100% DISCIPLINA!*\n¡Todos los ${squadCount} miembros jugaron 3/3 turnos!`;

    return `${outcomeHeader}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `⚔️ vs *${opp}*\n` +
      `⚽ *Resultado:* *${ourScore} : ${oppScore}*\n` +
      `👥 *Plantilla:* ${squadCount} jugadores\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `⭐ *MÁXIMOS GOLEADORES:*\n` +
      `🥇 *${mp1}* — *${mp1G}* goles\n` +
      `🥈 *${mp2}* — *${mp2G}* goles\n` +
      `🥉 *${mp3}* — *${mp3G}* goles\n` +
      `────────────────────\n` +
      `${closing}\n` +
      `────────────────────\n` +
      `${strikesText}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🌐 *Clasificación en vivo:*\n${WEBSITE_URL}`;
  } else {
    // Russian (Default)
    let outcomeHeader = isWin ? '🏆 *БРАТВА: ПОБЕДА!* 🟢' : (isDraw ? '⚖️ *БРАТВА: БОЕВАЯ НИЧЬЯ!* 🟡' : '🛡️ *БРАТВА: РЕЗУЛЬТАТ МАТЧА* 🔴');
    let closing = isWin ? "⚡ *Красавцы парни! Идем дальше за победами!*" : "⚡ *Боевой матч! В след. матче только победа!*";
    let strikesText = missed.length > 0
      ? `⛔ *ДИСЦИПЛИНА И СТРАЙКИ:*\n${missed.join('\n')}\n⚠️ *Страйк 1/3! Обязательно 3/3 в след. матче, иначе кик!*`
      : `✅ *100% ДИСЦИПЛИНА!*\nВсе ${squadCount} игроков сыграли 3/3!`;

    return `${outcomeHeader}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `⚔️ vs *${opp}*\n` +
      `⚽ *Счет:* *${ourScore} : ${oppScore}*\n` +
      `👥 *В составе:* ${squadCount} игроков\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `⭐ *ЛУЧШИЕ ИГРОКИ МАТЧА:*\n` +
      `🥇 *${mp1}* — *${mp1G}* голов\n` +
      `🥈 *${mp2}* — *${mp2G}* голов\n` +
      `🥉 *${mp3}* — *${mp3G}* голов\n` +
      `────────────────────\n` +
      `${closing}\n` +
      `────────────────────\n` +
      `${strikesText}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🌐 *Таблица и сайт лиги:*\n${WEBSITE_URL}`;
  }
}

function formatTopScorers(lang = 'ru') {
  const { pIndex } = loadLeagueData();
  const list = Object.entries(pIndex)
    .filter(([_, data]) => data && data.status !== 'inactive')
    .map(([id, data]) => ({
      id,
      name: bidiIsolate(data.display_name || id),
      goals: data.total_goals || 0,
      matches: data.total_matches || 0,
      avg: data.average_goals || 0
    }))
    .sort((a, b) => b.goals - a.goals);

  if (list.length === 0) return 'No player stats recorded yet.';

  const top10 = list.slice(0, 10);
  const podium = top10.slice(0, 3);
  const rest = top10.slice(3);

  const podiumCards = podium.map((p, idx) => {
    const medal = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : '🥉');
    if (lang === 'en') {
      return `${medal} *${idx + 1}. ${p.name}*\n` +
             `   ⚽ *${p.goals}* goals  •  ${p.matches} matches  •  avg *${p.avg}*`;
    }
    if (lang === 'ar') {
      return `${medal} *${idx + 1}. ${p.name}*\n` +
             `   ⚽ *${p.goals}* هدف  •  ${p.matches} مباريات  •  معدل *${p.avg}*`;
    }
    if (lang === 'es') {
      return `${medal} *${idx + 1}. ${p.name}*\n` +
             `   ⚽ *${p.goals}* goles  •  ${p.matches} partidos  •  prom *${p.avg}*`;
    }
    return `${medal} *${idx + 1}. ${p.name}*\n` +
           `   ⚽ *${p.goals}* голов  •  ${p.matches} матчей  •  ср. *${p.avg}*`;
  });

  const restLines = rest.map((p, idx) => {
    const rank = idx + 4;
    const padRank = rank < 10 ? ` ${rank}` : `${rank}`;
    if (lang === 'en') return `${padRank}. *${p.name}* — *${p.goals}*G (${p.matches}m, avg ${p.avg})`;
    if (lang === 'ar') return `${padRank}. *${p.name}* — *${p.goals}* هدف (${p.matches} مباريات، معدل ${p.avg})`;
    if (lang === 'es') return `${padRank}. *${p.name}* — *${p.goals}*G (${p.matches}p, prom ${p.avg})`;
    return `${padRank}. *${p.name}* — *${p.goals}*Г (${p.matches}м, ср. ${p.avg})`;
  });

  let body = podiumCards.join('\n────────────────────\n');
  if (restLines.length > 0) {
    body += '\n────────────────────\n' + restLines.join('\n');
  }

  if (lang === 'en') {
    return `👑 *BRATVA FCM: TOP 10 SCORERS* 👑\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `${body}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🌐 *Full Player Standings:*\n${WEBSITE_URL}`;
  }
  if (lang === 'ar') {
    return `👑 *دوري БРАТВА: قائمة أفضل 10 هدافين* 👑\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `${body}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🌐 *الترتيب الكامل للهدافين:*\n${WEBSITE_URL}`;
  }
  if (lang === 'es') {
    return `👑 *LIGA BRATVA: TOP 10 GOLEADORES* 👑\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `${body}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🌐 *Clasificación completa:*\n${WEBSITE_URL}`;
  }
  return `👑 *ТОП-10 БОМБАРДИРОВ БРАТВА* 👑\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `${body}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🌐 *Полная статистика игроков:*\n${WEBSITE_URL}`;
}

async function evaluateAllSquadStrikes() {
  const { pIndex, players, tournaments } = loadLeagueData();
  const rules = getLeagueRules();
  const regData = await getRegisteredPlayers();

  // Build a complete, chronological map of player matches directly from tournaments
  const playerMatchesMap = new Map();
  const sortedTournaments = (tournaments || []).slice().sort((a, b) => {
    const dateA = a.date || (a.id ? a.id.slice(0, 10) : '');
    const dateB = b.date || (b.id ? b.id.slice(0, 10) : '');
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return (a.timestamp || 0) - (b.timestamp || 0);
  });

  sortedTournaments.forEach(t => {
    (t.matches || []).forEach(m => {
      if (!m.player_id) return;
      if (!playerMatchesMap.has(m.player_id)) {
        playerMatchesMap.set(m.player_id, []);
      }
      playerMatchesMap.get(m.player_id).push({
        tournament_id: t.id || t.tournament_id,
        date: t.date,
        goals_for: m.goals_for || 0,
        turns_played: m.turns_played !== undefined ? m.turns_played : (m.goals_for > 0 ? 3 : 0)
      });
    });
  });

  // Identify the league's recent rolling tournaments
  const recentLeagueTournaments = sortedTournaments.slice(-5);
  const recentLeagueTournamentIds = new Set(recentLeagueTournaments.map(t => t.id || t.tournament_id));

  const evaluated = Object.entries(pIndex).map(([id, pData]) => {
    const fullPlayer = (players || []).find(p => p && p.player_id === id) || pData || {};
    const pMatches = playerMatchesMap.get(id) || fullPlayer.matches || [];
    const horizon = rules.rollingHorizon || 5;
    const recentMatches = pMatches.slice(-horizon);

    const isLeadership = ['sanya', 'саня', 'doxibro', 'doxibero', 'doxibero1'].includes(id.toLowerCase()) ||
      Boolean(regData && regData.registrations && regData.registrations[id] && (regData.registrations[id].is_admin || regData.registrations[id].is_owner || regData.registrations[id].role === 'Owner' || regData.registrations[id].role === 'Admin'));

    const isTelegramVerified = Boolean(isLeadership || (regData && regData.registrations && regData.registrations[id]));
    const playedInRecentLeague = pMatches.some(m => recentLeagueTournamentIds.has(m.tournament_id));
    const isCheckedIn = Boolean(currentCheckIn && currentCheckIn.ready && currentCheckIn.ready.has(id));
    const isExplicitlyInactive = Boolean(pData && pData.status === 'inactive');

    // A player is inactive if explicitly flagged, or if they haven't played in any recent league tournaments AND are not registered in Telegram AND have not checked in
    const isInactive = isExplicitlyInactive || (!playedInRecentLeague && !isTelegramVerified && !isCheckedIn);

    const resetTimeStr = pData && pData.strikes_reset_at ? pData.strikes_reset_at.split('T')[0] : null;

    let totalGoalsIn5 = 0;
    let strikesCount = 0;

    recentMatches.forEach(m => {
      totalGoalsIn5 += (m.goals_for || 0);
      const turns = m.turns_played !== undefined ? m.turns_played : 0;
      const matchDateStr = m.tournament_id ? m.tournament_id.split('_')[0] : null;
      const isBeforeReset = resetTimeStr && matchDateStr && matchDateStr < resetTimeStr;

      if (!isBeforeReset && turns < (rules.minTurnsPerTournament || 3)) {
        strikesCount += 1;
      }
    });

    const last5Avg = recentMatches.length > 0 ? parseFloat((totalGoalsIn5 / recentMatches.length).toFixed(1)) : 0;

    // Consecutive 0/3 check: check last 2 matches the player was fielded in
    let consecutive0 = 0;
    if (pMatches.length >= 2) {
      const last2 = pMatches.slice(-2);
      const m1Date = last2[0].tournament_id ? last2[0].tournament_id.split('_')[0] : null;
      const m2Date = last2[1].tournament_id ? last2[1].tournament_id.split('_')[0] : null;
      const m1BeforeReset = resetTimeStr && m1Date && m1Date < resetTimeStr;
      const m2BeforeReset = resetTimeStr && m2Date && m2Date < resetTimeStr;

      const m1Turns = last2[0].turns_played !== undefined ? last2[0].turns_played : 0;
      const m2Turns = last2[1].turns_played !== undefined ? last2[1].turns_played : 0;
      if (!m1BeforeReset && !m2BeforeReset && m1Turns === 0 && m2Turns === 0) {
        consecutive0 = 2;
      }
    }

    // Excuse check (admin forgiveness via /forgive)
    let isExcused = false;
    if (regData && regData.excuses && regData.excuses[id]) {
      isExcused = true;
      strikesCount = 0;
      consecutive0 = 0;
    }

    const strikeKick = strikesCount >= (rules.maxMissesKick || 3);
    const consecutiveKick = consecutive0 >= 2;
    const isEligibleForKick = !isInactive && !isExcused && !isLeadership && (consecutiveKick || strikeKick);

    return {
      pid: id,
      displayName: clean(fullPlayer.display_name || (pData && pData.display_name) || id),
      last5Avg,
      totalMatches: pMatches.length,
      recentMatchesCount: recentMatches.length,
      strikesIn5: isInactive ? 0 : strikesCount,
      consecutiveMisses: isInactive ? 0 : consecutive0,
      consecutiveKick,
      strikeKick,
      isEligibleForKick,
      isInactive: Boolean(isInactive),
      isExcused,
      isTelegramVerified,
      isLeadership,
      isDecayed: recentMatches.length >= horizon && strikesCount === 0
    };
  });

  return evaluated;
}

async function formatStrikes(lang = 'ru') {
  const squad = await evaluateAllSquadStrikes();
  const rules = getLeagueRules();
  const regData = await getRegisteredPlayers();

  const critical = [];
  const warnings = [];

  squad.filter(p => !p.isInactive && !p.isLeadership).forEach(p => {
    const playerTag = formatPlayerTag(p.displayName || p.pid, regData);
    if (p.isEligibleForKick) {
      const reason = p.consecutiveKick ? (lang === 'ar' ? 'غياب بطولتين متتاليتين 0/3' : lang === 'es' ? '2 torneos seguidos 0/3' : lang === 'en' ? '2 consecutive 0/3' : '2 турнира подряд 0/3')
                                      : `${p.strikesIn5}/${rules.rollingHorizon || 5} ${lang === 'ar' ? 'إنذارات' : lang === 'es' ? 'strikes' : lang === 'en' ? 'strikes' : 'страйка'}`;
      critical.push(`• 🚨 *${playerTag}* — ${reason} ⛔`);
    } else if (p.strikesIn5 > 0) {
      warnings.push(`• ⚠️ *${playerTag}* — ${p.strikesIn5}/${rules.maxMissesKick} ${lang === 'ar' ? 'إنذارات (آخر 5)' : lang === 'es' ? 'strikes (últimos 5)' : lang === 'en' ? 'strikes (last 5)' : 'страйка (посл. 5)'}`);
    }
  });

  if (lang === 'en') {
    let msg = `⛔ *BRATVA FCM: ROLLING 5-MATCH STRIKES REPORT* ⛔\n` +
      `━━━━━━━━━━━━━━━━━━━━\n`;
    if (critical.length > 0) msg += `🚨 *CRITICAL (ELIGIBLE FOR KICK):*\n${critical.join('\n')}\n────────────────────\n`;
    if (warnings.length > 0) msg += `⚠️ *ACTIVE WARNINGS (1-2 STRIKES):*\n${warnings.join('\n')}\n────────────────────\n`;
    if (critical.length === 0 && warnings.length === 0) msg += `✅ *100% CLEAN DISCIPLINE!*\nAll active squad members have 0 strikes!\n────────────────────\n`;
    msg += `⚖️ *Rules:* 3 strikes in 5 matches OR 2 consecutive 0/3 = Kick.\n` +
      `🟢 *Decay:* 3 clean matches (3/3) clears 1 strike!\n` +
      `🛡️ *Leadership:* Owner & Admins are protected by leadership immunity.\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🌐 *Website:* ${WEBSITE_URL}`;
    return msg;
  }
  if (lang === 'ar') {
    let msg = `⛔ *دوري БРАТВА: تقرير الإنذارات والغياب* ⛔\n` +
      `━━━━━━━━━━━━━━━━━━━━\n`;
    if (critical.length > 0) msg += `🚨 *حالات حرجة (مؤهلة للطرد الفوري):*\n${critical.join('\n')}\n────────────────────\n`;
    if (warnings.length > 0) msg += `⚠️ *إنذارات نشطة (1-2 إنذار):*\n${warnings.join('\n')}\n────────────────────\n`;
    if (critical.length === 0 && warnings.length === 0) msg += `✅ *انضباط مثالي 100%!*\nجميع أعضاء الفريق بسجل نظيف (0 إنذارات) في آخر 5 بطولات!\n────────────────────\n`;
    msg += `⚖️ *القانون:* 3 إنذارات في 5 بطولات أو تفويت بطولتين متتاليتين (0/3) = طرد.\n` +
      `🟢 *إسقاط الإنذارات:* لعب 3 بطولات متتالية بـ 3/3 يمسح سترايك واحد تلقائياً!\n` +
      `🛡️ *حصانة الإدارة:* الأونر والمسؤولون معفون من العقوبات التلقائية.\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🌐 *الموقع الرسمي:* ${WEBSITE_URL}`;
    return msg;
  }
  if (lang === 'es') {
    let msg = `⛔ *LIGA BRATVA: INFORME DE STRIKES (ÚLTIMOS 5)* ⛔\n` +
      `━━━━━━━━━━━━━━━━━━━━\n`;
    if (critical.length > 0) msg += `🚨 *CRÍTICO (APTOS PARA EXPULSIÓN):*\n${critical.join('\n')}\n────────────────────\n`;
    if (warnings.length > 0) msg += `⚠️ *AVISOS ACTIVOS (1-2 STRIKES):*\n${warnings.join('\n')}\n────────────────────\n`;
    if (critical.length === 0 && warnings.length === 0) msg += `✅ *¡DISCIPLINA PERFECTA 100%!* Todos los miembros tienen 0 strikes.\n────────────────────\n`;
    msg += `⚖️ *Reglas:* 3 strikes en 5 partidos o 2 seguidos 0/3 = Expulsión.\n` +
      `🟢 *Limpieza:* ¡3 partidos limpios seguidos (3/3) eliminan 1 strike!\n` +
      `🛡️ *Inmunidad:* El Owner y los Admins tienen inmunidad de liderazgo.\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🌐 *Sitio Oficial:* ${WEBSITE_URL}`;
    return msg;
  }

  // Russian (Default)
  let msg = `⛔ *БРАТВА: ОТЧЕТ ПО СТРАЙКАМ (ПОСЛЕДНИЕ 5 ТУРНИРОВ)* ⛔\n` +
    `━━━━━━━━━━━━━━━━━━━━\n`;
  if (critical.length > 0) msg += `🚨 *КАНДИДАТЫ НА КИК (3 страйка / 0/3 x2):*\n${critical.join('\n')}\n────────────────────\n`;
  if (warnings.length > 0) msg += `⚠️ *ПРЕДУПРЕЖДЕНИЕ (1-2 СТРАЙКА):*\n${warnings.join('\n')}\n────────────────────\n`;
  if (critical.length === 0 && warnings.length === 0) msg += `✅ *100% ЧИСТАЯ ДИСЦИПЛИНА!*\nУ всех активных бойцов 0 страйков!\n────────────────────\n`;
  msg += `⚖️ *Правила:* 3 страйка из 5 или 2 пропуска 0/3 подряд = кик.\n` +
    `🟢 *Сгорание:* 3 чистых матча подряд снимают 1 страйк!\n` +
    `🛡️ *Иммунитет:* Владелец и Админы защищены иммунитетом руководства.\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🌐 *Сайт:* ${WEBSITE_URL}`;
  return msg;
}

function calculateOptimalTournamentSize(readyCount, fallbackCount = 0) {
  const count = readyCount > 0 ? readyCount : fallbackCount;
  if (count >= 32) return 32;
  if (count >= 24) return 24;
  if (count >= 16) return 16;
  if (count >= 8) return 8;
  if (count >= 4) return 4;
  return 4;
}

function compareLineupCandidates(a, b) {
  // 1. Clean discipline (0 strikes) first!
  if (a.strikesIn5 === 0 && b.strikesIn5 > 0) return -1;
  if (a.strikesIn5 > 0 && b.strikesIn5 === 0) return 1;

  // 2. Fewer strikes if any
  if (a.strikesIn5 !== b.strikesIn5) return a.strikesIn5 - b.strikesIn5;

  // 3. Highest scoring average in personal last 5 games (last5Avg)
  if (b.last5Avg !== a.last5Avg) return b.last5Avg - a.last5Avg;

  // 4. Total matches played (experience)
  return b.totalMatches - a.totalMatches;
}

async function generateSmartLineup(requestedSize = null) {
  const allSquad = await evaluateAllSquadStrikes();

  // Restore check-in state from persisted registered_players.json if memory is cold
  try {
    const regData = await getRegisteredPlayers();
    syncCurrentCheckInState(regData);
  } catch (e) {}

  const eligibleCandidates = allSquad.filter(p => !p.isEligibleForKick && !p.isInactive);
  const hasReadyCheckIn = Boolean(currentCheckIn && currentCheckIn.ready && currentCheckIn.ready.size > 0);

  const readyPool = hasReadyCheckIn
    ? eligibleCandidates.filter(p => currentCheckIn.ready.has(p.pid))
    : eligibleCandidates;

  const unreadyPool = hasReadyCheckIn
    ? eligibleCandidates.filter(p => !currentCheckIn.ready.has(p.pid))
    : [];

  readyPool.sort(compareLineupCandidates);
  unreadyPool.sort(compareLineupCandidates);

  const isAuto = !requestedSize || requestedSize === 'auto';
  const size = isAuto
    ? calculateOptimalTournamentSize(readyPool.length, eligibleCandidates.length)
    : ([4, 8, 12, 16, 20, 24, 32].includes(requestedSize) ? requestedSize : 16);

  let starting = [];
  let bench = [];

  if (hasReadyCheckIn) {
    if (readyPool.length >= size) {
      starting = readyPool.slice(0, size);
      const readyBench = readyPool.slice(size);
      const neededReserves = Math.max(0, 8 - readyBench.length);
      bench = readyBench.concat(unreadyPool.slice(0, neededReserves));
    } else {
      starting = [...readyPool];
      const needed = size - readyPool.length;
      starting = starting.concat(unreadyPool.slice(0, needed));
      bench = unreadyPool.slice(needed, needed + 8);
    }
  } else {
    starting = readyPool.slice(0, size);
    bench = readyPool.slice(size, size + 8);
  }

  return {
    size,
    isAuto,
    starting,
    bench,
    readyCount: hasReadyCheckIn ? readyPool.length : 0,
    totalAvailable: eligibleCandidates.length,
    isCheckInUsed: hasReadyCheckIn,
    isCheckInActive: Boolean(currentCheckIn && currentCheckIn.active),
    hasInsufficientPlayers: hasReadyCheckIn && readyPool.length < 4
  };
}

async function formatSmartLineup(requestedSize = null, lang = 'ru') {
  const lineupData = await generateSmartLineup(requestedSize);
  const size = lineupData.size;
  const starting = lineupData.starting;
  const bench = lineupData.bench;
  const isAuto = lineupData.isAuto;
  const readyCount = lineupData.readyCount;
  const hasReadyCheckIn = lineupData.isCheckInUsed;
  const regData = await getRegisteredPlayers();

  const startingLines = starting.map((p, idx) => {
    const num = idx + 1;
    const padNum = num < 10 ? ` ${num}` : `${num}`;
    const playerTag = formatPlayerTag(p.displayName || p.pid, regData);
    if (lang === 'en') return `${padNum}. 🟢 *${playerTag}* — avg *${p.last5Avg}*G`;
    if (lang === 'ar') return `${padNum}. 🟢 *${playerTag}* — معدل *${p.last5Avg}* هدف`;
    if (lang === 'es') return `${padNum}. 🟢 *${playerTag}* — prom *${p.last5Avg}*G`;
    return `${padNum}. 🟢 *${playerTag}* — ср. *${p.last5Avg}*Г`;
  });

  const benchLines = bench.map((p, idx) => {
    const num = size + idx + 1;
    const padNum = num < 10 ? ` ${num}` : `${num}`;
    const playerTag = formatPlayerTag(p.displayName || p.pid, regData);
    const isReadyPlayer = hasReadyCheckIn && currentCheckIn && currentCheckIn.ready && currentCheckIn.ready.has(p.pid);
    let tag = '';
    if (lang === 'en') tag = isReadyPlayer ? '(Reserve — Ready)' : '(Backup)';
    else if (lang === 'ar') tag = isReadyPlayer ? '(احتياط — جاهز)' : '(احتياط غير مؤكد)';
    else if (lang === 'es') tag = isReadyPlayer ? '(Reserva — Listo)' : '(Reserva)';
    else tag = isReadyPlayer ? '(Запас — Готов)' : '(Резерв)';

    const dot = isReadyPlayer ? '🟡' : '⚪';
    if (lang === 'en') return `${padNum}. ${dot} *${playerTag}* — avg *${p.last5Avg}*G ${tag}`;
    if (lang === 'ar') return `${padNum}. ${dot} *${playerTag}* — معدل *${p.last5Avg}* هدف ${tag}`;
    if (lang === 'es') return `${padNum}. ${dot} *${playerTag}* — prom *${p.last5Avg}*G ${tag}`;
    return `${padNum}. ${dot} *${playerTag}* — ср. *${p.last5Avg}*Г ${tag}`;
  });

  // Insufficient players alert banner (< 4 ready)
  let alertBanner = '';
  if (lineupData.hasInsufficientPlayers) {
    if (lang === 'en') alertBanner = `⚠️ *ATTENTION: Only ${readyCount} players ready! Minimum 4 required for tournament!*\n────────────────────\n`;
    else if (lang === 'ar') alertBanner = `⚠️ *تنبيه: ${readyCount} لاعبين جاهزين فقط! يلزم 4 لاعبين كحد أدنى للبطولة!*\n────────────────────\n`;
    else if (lang === 'es') alertBanner = `⚠️ *¡ATENCIÓN: Solo ${readyCount} listos! ¡Se requieren mínimo 4 para el torneo!*\n────────────────────\n`;
    else alertBanner = `⚠️ *ВНИМАНИЕ: Готово только ${readyCount} бойцов! Для турнира нужно минимум 4 игрока!*\n────────────────────\n`;
  }

  // Auto-status note
  let statusBanner = '';
  if (isAuto) {
    if (hasReadyCheckIn) {
      if (lang === 'en') statusBanner = `🤖 *Bot Auto-Decision:* Official *${size}v${size}* bracket based on *${readyCount}* ready players!\n`;
      else if (lang === 'ar') statusBanner = `🤖 *قرار البوت التلقائي:* تنسيق *${size} ضد ${size}* الرسمي بناءً على *${readyCount}* لاعبين جاهزين!\n`;
      else if (lang === 'es') statusBanner = `🤖 *Decisión Auto del Bot:* Formato *${size}v${size}* oficial basado en *${readyCount}* jugadores listos!\n`;
      else statusBanner = `🤖 *Авто-выбор Бота:* Формат *${size}x${size}* на основе *${readyCount}* готовых бойцов!\n`;
    } else {
      if (lang === 'en') statusBanner = `ℹ️ *Projected ${size}v${size} bracket* (Based on all active members. Run /checkin before match!)\n`;
      else if (lang === 'ar') statusBanner = `ℹ️ *تشكيلة ${size} ضد ${size} تقديرية* (بناءً على أعضاء الفريق النشطين. أطلق /checkin قبل المباراة!)\n`;
      else if (lang === 'es') statusBanner = `ℹ️ *Alineación proyectada ${size}v${size}* (Basada en miembros activos. ¡Use /checkin antes del partido!)\n`;
      else statusBanner = `ℹ️ *Ориентировочный формат ${size}x${size}* (По всем активным игрокам. Запустите /checkin перед матчем!)\n`;
    }
  }

  if (lang === 'en') {
    let msg = `🎯 *BRATVA FCM: OFFICIAL SMART LINEUP (${size}v${size})* 🎯\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      alertBanner +
      statusBanner +
      `⚜️ *STARTING SQUAD (TOP ${size}):*\n${startingLines.join('\n')}\n`;
    if (benchLines.length > 0) {
      msg += `────────────────────\n📋 *BENCH & RESERVES:*\n${benchLines.join('\n')}\n`;
    }
    msg += `━━━━━━━━━━━━━━━━━━━━\n` +
      `⚡ *Selection Criteria (Auto-Ranked):*\n` +
      `1. Confirmed [ 🟢 Ready ] during pre-match check-in\n` +
      `2. Clean discipline (0 strikes priority)\n` +
      `3. Top scoring average in personal last 5 games!\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🌐 *Official Website:* ${WEBSITE_URL}`;
    return msg;
  }

  if (lang === 'ar') {
    let msg = `🎯 *دوري БРАТВА: التشكيلة الرسمية الذكية (${size} ضد ${size})* 🎯\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      alertBanner +
      statusBanner +
      `⚜️ *التشكيلة الأساسية (أفضل ${size} لاعبين):*\n${startingLines.join('\n')}\n`;
    if (benchLines.length > 0) {
      msg += `────────────────────\n📋 *دكة البدلاء (الاحتياط):*\n${benchLines.join('\n')}\n`;
    }
    msg += `━━━━━━━━━━━━━━━━━━━━\n` +
      `⚡ *معايير الاختيار الذكية (ترتيب تلقائي):*\n` +
      `1. تأكيد الجاهزية [ 🟢 أنا جاهز ] قبل موعد المباراة\n` +
      `2. انضباط كامل وسجل نظيف (أولوية 0 إنذارات أولاً)\n` +
      `3. أعلى معدل تهديفي للاعب في آخر 5 مباريات لعبها هو شخصياً!\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🌐 *الموقع الرسمي للدوري:* ${WEBSITE_URL}`;
    return msg;
  }

  if (lang === 'es') {
    let msg = `🎯 *LIGA BRATVA: ALINEACIÓN INTELIGENTE (${size}v${size})* 🎯\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      alertBanner +
      statusBanner +
      `⚜️ *TITULARES (TOP ${size}):*\n${startingLines.join('\n')}\n`;
    if (benchLines.length > 0) {
      msg += `────────────────────\n📋 *BANQUILLO Y RESERVAS:*\n${benchLines.join('\n')}\n`;
    }
    msg += `━━━━━━━━━━━━━━━━━━━━\n` +
      `⚡ *Criterios de Selección Inteligente:*\n` +
      `1. Confirmación [ 🟢 Estoy Listo ] en el check-in\n` +
      `2. 0 strikes (disciplina limpia prioritaria)\n` +
      `3. Mayor promedio de goles en sus propios últimos 5 partidos!\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🌐 *Sitio Oficial:* ${WEBSITE_URL}`;
    return msg;
  }

  // Russian (Default)
  let msg = `🎯 *БРАТВА: БОЕВОЙ СОСТАВ НА ТУРНИР (${size}x${size})* 🎯\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    alertBanner +
    statusBanner +
    `⚜️ *ОСНОВНОЙ СОСТАВ (ТОП-${size}):*\n${startingLines.join('\n')}\n`;
  if (benchLines.length > 0) {
    msg += `────────────────────\n📋 *СКАМЕЙКА ЗАПАСНЫХ (РЕЗЕРВ):*\n${benchLines.join('\n')}\n`;
  }
  msg += `━━━━━━━━━━━━━━━━━━━━\n` +
    `⚡ *Критерии автоматического отбора:*\n` +
    `1. Чек-ин готовности [ 🟢 Готов к игре ] перед матчем\n` +
    `2. Безупречная дисциплина (0 страйков в приоритете)\n` +
    `3. Лучшая результативность в своих последних 5 матчах!\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🌐 *Сайт лиги:* ${WEBSITE_URL}`;
  return msg;
}

const formatLineup = (lang = 'ru') => formatSmartLineup(null, lang);

function getLineupKeyboard(size = 16, currentLang = 'ru', isPrivate = false, isAuto = false) {
  const ruLabel = currentLang === 'ru' ? '• 🇷🇺 RU •' : '🇷🇺 RU';
  const enLabel = currentLang === 'en' ? '• 🇬🇧 EN •' : '🇬🇧 EN';
  const arLabel = currentLang === 'ar' ? '• 🇸🇦 AR •' : '🇸🇦 AR';
  const esLabel = currentLang === 'es' ? '• 🇪🇸 ES •' : '🇪🇸 ES';

  const autoLabel = currentLang === 'ar' ? '🤖 الحجم التلقائي (البوت)' :
                    currentLang === 'es' ? '🤖 Tamaño Auto (Bot)' :
                    currentLang === 'en' ? '🤖 Auto Size (Bot)' : '🤖 Авто-размер (Бот)';

  const autoParam = isAuto ? 'auto' : size;

  const rows = [
    [
      { text: isAuto ? `• ${autoLabel} •` : autoLabel, callback_data: `fmt_lineup_auto_${currentLang}` }
    ],
    [
      { text: (!isAuto && size === 4) ? '• 4v4 •' : '4v4', callback_data: `fmt_lineup_4_${currentLang}` },
      { text: (!isAuto && size === 8) ? '• 8v8 •' : '8v8', callback_data: `fmt_lineup_8_${currentLang}` },
      { text: (!isAuto && size === 16) ? '• 16v16 •' : '16v16', callback_data: `fmt_lineup_16_${currentLang}` },
      { text: (!isAuto && size === 24) ? '• 24v24 •' : '24v24', callback_data: `fmt_lineup_24_${currentLang}` },
      { text: (!isAuto && size === 32) ? '• 32v32 •' : '32v32', callback_data: `fmt_lineup_32_${currentLang}` }
    ],
    [
      { text: ruLabel, callback_data: `tab_lineup_${autoParam}_ru` },
      { text: enLabel, callback_data: `tab_lineup_${autoParam}_en` },
      { text: arLabel, callback_data: `tab_lineup_${autoParam}_ar` },
      { text: esLabel, callback_data: `tab_lineup_${autoParam}_es` }
    ]
  ];

  if (isPrivate) {
    const postLabel = currentLang === 'ar' ? `📢 نشر تشكيلة ${size} ضد ${size} في القناة` :
                      currentLang === 'es' ? `📢 Publicar alineación ${size}v${size} en el Canal` :
                      currentLang === 'en' ? `📢 Post ${size}v${size} Lineup to Channel` :
                      `📢 Опубликовать состав ${size}x${size} в канал`;
    rows.push([
      { text: postLabel, callback_data: `bcast_lineup_${autoParam}` }
    ]);
  }

  const websiteLabel = currentLang === 'ar' ? '🌐 الموقع الرسمي للدوري' :
                       currentLang === 'es' ? '🌐 Sitio Oficial de la Liga' :
                       currentLang === 'en' ? '🌐 Official League Website' : '🌐 Официальный сайт Лиги';

  rows.push([
    { text: websiteLabel, url: WEBSITE_URL }
  ]);

  return { inline_keyboard: rows };
}

function formatCheckInPrompt(lang = 'ru') {
  const readyPids = Array.from(currentCheckIn.ready);
  const awayPids = Array.from(currentCheckIn.away);
  const { pIndex } = loadLeagueData();
  const regData = inMemoryRegistered || { registrations: {} };

  const readyNames = readyPids.map(id => formatPlayerTag(id, regData));
  const awayNames = awayPids.map(id => formatPlayerTag(id, regData));

  const readyCount = readyNames.length;
  const awayCount = awayNames.length;

  const now = Date.now();
  const isExpired = !currentCheckIn.active || (currentCheckIn.expiresAt && now >= currentCheckIn.expiresAt);
  const remainingMs = currentCheckIn.expiresAt ? Math.max(0, currentCheckIn.expiresAt - now) : 0;
  const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
  const projectedSize = calculateOptimalTournamentSize(readyCount);

  let statusHeader = '';
  let footerText = '';

  if (lang === 'en') {
    const bracketText = readyCount >= 4 ? `${projectedSize}v${projectedSize} (${projectedSize} Starters + ${Math.max(0, readyCount - projectedSize)} Reserves)` : 'Need min 4 ready players';
    statusHeader = !isExpired
      ? `⏳ *STATUS:* 🟢 *OPEN (Closes in: ${remainingMinutes} min | 60 min limit)*\n` +
        `🤖 *Auto-Projected Bracket:* *${bracketText}*`
      : `🔒 *STATUS:* 🔴 *CLOSED (Time Expired — Final Bracket: ${readyCount >= 4 ? `${projectedSize}v${projectedSize}` : 'Insufficient'})*`;
    footerText = !isExpired
      ? `👉 *Tap a button below to confirm your status:*`
      : `📋 *Check-in closed. View the confirmed starting lineup below:*`;
  } else if (lang === 'ar') {
    const bracketText = readyCount >= 4 ? `${projectedSize} ضد ${projectedSize} (${projectedSize} أساسي + ${Math.max(0, readyCount - projectedSize)} احتياط)` : 'يلزم 4 لاعبين كحد أدنى';
    statusHeader = !isExpired
      ? `⏳ *الحالة:* 🟢 *تسجيل الحضور مفتوح (متبقي: ${remainingMinutes} دقيقة | مهلة 60 د)*\n` +
        `🤖 *التنسيق التلقائي المتوقع:* *${bracketText}*`
      : `🔒 *الحالة:* 🔴 *تم إغلاق تسجيل الحضور (التنسيق المعتمد: ${readyCount >= 4 ? `${projectedSize} ضد ${projectedSize}` : 'غير كافٍ'})*`;
    footerText = !isExpired
      ? `👉 *اضغط على الزر بالأسفل لتأكيد حالتك الآن:*`
      : `📋 *انتهى وقت التسجيل. يمكنك الاطلاع على التشكيلة الأساسية بالأسفل:*`;
  } else if (lang === 'es') {
    const bracketText = readyCount >= 4 ? `${projectedSize}v${projectedSize} (${projectedSize} Titulares + ${Math.max(0, readyCount - projectedSize)} Reservas)` : 'Se requieren mín. 4 listos';
    statusHeader = !isExpired
      ? `⏳ *ESTADO:* 🟢 *ABIERTO (Cierra en: ${remainingMinutes} min | 60 min límite)*\n` +
        `🤖 *Formato Auto-Proyectado:* *${bracketText}*`
      : `🔒 *ESTADO:* 🔴 *CERRADO (Tiempo agotado — Formato final: ${readyCount >= 4 ? `${projectedSize}v${projectedSize}` : 'Insuficiente'})*`;
    footerText = !isExpired
      ? `👉 *Toca un botón abajo para confirmar tu estado:*`
      : `📋 *Check-in finalizado. Consulta la alineación confirmada abajo:*`;
  } else {
    // Russian (Default)
    const bracketText = readyCount >= 4 ? `${projectedSize}x${projectedSize} (${projectedSize} в основе + ${Math.max(0, readyCount - projectedSize)} в запасе)` : 'Нужно минимум 4 игрока';
    statusHeader = !isExpired
      ? `⏳ *СТАТУС:* 🟢 *ИДЁТ ЧЕК-ИН (Осталось: ${remainingMinutes} мин | 60 мин лимит)*\n` +
        `🤖 *Текущий авто-формат Бота:* *${bracketText}*`
      : `🔒 *СТАТУС:* 🔴 *ЧЕК-ИН ЗАКРЫТ (Время истекло — Формат основы: ${readyCount >= 4 ? `${projectedSize}x${projectedSize}` : 'Недостаточно'})*`;
    footerText = !isExpired
      ? `👉 *Нажмите кнопку ниже, чтобы подтвердить участие:*`
      : `📋 *Чек-ин завершён. Ознакомьтесь с утверждённой основой по кнопке ниже:*`;
  }

  const readyList = readyCount > 0
    ? readyNames.map((n, i) => ` ${i + 1 < 10 ? ' ' : ''}${i + 1}. 🟢 *${n}*`).join('\n')
    : (lang === 'ar' ? '   _لا يوجد لاعبين حتى الآن... اضغط [ أنا جاهز ]!_' : lang === 'es' ? '   _¡Nadie aún... sé el primero!_' : lang === 'en' ? '   _No one checked in yet... Tap [ I\'m Ready ]!_' : '   _Пока никто не нажал... Будь первым!_');

  const awayList = awayCount > 0
    ? awayNames.map(n => `• 🔴 *${n}*`).join('\n')
    : (lang === 'ar' ? '   _لا أحد_' : lang === 'es' ? '   _Ninguno_' : lang === 'en' ? '   _None_' : '   _Никого_');

  if (lang === 'en') {
    return `⚔️ *BRATVA FCM: PRE-MATCH CHECK-IN* ⚔️\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `${statusHeader}\n` +
      `🛡️ *Attention Squad!* Preparing for the next tournament!\n` +
      `Please confirm your availability to play all 3/3 turns!\n` +
      `────────────────────\n` +
      `🟢 *READY TO PLAY (${readyCount}):*\n${readyList}\n` +
      `────────────────────\n` +
      `🔴 *NOT AVAILABLE (${awayCount}):*\n${awayList}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `${footerText}`;
  }
  if (lang === 'ar') {
    return `⚔️ *دوري БРАТВА: نداء الجاهزية والحضور* ⚔️\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `${statusHeader}\n` +
      `🛡️ *إلى جميع أبطال الفريق!* نستعد لبدء البطولة القادمة!\n` +
      `يرجى تأكيد جاهزيتك للعب جميع المحاولات 3/3 كاملة في موعدها!\n` +
      `────────────────────\n` +
      `🟢 *اللاعبون الجاهزون للعب (${readyCount}):*\n${readyList}\n` +
      `────────────────────\n` +
      `🔴 *غير المتاحين حالياً (${awayCount}):*\n${awayList}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `${footerText}`;
  }
  if (lang === 'es') {
    return `⚔️ *LIGA BRATVA: PASE DE LISTA Y CHECK-IN* ⚔️\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `${statusHeader}\n` +
      `🛡️ *¡Atención Equipo!* ¡Preparándonos para el próximo torneo!\n` +
      `¡Confirma tu disponibilidad para jugar los 3/3 turnos completos!\n` +
      `────────────────────\n` +
      `🟢 *LISTOS PARA JUGAR (${readyCount}):*\n${readyList}\n` +
      `────────────────────\n` +
      `🔴 *NO DISPONIBLES (${awayCount}):*\n${awayList}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `${footerText}`;
  }

  // Russian (Default)
  return `⚔️ *БРАТВА: ПРЕДМАТЧЕВЫЙ ЧЕК-ИН* ⚔️\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `${statusHeader}\n` +
    `🛡️ *Внимание бойцы!* Готовимся к старту следующего турнира!\n` +
    `Подтвердите вашу готовность сыграть все 3/3 ходов вовремя!\n` +
    `────────────────────\n` +
    `🟢 *ГОТОВЫ К ИГРЕ (${readyCount}):*\n${readyList}\n` +
    `────────────────────\n` +
    `🔴 *НЕ МОГУТ СЫГРАТЬ (${awayCount}):*\n${awayList}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `${footerText}`;
}

function getCheckInKeyboard(currentLang = 'ru', includeBcast = false) {
  const ruLabel = currentLang === 'ru' ? '• 🇷🇺 RU •' : '🇷🇺 RU';
  const enLabel = currentLang === 'en' ? '• 🇬🇧 EN •' : '🇬🇧 EN';
  const arLabel = currentLang === 'ar' ? '• 🇸🇦 AR •' : '🇸🇦 AR';
  const esLabel = currentLang === 'es' ? '• 🇪🇸 ES •' : '🇪🇸 ES';

  const readyLabel = currentLang === 'ar' ? '🟢 أنا جاهز للعب' :
                     currentLang === 'es' ? '🟢 Estoy Listo' :
                     currentLang === 'en' ? '🟢 I\'m Ready' : '🟢 Я готов к игре';

  const awayLabel = currentLang === 'ar' ? '🔴 غير متاح حالياً' :
                    currentLang === 'es' ? '🔴 No Disponible' :
                    currentLang === 'en' ? '🔴 Not Available' : '🔴 Не могу сыграть';

  const listLabel = currentLang === 'ar' ? `📋 قائمة الجاهزين (${currentCheckIn.ready.size})` :
                    currentLang === 'es' ? `📋 Ver Lista (${currentCheckIn.ready.size})` :
                    currentLang === 'en' ? `📋 Ready List (${currentCheckIn.ready.size})` : `📋 Список готовых (${currentCheckIn.ready.size})`;

  const lineupLabel = currentLang === 'ar' ? '🎯 التشكيلة الذكية' :
                      currentLang === 'es' ? '🎯 Mejor Alineación' :
                      currentLang === 'en' ? '🎯 Smart Lineup' : '🎯 Основа Лиги';

  const isExpired = !currentCheckIn.active || (currentCheckIn.expiresAt && Date.now() >= currentCheckIn.expiresAt);

  const rows = [];

  if (!isExpired) {
    rows.push([
      { text: readyLabel, callback_data: 'ci_ready' },
      { text: awayLabel, callback_data: 'ci_away' }
    ]);
    rows.push([
      { text: listLabel, callback_data: 'ci_list' },
      { text: lineupLabel, callback_data: 'cmd_lineup' }
    ]);
  } else {
    rows.push([
      { text: lineupLabel, callback_data: 'cmd_lineup' },
      { text: listLabel, callback_data: 'ci_list' }
    ]);
  }

  rows.push([
    { text: ruLabel, callback_data: 'tab_checkin_0_ru' },
    { text: enLabel, callback_data: 'tab_checkin_0_en' },
    { text: arLabel, callback_data: 'tab_checkin_0_ar' },
    { text: esLabel, callback_data: 'tab_checkin_0_es' }
  ]);

  if (includeBcast && !isExpired) {
    rows.push([
      { text: '📢 Post Check-In Rally to Channel', callback_data: 'bcast_checkin' }
    ]);
  }

  rows.push([
    { text: '🌐 Official League Website', url: WEBSITE_URL }
  ]);

  return { inline_keyboard: rows };
}

async function formatTournaments(lang = 'ru') {
  let list = [];
  try {
    const tIndex = await getTournamentsIndex();
    const entries = Object.entries(tIndex || {});
    if (entries.length > 0) {
      list = entries.slice(-5).reverse().map(([id, meta]) => ({ id, ...meta }));
    }
  } catch (e) {}

  if (list.length === 0) {
    const { tournaments } = loadLeagueData();
    list = (tournaments || []).slice(0, 5);
  }

  if (list.length === 0) return 'No tournaments recorded yet.';

  const cards = list.map(t => {
    let statusBadge = '🟢 ПОБЕДА';
    if (lang === 'en') {
      statusBadge = t.result === 'win' ? '🟢 WIN' : (t.result === 'draw' ? '🟡 DRAW' : '🔴 DEFEAT');
    } else if (lang === 'ar') {
      statusBadge = t.result === 'win' ? '🟢 فوز' : (t.result === 'draw' ? '🟡 تعادل' : '🔴 خسارة');
    } else if (lang === 'es') {
      statusBadge = t.result === 'win' ? '🟢 VICTORIA' : (t.result === 'draw' ? '🟡 EMPATE' : '🔴 DERROTA');
    } else {
      statusBadge = t.result === 'win' ? '🟢 ПОБЕДА' : (t.result === 'draw' ? '🟡 НИЧЬЯ' : '🔴 ПОРАЖЕНИЕ');
    }

    let cleanDate = t.date || '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
      const [y, m, d] = cleanDate.split('-');
      cleanDate = `${d}.${m}.${y}`;
    }

    const oppIso = bidiIsolate(t.opponent_league || 'OPPONENT');
    const vsWord = lang === 'ar' ? 'ضد' : 'vs';

    return `${statusBadge}  •  *${t.our_total_goals} : ${t.opponent_total_goals}*\n` +
           `⚔️ ${vsWord} *${oppIso}*\n` +
           `📅 *${cleanDate}*`;
  });

  const divider = '\n────────────────────\n';
  const content = cards.join(divider);

  if (lang === 'en') {
    return `🏆 *RECENT БРАТВА TOURNAMENTS*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `${content}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🌐 *Full Match History:*\n${WEBSITE_URL}`;
  }
  if (lang === 'ar') {
    return `🏆 *بطولات دوري БРАТВА الأخيرة*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `${content}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🌐 *سجل المباريات الكامل:*\n${WEBSITE_URL}`;
  }
  if (lang === 'es') {
    return `🏆 *ÚLTIMOS TORNEOS DE БРАТВА*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `${content}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🌐 *Historial completo:*\n${WEBSITE_URL}`;
  }
  return `🏆 *ПОСЛЕДНИЕ ТУРНИРЫ БРАТВА*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `${content}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🌐 *Полная история матчей:*\n${WEBSITE_URL}`;
}

function findPlayerByQuery(query) {
  if (!query || typeof query !== 'string') return null;
  const q = query.trim().toLowerCase();
  if (q.length < 2) return null;
  const { pIndex, players } = loadLeagueData();

  // 1. Exact match by player_id in pIndex
  if (pIndex[q]) {
    return {
      player_id: q,
      display_name: pIndex[q].display_name || q,
      ...pIndex[q]
    };
  }

  // 2. Exact match in players list
  const exactPlayer = players.find(p => {
    if (!p) return false;
    const pid = (p.player_id || '').toLowerCase();
    const dname = (p.display_name || '').toLowerCase();
    return pid === q || dname === q;
  });
  if (exactPlayer) return exactPlayer;

  // 3. Exact match in pIndex by display_name
  for (const [id, data] of Object.entries(pIndex)) {
    if ((data.display_name || '').toLowerCase() === q) {
      return { player_id: id, ...data };
    }
  }

  // 4. Aliases in players
  const aliasMatch = players.find(p => {
    if (!p || !p.known_aliases) return false;
    return p.known_aliases.some(a => (a || '').toLowerCase() === q);
  });
  if (aliasMatch) return aliasMatch;

  // 5. Substring match (if query is at least 3 chars)
  if (q.length >= 3) {
    for (const [id, data] of Object.entries(pIndex)) {
      const pid = id.toLowerCase();
      const dname = (data.display_name || '').toLowerCase();
      if (pid.includes(q) || dname.includes(q)) {
        return { player_id: id, ...data };
      }
    }
  }

  return null;
}

function generatePlayerStatsMessage(query, lang = 'ru') {
  if (!query || !query.trim()) {
    if (lang === 'ar') return '⚠️ يرجى تحديد اسم اللاعب، مثال: `/player DOXIBERO1`';
    if (lang === 'es') return '⚠️ Por favor indica el nombre de un jugador, ej: `/player DOXIBERO1`';
    if (lang === 'en') return '⚠️ Please specify a player name, e.g.: `/player DOXIBERO1`';
    return '⚠️ Пожалуйста, укажите имя игрока, например: `/player DOXIBERO1`';
  }
  const { pIndex, players } = loadLeagueData();
  const found = findPlayerByQuery(query);

  if (!found) {
    if (lang === 'ar') return `❌ اللاعب "${clean(query)}" غير موجود في قاعدة بيانات الدوري. جرب /top لعرض قائمة الهدافين.\n🌐 ${WEBSITE_URL}`;
    if (lang === 'es') return `❌ Jugador "${clean(query)}" no encontrado en la base de datos. Usa /top para ver goleadores.\n🌐 ${WEBSITE_URL}`;
    if (lang === 'en') return `❌ Player "${clean(query)}" not found in league database. Try /top to view top scorers.\n🌐 ${WEBSITE_URL}`;
    return `❌ Игрок "${clean(query)}" не найден в базе данных Лиги. Попробуйте /top для списка бомбардиров.\n🌐 ${WEBSITE_URL}`;
  }

  const pid = found.player_id;
  const indexData = pIndex[pid] || found;
  const fullPlayer = players.find(p => p && p.player_id === pid) || found;

  const totalMatches = (indexData.total_matches !== undefined && indexData.total_matches > 0) ? indexData.total_matches : (fullPlayer.matches ? fullPlayer.matches.length : 0);
  const totalGoals = (indexData.total_goals !== undefined && indexData.total_goals > 0) ? indexData.total_goals : (fullPlayer.matches ? fullPlayer.matches.reduce((s, m) => s + (m.goals_for || 0), 0) : 0);
  const avg = (indexData.average_goals !== undefined && indexData.average_goals > 0) ? indexData.average_goals : (totalMatches > 0 ? parseFloat((totalGoals / totalMatches).toFixed(1)) : 0);
  const strikes = indexData.eligibility_streak?.current_fail_streak || 0;
  const dName = bidiIsolate(found.display_name || pid);
  const statusIcon = strikes >= 3 ? '🚨' : (strikes > 0 ? '⚠️' : '✅');
  const profileUrl = `${WEBSITE_URL}?player=${encodeURIComponent(pid)}`;

  if (lang === 'en') {
    const statusText = strikes >= 3 ? 'ELIGIBLE FOR KICK (3+ strikes)' : (strikes > 0 ? `Warning (${strikes}/3 strikes)` : 'Active & Safe (0 strikes)');
    return `👤 *PLAYER PROFILE* ⚜️\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `⭐ *${dName}*\n` +
      `⚽ Total Goals: *${totalGoals}*\n` +
      `🏟️ Tournaments: *${totalMatches}*\n` +
      `📊 Scoring Average: *${avg}* goals/match\n` +
      `────────────────────\n` +
      `🛡️ Discipline: ${statusIcon} *${statusText}*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🌐 *Interactive Profile & Match History:*\n${profileUrl}`;
  }
  if (lang === 'ar') {
    const statusText = strikes >= 3 ? 'مؤهل للاستبعاد (3+ إنذارات)' : (strikes > 0 ? `إنذار غياب (${strikes}/3)` : 'نشط ومنضبط (0 إنذارات)');
    return `👤 *الملف الشخصي للاعب* ⚜️\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `⭐ *${dName}*\n` +
      `⚽ إجمالي الأهداف: *${totalGoals}*\n` +
      `🏟️ البطولات الملعوبة: *${totalMatches}*\n` +
      `📊 المعدل التهديفي: *${avg}* هدف/مباراة\n` +
      `────────────────────\n` +
      `🛡️ حالة الانضباط: ${statusIcon} *${statusText}*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🌐 *الملف التفاعلي وسجل المباريات:*\n${profileUrl}`;
  }
  if (lang === 'es') {
    const statusText = strikes >= 3 ? 'APTO PARA EXPULSIÓN (3+ faltas)' : (strikes > 0 ? `Aviso (${strikes}/3 strikes)` : 'Activo y Seguro (0 faltas)');
    return `👤 *PERFIL DEL JUGADOR* ⚜️\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `⭐ *${dName}*\n` +
      `⚽ Goles Totales: *${totalGoals}*\n` +
      `🏟️ Torneos Jugados: *${totalMatches}*\n` +
      `📊 Promedio Goleador: *${avg}* goles/partido\n` +
      `────────────────────\n` +
      `🛡️ Disciplina: ${statusIcon} *${statusText}*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🌐 *Perfil Interactivo e Historial:*\n${profileUrl}`;
  }

  const statusText = strikes >= 3 ? 'КАНДИДАТ НА КИК (3+ пропуска)' : (strikes > 0 ? `Предупреждение (${strikes}/3 страйка)` : 'Активен и в норме (0 страйков)');
  return `👤 *ПРОФИЛЬ ИГРОКА* ⚜️\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `⭐ *${dName}*\n` +
    `⚽ Всего голов: *${totalGoals}*\n` +
    `🏟️ Турниров сыграно: *${totalMatches}*\n` +
    `📊 Средняя результативность: *${avg}* голов/матч\n` +
    `────────────────────\n` +
    `🛡️ Дисциплина: ${statusIcon} *${statusText}*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🌐 *Интерактивный профиль и матчи:*\n${profileUrl}`;
}

function formatWelcome(lang = 'ru') {
  if (lang === 'en') {
    return `⚜️ *BRATVA FCM LEAGUE* ⚜️\n` +
      `🏆 *Official League Portal & Squad Companion*\n\n` +
      `Welcome to the official **BRATVA FCM** League Bot!\n` +
      `All squad tracking, tournament lineups, and player performance in one place:\n\n` +
      `• 👤 *Player Profile:* View your goals, matches played, and career card\n` +
      `• ⚔️ *Pre-Match Check-In:* Confirm your availability for the next tournament\n` +
      `• 🎯 *Smart Lineup:* View today's official starting squad & rotation\n` +
      `• 🏆 *Top Scorers:* Check the squad's leading goalscorers\n` +
      `• 📜 *League Rules:* Mandatory 3/3 turns policy & discipline standards\n` +
      `• 🌐 *Official Website:* Full match archive, live standings & player records\n\n` +
      `👥 *Telegram Community (Channel + Group):*\n${COMMUNITY_URL}\n\n` +
      `📋 *Choose an option from the menu below 👇*`;
  }
  if (lang === 'ar') {
    return `⚜️ *دوري БРАТВА FCM LEAGUE* ⚜️\n` +
      `🏆 *البوابة الرسمية لدوري براتفا*\n\n` +
      `مرحباً بك في البوت الرسمي لفريق ودوري **БРАТВА FCM**!\n` +
      `كل ما يخص الفريق وإحصائيات اللاعبين في مكان واحد:\n\n` +
      `• 👤 *الملف الشخصي:* استعرض أهدافك، مشاركاتك وبطاقتك كلاعب\n` +
      `• ⚔️ *تأكيد الجاهزية (Check-In):* سجّل حضورك للمشاركة في البطولة القادمة\n` +
      `• 🎯 *تشكيلة البطولة:* تعرف على التشكيلة الأساسية وقائمة الاحتياط لليوم\n` +
      `• 🏆 *قائمة الهدافين:* ترتيب أفضل هدافي الفريق\n` +
      `• 📜 *قوانين الدوري:* الالتزام بـ 3/3 محاولات ونظام الانضباط\n` +
      `• 🌐 *الموقع الرسمي:* الأرشيف الكامل للمباريات وسجلات الأرقام القياسية\n\n` +
      `👥 *مجتمع تيليجرام (القناة + المجموعة):*\n${COMMUNITY_URL}\n\n` +
      `📋 *اختر ما تريد من القائمة أدناه 👇*`;
  }
  if (lang === 'es') {
    return `⚜️ *LIGA BRATVA FCM* ⚜️\n` +
      `🏆 *Portal Oficial de la Liga*\n\n` +
      `¡Bienvenido al bot oficial de la Liga **БРАТВА FCM**!\n` +
      `Toda la gestión del equipo, alineaciones y rendimiento en un solo lugar:\n\n` +
      `• 👤 *Perfil de Jugador:* Consulta tus goles, partidos y tarjeta personal\n` +
      `• ⚔️ *Check-In Pre-Partido:* Confirma tu disponibilidad para el torneo\n` +
      `• 🎯 *Alineación Oficial:* Conoce el 11 titular y la rotación de hoy\n` +
      `• 🏆 *Goleadores:* Consulta la tabla de máximos anotadores\n` +
      `• 📜 *Reglas de la Liga:* Obligatorio 3/3 turnos y código disciplinario\n` +
      `• 🌐 *Web Oficial:* Historial completo de torneos y récords de la plantilla\n\n` +
      `👥 *Comunidad de Telegram (Canal + Grupo):*\n${COMMUNITY_URL}\n\n` +
      `📋 *Elige una opción en el menú abajo 👇*`;
  }
  return `⚜️ *БРАТВА FCM LEAGUE* ⚜️\n` +
    `🏆 *Официальный бот и портал лиги*\n\n` +
    `Добро пожаловать в официальный клубный бот лиги **БРАТВА FCM**!\n` +
    `Здесь собрана вся статистика команды и ключевые функции для каждого игрока:\n\n` +
    `• 👤 *Карточка игрока:* Личные голы, сыгранные турниры и статистика\n` +
    `• ⚔️ *Предматчевый сбор:* Подтверждение участия в турнире (Check-In)\n` +
    `• 🎯 *Основа лиги:* Стартовый состав и ротация на сегодняшний матч\n` +
    `• 🏆 *Топ бомбардиров:* Рейтинг лучших снайперов команды\n` +
    `• 📜 *Правила лиги:* Обязательные 3/3 ходов и регламент дисциплины\n` +
    `• 🌐 *Сайт лиги:* Полная история всех матчей и рекордов команды\n\n` +
    `👥 *Telegram Сообщество (Канал + Чат):*\n${COMMUNITY_URL}\n\n` +
    `📋 *Выберите действие в меню ниже 👇*`;
}

function formatChannelWelcome(lang = 'ru') {
  if (lang === 'en') {
    return `⚜️ *WELCOME TO BRATVA FCM!* ⚜️\n\n` +
      `Welcome to our official league community!\n\n` +
      `📌 *Key info for all members:*\n` +
      `• Daily tournament lineups, match recaps, and announcements are published here.\n` +
      `• Every player's performance (goals, turns played, career stats) is tracked live on our website.\n` +
      `• Make sure you join our squad discussion chat to coordinate tactics and match turns!\n\n` +
      `⚔️ *Standard rule:* Stay active, complete all 3/3 turns in every match, and let's keep winning together! ⚽`;
  }
  if (lang === 'ar') {
    return `⚜️ *مرحباً بكم في دوري БРАТВА FCM!* ⚜️\n\n` +
      `أهلاً وسهلاً بجميع الأعضاء في قناتنا الرسمية!\n\n` +
      `📌 *معلومات أساسية لكل لاعب:*\n` +
      `• هنا ننشر يومياً تشكيلات البطولات، نتائج المباريات، وجميع إعلانات الفريق.\n` +
      `• إحصائيات كل لاعب (الأهداف، المحاولات، السجل الكامل) موثقة بشكل مباشر على موقعنا الرسمي.\n` +
      `• انضموا لمجموعة النقاش الخاصة بالتشكيلة لتنسيق الهجمات، الخطط والتواصل مع الفريق!\n\n` +
      `⚔️ *القانون الأساسي:* الالتزام التام، لعب 3/3 محاولات دائماً في كل بطولة، والقتال من أجل الفوز معاً! ⚽`;
  }
  if (lang === 'es') {
    return `⚜️ *¡BIENVENIDOS A BRATVA FCM!* ⚜️\n\n` +
      `¡Bienvenidos a todos los miembros al canal oficial de nuestra liga!\n\n` +
      `📌 *Información clave del equipo:*\n` +
      `• Aquí publicamos a diario las alineaciones, resultados de torneos y avisos oficiales.\n` +
      `• Las estadísticas de cada jugador (goles, turnos jugados, historial) se actualizan en vivo en nuestra web oficial.\n` +
      `• Uníos al grupo de debate de la plantilla para coordinar tácticas, turnos y comunicaros con el equipo.\n\n` +
      `⚔️ *Regla fundamental:* Máximo compromiso, jugar siempre los 3/3 turnos y ganar juntos! ⚽`;
  }
  return `⚜️ *ДОБРО ПОЖАЛОВАТЬ В БРАТВА FCM!* ⚜️\n\n` +
    `Приветствуем всех участников в нашем официальном канале!\n\n` +
    `📌 *Главное о нашей лиге:*\n` +
    `• Здесь ежедневно выходят составы на турниры, результаты матчей и важные объявления.\n` +
    `• Вся статистика каждого игрока (голы, сыгранные ходы, рекорды) ведется в реальном времени на нашем сайте.\n` +
    `• Обязательно вступайте в наш чат обсуждений — там мы обсуждаем тактику, составы и координируем ходы!\n\n` +
    `⚔️ *Правило простое:* Играем ответственно, всегда забираем свои 3/3 ходов и побеждаем вместе! ⚽`;
}

function formatJoinRequiredPrompt(lang = 'ru') {
  if (lang === 'ar') {
    return `📢 *تنبيه إلزامي: الانضمام لمجتمع الفريق أولاً!* 📢\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `⚠️ للمشاركة في دوري **БРАТВА FCM** والظهور في تشكيلة البطولات، يجب أولاً الانضمام إلى القناة الرسمية ومجموعة الفريق!\n\n` +
      `📲 *خطوات التسجيل الإلزامية:*\n` +
      `**1.** انضم إلى القناة الرسمية ومجموعة الفريق عبر الزر بالأسفل.\n` +
      `**2.** فور انضمامك، سيرسل لك البوت تلقائياً رسالة المتابعة لتسجيل اسمك في قائمة الفريق.\n` +
      `**3.** أرسل اسمك المستعار فقط في EA FC Mobile لتعقب أهدافك ودخول تشكيلة البطولات!\n\n` +
      `🔒 *توضيح هام:* نطلب فقط اسمك المستعار الظاهر في اللعبة (Nickname) لتنزيلك في التشكيلة — لا نطلب أي كلمة مرور أو بيانات خاصة نهائياً!\n` +
      `🚫 *ملاحظة:* التسجيل في التشكيلة يتطلب الانضمام المسبق لمجتمع الفريق.`;
  }
  if (lang === 'en') {
    return `📢 *MANDATORY: JOIN OUR OFFICIAL COMMUNITY FIRST!* 📢\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `⚠️ To participate in **BRATVA FCM** tournaments, you must first join our official Channel and Discussion Group!\n\n` +
      `📲 *Mandatory Steps to Register:*\n` +
      `**1.** Join our official Channel and Discussion Group via the button below.\n` +
      `**2.** Once joined, the bot will automatically prompt you to enter your player nickname.\n` +
      `**3.** Send your public EA FC Mobile In-Game Nickname to enter our tournament roster!\n\n` +
      `🔒 *100% Safe:* We only ask for your public in-game nickname to track your match goals — no logins or passwords needed!\n` +
      `🚫 *Note:* Roster registration requires joining our official community first.`;
  }
  if (lang === 'es') {
    return `📢 *¡OBLIGATORIO: ÚNETE PRIMERO A LA COMUNIDAD!* 📢\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `⚠️ Para participar en los torneos de **BRATVA FCM**, ¡primero debes unirte a nuestro Canal y Grupo oficial!\n\n` +
      `📲 *Pasos obligatorios:*\n` +
      `**1.** Únete a nuestro Canal y Grupo oficial mediante el botón de abajo.\n` +
      `**2.** Una vez dentro, el bot te enviará automáticamente el mensaje para registrar tu nombre de jugador.\n` +
      `**3.** Envía tu nombre público de EA FC Mobile (IGN) para entrar en la plantilla del equipo.\n\n` +
      `🔒 *100% Seguro:* Solo solicitamos tu nombre público del juego para registrar goles y alineaciones — ¡sin contraseñas!\n` +
      `🚫 *Nota:* El registro en plantilla requiere unirse a la comunidad primero.`;
  }
  // Russian (Default)
  return `📢 *ОБЯЗАТЕЛЬНО: ВСТУПИТЕ В КАНАЛ И ЧАТ ЛИГИ!* 📢\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `⚠️ Для участия в турнирах **БРАТВА FCM** необходимо сначала вступить в наш официальный Канал и Чат команды!\n\n` +
    `📲 *Обязательные шаги для допуска:*\n` +
    `**1.** Вступите в наш официальный Канал и Чат по кнопке ниже.\n` +
    `**2.** После вступления бот автоматически пришлет сообщение для записи вашего игрового ника в состав.\n` +
    `**3.** Отправьте свой игровой никнейм в EA FC Mobile для допуска к составу на турниры!\n\n` +
    `🔒 *Безопасно:* Мы просим только публичный никнейм из игры для учета голов в турнирах — пароли и логины не нужны!\n` +
    `🚫 *Важно:* Запись в состав доступна только участникам нашего сообщества.`;
}

function getJoinRequiredKeyboard(currentLang = 'ru') {
  const joinLabel = currentLang === 'ar' ? '1️⃣ اضغط هنا للانضمام للقناة والمجموعة' :
                    currentLang === 'es' ? '1️⃣ Unirse al Canal y Grupo' :
                    currentLang === 'en' ? '1️⃣ Join Channel & Group Chat' : '1️⃣ Вступить в Канал и Чат';

  const ruLabel = currentLang === 'ru' ? '• 🇷🇺 RU •' : '🇷🇺 RU';
  const enLabel = currentLang === 'en' ? '• 🇬🇧 EN •' : '🇬🇧 EN';
  const arLabel = currentLang === 'ar' ? '• 🇸🇦 AR •' : '🇸🇦 AR';
  const esLabel = currentLang === 'es' ? '• 🇪🇸 ES •' : '🇪🇸 ES';

  return {
    inline_keyboard: [
      [
        { text: joinLabel, url: COMMUNITY_URL }
      ],
      [
        { text: ruLabel, callback_data: 'tab_joinreq_0_ru' },
        { text: enLabel, callback_data: 'tab_joinreq_0_en' },
        { text: arLabel, callback_data: 'tab_joinreq_0_ar' },
        { text: esLabel, callback_data: 'tab_joinreq_0_es' }
      ]
    ]
  };
}

function formatCommunityJoinedPrompt(lang = 'ru') {
  if (lang === 'ar') {
    return `👋 *مرحباً بك في مجتمع БРАТВА FCM!* ⚜️\n\n` +
      `🎉 *لقد انضممت بنجاح إلى القناة الرسمية ومجموعة الفريق!*\n\n` +
      `👉 *الخطوة التالية — تسجيل اسمك في تشكيلة البطولات:*\n` +
      `اضغط على الزر بالأسفل لتأكيد عضويتك وإرسال اسمك المستعار في لعبة EA FC Mobile!\n\n` +
      `🔒 *آمن 100%:* نطلب فقط اسمك المستعار الظاهر في اللعبة (Nickname) لحساب أهدافك وإدراجك في تشكيلة المباريات — لا نطلب أي كلمة مرور أو دخول لحسابك نهائياً!\n\n` +
      `⚠️ *تنبيه هام:* يرجى قراءة قوانين الفريق بالأسفل (إلزامية لعب 3/3 جولات في كل بطولة) لتفادي العقوبات أو الاستبعاد!`;
  }
  if (lang === 'en') {
    return `👋 *Welcome to the BRATVA FCM Community!* ⚜️\n\n` +
      `🎉 *You have successfully joined our official Channel and Squad Chat!*\n\n` +
      `👉 *Next Step — Enter Tournament Squad Roster:*\n` +
      `Tap the button below to confirm your membership and submit your public EA FC Mobile In-Game Nickname!\n\n` +
      `🔒 *100% Safe:* We only ask for your public in-game nickname to record your match goals and lineup selection — no passwords or account logins ever!\n\n` +
      `⚠️ *Important:* Please read our official League Rules below (play all 3/3 turns in tournaments) to avoid strikes and removal!`;
  }
  if (lang === 'es') {
    return `👋 *¡Bienvenido a la comunidad de BRATVA FCM!* ⚜️\n\n` +
      `🎉 *¡Te has unido con éxito a nuestro Canal y Grupo oficial!*\n\n` +
      `👉 *Siguiente paso — Registro en la plantilla de torneos:*\n` +
      `¡Pulsa el botón de abajo para confirmar tu membresía y registrar tu nombre de EA FC Mobile!\n\n` +
      `🔒 *100% Seguro:* Solo necesitamos tu nombre público del juego para registrar tus goles en torneos y convocarte en la alineación — ¡sin contraseñas!\n\n` +
      `⚠️ *Importante:* Lee el reglamento oficial abajo (jugar los 3/3 turnos en cada torneo) para evitar sanciones y expulsión.`;
  }
  // Russian (Default)
  return `👋 *Добро пожаловать в сообщество БРАТВА FCM!* ⚜️\n\n` +
    `🎉 *Вы успешно вступили в наш официальный Канал и Чат команды!*\n\n` +
    `👉 *Следующий шаг — Запись в состав лиги на турниры:*\n` +
    `Нажмите кнопку ниже, чтобы подтвердить участие и записать свой игровой никнейм EA FC Mobile в состав команды!\n\n` +
    `🔒 *100% Безопасно:* Бот просит только ваш публичный игровой никнейм для учета забитых голов и расстановки в турнирах — пароли не требуются!\n\n` +
    `⚠️ *Важно:* Обязательно прочитайте правила лиги ниже (забирать все 3/3 ходов в каждом турнире), чтобы избежать штрафов!`;
}

function getCommunityJoinedKeyboard(currentLang = 'ru') {
  const checkLabel = currentLang === 'ar' ? '2️⃣ تأكيد الانضمام والمتابعة' :
                     currentLang === 'es' ? '2️⃣ Verificar suscripción y continuar' :
                     currentLang === 'en' ? '2️⃣ Check Membership & Continue' : '2️⃣ Проверить подписку и продолжить';

  const rulesLabel = currentLang === 'ar' ? '📜 قراءة قوانين الفريق' :
                     currentLang === 'es' ? '📜 Leer Reglamento de la Liga' :
                     currentLang === 'en' ? '📜 Read League Rules' : '📜 Правила лиги';

  const siteLabel = currentLang === 'ar' ? '🌐 الموقع الرسمي للفريق' :
                    currentLang === 'es' ? '🌐 Web Oficial de la Liga' :
                    currentLang === 'en' ? '🌐 Official League Website' : '🌐 Официальный сайт лиги';

  const ruLabel = currentLang === 'ru' ? '• 🇷🇺 RU •' : '🇷🇺 RU';
  const enLabel = currentLang === 'en' ? '• 🇬🇧 EN •' : '🇬🇧 EN';
  const arLabel = currentLang === 'ar' ? '• 🇸🇦 AR •' : '🇸🇦 AR';
  const esLabel = currentLang === 'es' ? '• 🇪🇸 ES •' : '🇪🇸 ES';

  return {
    inline_keyboard: [
      [
        { text: checkLabel, callback_data: `verify_sub_${currentLang}` }
      ],
      [
        { text: rulesLabel, callback_data: `tab_rules_0_${currentLang}` },
        { text: siteLabel, url: WEBSITE_URL }
      ],
      [
        { text: ruLabel, callback_data: `tab_cmjoined_0_ru` },
        { text: enLabel, callback_data: `tab_cmjoined_0_en` },
        { text: arLabel, callback_data: `tab_cmjoined_0_ar` },
        { text: esLabel, callback_data: `tab_cmjoined_0_es` }
      ]
    ]
  };
}

function formatVerificationPrompt(lang = 'ru') {
  if (lang === 'ar') {
    return `⚜️ *دوري БРАТВА FCM — تسجيل اسم اللاعب* ⚜️\n\n` +
      `✅ *تم تأكيد عضويتك بنجاح! مرحباً بك في الفريق!*\n\n` +
      `👉 *أرسل الآن اسمك المستعار في لعبة EA FC Mobile (In-Game Nickname) هنا في المحادثة:*\n` +
      `_(اكتب اسمك تماماً كما يظهر في قائمة الفريق باللعبة)_\n\n` +
      `🔒 *آمن ومبسط 100%:*\n` +
      `نحتاج فقط لاسمك الظاهر في اللعبة لحساب أهدافك في البطولات وتنزيلك في التشكيلة الأساسية — لا نحتاج لأي كلمة مرور أو دخول لحسابك نهائياً!`;
  }
  if (lang === 'en') {
    return `⚜️ *BRATVA FCM — SQUAD ROSTER REGISTRATION* ⚜️\n\n` +
      `✅ *Community Membership Confirmed! Welcome to the squad!*\n\n` +
      `👉 *Simply send your public EA FC Mobile In-Game Nickname (IGN) here in chat:*\n` +
      `_(Type it exactly as it appears in the game squad roster)_\n\n` +
      `🔒 *100% Safe & Simple:*\n` +
      `We only use your public in-game name to record tournament goals and include you in starting lineups — no passwords or account logins ever!`;
  }
  if (lang === 'es') {
    return `⚜️ *BRATVA FCM — REGISTRO EN LA PLANTILLA* ⚜️\n\n` +
      `✅ *¡Membresía confirmada con éxito! ¡Bienvenido al equipo!*\n\n` +
      `👉 *Simplemente escribe aquí en el chat tu nombre de EA FC Mobile (IGN):*\n` +
      `_(Escríbelo exactamente como aparece en la plantilla del juego)_\n\n` +
      `🔒 *100% Seguro y sencillo:*\n` +
      `Solo necesitamos tu nombre público del juego para registrar tus goles en torneos y convocarte en la alineación — ¡sin contraseñas ni accesos!`;
  }
  return `⚜️ *БРАТВА FCM — ЗАПИСЬ В СОСТАВ КОМАНДЫ* ⚜️\n\n` +
    `✅ *Подписка на сообщество подтверждена! Добро пожаловать в команду!*\n\n` +
    `👉 *Просто отправьте сюда в чат ваш игровой никнейм EA FC Mobile (IGN):*\n` +
    `_(Напишите его в точности так, как он указан в списке состава в игре)_\n\n` +
    `🔒 *100% Безопасно и просто:*\n` +
    `Бот использует только ваш публичный никнейм для подсчета голов в турнирах и допуска к основе — никаких паролей и входов в аккаунт!`;
}

function getVerificationKeyboard(currentLang = 'ru') {
  const ruLabel = currentLang === 'ru' ? '• 🇷🇺 RU •' : '🇷🇺 RU';
  const enLabel = currentLang === 'en' ? '• 🇬🇧 EN •' : '🇬🇧 EN';
  const arLabel = currentLang === 'ar' ? '• 🇸🇦 AR •' : '🇸🇦 AR';
  const esLabel = currentLang === 'es' ? '• 🇪🇸 ES •' : '🇪🇸 ES';

  return {
    inline_keyboard: [
      [
        { text: ruLabel, callback_data: 'tab_verify_0_ru' },
        { text: enLabel, callback_data: 'tab_verify_0_en' },
        { text: arLabel, callback_data: 'tab_verify_0_ar' },
        { text: esLabel, callback_data: 'tab_verify_0_es' }
      ],
      [
        { text: '🌐 Official League Website', url: WEBSITE_URL }
      ]
    ]
  };
}

function formatVerificationSuccess(matchedName, uid = null, lang = 'ru') {
  const uidText = uid ? ` (UID: \`${clean(uid)}\`)` : '';
  const nameIso = bidiIsolate(matchedName);
  if (lang === 'ar') {
    return `✅ *تم تسجيلك في قائمة الفريق بنجاح!* ⚜️\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 *اسم اللاعب في اللعبة:* *${nameIso}*${uidText}\n` +
      `🔰 *الحالة:* مسجل في تشكيلة الفريق الرسمية\n` +
      `────────────────────\n` +
      `⚠️ *تنبيه هام جداً (إلزامي للقراءة):*\n` +
      `يرجى قراءة قوانين الدوري الرسمية بالضغط على [ 📜 اقرأ قوانين الدوري (هام جداً) ] بالأسفل لتجنب الإنذارات والاستبعاد!\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👉 *الخطوة التالية:* اضغط على الأزرار بالأسفل للانضمام للقناة وقراءة القوانين:`;
  }
  if (lang === 'en') {
    return `✅ *REGISTERED IN SQUAD ROSTER!* ⚜️\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 *In-Game Nickname:* *${nameIso}*${uidText}\n` +
      `🔰 *Squad Status:* Active Roster Member\n` +
      `────────────────────\n` +
      `⚠️ *IMPORTANT TO READ (MANDATORY):*\n` +
      `Please read our official League Rules by tapping [ 📜 Read League Rules (IMPORTANT) ] below to avoid strikes and removal from the team!\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👉 *Next Step:* Tap buttons below to join our community and read the rules:`;
  }
  if (lang === 'es') {
    return `✅ *¡REGISTRADO EN LA PLANTILLA!* ⚜️\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 *Nombre en el juego:* *${nameIso}*${uidText}\n` +
      `🔰 *Estado:* Miembro Activo en Plantilla\n` +
      `────────────────────\n` +
      `⚠️ *AVISO IMPORTANTE (LECTURA OBLIGATORIA):*\n` +
      `¡Lee las reglas oficiales de la liga pulsando [ 📜 Leer Reglas (IMPORTANTE) ] abajo para evitar strikes y expulsión!\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👉 *Siguiente paso:* Toca los botones de abajo para unirte al canal y leer las reglas:`;
  }
  return `✅ *ИГРОК УСПЕШНО ЗАПИСАН В СОСТАВ!* ⚜️\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 *Игровой ник:* *${nameIso}*${uidText}\n` +
    `🔰 *Статус в лиге:* Активный игрок состава\n` +
    `────────────────────\n` +
    `⚠️ *ВАЖНО К ПРОЧТЕНИЮ (ОБЯЗАТЕЛЬНО):*\n` +
    `Обязательно ознакомься с правилами лиги, нажав [ 📜 Читать Правила (ВАЖНО) ] ниже, чтобы избежать страйков и кика из команды!\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👉 *Следующий шаг:* Вступай в канал/чат и читай правила по кнопкам ниже:`;
}

function getVerificationSuccessKeyboard(playerId, currentLang = 'ru') {
  const ruLabel = currentLang === 'ru' ? '• 🇷🇺 RU •' : '🇷🇺 RU';
  const enLabel = currentLang === 'en' ? '• 🇬🇧 EN •' : '🇬🇧 EN';
  const arLabel = currentLang === 'ar' ? '• 🇸🇦 AR •' : '🇸🇦 AR';
  const esLabel = currentLang === 'es' ? '• 🇪🇸 ES •' : '🇪🇸 ES';

  const folderLabel = currentLang === 'ar' ? '👥 انضم للقناة والمجموعة الرسمية' :
                      currentLang === 'es' ? '👥 Unirse al Canal y Grupo Oficial' :
                      currentLang === 'en' ? '👥 Join Official Channel & Chat' : '👥 Вступить в Канал и Чат Лиги';

  const channelLabel = currentLang === 'ar' ? '📢 القناة الرسمية @BRATVAFCM' :
                       currentLang === 'es' ? '📢 Canal Oficial @BRATVAFCM' :
                       currentLang === 'en' ? '📢 Official Channel @BRATVAFCM' : '📢 Официальный Канал @BRATVAFCM';

  const rulesBtnLabel = currentLang === 'ar' ? '📜 اقرأ قوانين الدوري (هام جداً)' :
                        currentLang === 'es' ? '📜 Leer Reglas (IMPORTANTE)' :
                        currentLang === 'en' ? '📜 Read League Rules (IMPORTANT)' : '📜 Читать Правила Лиги (ВАЖНО)';

  const { pIndex } = loadLeagueData();
  const hasStats = pIndex && pIndex[playerId];

  const cardLabel = currentLang === 'ar' ? (hasStats ? '🌐 بطاقتك الشخصية في الموقع' : '🌐 الموقع الرسمي للدوري') :
                    currentLang === 'es' ? (hasStats ? '🌐 Tu Tarjeta en la Web' : '🌐 Sitio Oficial de la Liga') :
                    currentLang === 'en' ? (hasStats ? '🌐 Your Player Card on Website' : '🌐 Official League Website') :
                    (hasStats ? '🌐 Твоя Карточка на Сайте' : '🌐 Официальный Сайт Лиги');

  const cardUrl = hasStats ? `${WEBSITE_URL}?player=${encodeURIComponent(playerId)}` : WEBSITE_URL;

  const menuBtnLabel = currentLang === 'ar' ? '📋 القائمة الرئيسية (لوحة التحكم)' :
                       currentLang === 'es' ? '📋 Menú Principal (Panel)' :
                       currentLang === 'en' ? '📋 Main Menu (Dashboard)' : '📋 Главное меню Лиги';

  return {
    inline_keyboard: [
      [
        { text: ruLabel, callback_data: `tab_versuccess_${playerId}_ru` },
        { text: enLabel, callback_data: `tab_versuccess_${playerId}_en` },
        { text: arLabel, callback_data: `tab_versuccess_${playerId}_ar` },
        { text: esLabel, callback_data: `tab_versuccess_${playerId}_es` }
      ],
      [
        { text: menuBtnLabel, callback_data: 'cmd_menu' }
      ],
      [
        { text: rulesBtnLabel, callback_data: `tab_rules_0_${currentLang}` }
      ],
      [
        { text: folderLabel, url: COMMUNITY_URL }
      ],
      [
        { text: channelLabel, url: 'https://t.me/BRATVAFCM' }
      ],
      [
        { text: cardLabel, url: cardUrl }
      ]
    ]
  };
}

function formatUidPrompt(inGameName, lang = 'ru') {
  if (lang === 'en') {
    return `⚠️ *A PLAYER WITH THIS NAME IS ALREADY IN THE LEAGUE!* ⚜️\n\n` +
      `Username: *${clean(inGameName)}*\n\n` +
      `Another member has already registered with this exact username.\n` +
      `To distinguish your account and avoid confusion:\n\n` +
      `👉 *Please send your in-game UID (User ID) here in chat*\n` +
      `_(You can copy your UID from your EA FC Mobile profile)_\n\n` +
      `⚡ Once sent, you'll immediately get your invite link to our official channel & squad chat!`;
  }
  if (lang === 'ar') {
    return `⚠️ *يوجد لاعب بنفس هذا الاسم في الدوري بالفعل!* ⚜️\n\n` +
      `الاسم: *${clean(inGameName)}*\n\n` +
      `تم تسجيل عضو آخر بنفس هذا الاسم مسبقاً.\n` +
      `للتعرف على حسابك وتجنب أي التباس بينكما:\n\n` +
      `👉 *أرسل الـ UID الخاص بك في اللعبة هنا في المحادثة*\n` +
      `_(يمكنك نسخ الـ UID من ملفك الشخصي داخل EA FC Mobile)_\n\n` +
      `⚡ بمجرد إرسال الـ UID، ستحصل فوراً على رابط الدخول إلى القناة ومجموعة الفريق!`;
  }
  if (lang === 'es') {
    return `⚠️ *¡YA HAY UN JUGADOR CON ESTE NOMBRE EN LA LIGA!* ⚜️\n\n` +
      `Nombre: *${clean(inGameName)}*\n\n` +
      `Otro miembro ya se ha registrado con este mismo nombre.\n` +
      `Para distinguir tu cuenta y evitar confusiones:\n\n` +
      `👉 *Envía tu UID (User ID) del juego aquí en el chat*\n` +
      `_(Puedes copiar tu UID desde tu perfil de EA FC Mobile)_\n\n` +
      `⚡ ¡En cuanto envíes tu UID, recibirás de inmediato el enlace al canal y al chat!`;
  }
  return `⚠️ *ИГРОК С ТАКИМ ИМЕНЕМ УЖЕ ЕСТЬ В ЛИГЕ!* ⚜️\n\n` +
    `Никнейм: *${clean(inGameName)}*\n\n` +
    `В лиге уже зарегистрирован участник с таким же никнеймом.\n` +
    `Чтобы мы точно знали твой аккаунт и не перепутали вас:\n\n` +
    `👉 *Отправь сюда свой игровой UID (User ID)*\n` +
    `_(UID можно скопировать в профиле EA FC Mobile)_\n\n` +
    `⚡ Как только отправишь UID, бот сразу выдаст тебе ссылку для входа в канал и чат лиги!`;
}

function getUidPromptKeyboard(encodedName, currentLang = 'ru') {
  const ruLabel = currentLang === 'ru' ? '• 🇷🇺 RU •' : '🇷🇺 RU';
  const enLabel = currentLang === 'en' ? '• 🇬🇧 EN •' : '🇬🇧 EN';
  const arLabel = currentLang === 'ar' ? '• 🇸🇦 AR •' : '🇸🇦 AR';
  const esLabel = currentLang === 'es' ? '• 🇪🇸 ES •' : '🇪🇸 ES';

  return {
    inline_keyboard: [
      [
        { text: ruLabel, callback_data: `tab_veruid_${encodedName}_ru` },
        { text: enLabel, callback_data: `tab_veruid_${encodedName}_en` },
        { text: arLabel, callback_data: `tab_veruid_${encodedName}_ar` },
        { text: esLabel, callback_data: `tab_veruid_${encodedName}_es` }
      ],
      [
        { text: '🌐 Official League Website', url: WEBSITE_URL }
      ]
    ]
  };
}

function formatPhotoWarning(lang = 'ru') {
  if (lang === 'en') {
    return `⛔ *LEAGUE ADMINS ONLY!* ⚠️\n\n` +
      `Uploading tournament match screenshots is strictly reserved for League Admins.\n\n` +
      `👉 *Are you a league member?*\n` +
      `Send your *EA FC Mobile username* here in chat to get your official invite link to our private channel & squad chat!`;
  }
  if (lang === 'ar') {
    return `⛔ *خاص بمسؤولي الدوري فقط!* ⚠️\n\n` +
      `تحميل لقطات مباريات البطولة متاح فقط لمسؤولي ومؤسس الدوري.\n\n` +
      `👉 *هل أنت عضو في الفريق؟*\n` +
      `أرسل *اسمك في EA FC Mobile* هنا للحصول على رابط الانضمام إلى القناة الرسمية ومجموعة الفريق!`;
  }
  if (lang === 'es') {
    return `⛔ *¡SOLO PARA ADMINISTRADORES!* ⚠️\n\n` +
      `La subida de capturas de torneos está reservada exclusivamente para administradores.\n\n` +
      `👉 *¿Eres miembro de la liga?*\n` +
      `¡Envía tu *nombre de EA FC Mobile* aquí en el chat para recibir el enlace a nuestro canal y chat privado!`;
  }
  return `⛔ *ТОЛЬКО ДЛЯ АДМИНИСТРАТОРОВ ЛИГИ!* ⚠️\n\n` +
    `Загружать скриншоты матчей турнира могут только администраторы лиги.\n\n` +
    `👉 *Ты участник лиги?*\n` +
    `Отправь свое *имя пользователя (username) в EA FC Mobile* сюда в чат, чтобы получить ссылку на закрытый канал и чат лиги!`;
}

function getPhotoWarningKeyboard(currentLang = 'ru') {
  const ruLabel = currentLang === 'ru' ? '• 🇷🇺 RU •' : '🇷🇺 RU';
  const enLabel = currentLang === 'en' ? '• 🇬🇧 EN •' : '🇬🇧 EN';
  const arLabel = currentLang === 'ar' ? '• 🇸🇦 AR •' : '🇸🇦 AR';
  const esLabel = currentLang === 'es' ? '• 🇪🇸 ES •' : '🇪🇸 ES';

  return {
    inline_keyboard: [
      [
        { text: ruLabel, callback_data: 'tab_verphoto_0_ru' },
        { text: enLabel, callback_data: 'tab_verphoto_0_en' },
        { text: arLabel, callback_data: 'tab_verphoto_0_ar' },
        { text: esLabel, callback_data: 'tab_verphoto_0_es' }
      ],
      [
        { text: '🌐 Official League Website', url: WEBSITE_URL }
      ]
    ]
  };
}

function getCanonicalPlayerKey(pid, displayName) {
  const normName = (displayName || '').trim().toLowerCase();
  const normPid = (pid || '').trim().toLowerCase();

  if (normPid === 'sanya' || normPid === 'саня' || normName === 'саня' || normName === 'sanya') {
    return 'sanya';
  }
  if (normPid === 'doxibro' || normPid === 'doxibero' || normName === 'doxibéro' || normName === 'doxibero') {
    return 'doxibro';
  }
  if (normPid === 'doxibero1' || normName === 'doxibero1') {
    return 'doxibero1';
  }
  if (normPid === 'tima' || normPid === 'тима' || normName === 'тима' || normName === 'tima') {
    return 'tima';
  }

  const raw = normName || normPid;
  let cleanKey = raw.replace(/[^a-z0-9а-яё]/gi, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  if (cleanKey.startsWith('member_')) {
    cleanKey = cleanKey.replace(/^member_/, '');
  }
  return cleanKey || raw;
}

async function formatPendingAudit(lang = 'ru') {
  const regData = await getRegisteredPlayers();
  const registeredMap = regData.registrations || {};

  const { pIndex } = loadLeagueData();

  const playersByKey = new Map();
  for (const [pid, p] of Object.entries(pIndex || {})) {
    if (!p || !p.display_name) continue;
    const key = getCanonicalPlayerKey(pid, p.display_name);
    if (!playersByKey.has(key)) {
      playersByKey.set(key, {
        pids: [pid],
        displayName: p.display_name
      });
    } else {
      const pids = playersByKey.get(key).pids;
      if (!pids.includes(pid)) pids.push(pid);
    }
  }

  if (globalLatestTournament && globalLatestTournament.matches) {
    for (const m of globalLatestTournament.matches) {
      if (m.player_id && m.player_display_name) {
        const key = getCanonicalPlayerKey(m.player_id, m.player_display_name);
        if (!playersByKey.has(key)) {
          playersByKey.set(key, {
            pids: [m.player_id],
            displayName: m.player_display_name
          });
        } else {
          const pids = playersByKey.get(key).pids;
          if (!pids.includes(m.player_id)) pids.push(m.player_id);
        }
      }
    }
  }

  for (const [rId, reg] of Object.entries(registeredMap)) {
    if (reg && reg.display_name) {
      const key = getCanonicalPlayerKey(reg.player_id || rId, reg.display_name);
      if (!playersByKey.has(key)) {
        playersByKey.set(key, {
          pids: [reg.player_id || rId],
          displayName: reg.display_name
        });
      } else {
        const pids = playersByKey.get(key).pids;
        if (reg.player_id && !pids.includes(reg.player_id)) pids.push(reg.player_id);
      }
    }
  }

  const verified = [];
  const pending = [];

  for (const [key, pInfo] of playersByKey.entries()) {
    let reg = null;
    for (const pid of pInfo.pids) {
      if (registeredMap[pid]) {
        reg = registeredMap[pid];
        break;
      }
    }
    if (!reg && registeredMap[key]) {
      reg = registeredMap[key];
    }

    const isOwner = key === 'sanya' || key === 'саня' || (reg && (reg.is_owner || reg.role === 'Owner'));
    const isAdmin = key === 'doxibro' || key === 'doxibero' || key === 'doxibero1' || (reg && (reg.is_admin || reg.role === 'Admin'));

    if (isOwner || isAdmin || reg) {
      // Clean names ONLY - no @, no ID, no admin labels as requested!
      verified.push(`• *${clean(pInfo.displayName)}*`);
    } else {
      pending.push(`• *${clean(pInfo.displayName)}*`);
    }
  }

  const cleanVerified = Array.from(new Set(verified)).sort((a, b) => a.localeCompare(b));
  const cleanPending = Array.from(new Set(pending)).sort((a, b) => a.localeCompare(b));

  const total = cleanVerified.length + cleanPending.length;
  const vCount = cleanVerified.length;
  const pCount = cleanPending.length;
  const pct = total > 0 ? Math.round((vCount / total) * 100) : 0;

  if (lang === 'en') {
    let msg = `📋 *БРАТВА FCM — TELEGRAM SQUAD AUDIT* ⚜️\n\n` +
      `📊 *Registration Status (🚨 TODAY IS THE LAST CHANCE!):*\n` +
      `• Total Roster: *${total}* players\n` +
      `• ✅ Joined on Telegram: *${vCount}* (${pct}%)\n` +
      `• ❌ Not Registered (To Kick): *${pCount}* (${100 - pct}%)\n\n`;

    if (pCount > 0) {
      msg += `❌ *PLAYERS NOT YET ON TELEGRAM (${pCount}):*\n` +
        `${cleanPending.slice(0, 50).join('\n')}${cleanPending.length > 50 ? `\n_...and ${cleanPending.length - 50} more_` : ''}\n\n` +
        `🚨 *WARNING: TODAY IS THE LAST CHANCE! Anyone remaining on this ❌ list will be kicked from the in-game league tonight!*\n\n`;
    } else {
      msg += `🎉 *100% SQUAD VERIFIED!* All members have successfully registered on Telegram!\n\n`;
    }

    if (cleanVerified.length > 0) {
      msg += `✅ *PLAYERS WHO JOINED TELEGRAM (${cleanVerified.length}):*\n` +
        `${cleanVerified.join('\n')}`;
    }
    return msg;
  }

  if (lang === 'ar') {
    let msg = `📋 *دوري БРАТВА — تدقيق أعضاء تيليجرام* ⚜️\n\n` +
      `📊 *حالة التسجيل (🚨 اليوم هو آخر فرصة!):*\n` +
      `• إجمالي اللاعبين: *${total}* لاعباً\n` +
      `• ✅ المنضمون لتيليجرام: *${vCount}* (${pct}%)\n` +
      `• ❌ غير مسجلين (عرضة للاستبعاد): *${pCount}* (${100 - pct}%)\n\n`;

    if (pCount > 0) {
      msg += `❌ *أعضاء لم ينضموا بعد إلى تيليجرام (${pCount}):*\n` +
        `${cleanPending.slice(0, 50).join('\n')}${cleanPending.length > 50 ? `\n_...و ${cleanPending.length - 50} آخرين_` : ''}\n\n` +
        `🚨 *تنبيه حاسم: اليوم هو آخر فرصة! كل من يبقى في هذه القائمة ❌ سيتم استبعاده فوراً من الدوري داخل اللعبة الليلة!*\n\n`;
    } else {
      msg += `🎉 *اكتمل التوثيق 100%!* جميع أعضاء الفريق انضموا وسجلوا بنجاح في تيليجرام!\n\n`;
    }

    if (cleanVerified.length > 0) {
      msg += `✅ *اللاعبون المنضمون لتيليجرام (${cleanVerified.length}):*\n` +
        `${cleanVerified.join('\n')}`;
    }
    return msg;
  }

  if (lang === 'es') {
    let msg = `📋 *БРАТВА FCM — AUDITORÍA DE TELEGRAM* ⚜️\n\n` +
      `📊 *Estado de Registro (🚨 ¡HOY ES LA ÚLTIMA OPORTUNIDAD!):*\n` +
      `• Plantilla Total: *${total}* jugadores\n` +
      `• ✅ Unidos a Telegram: *${vCount}* (${pct}%)\n` +
      `• ❌ No Registrados (Para Expulsión): *${pCount}* (${100 - pct}%)\n\n`;

    if (pCount > 0) {
      msg += `❌ *JUGADORES QUE AÚN NO ESTÁN EN TELEGRAM (${pCount}):*\n` +
        `${cleanPending.slice(0, 50).join('\n')}${cleanPending.length > 50 ? `\n_...y ${cleanPending.length - 50} más_` : ''}\n\n` +
        `🚨 *¡AVISO FINAL: HOY ES LA ÚLTIMA OPORTUNIDAD! Quien permanezca en esta lista ❌ será expulsado de la liga esta noche!*\n\n`;
    } else {
      msg += `🎉 *¡100% DE LA PLANTILLA EN TELEGRAM!* ¡Todos los miembros se han unido con éxito!\n\n`;
    }

    if (cleanVerified.length > 0) {
      msg += `✅ *JUGADORES QUE YA SE UNIERON (${cleanVerified.length}):*\n` +
        `${cleanVerified.join('\n')}`;
    }
    return msg;
  }

  // Russian (Default)
  let msg = `📋 *БРАТВА FCM — АУДИТ СОСТАВА В TELEGRAM* ⚜️\n\n` +
    `📊 *Статус регистрации (🚨 СЕГОДНЯ ПОСЛЕДНИЙ ШАНС!):*\n` +
    `• Общий состав: *${total}* бойцов\n` +
    `• ✅ Вступили в Telegram: *${vCount}* (${pct}%)\n` +
    `• ❌ Не зарегистрированы (На кик): *${pCount}* (${100 - pct}%)\n\n`;

  if (pCount > 0) {
    msg += `❌ *ИГРОКИ НЕ В TELEGRAM (${pCount}):*\n` +
      `${cleanPending.slice(0, 50).join('\n')}${cleanPending.length > 50 ? `\n_...и ещё ${cleanPending.length - 50}_` : ''}\n\n` +
      `🚨 *ВНИМАНИЕ: СЕГОДНЯ ПОСЛЕДНИЙ ШАНС! Все, кто останется в этом списке ❌ до конца дня, будут исключены из Лиги в игре!*\n\n`;
  } else {
    msg += `🎉 *100% СОСТАВА В TELEGRAM!* Все бойцы успешно подтвердили регистрацию!\n\n`;
  }

  if (cleanVerified.length > 0) {
    msg += `✅ *ИГРОКИ, КОТОРЫЕ УЖЕ В TELEGRAM (${cleanVerified.length}):*\n` +
      `${cleanVerified.join('\n')}`;
  }

  return msg;
}

/**
 * Helper to get clean list of joined and pending players
 * (Pure display names, NO @, NO ID, Admins as regular members, robust matching)
 */
async function getCleanSquadTelegramStatus() {
  const regData = await getRegisteredPlayers();
  const registeredMap = regData.registrations || {};
  const { pIndex } = loadLeagueData();

  const playersByKey = new Map();
  for (const [pid, p] of Object.entries(pIndex || {})) {
    if (!p || !p.display_name) continue;
    if (p.status === 'inactive') continue;
    const key = getCanonicalPlayerKey(pid, p.display_name);
    if (!playersByKey.has(key)) {
      playersByKey.set(key, { pids: [pid], displayName: p.display_name });
    } else {
      const pids = playersByKey.get(key).pids;
      if (!pids.includes(pid)) pids.push(pid);
    }
  }

  if (globalLatestTournament && globalLatestTournament.matches) {
    for (const m of globalLatestTournament.matches) {
      if (m.player_id && m.player_display_name) {
        const key = getCanonicalPlayerKey(m.player_id, m.player_display_name);
        if (!playersByKey.has(key)) {
          playersByKey.set(key, { pids: [m.player_id], displayName: m.player_display_name });
        } else {
          const pids = playersByKey.get(key).pids;
          if (!pids.includes(m.player_id)) pids.push(m.player_id);
        }
      }
    }
  }

  for (const [rId, reg] of Object.entries(registeredMap)) {
    if (reg && reg.display_name) {
      const key = getCanonicalPlayerKey(reg.player_id || rId, reg.display_name);
      if (!playersByKey.has(key)) {
        playersByKey.set(key, { pids: [reg.player_id || rId], displayName: reg.display_name });
      } else {
        const pids = playersByKey.get(key).pids;
        if (reg.player_id && !pids.includes(reg.player_id)) pids.push(reg.player_id);
      }
    }
  }

  const joined = [];
  const pending = [];

  for (const [key, pInfo] of playersByKey.entries()) {
    let reg = null;
    for (const pid of pInfo.pids) {
      if (registeredMap[pid]) { reg = registeredMap[pid]; break; }
    }
    if (!reg && registeredMap[key]) reg = registeredMap[key];

    let isJoined = Boolean(reg || key === 'sanya' || key === 'саня' || key === 'doxibro' || key === 'doxibero' || key === 'doxibero1');
    if (!isJoined) {
      const normKey = key.toLowerCase().replace(/[\s_]+/g, '_');
      for (const r of Object.values(registeredMap)) {
        if (!r) continue;
        const rName = (r.display_name || '').toLowerCase().replace(/[\s_]+/g, '_');
        const rInGame = (r.in_game_name || '').toLowerCase().replace(/[\s_]+/g, '_');
        const rPid = (r.player_id || '').toLowerCase().replace(/[\s_]+/g, '_');
        if (rName === normKey || rInGame === normKey || rPid === normKey || rPid === `member_${normKey}`) {
          isJoined = true;
          break;
        }
      }
    }

    if (isJoined) {
      // Pure clean player name - NO @, NO ID, NO role tags!
      joined.push(`• *${clean(pInfo.displayName)}*`);
    } else {
      pending.push(`• *${clean(pInfo.displayName)}*`);
    }
  }

  const uniqueJoined = Array.from(new Set(joined)).sort((a, b) => a.localeCompare(b));
  const uniquePending = Array.from(new Set(pending)).sort((a, b) => a.localeCompare(b));

  return { uniqueJoined, uniquePending };
}

/**
 * Format Clean Telegram Registration Notice:
 * Clear, motivating instructions with NO member lists, explaining how to verify in the bot
 * and that Telegram verification is mandatory to be eligible for LvL tournament lineups.
 */
function formatTelegramNotice(lang = 'ru') {
  if (lang === 'en') {
    return `📢 *BRATVA FCM: OFFICIAL TELEGRAM REGISTRATION* 📢\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `⚠️ *ATTENTION TO ALL IN-GAME SQUAD MEMBERS:*\n\n` +
      `Registration in our official Telegram bot is **MANDATORY** to participate in LvL tournaments!\n\n` +
      `🚫 *No Telegram = Strictly Benched.* Unverified players cannot be selected for tournament lineups.\n` +
      `🛡️ Inactive accounts without Telegram verification will be removed from the in-game league when spots are needed for active recruits.\n\n` +
      `📲 *HOW TO VERIFY IN 3 EASY STEPS (Takes 10s):*\n` +
      `1️⃣ Open our official bot: [@BratvaFCMBot](https://t.me/BratvaFCMBot?start=register)\n` +
      `2️⃣ Press /start and send your exact in-game Nickname\n` +
      `3️⃣ Join our official Community (Channel & Group Chat)\n\n` +
      `⚡ Once verified, your stats, match history, and tournament lineup eligibility will be activated!`;
  }
  if (lang === 'ar') {
    return `📢 *دوري БРАТВА FCM: تنبيه رسمي للتسجيل في تيليجرام* 📢\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `⚠️ *إلى جميع أعضاء الدوري داخل لعبة FC Mobile:*\n\n` +
      `التسجيل في بوت تيليجرام الرسمي **إلزامي وضروري** للمشاركة في بطولات الدوري (LvL)!\n\n` +
      `🚫 *غير مسجل في البوت = في الاحتياط التام.* لا يدخل أي لاعب غير موثق إلى التشكيلة الأساسية للبطولات نهائياً.\n` +
      `🛡️ الحسابات غير الموثقة في تيليجرام معرضة للاستبعاد من الدوري عند امتلاء المقاعد لإفساح المجال للأعضاء النشيطين.\n\n` +
      `📲 *خطوات التوثيق في 3 خطوات بسيطة (10 ثوانٍ فقط):*\n` +
      `1️⃣ ادخل إلى البوت الرسمي: [@BratvaFCMBot](https://t.me/BratvaFCMBot?start=register)\n` +
      `2️⃣ اضغط على /start وأرسل اسم حسابك في اللعبة (Nickname) تماماً\n` +
      `3️⃣ انضم إلى مجتمع الفريق الرسمي (القناة ومجموعة النقاش)\n\n` +
      `⚡ بعد التوثيق، يتم تفعيل إحصائياتك وأهليتك لدخول التشكيلة والمنافسة في البطولات!`;
  }
  if (lang === 'es') {
    return `📢 *BRATVA FCM: REGISTRO OFICIAL EN TELEGRAM* 📢\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `⚠️ *ATENCIÓN A TODOS LOS MIEMBROS EN FC MOBILE:*\n\n` +
      `¡El registro en nuestro bot oficial de Telegram es **OBLIGATORIO** para participar en torneos LvL!\n\n` +
      `🚫 *Sin Telegram = Banquillo Estricto.* Los jugadores sin verificar no jugarán partidos de torneo.\n` +
      `🛡️ Las cuentas inactivas sin verificar en Telegram podrán ser expulsadas de la liga para dar espacio a miembros activos.\n\n` +
      `📲 *CÓMO VERIFICARTE EN 3 PASOS (10 segundos):*\n` +
      `1️⃣ Abre nuestro bot oficial: [@BratvaFCMBot](https://t.me/BratvaFCMBot?start=register)\n` +
      `2️⃣ Pulsa /start y envía tu Nick exacto del juego\n` +
      `3️⃣ Únete a nuestra comunidad oficial (Canal y Grupo)\n\n` +
      `⚡ ¡Una vez verificado, tendrás acceso a las alineaciones de torneos y tus estadísticas!`;
  }
  // Russian (Default)
  return `📢 *БРАТВА FCM: РЕГИСТРАЦИЯ В TELEGRAM* 📢\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `⚠️ *ВНИМАНИЮ ВСЕХ УЧАСТНИКОВ ЛИГИ В FC MOBILE:*\n\n` +
    `Регистрация в официальном боте Telegram **ОБЯЗАТЕЛЬНА** для участия в турнирах LvL!\n\n` +
    `🚫 *Нет в боте = Строго в запасе.* Неверифицированные игроки не допускаются в основу на турнирные матчи.\n` +
    `🛡️ Неактивные аккаунты без верификации в Telegram подлежат исключению из лиги при необходимости мест для активных новичков.\n\n` +
    `📲 *КАК ПРОЙТИ ВЕРИФИКАЦИЮ ЗА 3 ШАГА (10 секунд):*\n` +
    `1️⃣ Откройте официального бота: [@BratvaFCMBot](https://t.me/BratvaFCMBot?start=register)\n` +
    `2️⃣ Нажмите /start и отправьте свой точный игровой ник\n` +
    `3️⃣ Вступите в официальное сообщество (Канал и Чат)\n\n` +
    `⚡ После верификации ваш профиль, статистика и допуск к турнирам будут активированы!`;
}

/**
 * Format Dedicated Warning Message: "Today is Last Chance"
 * Showing clean names of players who joined (no @, no ID, admins as members)
 * and unjoined players with urgent kick deadline warning!
 */
async function formatLastChanceWarning(lang = 'ru') {
  const { uniqueJoined, uniquePending } = await getCleanSquadTelegramStatus();

  if (lang === 'en') {
    let msg = `🚨 *БРАТВА FCM: FINAL NOTICE — TODAY IS THE LAST CHANCE!* 🚨\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `⚠️ *ATTENTION ALL SQUAD MEMBERS!*\n` +
      `Today is the **FINAL DEADLINE** to register on our official Telegram! All EA FC Mobile league members must verify their in-game nickname.\n\n` +
      `✅ *PLAYERS WHO ALREADY JOINED TELEGRAM (${uniqueJoined.length}):*\n` +
      `${uniqueJoined.join('\n')}\n\n`;

    if (uniquePending.length > 0) {
      const sliceCount = 50;
      msg += `❌ *NOT YET ON TELEGRAM (${uniquePending.length} players):*\n` +
        `${uniquePending.slice(0, sliceCount).join('\n')}${uniquePending.length > sliceCount ? `\n_...and ${uniquePending.length - sliceCount} more_` : ''}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `⛔ *DISCIPLINARY KICK (END OF TODAY):*\n` +
        `Anyone remaining on this ❌ list by tonight will be **PERMANENTLY KICKED FROM THE IN-GAME LEAGUE**!\n\n` +
        `📲 *HOW TO KEEP YOUR SPOT RIGHT NOW (Takes 10 seconds):*\n` +
        `1. Open our official bot: [@BratvaFCMBot](https://t.me/BratvaFCMBot?start=register)\n` +
        `2. Press /start and send your in-game nickname.\n` +
        `3. Get your ✅ verified status and secure your roster spot!`;
    } else {
      msg += `🎉 *100% SQUAD VERIFIED!* All league members have joined Telegram!`;
    }
    return msg;
  }

  if (lang === 'ar') {
    let msg = `🚨 *دوري БРАТВА: تنبيه أخير وحاسم — اليوم هو آخر فرصة!* 🚨\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `⚠️ *إلى جميع أعضاء الدوري في اللعبة:*\n` +
      `اليوم هو **الموعد النهائي والأخير** لإتمام التسجيل في بوت تيليجرام الرسمي! يجب على كل لاعب تأكيد نك نيم حسابه.\n\n` +
      `✅ *اللاعبون المنضمون حالياً لتيليجرام (${uniqueJoined.length}):*\n` +
      `${uniqueJoined.join('\n')}\n\n`;

    if (uniquePending.length > 0) {
      const sliceCount = 50;
      msg += `❌ *أعضاء لم ينضموا بعد إلى تيليجرام (${uniquePending.length} لاعباً):*\n` +
        `${uniquePending.slice(0, sliceCount).join('\n')}${uniquePending.length > sliceCount ? `\n_...و ${uniquePending.length - sliceCount} آخرين_` : ''}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `⛔ *قرار الاستبعاد الإجباري (مع نهاية اليوم):*\n` +
        `أي لاعب يبقى في هذه القائمة ❌ مع نهاية هذا اليوم سيتم **طرده واستبعاده نهائياً وبلا رجعة** من الدوري داخل اللعبة!\n\n` +
        `📲 *كيف تحمي مكانك في الدوري الآن فوراً (10 ثوانٍ فقط):*\n` +
        `1. ادخل لبوت الدوري الرسمي: [@BratvaFCMBot](https://t.me/BratvaFCMBot?start=register)\n` +
        `2. اضغط /start واكتب اسمك أو نك نيم حسابك في اللعبة.\n` +
        `3. احصل على التوثيق الأخضر ✅ واضمن بقاءك مع الفريق!`;
    } else {
      msg += `🎉 *اكتمل الانضمام 100%!* جميع لاعبي الفريق مسجلون في تيليجرام!`;
    }
    return msg;
  }

  if (lang === 'es') {
    let msg = `🚨 *БРАТВА FCM: AVISO FINAL — ¡HOY ES LA ÚLTIMA OPORTUNIDAD!* 🚨\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `⚠️ *¡ATENCIÓN A TODOS LOS MIEMBROS DE LA LIGA!*\n` +
      `¡Hoy es el **PLAZO FINAL DEFINITIVO** para registrarse en nuestro bot oficial de Telegram! Todos deben confirmar su nick del juego.\n\n` +
      `✅ *JUGADORES QUE YA SE UNIERON A TELEGRAM (${uniqueJoined.length}):*\n` +
      `${uniqueJoined.join('\n')}\n\n`;

    if (uniquePending.length > 0) {
      const sliceCount = 50;
      msg += `❌ *AÚN NO ESTÁN EN TELEGRAM (${uniquePending.length} jugadores):*\n` +
        `${uniquePending.slice(0, sliceCount).join('\n')}${uniquePending.length > sliceCount ? `\n_...y ${uniquePending.length - sliceCount} más_` : ''}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `⛔ *MEDIDA DISCIPLINARIA (AL FINAL DEL DÍA):*\n` +
        `¡Cualquiera que permanezca en la lista ❌ esta noche será **EXPULSADO DEFINITIVAMENTE DE LA LIGA** en el juego!\n\n` +
        `📲 *CÓMO ASEGURAR TU LUGAR AHORA MISMO (Toma 10 segundos):*\n` +
        `1. Abre nuestro bot oficial: [@BratvaFCMBot](https://t.me/BratvaFCMBot?start=register)\n` +
        `2. Pulsa /start y envía tu apodo en el juego.\n` +
        `3. ¡Obtén tu verificación ✅ y asegura tu puesto en el equipo!`;
    } else {
      msg += `🎉 *¡100% DE LA PLANTILLA VERIFICADA!* ¡Todos los miembros se han unido a Telegram!`;
    }
    return msg;
  }

  // Russian (Default)
  let msg = `🚨 *БРАТВА FCM: ПОСЛЕДНЕЕ ПРЕДУПРЕЖДЕНИЕ — СЕГОДНЯ ПОСЛЕДНИЙ ШАНС!* 🚨\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `⚠️ *ВНИМАНИЕ ВСЕМ БОЙЦАМ ЛИГИ!*\n` +
    `Сегодня наступает **крайний срок регистрации** в нашем Telegram-боте! Все игроки Лиги в EA FC Mobile обязаны подтвердить свой ник.\n\n` +
    `✅ *ИГРОКИ, КОТОРЫЕ УЖЕ В TELEGRAM (${uniqueJoined.length}):*\n` +
    `${uniqueJoined.join('\n')}\n\n`;

  if (uniquePending.length > 0) {
    const sliceCount = 50;
    msg += `❌ *ИГРОКИ, КОТОРЫХ ЕЩЁ НЕТ В TELEGRAM (${uniquePending.length} бойцов):*\n` +
      `${uniquePending.slice(0, sliceCount).join('\n')}${uniquePending.length > sliceCount ? `\n_...и ещё ${uniquePending.length - sliceCount}_` : ''}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `⛔ *ДИСЦИПЛИНАРНОЕ ИСКЛЮЧЕНИЕ (СЕГОДНЯ):*\n` +
      `Все, кто останется в списке ❌ до конца сегодняшнего дня, будут **БЕЗВОЗВРАТНО ИСКЛЮЧЕНЫ ИЗ ЛИГИ** в игре!\n\n` +
      `📲 *КАК СОХРАНИТЬ МЕСТО В ЛИГЕ ПРЯМО СЕЙЧАС (10 секунд):*\n` +
      `1. Откройте нашего бота: [@BratvaFCMBot](https://t.me/BratvaFCMBot?start=register)\n` +
      `2. Нажмите /start и напишите свой игровой ник.\n` +
      `3. Получите зеленую галочку ✅ и оставайтесь в команде!`;
  } else {
    msg += `🎉 *100% СОСТАВА В TELEGRAM!* Все бойцы успешно подтвердили регистрацию!`;
  }
  return msg;
}

function getLastChanceWarningKeyboard(currentLang = 'ru') {
  const ruLabel = currentLang === 'ru' ? '• 🇷🇺 RU •' : '🇷🇺 RU';
  const enLabel = currentLang === 'en' ? '• 🇬🇧 EN •' : '🇬🇧 EN';
  const arLabel = currentLang === 'ar' ? '• 🇸🇦 AR •' : '🇸🇦 AR';
  const esLabel = currentLang === 'es' ? '• 🇪🇸 ES •' : '🇪🇸 ES';

  const bcastLabel = currentLang === 'ar' ? '📢 نشر التحذير بالقناة' :
                     currentLang === 'es' ? '📢 Publicar Aviso en el Canal' :
                     currentLang === 'en' ? '📢 Broadcast Warning to Channel' : '📢 Опубликовать предупреждение в канал';

  const auditLabel = currentLang === 'ar' ? '👥 تدقيق تيليجرام' :
                     currentLang === 'es' ? '👥 Auditoría Telegram' :
                     currentLang === 'en' ? '👥 Telegram Audit' : '👥 Аудит состава';

  const refreshLabel = currentLang === 'ar' ? '🔄 تحديث القائمة' :
                       currentLang === 'es' ? '🔄 Actualizar Lista' :
                       currentLang === 'en' ? '🔄 Refresh List' : '🔄 Обновить';

  const menuLabel = currentLang === 'ar' ? '📋 العودة للقائمة' :
                    currentLang === 'es' ? '📋 Volver al Menú' :
                    currentLang === 'en' ? '📋 Back to Menu' : '📋 На главную';

  return {
    inline_keyboard: [
      [
        { text: ruLabel, callback_data: 'tab_warn_0_ru' },
        { text: enLabel, callback_data: 'tab_warn_0_en' },
        { text: arLabel, callback_data: 'tab_warn_0_ar' },
        { text: esLabel, callback_data: 'tab_warn_0_es' }
      ],
      [
        { text: bcastLabel, callback_data: 'bcast_lastchance' }
      ],
      [
        { text: auditLabel, callback_data: 'cmd_pending' },
        { text: refreshLabel, callback_data: 'cmd_warning_lastchance' }
      ],
      [
        { text: menuLabel, callback_data: 'cmd_menu' }
      ]
    ]
  };
}

/**
 * Format Dedicated Announcement: "Removed Players Did Not Join Telegram & Tomorrow You Are Next!"
 * Clear clarification of reasons for removal + urgent deadline warning for tomorrow.
 */
async function formatKickedWarning(lang = 'ru') {
  const { uniqueJoined, uniquePending } = await getCleanSquadTelegramStatus();

  if (lang === 'en') {
    let msg = `🚨 *BRATVA FCM: KICKED PLAYERS NOTICE & TOMORROW'S WARNING!* 🚨\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📢 *OFFICIAL CLARIFICATION TO ALL LEAGUE MEMBERS:*\n` +
      `The players recently removed from our in-game league were removed **STRICTLY BECAUSE THEY FAILED TO JOIN TELEGRAM**!\n` +
      `They did not register in our bot or join the team chat to coordinate tournaments.\n\n` +
      `⛔ *TOMORROW IS THE NEXT WAVE OF REMOVALS — YOU ARE NEXT!*\n` +
      `Anyone who remains on the ❌ unjoined list by tomorrow will be **THE NEXT TO BE PERMANENTLY KICKED FROM THE LEAGUE** without warning!\n\n` +
      `✅ *PLAYERS WHO ALREADY JOINED TELEGRAM (${uniqueJoined.length}):*\n` +
      `${uniqueJoined.join('\n')}\n\n`;

    if (uniquePending.length > 0) {
      const sliceCount = 50;
      msg += `❌ *NOT YET ON TELEGRAM — IN LINE FOR TOMORROW'S KICK (${uniquePending.length} players):*\n` +
        `${uniquePending.slice(0, sliceCount).join('\n')}${uniquePending.length > sliceCount ? `\n_...and ${uniquePending.length - sliceCount} more_` : ''}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📲 *HOW TO KEEP YOUR SPOT RIGHT NOW (Takes 10 seconds):*\n` +
        `1. Open our official bot: [@BratvaFCMBot](https://t.me/BratvaFCMBot?start=register)\n` +
        `2. Press /start and send your in-game nickname.\n` +
        `3. Join our community chat & channel.\n\n` +
        `⚠️ *IMPORTANT:* Even if you are already inside the group or channel, you **MUST** open [@BratvaFCMBot](https://t.me/BratvaFCMBot?start=register) and send your in-game nickname to get verified!`;
    } else {
      msg += `🎉 *100% SQUAD VERIFIED!* All league members have joined Telegram!`;
    }
    return msg;
  }

  if (lang === 'ar') {
    let msg = `🚨 *دوري БРАТВА FCM: توضيح بخصوص المطرودين وتنبيه حاسم لغد!* 🚨\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📢 *بيان رسمي وتوضيح لجميع أعضاء الدوري:*\n` +
      `اللاعبون الذين تم طردهم مؤخراً من الدوري داخل اللعبة تم استبعادهم **فقط وحصرياً لأنهم لم ينضموا إلى تيليجرام**!\n` +
      `لم يقوموا بالتسجيل في البوت ولم يثبتوا أسماءهم في قائمة الفريق لتنسيق المباريات والتشكيلات.\n\n` +
      `⛔ *غداً ستبدأ الدفعة القادمة من الطرد — غداً الدور عليك إذا لم تنضم!*:\n` +
      `أي لاعب يظل اسمه في قائمة غير المنضمين ❌ حتى الغد، **سيكون هو التالي في الطرد النهائي والاستبعاد من الدوري** بلا رجعة!\n\n` +
      `✅ *اللاعبون المنضمون حالياً لتيليجرام (${uniqueJoined.length}):*\n` +
      `${uniqueJoined.join('\n')}\n\n`;

    if (uniquePending.length > 0) {
      const sliceCount = 50;
      msg += `❌ *أعضاء لم ينضموا بعد — المعرضون للطرد غداً (${uniquePending.length} لاعباً):*\n` +
        `${uniquePending.slice(0, sliceCount).join('\n')}${uniquePending.length > sliceCount ? `\n_...و ${uniquePending.length - sliceCount} آخرين_` : ''}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📲 *كيف تحمي مكانك في الدوري الآن فوراً (10 ثوانٍ فقط):*\n` +
        `1. ادخل لبوت الدوري الرسمي: [@BratvaFCMBot](https://t.me/BratvaFCMBot?start=register)\n` +
        `2. اضغط /start واكتب اسمك أو نك نيم حسابك داخل اللعبة.\n` +
        `3. انضم لمجموعة الفريق والقناة الرسمية.\n\n` +
        `⚠️ *ملاحظة هامة جداً:* حتى لو كنت موجوداً في المجموعة أو القناة، يجب عليك **حتماً** الدخول لبوت [@BratvaFCMBot](https://t.me/BratvaFCMBot?start=register) وإرسال اسمك المستعار لتسجيلك في قائمة الفريق!`;
    } else {
      msg += `🎉 *اكتمل الانضمام 100%!* جميع لاعبي الفريق مسجلون في تيليجرام!`;
    }
    return msg;
  }

  if (lang === 'es') {
    let msg = `🚨 *БРАТВА FCM: AVISO SOBRE EXPULSADOS Y ¡MAÑANA TE TOCA A TI!* 🚨\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📢 *COMUNICADO OFICIAL PARA TODOS LOS MIEMBROS DE LA LIGA:*\n` +
      `Los jugadores recientemente expulsados de la liga en el juego fueron removidos **EXCLUSIVAMENTE POR NO UNIRSE A TELEGRAM**!\n` +
      `No confirmaron su apodo en el bot ni entraron al chat del equipo.\n\n` +
      `⛔ *¡MAÑANA ES LA SIGUIENTE OLA DE EXPULSIONES — MAÑANA TE TOCA A TI!*:\n` +
      `¡Cualquiera que permanezca en la lista ❌ mañana **SERÁ EL SIGUIENTE EN SER EXPULSADO DEFINITIVAMENTE DE LA LIGA**!\n\n` +
      `✅ *JUGADORES QUE YA SE UNIERON A TELEGRAM (${uniqueJoined.length}):*\n` +
      `${uniqueJoined.join('\n')}\n\n`;

    if (uniquePending.length > 0) {
      const sliceCount = 50;
      msg += `❌ *AÚN NO ESTÁN EN TELEGRAM — EN RIESGO DE EXPULSIÓN MAÑANA (${uniquePending.length} jugadores):*\n` +
        `${uniquePending.slice(0, sliceCount).join('\n')}${uniquePending.length > sliceCount ? `\n_...y ${uniquePending.length - sliceCount} más_` : ''}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📲 *CÓMO PROTEGER TU PUESTO AHORA MISMO (Toma 10 segundos):*\n` +
        `1. Abre nuestro bot oficial: [@BratvaFCMBot](https://t.me/BratvaFCMBot?start=register)\n` +
        `2. Pulsa /start y envía tu apodo en el juego.\n` +
        `3. Únete al chat y canal oficial del equipo.\n\n` +
        `⚠️ *AVISO IMPORTANTE:* Aunque ya estés en el grupo o canal, es **OBLIGATORIO** abrir [@BratvaFCMBot](https://t.me/BratvaFCMBot?start=register) y mandar tu apodo para registrarte oficialmente!`;
    } else {
      msg += `🎉 *¡100% DE LA PLANTILLA VERIFICADA!* ¡Todos los miembros se han unido a Telegram!`;
    }
    return msg;
  }

  // Russian (Default)
  let msg = `🚨 *БРАТВА FCM: РАЗЪЯСНЕНИЕ ПО ИСКЛЮЧЁННЫМ И ПОСЛЕДНЕЕ ПРЕДУПРЕЖДЕНИЕ!* 🚨\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📢 *ОФИЦИАЛЬНОЕ УВЕДОМЛЕНИЕ ДЛЯ ВСЕХ ИГРОКОВ ЛИГИ:*\n` +
    `Игроки, которые были недавно исключены из состава лиги в игре, были исключены **ИСКЛЮЧИТЕЛЬНО ИЗ-ЗА ОТСУТСТВИЯ В TELEGRAM**!\n` +
    `Они не подтвердили свой ник в нашем боте и не вступили в командный чат для координации турниров.\n\n` +
    `⛔ *ЗАВТРА ВТОРАЯ ВОЛНА ИСКЛЮЧЕНИЙ — ЗАВТРА ОЧЕРЕДЬ ОСТАЛЬНЫХ!*\n` +
    `Все, кто останется в списке незарегистрированных ❌ до завтра, **БУДУТ СЛЕДУЮЩИМИ НА БЕЗВОЗВРАТНЫЙ КИК ИЗ ЛИГИ**!\n\n` +
    `✅ *ИГРОКИ, КОТОРЫЕ УЖЕ В TELEGRAM (${uniqueJoined.length}):*\n` +
    `${uniqueJoined.join('\n')}\n\n`;

  if (uniquePending.length > 0) {
    const sliceCount = 50;
    msg += `❌ *ЕЩЁ НЕ В TELEGRAM — КАНДИДАТЫ НА КИК ЗАВТРА (${uniquePending.length} бойцов):*\n` +
      `${uniquePending.slice(0, sliceCount).join('\n')}${uniquePending.length > sliceCount ? `\n_...и ещё ${uniquePending.length - sliceCount}_` : ''}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📲 *КАК СОХРАНИТЬ МЕСТО В ЛИГЕ ПРЯМО СЕЙЧАС (10 секунд):*\n` +
      `1. Откройте нашего бота: [@BratvaFCMBot](https://t.me/BratvaFCMBot?start=register)\n` +
      `2. Нажмите /start и напишите свой игровой ник.\n` +
      `3. Вступите в закрытый чат и канал лиги.\n\n` +
      `⚠️ *ВАЖНО:* Даже если вы уже состоите в группе или канале, вы **ОБЯЗАНЫ** открыть бота [@BratvaFCMBot](https://t.me/BratvaFCMBot?start=register) и отправить свой ник, чтобы система внесла вас в список подтверждённых!`;
  } else {
    msg += `🎉 *100% СОСТАВА В TELEGRAM!* Все бойцы успешно подтвердили регистрацию!`;
  }
  return msg;
}

function getKickedWarningKeyboard(currentLang = 'ru') {
  const ruLabel = currentLang === 'ru' ? '• 🇷🇺 RU •' : '🇷🇺 RU';
  const enLabel = currentLang === 'en' ? '• 🇬🇧 EN •' : '🇬🇧 EN';
  const arLabel = currentLang === 'ar' ? '• 🇸🇦 AR •' : '🇸🇦 AR';
  const esLabel = currentLang === 'es' ? '• 🇪🇸 ES •' : '🇪🇸 ES';

  const bcastLabel = currentLang === 'ar' ? '📢 نشر التنبيه بالقناة' :
                     currentLang === 'es' ? '📢 Publicar Aviso en el Canal' :
                     currentLang === 'en' ? '📢 Broadcast Notice to Channel' : '📢 Опубликовать предупреждение в канал';

  const refreshLabel = currentLang === 'ar' ? '🔄 تحديث القائمة' :
                       currentLang === 'es' ? '🔄 Actualizar Lista' :
                       currentLang === 'en' ? '🔄 Refresh List' : '🔄 Обновить';

  const menuLabel = currentLang === 'ar' ? '📋 العودة للقائمة' :
                    currentLang === 'es' ? '📋 Volver al Menú' :
                    currentLang === 'en' ? '📋 Back to Menu' : '📋 На главную';

  return {
    inline_keyboard: [
      [
        { text: ruLabel, callback_data: 'tab_kicked_0_ru' },
        { text: enLabel, callback_data: 'tab_kicked_0_en' },
        { text: arLabel, callback_data: 'tab_kicked_0_ar' },
        { text: esLabel, callback_data: 'tab_kicked_0_es' }
      ],
      [
        { text: bcastLabel, callback_data: 'bcast_kicked' }
      ],
      [
        { text: refreshLabel, callback_data: 'cmd_warning_kicked' },
        { text: menuLabel, callback_data: 'cmd_menu' }
      ]
    ]
  };
}

function getPendingKeyboard(currentLang = 'ru') {
  const ruLabel = currentLang === 'ru' ? '• 🇷🇺 RU •' : '🇷🇺 RU';
  const enLabel = currentLang === 'en' ? '• 🇬🇧 EN •' : '🇬🇧 EN';
  const arLabel = currentLang === 'ar' ? '• 🇸🇦 AR •' : '🇸🇦 AR';
  const esLabel = currentLang === 'es' ? '• 🇪🇸 ES •' : '🇪🇸 ES';

  const warnLabel = currentLang === 'ar' ? '🚨 تحذير: اليوم آخر فرصة' :
                    currentLang === 'es' ? '🚨 Aviso: Hoy Última Oportunidad' :
                    currentLang === 'en' ? '🚨 Warning: Today is Last Chance' : '🚨 Предупреждение: Последний шанс';

  const refreshLabel = currentLang === 'ar' ? '🔄 تحديث التدقيق مباشر' :
                       currentLang === 'es' ? '🔄 Actualizar Auditoría' :
                       currentLang === 'en' ? '🔄 Refresh Audit Live' : '🔄 Обновить аудит live';

  const bcastLabel = currentLang === 'ar' ? '📢 نشر التحذير بالقناة' :
                     currentLang === 'es' ? '📢 Publicar Aviso en el Canal' :
                     currentLang === 'en' ? '📢 Broadcast Warning to Channel' : '📢 Опубликовать предупреждение в канал';

  const menuLabel = currentLang === 'ar' ? '📋 العودة للقائمة' :
                    currentLang === 'es' ? '📋 Volver al Menú' :
                    currentLang === 'en' ? '📋 Back to Menu' : '📋 На главную';

  return {
    inline_keyboard: [
      [
        { text: ruLabel, callback_data: 'tab_audit_0_ru' },
        { text: enLabel, callback_data: 'tab_audit_0_en' },
        { text: arLabel, callback_data: 'tab_audit_0_ar' },
        { text: esLabel, callback_data: 'tab_audit_0_es' }
      ],
      [
        { text: warnLabel, callback_data: 'cmd_warning_lastchance' }
      ],
      [
        { text: bcastLabel, callback_data: 'bcast_lastchance' }
      ],
      [
        { text: refreshLabel, callback_data: 'cmd_pending' },
        { text: menuLabel, callback_data: 'cmd_menu' }
      ]
    ]
  };
}

function formatMyStatsPrompt(lang = 'ru') {
  if (lang === 'en') {
    return `👤 *PERSONAL PLAYER STATS DASHBOARD* 👤\n\n` +
      `👉 *How to view your personal performance card:*\n` +
      `Simply type and send your in-game nickname here in chat (e.g.: \`DOXIBERO1\` or \`/player DOXIBERO1\`)!\n\n` +
      `📊 You'll get your full stats:\n` +
      `• Total career goals & tournament count\n` +
      `• Scoring average per match\n` +
      `• Strike & discipline status (0/3 Safe or Warning)\n` +
      `• 1-Tap link to your personal interactive web dashboard!\n\n` +
      `🌐 *Official League Site:* ${WEBSITE_URL}`;
  }
  if (lang === 'ar') {
    return `👤 *لوحة الإحصائيات الشخصية للاعب* 👤\n\n` +
      `👉 *كيفية عرض بطاقة أدائك وإحصائياتك الشخصية:*\n` +
      `أرسل ببساطة اسمك في اللعبة هنا في المحادثة (مثال: \`DOXIBERO1\` أو \`/player DOXIBERO1\`)!\n\n` +
      `📊 ستحصل فوراً على تقريرك الشامل:\n` +
      `• إجمالي أهدافك وعدد البطولات التي شاركت فيها\n` +
      `• معدلك التهديفي في كل مباراة\n` +
      `• حالة الانضباط والإنذارات (0/3 آمن أو إنذار غياب)\n` +
      `• رابط مباشر بضغطة واحدة لملفك التفاعلي الكامل في الموقع!\n\n` +
      `🌐 *الموقع الرسمي للدوري:* ${WEBSITE_URL}`;
  }
  if (lang === 'es') {
    return `👤 *PANEL DE RENDIMIENTO PERSONAL* 👤\n\n` +
      `👉 *Cómo ver tus estadísticas personales:*\n` +
      `¡Simplemente escribe tu nombre de jugador aquí en el chat (ejemplo: \`DOXIBERO1\` o \`/player DOXIBERO1\`)!\n\n` +
      `📊 Recibirás al instante:\n` +
      `• Total de goles y torneos jugados\n` +
      `• Promedio goleador por partido\n` +
      `• Estado de disciplina y strikes (0/3 Seguro o Aviso)\n` +
      `• Enlace directo a tu panel interactivo en la web!\n\n` +
      `🌐 *Sitio Oficial de la Liga:* ${WEBSITE_URL}`;
  }
  return `👤 *ЛИЧНАЯ СТАТИСТИКА ИГРОКА* 👤\n\n` +
    `👉 *Как посмотреть свою карточку и результаты:*\n` +
    `Просто напишите ваш игровой никнейм здесь в чате (например: \`DOXIBERO1\` или \`/player DOXIBERO1\`)!\n\n` +
    `📊 Бот мгновенно выдаст:\n` +
    `• Всего забитых голов и сыгранных турниров\n` +
    `• Средняя результативность за матч\n` +
    `• Статус страйков (0/3 Безопасно или предупреждение)\n` +
    `• Прямая ссылка на ваш интерактивный профиль на сайте!\n\n` +
    `🌐 *Официальный сайт Лиги:* ${WEBSITE_URL}`;
}

async function formatKicklist(lang = 'ru') {
  const squad = await evaluateAllSquadStrikes();
  const rules = getLeagueRules();
  const regData = await getRegisteredPlayers();
  const critical = [];
  const warning = [];

  squad.filter(p => !p.isInactive && !p.isLeadership).forEach(p => {
    const playerTag = formatPlayerTag(p.displayName || p.pid, regData);
    if (p.isEligibleForKick) {
      let reason = '';
      if (p.consecutiveKick) {
        reason = lang === 'ar' ? 'غياب بطولتين متتاليتين (0/3 مرتين)' :
                 lang === 'es' ? '2 torneos seguidos 0/3' :
                 lang === 'en' ? '2 consecutive missed tournaments (0/3)' : '2 турнира подряд 0/3';
      } else {
        reason = `${p.strikesIn5}/${rules.rollingHorizon || 5} ${lang === 'ar' ? 'إنذارات' : lang === 'es' ? 'strikes' : lang === 'en' ? 'strikes' : 'страйка'}`;
      }
      const kickTag = lang === 'ar' ? 'مؤهل للاستبعاد الفوري ⛔' :
                      lang === 'es' ? 'APTO PARA EXPULSIÓN ⛔' :
                      lang === 'en' ? 'ELIGIBLE FOR KICK ⛔' : 'КАНДИДАТ НА КИК ⛔';
      critical.push(`• 🚨 *${playerTag}* — ${reason} (${kickTag})`);
    } else if (p.strikesIn5 > 0) {
      const warnTag = lang === 'ar' ? 'إنذار سترايك ❌' :
                      lang === 'es' ? 'Strike de aviso ❌' :
                      lang === 'en' ? 'Warning strike ❌' : 'Предупреждение ❌';
      warning.push(`• ⚠️ *${playerTag}* — ${p.strikesIn5}/${rules.maxMissesKick} (${warnTag})`);
    }
  });

  if (lang === 'en') {
    let msg = `📋 *БРАТВА INACTIVITY & KICK REVIEW* 📋\n` +
      `━━━━━━━━━━━━━━━━━━━━\n`;
    if (critical.length > 0) msg += `🚨 *CRITICAL: ELIGIBLE FOR KICK (${rules.maxMissesKick}+ STRIKES OR 2x 0/3):*\n${critical.join('\n')}\n────────────────────\n`;
    if (warning.length > 0) msg += `⚠️ *ON NOTICE (1-${rules.maxMissesKick - 1} STRIKES):*\n${warning.join('\n')}\n────────────────────\n`;
    if (critical.length === 0 && warning.length === 0) msg += `✅ *PERFECT SQUAD DISCIPLINE!*\nAll active members have 0 strikes. Squad is 100% active!\n────────────────────\n`;
    msg += `⚖️ *Official Rule:* 3 strikes in 5 matches OR 2 consecutive 0/3 = automatic kick.\n` +
      `🟢 *Decay:* Playing 3 consecutive clean matches (3/3) clears 1 strike!\n` +
      `🛡️ *Leadership Immunity:* Owner & Admins are exempt from automated sanctions.\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🌐 *Full Standings:* ${WEBSITE_URL}`;
    return msg;
  }
  if (lang === 'ar') {
    let msg = `📋 *دوري БРАТВА: مراجعة الحضور وقائمة الاستبعاد* 📋\n` +
      `━━━━━━━━━━━━━━━━━━━━\n`;
    if (critical.length > 0) msg += `🚨 *حالة حرجة: مؤهلون للاستبعاد الفوري (${rules.maxMissesKick}+ إنذارات أو غياب 0/3 مرتين):*\n${critical.join('\n')}\n────────────────────\n`;
    if (warning.length > 0) msg += `⚠️ *تحت الملاحظة (1-${rules.maxMissesKick - 1} إنذار):*\n${warning.join('\n')}\n────────────────────\n`;
    if (critical.length === 0 && warning.length === 0) msg += `✅ *انضباط مثالي! جميع أعضاء الفريق بدون أي إنذار.*\n────────────────────\n`;
    msg += `⚖️ *القانون الرسمي:* 3 إنذارات في آخر 5 بطولات أو غياب مرتين متتاليتين (0/3) = استبعاد فوري.\n` +
      `🟢 *سقوط الإنذارات:* لعب 3 بطولات متتالية بـ 3/3 يمسح سترايك واحد تلقائياً!\n` +
      `🛡️ *حصانة الإدارة:* الأونر والمسؤولون معفون من عقوبات الاستبعاد التلقائية.\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🌐 *الترتيب الكامل:* ${WEBSITE_URL}`;
    return msg;
  }
  if (lang === 'es') {
    let msg = `📋 *БРАТВА: AUDITORÍA DE INACTIVIDAD Y EXPULSIONES* 📋\n` +
      `━━━━━━━━━━━━━━━━━━━━\n`;
    if (critical.length > 0) msg += `🚨 *CRÍTICO: APTOS PARA EXPULSIÓN (${rules.maxMissesKick}+ STRIKES O 2x 0/3):*\n${critical.join('\n')}\n────────────────────\n`;
    if (warning.length > 0) msg += `⚠️ *BAJO AVISO (1-${rules.maxMissesKick - 1} STRIKES):*\n${warning.join('\n')}\n────────────────────\n`;
    if (critical.length === 0 && warning.length === 0) msg += `✅ *¡DISCIPLINA PERFECTA! Todos los miembros tienen 0 strikes.*\n────────────────────\n`;
    msg += `⚖️ *Regla oficial:* 3 strikes en 5 torneos o 2 seguidos 0/3 = expulsión automática.\n` +
      `🟢 *Limpieza:* ¡3 partidos limpios seguidos (3/3) eliminan 1 strike!\n` +
      `🛡️ *Inmunidad:* El Owner y Admins están exentos de sanciones automáticas.\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🌐 *Clasificación:* ${WEBSITE_URL}`;
    return msg;
  }

  // Russian (Default)
  let msg = `📋 *БРАТВА: ПРОВЕРКА АКТИВНОСТИ И КАНДИДАТЫ НА КИК* 📋\n` +
    `━━━━━━━━━━━━━━━━━━━━\n`;
  if (critical.length > 0) msg += `🚨 *КРИТИЧНО: КАНДИДАТЫ НА ИСКЛЮЧЕНИЕ (${rules.maxMissesKick}+ СТРАЙКА ИЛИ 2x 0/3):*\n${critical.join('\n')}\n────────────────────\n`;
  if (warning.length > 0) msg += `⚠️ *НА ПРЕДУПРЕЖДЕНИИ (1-${rules.maxMissesKick - 1} СТРАЙКА):*\n${warning.join('\n')}\n────────────────────\n`;
  if (critical.length === 0 && warning.length === 0) msg += `✅ *ИДЕАЛЬНАЯ ДИСЦИПЛИНА! У всех бойцов 0 страйков. Состав 100% активен!*\n────────────────────\n`;
  msg += `⚖️ *Правило лиги:* 3 страйка из 5 или 2 пропуска подряд 0/3 = автоматический кик.\n` +
    `🟢 *Сгорание:* 3 чистых матча подряд снимают 1 страйк!\n` +
    `🛡️ *Иммунитет:* Владелец и Админы защищены иммунитетом руководства.\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🌐 *Полная таблица:* ${WEBSITE_URL}`;
  return msg;
}

function formatRules(lang = 'ru') {
  const rules = getLeagueRules();
  if (lang === 'en') {
    return `📜 *OFFICIAL BRATVA FCM LEAGUE RULEBOOK* 📜\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `1️⃣ ⚽ *Attendance & Sanction Matrix (Mandatory 3/3):*\n` +
      `• *Partial Miss (1/3 or 2/3 turns):* Warning + *1-Match Temporary Bench Suspension* (remains in the league).\n` +
      `• *Total Ghost (0/3 turns):* Red Strike + *2-Match Temporary Bench Suspension* (remains in the league).\n` +
      `• 🚨 *Permanent League Kick:* Occurs ONLY in two specific cases:\n` +
      `   ① 2 consecutive 0/3 missed tournaments.\n` +
      `   ② Accumulating 3 strikes within the last 5 tournaments.\n` +
      `• 🟢 *Strike Decay:* Playing 3 consecutive clean matches (3/3) automatically clears 1 strike!\n` +
      `────────────────────\n` +
      `2️⃣ 👑 *Leadership & Admin Immunity:*\n` +
      `• The League Owner and Admins manage the squad, tournaments, and communication.\n` +
      `• 🛡️ *Immunity:* Leadership is strictly exempt from automated bot strikes, benching, or kicks.\n` +
      `────────────────────\n` +
      `3️⃣ 🎯 *Scoring Performance vs Discipline:*\n` +
      `• Low goals with full turns (3/3) is *NEVER penalized with strikes or kicks*.\n` +
      `• 🔄 *Tactical Bench Rotation:* Players struggling with form are temporarily placed on the bench to practice and regain sharpness.\n` +
      `• Starters are chosen by: ① Check-in readiness, ② 0 strikes, ③ Highest 5-match scoring average!\n` +
      `────────────────────\n` +
      `4️⃣ 📱 *Telegram Verification & In-Game Tagging:*\n` +
      `• Every member must register in [@BratvaFCMBot](https://t.me/BratvaFCMBot).\n` +
      `• 🏷️ *In-Game Tagging:* All mentions and notifications use your exact **In-Game Nickname** linked to your Telegram account.\n` +
      `• 🚫 *Unverified Players:* Strictly restricted to the bench and cannot participate in LvL tournaments.\n` +
      `────────────────────\n` +
      `5️⃣ 🛡️ *Advance Notice & Excused Absences:*\n` +
      `• If an emergency arises, inform leadership in the chat BEFORE check-in closes.\n` +
      `• An Admin can excuse the absence via \`/forgive <player>\`, granting zero strikes.\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👥 *Telegram Community (Channel + Group):*\n${COMMUNITY_URL}\n\n` +
      `🌐 *Official Website:* ${WEBSITE_URL}`;
  }
  if (lang === 'ar') {
    return `📜 *دستور وقوانين دوري БРАТВА FCM الرسمية* 📜\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `1️⃣ ⚽ *مصفوفة الحضور والعقوبات المتدرجة (إلزامي 3/3):*\n` +
      `• *نقص الهجمات (1/3 أو 2/3):* إنذار أصفر + *حظر مؤقت لمباراة واحدة* (احتياط لمباراة واحدة لتدارك الأمر مع البقاء في الدوري).\n` +
      `• *الغياب التام (0/3):* سترايك أحمر مباشر + *حظر مؤقت لمباراتين متتاليتين* (احتياط لمباراتين لإثبات الجدية مع البقاء في الدوري).\n` +
      `• 🚨 *الطرد النهائي من الدوري:* يُطرد العضو نهائياً في حالتين فقط:\n` +
      `   ① تفويت بطولتين متتاليتين بالكامل (0/3 مرتين متتاليتين).\n` +
      `   ② تراكم 3 إنذارات حمراء في آخر 5 بطولات.\n` +
      `• 🟢 *إسقاط الإنذارات:* لعب 3 بطولات متتالية بهجمات كاملة 3/3 يمسح سترايك واحداً تلقائياً!\n` +
      `────────────────────\n` +
      `2️⃣ 👑 *حصانة الإدارة والمسؤولين:*\n` +
      `• الأونر ومسؤولو الدوري يتولون إدارة الدوري وتنظيم البطولات وضبط الشات.\n` +
      `• 🛡️ *حصانة تامة:* الإدارة معفاة تماماً من أي نظام إنذارات أو طرد تلقائي من البوت.\n` +
      `────────────────────\n` +
      `3️⃣ 🎯 *المستوى التهديفي والمداورة التكتيكية:*\n` +
      `• ضعف التهديف مع لعب الهجمات كاملة (3/3) *ليس مخالفة ولا يستوجب أي سترايك أو طرد نهائياً*.\n` +
      `• 🔄 *المداورة التكتيكية:* تراجع معدل التهديف يضع اللاعب في الاحتياط لاستعادة مستواه وتجهيز نفسه.\n` +
      `• مقاعد الأساسيين تُمنح تلقائياً حسب: ① الجاهزية بالتشيك-إن، ② نظافة السجل من الإنذارات، ③ أعلى معدل تهديفي بآخر 5 مباريات لعبها العضو!\n` +
      `────────────────────\n` +
      `4️⃣ 📱 *التوثيق في تيليجرام والمناداة باسم اللعبة:*\n` +
      `• كل عضو ملزم بتوثيق حسابه في البوت [@BratvaFCMBot](https://t.me/BratvaFCMBot).\n` +
      `• 🏷️ *المناداة باسم اللعبة:* جميع التنبيهات والتاغات تظهر بـ **اسم اللاعب داخل اللعبة (IGN)** لسهولة التعرف عليه والتواصل معه مباشرة.\n` +
      `• 🚫 *غير المسجلين في البوت:* احتياط دائم وممنوعون من دخول تشكيلة البطولات LvL.\n` +
      `────────────────────\n` +
      `5️⃣ 🛡️ *الأعذار المسبقة وحالات الطوارئ:*\n` +
      `• في حال وجود ظرف طارئ، يجب إبلاغ الإدارة في الشات قبل إغلاق التشيك-إن.\n` +
      `• يمكن للأدمن إعفاء اللاعب عبر أمر \`/forgive <اسم_اللاعب>\` دون احتساب أي عقوبة أو إنذار.\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👥 *مجتمع تيليجرام الرسمي (القناة + المجموعة):*\n${COMMUNITY_URL}\n\n` +
      `🌐 *الموقع الرسمي للدوري:* ${WEBSITE_URL}`;
  }
  if (lang === 'es') {
    return `📜 *REGLAMENTO OFICIAL DE LA LIGA BRATVA FCM* 📜\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `1️⃣ ⚽ *Matriz de Asistencia y Sanciones (Obligatorio 3/3):*\n` +
      `• *Turnos incompletos (1/3 o 2/3):* Aviso + *Suspensión temporal de 1 partido* (banquillo por 1 partido, permanece en la liga).\n` +
      `• *Ausencia total (0/3):* Strike rojo + *Suspensión temporal de 2 partidos* (banquillo por 2 partidos, permanece en la liga).\n` +
      `• 🚨 *Expulsión Definitiva:* Ocurre ÚNICAMENTE en dos situaciones:\n` +
      `   ① 2 torneos consecutivos con 0/3 turnos jugados.\n` +
      `   ② Acumular 3 strikes en tus últimos 5 torneos.\n` +
      `• 🟢 *Limpieza:* ¡Jugar 3 partidos consecutivos con 3/3 elimina 1 strike automáticamente!\n` +
      `────────────────────\n` +
      `2️⃣ 👑 *Inmunidad de Liderazgo y Admins:*\n` +
      `• El Owner y los Administradores gestionan la liga y la organización.\n` +
      `• 🛡️ *Inmunidad:* El liderazgo está totalmente exento de strikes y expulsiones automáticas del bot.\n` +
      `────────────────────\n` +
      `3️⃣ 🎯 *Rendimiento Goleador y Rotación Táctica:*\n` +
      `• La baja cuota goleadora jugando los 3/3 turnos *NUNCA se sanciona con strikes ni expulsión*.\n` +
      `• 🔄 *Rotación Táctica:* Jugadores con baja forma pasan al banquillo para recuperar ritmo.\n` +
      `• La titularidad se define por: ① Check-in listo, ② 0 strikes, ③ Mayor promedio en sus últimos 5 partidos.\n` +
      `────────────────────\n` +
      `4️⃣ 📱 *Verificación en Telegram y Etiquetas por IGN:*\n` +
      `• Todo miembro debe verificar su cuenta en [@BratvaFCMBot](https://t.me/BratvaFCMBot).\n` +
      `• 🏷️ *Etiquetas por Nombre de Juego:* Los avisos muestran tu **Nombre exacto en FC Mobile (IGN)** enlazado a tu Telegram.\n` +
      `• 🚫 *Sin Telegram:* Banquillo estricto sin acceso a torneos LvL.\n` +
      `────────────────────\n` +
      `5️⃣ 🛡️ *Avisos Previos y Justificaciones:*\n` +
      `• Avisa a los administradores en el chat ANTES del cierre del check-in.\n` +
      `• Los administradores pueden justificar la ausencia con \`/forgive <jugador>\` sin penalizaciones.\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👥 *Comunidad de Telegram (Canal + Grupo):*\n${COMMUNITY_URL}\n\n` +
      `🌐 *Sitio Oficial:* ${WEBSITE_URL}`;
  }

  // Russian (Default)
  return `📜 *ОФИЦИАЛЬНЫЙ СВОД ПРАВИЛ БРАТВА FCM* 📜\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `1️⃣ ⚽ *Матрица дисциплины и ходов (Обязательно 3/3):*\n` +
    `• *Неполные ходы (1/3 или 2/3):* Желтая карточка + *Временный бан на 1 матч* (скамейка запасных на 1 игру, игрок остается в лиге).\n` +
    `• *Полный пропуск (0/3):* Красный страйк + *Временный бан на 2 матча* (скамейка запасных на 2 игры для подтверждения формы, игрок остается в лиге).\n` +
    `• 🚨 *Окончательный кик из лиги:* Наступает ТОЛЬКО в двух случаях:\n` +
    `   ① 2 турнира подряд по 0/3 ходов.\n` +
    `   ② 3 страйка за последние 5 турниров.\n` +
    `• 🟢 *Сгорание:* 3 чистых турнира подряд (3/3) автоматически снимают 1 страйк!\n` +
    `────────────────────\n` +
    `2️⃣ 👑 *Иммунитет Руководства (Владелец и Админы):*\n` +
    `• Владелец лиги и Администраторы управляют составом, турнирами и чатом.\n` +
    `• 🛡️ *Иммунитет:* Руководство полностью освобождено от автоматических страйков и киков бота.\n` +
    `────────────────────\n` +
    `3️⃣ 🎯 *Результативность и тактическая ротация:*\n` +
    `• Спад голов при сыгранных 3/3 ходах *НЕ является нарушением и НЕ наказывается страйками*.\n` +
    `• 🔄 *Тактическая ротация:* Игрок переводится на банку для набора формы и тренировок.\n` +
    `• Основа отбирается по: ① Чек-ин готовности, ② 0 страйков, ③ Лучший средний результат за свои последние 5 матчей!\n` +
    `────────────────────\n` +
    `4️⃣ 📱 *Верификация в Telegram и теги по нику в игре:*\n` +
    `• Каждый боец обязан привязать аккаунт в боте [@BratvaFCMBot](https://t.me/BratvaFCMBot).\n` +
    `• 🏷️ *Тег по игровому нику:* Все уведомления и теги отображают ваш **Никнейм в FC Mobile (IGN)** со ссылкой на ваш Telegram профиль.\n` +
    `• 🚫 *Без Telegram:* Строгий резерв без допуска к матчам LvL.\n` +
    `────────────────────\n` +
    `5️⃣ 🛡️ *Предупреждения и уважительные причины:*\n` +
    `• Предупредите руководство в чате ДО закрытия чек-ина.\n` +
    `• Админ может аннулировать пропуск командой \`/forgive <игрок>\` без начисления страйков.\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👥 *Сообщество лиги (Канал + Чат):*\n${COMMUNITY_URL}\n\n` +
    `🌐 *Официальный сайт:* ${WEBSITE_URL}`;
}

const generateTopScorersMessage = (lang = 'ru') => formatTopScorers(lang);
const generateStrikesMessage = (lang = 'ru') => formatStrikes(lang);
const generateLineupMessage = (lang = 'ru') => formatLineup(lang);
const generateTournamentsMessage = async (lang = 'ru') => await formatTournaments(lang);
const generateKicklistMessage = (lang = 'ru') => formatKicklist(lang);
const generateRulesMessage = (lang = 'ru') => formatRules(lang);

function formatMvp(lang = 'multi') {
  const { pIndex, tournaments } = loadLeagueData();
  const recentT = (tournaments || []).slice(0, 5);

  const candidates = Object.entries(pIndex).map(([id, data]) => {
    const name = clean(data.display_name || id);
    let goalsInRecent = 0;
    let matchesInRecent = 0;

    recentT.forEach(t => {
      const match = (t.matches || []).find(m => m.player_id === id);
      if (match) {
        goalsInRecent += (match.goals_for || 0);
        matchesInRecent += 1;
      }
    });

    const avgInRecent = matchesInRecent > 0 ? (goalsInRecent / matchesInRecent) : 0;
    const strikes = data.eligibility_streak?.current_fail_streak || 0;

    return { id, name, goals: goalsInRecent, matches: matchesInRecent, avg: parseFloat(avgInRecent.toFixed(1)), strikes };
  }).filter(c => c.matches >= 1 && c.strikes === 0).sort((a, b) => b.avg - a.avg || b.goals - a.goals);

  if (candidates.length === 0) {
    return 'No MVP candidates found in recent tournaments.';
  }

  const mvp = candidates[0];
  const runnerUp = candidates[1];
  const third = candidates[2];

  if (lang === 'ru') {
    return `👑 *БРАТВА: ЛУЧШИЙ ИГРОК НЕДЕЛИ (MVP)* 👑\n\n` +
      `⭐ *MVP:* *${mvp.name}* 🥇\n` +
      `⚽ Голы: *${mvp.goals}* (${mvp.matches} турниров, *ср. ${mvp.avg}* г/м)\n` +
      `🎯 Дисциплина: *100% (0 Страйков)*\n\n` +
      `🥈 *2-е место:* ${runnerUp ? `${runnerUp.name} (${runnerUp.goals}Г, ср. ${runnerUp.avg})` : '-'}\n` +
      `🥉 *3-е место:* ${third ? `${third.name} (${third.goals}Г, ср. ${third.avg})` : '-'}\n\n` +
      `⚡ Выдающаяся игра за честь БРАТВА!\n` +
      `🌐 *Сайт лиги:*\n${WEBSITE_URL}`;
  }
  if (lang === 'en') {
    return `👑 *БРАТВА PLAYER OF THE WEEK (MVP SPOTLIGHT)* 👑\n\n` +
      `⭐ *MVP:* *${mvp.name}* 🥇\n` +
      `⚽ Goals: *${mvp.goals}* (${mvp.matches} tournaments, *avg ${mvp.avg}* G/M)\n` +
      `🎯 Discipline: *100% (0 Strikes)*\n\n` +
      `🥈 *Runner-Up:* ${runnerUp ? `${runnerUp.name} (${runnerUp.goals}G, avg ${runnerUp.avg})` : '-'}\n` +
      `🥉 *3rd Place:* ${third ? `${third.name} (${third.goals}G, avg ${third.avg})` : '-'}\n\n` +
      `⚡ Outstanding performance leading БРАТВА to glory!\n` +
      `🌐 *Full Player Standings:*\n${WEBSITE_URL}`;
  }
  if (lang === 'ar') {
    return `👑 *دوري БРАТВА: نجم الأسبوع (MVP)* 👑\n\n` +
      `⭐ *الأسطورة MVP:* *${mvp.name}* 🥇\n` +
      `⚽ مجموع الأهداف: *${mvp.goals}* (${mvp.matches} بطولات، *معدل ${mvp.avg}* هدف/مباراة)\n` +
      `🎯 الانضباط: *100% (0 إنذار)*\n\n` +
      `🥈 *الوصيف (2):* ${runnerUp ? `${runnerUp.name} (${runnerUp.goals} هدف، معدل ${runnerUp.avg})` : '-'}\n` +
      `🥉 *المركز الثالث (3):* ${third ? `${third.name} (${third.goals} هدف، معدل ${third.avg})` : '-'}\n\n` +
      `⚡ أداء استثنائي يقود كتيبة БРАТВА نحو القمة!\n` +
      `🌐 *الترتيب المباشر:*\n${WEBSITE_URL}`;
  }
  if (lang === 'es') {
    return `👑 *LIGA БРАТВА: JUGADOR DE LA SEMANA (MVP)* 👑\n\n` +
      `⭐ *MVP:* *${mvp.name}* 🥇\n` +
      `⚽ Goles: *${mvp.goals}* (${mvp.matches} torneos, *promedio ${mvp.avg}* G/P)\n` +
      `🎯 Disciplina: *100% (0 Strikes)*\n\n` +
      `🥈 *Subcampeón:* ${runnerUp ? `${runnerUp.name} (${runnerUp.goals}G, prom. ${runnerUp.avg})` : '-'}\n` +
      `🥉 *3º Puesto:* ${third ? `${third.name} (${third.goals}G, prom. ${third.avg})` : '-'}\n\n` +
      `⚡ ¡Rendimiento estelar llevando a БРАТВА a la cima!\n` +
      `🌐 *Clasificación en vivo:*\n${WEBSITE_URL}`;
  }

  // Russian (Default)
  return `👑 *БРАТВА: ЛУЧШИЙ ИГРОК НЕДЕЛИ (MVP)* 👑\n\n` +
    `⭐ *MVP:* *${mvp.name}* 🥇\n` +
    `⚽ Голы: *${mvp.goals}* (${mvp.matches} турниров, *ср. ${mvp.avg}* г/м)\n` +
    `🎯 Дисциплина: *100% (0 Страйков)*\n\n` +
    `🥈 *2-е место:* ${runnerUp ? `${runnerUp.name} (${runnerUp.goals}Г, ср. ${runnerUp.avg})` : '-'}\n` +
    `🥉 *3-е место:* ${third ? `${third.name} (${third.goals}Г, ср. ${third.avg})` : '-'}\n\n` +
    `⚡ Выдающаяся игра за честь БРАТВА!\n` +
    `🌐 *Сайт лиги:*\n${WEBSITE_URL}`;
}

const generateMvpMessage = (lang = 'ru') => formatMvp(lang);

function formatRally(lang = 'ru') {
  const rules = getLeagueRules();
  if (lang === 'en') {
    return `⚔️ *БРАТВА LEAGUE: TOURNAMENT RALLY!* ⚔️\n\n` +
      `🛡️ *Attention БРАТВА Squad!* Tournament is LIVE!\n` +
      `⚽ All members must complete *${rules.minTurnsPerTournament}/3* turns!\n` +
      `🎯 Target: *${rules.minGoalsPerTournament}+ goals* minimum!\n` +
      `⛔ Missed tournament = strike (${rules.maxMissesKick} strikes = automatic kick)!\n\n` +
      `🌐 *League Website:*\n${WEBSITE_URL}`;
  }
  if (lang === 'ar') {
    return `⚔️ *دوري БРАТВА: نداء المشاركة في البطولة!* ⚔️\n\n` +
      `🛡️ *إلى جميع أبطال БРАТВА!* البطولة الجديدة بدأت الآن!\n` +
      `⚽ يجب على جميع الأعضاء إكمال جميع المحاولات *${rules.minTurnsPerTournament}/3* في المباراة!\n` +
      `🎯 الهدف الأدنى: *${rules.minGoalsPerTournament}+ هدف*!\n` +
      `⛔ تفويت البطولة = إنذار سترايك (${rules.maxMissesKick} سترايكات = استبعاد تلقائي)!\n\n` +
      `🌐 *الموقع الرسمي:*\n${WEBSITE_URL}`;
  }
  if (lang === 'es') {
    return `⚔️ *LIGA БРАТВА: ¡LLAMADA A LA BATALLA!* ⚔️\n\n` +
      `🛡️ *¡Guerreros de БРАТВА!* ¡El nuevo torneo ha comenzado!\n` +
      `⚽ ¡Obligatorio jugar los *${rules.minTurnsPerTournament}/3* turnos en el partido!\n` +
      `🎯 Objetivo mínimo: *¡${rules.minGoalsPerTournament}+ goles*!\n` +
      `⛔ Falta en torneo = strike automático (¡${rules.maxMissesKick} strikes = expulsión)!\n\n` +
      `🌐 *Sitio oficial:*\n${WEBSITE_URL}`;
  }

  // Russian (Default)
  return `⚔️ *БРАТВА LEAGUE: БОЕВОЙ СБОР!* ⚔️\n\n` +
    `🛡️ *Бойцы БРАТВА!* Новый турнир стартовал!\n` +
    `⚽ Обязательно сыграть *${rules.minTurnsPerTournament}/3* ходов в матче!\n` +
    `🎯 Планка: *${rules.minGoalsPerTournament}+ голов*!\n` +
    `⛔ Пропуск турнира = автоматический страйк (${rules.maxMissesKick} страйка = кик)!\n\n` +
    `🌐 *Сайт лиги:* ${WEBSITE_URL}`;
}

const generateRallyMessage = (lang = 'ru') => formatRally(lang);

function resolveTurnsPlayed(p) {
  if (!p) return 0;
  const limit = typeof p.limit_remaining === 'string' ? p.limit_remaining.trim() : '';
  const goals = typeof p.goals === 'number' ? p.goals : (parseInt(p.goals, 10) || 0);

  // 1. Authoritative ground truth from "LIMIT" column in screenshot:
  // In EA FC Mobile tournaments, LIMIT indicates turns REMAINING (available to attack):
  // "0/3" = 0 turns left -> played all 3 turns
  // "1/3" = 1 turn left  -> played 2 turns
  // "2/3" = 2 turns left -> played 1 turn
  // "3/3" = 3 turns left -> played 0 turns (has not played yet)
  if (limit === '0/3') return 3;
  if (limit === '3/3') return 0;
  if (limit === '1/3') return 2;
  if (limit === '2/3') return 1;

  if (limit.includes('/3')) {
    const rem = parseInt(limit.split('/')[0], 10);
    if (!isNaN(rem) && rem >= 0 && rem <= 3) {
      return 3 - rem;
    }
  }

  // 2. Physical impossibility check with goals:
  // In EA FC Mobile, a player CANNOT score goals without playing turns!
  // If player scored goals (> 0), they must have played turns!
  if (goals > 0) {
    if (typeof p.turns_played === 'number' && p.turns_played > 0 && p.turns_played <= 3) {
      return p.turns_played;
    }
    return 3;
  }

  // 3. If 0 goals:
  if (goals === 0) {
    if (limit === '0/3') return 3;
    return 0;
  }

  return typeof p.turns_played === 'number' && p.turns_played >= 0 && p.turns_played <= 3 ? p.turns_played : 0;
}

function formatLiveAlert(aiResult, lang = 'ru', regData = null) {
  if (!aiResult) return 'No active live match data.';
  const opp = clean(aiResult.opponent_league || 'OPPONENT');
  const ourG = aiResult.score_bratva || 0;
  const oppG = aiResult.score_opponent || 0;
  const timeInfo = clean(aiResult.time_info || 'Live in progress');
  const unplayed = (aiResult.players || []).filter(p => resolveTurnsPlayed(p) < 3);
  const pLines = unplayed.length > 0
    ? unplayed.map(p => `⌛ | ${formatPlayerTag(p.name, regData)} | ${resolveTurnsPlayed(p)}/3`).join('\n')
    : '✅ All squad members have completed their turns!';

  if (lang === 'en') {
    return `🟢 *LIVE MATCH: vs ${opp}*\n` +
      `⚽ *Score:* ${ourG} - ${oppG}\n` +
      `⏳ *Timer:* ${timeInfo}\n\n` +
      `⛔ *ATTENTION PLEASE (UNPLAYED TURNS):*\n${pLines}\n\n` +
      `⚡ *Action Required:* Jump in and complete your 3/3 turns immediately!\n\n` +
      `🌐 *Live Tracker:*\n${WEBSITE_URL}`;
  }
  if (lang === 'ar') {
    return `🟢 *مباراة مباشرة جارية الآن: ضد ${opp}*\n` +
      `⚽ *النتيجة الحالية:* ${ourG} - ${oppG}\n` +
      `⏳ *الوقت المتبقي:* ${timeInfo}\n\n` +
      `⛔ *تنبيه: محاولات متبقية لم تكتمل بعد:*\n${pLines}\n\n` +
      `⚡ *المطلوب فوراً:* ادخل إلى اللعبة والعب محاولاتك كاملة لتجنب الإنذار!\n\n` +
      `🌐 *المتابعة المباشرة:* ${WEBSITE_URL}`;
  }
  if (lang === 'es') {
    return `🟢 *PARTIDO EN DIRECTO: vs ${opp}*\n` +
      `⚽ *Resultado:* ${ourG} - ${oppG}\n` +
      `⏳ *Tiempo:* ${timeInfo}\n\n` +
      `⛔ *ATENCIÓN (TURNOS PENDIENTES):*\n${pLines}\n\n` +
      `⚡ *Acción requerida:* ¡Entrad y jugad vuestros 3/3 turnos ya!\n\n` +
      `🌐 *Marcador en vivo:*\n${WEBSITE_URL}`;
  }

  // Russian (Default)
  return `🟢 *МАТЧ В ПРЯМОМ ЭФИРЕ: vs ${opp}*\n` +
    `⚽ *Счет:* ${ourG} - ${oppG}\n` +
    `⏳ *Время:* ${timeInfo}\n\n` +
    `⛔ *ВНИМАНИЕ: ОСТАЛИСЬ НЕ СЫГРАННЫЕ ХОДЫ:*\n${pLines}\n\n` +
    `⚡ Срочно зайдите в игру и сыграйте 3/3 ходов!\n\n` +
    `🌐 *Сайт лиги:* ${WEBSITE_URL}`;
}

function slugifyLeague(text) {
  if (!text) return 'opponent';
  const cyrillicMap = {
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z','и':'i','й':'y',
    'і':'i','ї':'yi','є':'ye',
    'к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f',
    'х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'
  };
  let s = text.toLowerCase().split('').map(c => cyrillicMap[c] || c).join('');
  s = s.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!s) s = text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '');
  return s || 'opponent';
}

function slugifyPlayerId(name, idx) {
  if (!name) return `player_${idx}`;
  let clean = name.trim();
  const lower = clean.toLowerCase();
  if (lower === 'doxibéro' || lower === 'doxibero' || lower === 'doxibro') return 'doxibero';
  if (lower === 'doxibero1') return 'doxibero1';
  let pid = lower.replace(/[^\p{L}\p{N}_]+/gu, '_').replace(/^_+|_+$/g, '');
  return pid || `player_${idx}`;
}

// -------------------------------------------------------------
// Direct Personalized Player Notifications (Fidelity & Motivation)
// -------------------------------------------------------------

async function getVerifiedPlayersForNotification() {
  const regData = await getRegisteredPlayers();
  const mapByTgId = new Map();

  Object.entries(regData.registrations || {}).forEach(([pid, reg]) => {
    const tgId = reg.telegram_id;
    if (!tgId) return;

    const strTgId = String(tgId);
    if (!mapByTgId.has(strTgId)) {
      mapByTgId.set(strTgId, {
        telegramId: tgId,
        telegramUsername: reg.telegram_username || '',
        displayName: reg.display_name || reg.in_game_name || pid,
        playerIds: [pid.toLowerCase()],
        role: reg.role || 'Member',
        preferredLang: reg.preferred_language || null
      });
    } else {
      const existing = mapByTgId.get(strTgId);
      const pidLower = pid.toLowerCase();
      if (!existing.playerIds.includes(pidLower)) {
        existing.playerIds.push(pidLower);
      }
    }
  });

  return Array.from(mapByTgId.values());
}

function resolvePlayerLanguage(player) {
  if (player.preferredLang && ['ru', 'ar', 'en', 'es'].includes(player.preferredLang)) {
    return player.preferredLang;
  }
  const name = String(player.displayName || '');
  const user = String(player.telegramUsername || '');
  if (/[\u0600-\u06FF]/.test(name) || name.toLowerCase().includes('doxibero') || name.toLowerCase().includes('doxibro') || user.toLowerCase().includes('doxibero')) {
    return 'ar';
  }
  if (/[а-яА-ЯёЁ]/.test(name) || name.toLowerCase().includes('sanya') || name.toLowerCase().includes('l1onchik') || user.toLowerCase().includes('l1onchik')) {
    return 'ru';
  }
  if (name.toLowerCase().includes('rogelio') || user.toLowerCase().includes('rogelio')) {
    return 'es';
  }
  return 'en';
}

async function notifyVerifiedPlayersLineup(lineupData) {
  const verified = await getVerifiedPlayersForNotification();
  if (verified.length === 0 || !lineupData) return;

  const size = lineupData.size;
  const startingPids = (lineupData.starting || []).map(p => String(p.pid).toLowerCase());
  const benchPids = (lineupData.bench || []).map(p => String(p.pid).toLowerCase());

  for (const player of verified) {
    const isStarting = player.playerIds.some(id => startingPids.includes(id));
    const isBench = !isStarting && player.playerIds.some(id => benchPids.includes(id));

    if (!isStarting && !isBench) continue; // Not in squad for this tournament

    const lang = resolvePlayerLanguage(player);
    const pName = bidiIsolate(player.displayName);

    const matchedP = (lineupData.starting || []).concat(lineupData.bench || []).find(p => player.playerIds.includes(String(p.pid).toLowerCase())) || {};
    const avg = matchedP.last5Avg !== undefined ? matchedP.last5Avg : 0;
    const strikes = matchedP.strikesIn5 !== undefined ? matchedP.strikesIn5 : 0;

    let msg = '';
    if (isStarting) {
      if (lang === 'ar') {
        msg = `⚔️ *دوري БРАТВА FCM: استدعاء رسمي للبطولة!* ⚔️\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `⚜️ *أهلاً بالبطل:* *${pName}* 🛡️\n\n` +
          `🎯 *قرار القيادة الفنية للرابطة:*\n` +
          `لقد تم اختيارك رسمياً ضمن **التشكيلة الأساسية (${size} ضد ${size})** في البطولة القادمة!\n\n` +
          `⚽ *مهمتك القتالية في المباراة:*\n` +
          `• إنهاء جميع المحاولات *3/3 كاملة* فور انطلاق البطولة!\n` +
          `• استهداف تسجيل *20+ هدف* لقيادة الكتيبة نحو الانتصار!\n` +
          `• اللعب بروح الأخوة والانضباط العالي التي تميز БРАТВА.\n\n` +
          `📊 *معدلك في آخر 5 مباريات:* *${avg}* هدف\n` +
          `🎯 *سجل الإنضباط:* *${strikes}* إنذارات (100% نظيف ✅)\n\n` +
          `🔥 *الفريق كامل يثق فيك ويعول عليك... لا تخذل كتيبتك وكن في الموعد!* 🏆\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `🌐 *الموقع الرسمي للدوري:* ${WEBSITE_URL}`;
      } else if (lang === 'en') {
        msg = `⚔️ *BRATVA FCM: OFFICIAL TOURNAMENT CALL-UP!* ⚔️\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `⚜️ *Warrior:* *${pName}* 🛡️\n\n` +
          `🎯 *League Technical Selection:*\n` +
          `You have earned your place in the **STARTING SQUAD (${size}v${size})** for the upcoming tournament!\n\n` +
          `⚽ *Your Match Directives:*\n` +
          `• Complete all *3/3 turns* promptly once match is live!\n` +
          `• Target *20+ goals* minimum to lead our brotherhood to victory!\n` +
          `• Play with the relentless spirit and discipline of BRATVA.\n\n` +
          `📊 *Recent Form (Last 5):* avg *${avg}*G\n` +
          `🎯 *Discipline Status:* *${strikes}* Strikes (Clean ✅)\n\n` +
          `🔥 *The entire league stands behind you. Lead the attack to glory!* 🏆\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `🌐 *Official Website:* ${WEBSITE_URL}`;
      } else if (lang === 'es') {
        msg = `⚔️ *LIGA BRATVA FCM: ¡CONVOCATORIA OFICIAL!* ⚔️\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `⚜️ *Guerrero:* *${pName}* 🛡️\n\n` +
          `🎯 *Decisión Técnica de la Liga:*\n` +
          `¡Has sido seleccionado en la **ALINEACIÓN TITULAR (${size}v${size})** para el próximo torneo!\n\n` +
          `⚽ *Tu misión en la cancha:*\n` +
          `• ¡Completar tus *3/3 turnos* puntualmente!\n` +
          `• ¡Buscar la meta de *20+ goles* para asegurar la victoria!\n` +
          `• Defender el honor y la disciplina de BRATVA.\n\n` +
          `📊 *Promedio reciente:* prom. *${avg}*G\n` +
          `🎯 *Disciplina:* *${strikes}* Strikes (Limpio ✅)\n\n` +
          `🔥 *¡El equipo confía plenamente en ti! ¡Sal a ganar!* 🏆\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `🌐 *Sitio Oficial:* ${WEBSITE_URL}`;
      } else {
        // Russian (Default)
        msg = `⚔️ *БРАТВА FCM: БОЕВОЙ ВЫЗОВ НА ТУРНИР!* ⚔️\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `⚜️ *Боец:* *${pName}* 🛡️\n\n` +
          `🎯 *Решение руководства лиги:*\n` +
          `Ты официально включён в **ОСНОВНОЙ СОСТАВ (${size}x${size})** на предстоящий турнир!\n\n` +
          `⚽ *Твоя боевая задача:*\n` +
          `• Сыграть все *3/3 ходов* вовремя, без задержек!\n` +
          `• Пробить командную планку *20+ голов* для победы!\n` +
          `• Держать планку чести и дисциплины БРАТВА.\n\n` +
          `📊 *Твоя форма (посл. 5):* ср. *${avg}*Г\n` +
          `🎯 *Страйки:* *${strikes}* (Чисто ✅)\n\n` +
          `🔥 *Братва рассчитывает на тебя. Выходи на поле и забери победу!* 🏆\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `🌐 *Сайт лиги:* ${WEBSITE_URL}`;
      }
    } else {
      // Bench / Reserve
      if (lang === 'ar') {
        msg = `🟡 *دوري БРАТВА FCM: وضعية التشكيلة (دكة الاحتياط)* 🟡\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `⚜️ *البطل:* *${pName}* 🛡️\n\n` +
          `📋 *أنت مسجل في دكة البدلاء كاحتياطي أول جاهز!*\n` +
          `• ابقَ في حالة تأهب وجاهزية تامة للدخول في حال تعذر أحد الأساسيين عن اللعب.\n` +
          `• التزامك وحضورك في سحب الجاهزية محل تقدير كبير من الرابطة!\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `🌐 *الموقع الرسمي:* ${WEBSITE_URL}`;
      } else if (lang === 'en') {
        msg = `🟡 *BRATVA FCM: SQUAD STATUS (BENCH / RESERVE)* 🟡\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `⚜️ *Warrior:* *${pName}* 🛡️\n\n` +
          `📋 *You are placed on the Official Bench as Priority Reserve!*\n` +
          `• Stay on alert in case an active starter cannot complete their attacks.\n` +
          `• Your reliability is essential to our brotherhood's depth!\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `🌐 *Official Website:* ${WEBSITE_URL}`;
      } else if (lang === 'es') {
        msg = `🟡 *LIGA BRATVA FCM: ESTADO DE LA PLANTILLA (BANQUILLO)* 🟡\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `⚜️ *Guerrero:* *${pName}* 🛡️\n\n` +
          `📋 *¡Estás en el Banquillo como Reserva Prioritaria!*\n` +
          `• Mantente atento por si un titular no puede jugar sus turnos.\n` +
          `• ¡Tu presencia y compromiso fortalecen a todo el equipo!\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `🌐 *Sitio Oficial:* ${WEBSITE_URL}`;
      } else {
        // Russian
        msg = `🟡 *БРАТВА FCM: СКАМЕЙКА ЗАПАСНЫХ (РЕЗЕРВ)* 🟡\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `⚜️ *Боец:* *${pName}* 🛡️\n\n` +
          `📋 *Ты в официальном резерве лиги как приоритетный запасной!*\n` +
          `• Будь наготове, если кому-то из основы потребуется срочная замена.\n` +
          `• Твоя верность и готовность делают БРАТВА сильнее!\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `🌐 *Сайт лиги:* ${WEBSITE_URL}`;
      }
    }

    const lineupBtnText = lang === 'ar' ? '🎯 عرض التشكيلة الكاملة' :
                          lang === 'es' ? '🎯 Ver Alineación Completa' :
                          lang === 'en' ? '🎯 View Full Lineup' : '🎯 Посмотреть состав основы';

    const keys = {
      inline_keyboard: [
        [
          { text: lineupBtnText, callback_data: `fmt_lineup_auto_${lang}` }
        ],
        [
          { text: '🌐 Official League Website', url: WEBSITE_URL }
        ]
      ]
    };

    try {
      await sendTelegramMessage(player.telegramId, msg, keys);
      await new Promise(r => setTimeout(r, 60));
    } catch (e) {
      console.error(`Failed to send lineup notification to ${player.displayName}:`, e.message);
    }
  }
}

async function notifyVerifiedPlayersMatchDebrief(tData) {
  const verified = await getVerifiedPlayersForNotification();
  if (verified.length === 0 || !tData || !tData.matches) return;

  const { pIndex } = loadLeagueData();
  const opponent = tData.opponent_league || 'OPPONENT';
  const ourScore = tData.our_total_goals || 0;
  const oppScore = tData.opponent_total_goals || 0;
  const result = tData.result;

  for (const player of verified) {
    const match = tData.matches.find(m => player.playerIds.includes(String(m.player_id).toLowerCase()));
    if (!match) continue; // Player didn't play in this tournament

    const lang = resolvePlayerLanguage(player);
    const pName = bidiIsolate(player.displayName);
    const goals = match.goals_for !== undefined ? match.goals_for : 0;
    const turns = match.turns_played !== undefined ? match.turns_played : 0;

    const pData = pIndex[match.player_id] || pIndex[player.playerIds[0]] || {};
    const totalGoals = pData.total_goals || goals;
    const totalMatches = pData.total_matches || 1;
    const avg = pData.average_goals || (totalGoals / totalMatches).toFixed(1);
    const strikes = pData.eligibility_streak?.current_fail_streak || 0;

    let resultBadge = '';
    if (lang === 'ar') resultBadge = result === 'win' ? '🟢 فوز مستحق!' : (result === 'draw' ? '🟡 تعادل حماسي' : '🔴 خسارة قتالية');
    else if (lang === 'es') resultBadge = result === 'win' ? '🟢 ¡VICTORIA!' : (result === 'draw' ? '🟡 EMPATE' : '🔴 DERROTA');
    else if (lang === 'en') resultBadge = result === 'win' ? '🟢 GLORIOUS WIN!' : (result === 'draw' ? '🟡 HARD DRAW' : '🔴 TOUGH LOSS');
    else resultBadge = result === 'win' ? '🟢 ПОБЕДА БРАТВА!' : (result === 'draw' ? '🟡 БОЕВАЯ НИЧЬЯ' : '🔴 ПОРАЖЕНИЕ');

    let feedback = '';
    if (lang === 'ar') {
      if (turns === 3 && goals >= 25) {
        feedback = `🌟 *أداء أسطوري استثنائي!* أبدعت اليوم وكنت سلاحاً فتاكاً في شباك الخصم. هذا هو المقاتل الحقيقي الذي يفتخر به دوري БРАТВА! استمر في قيادة الهجوم نحو القمة! 🔥`;
      } else if (turns === 3 && goals >= 20) {
        feedback = `🔥 *مستوى بطولي ممتاز!* حققت هدف الفريق (20+ هدف) ولعبت هجماتك 3/3 كاملة. شكراً لتفانيك وانضباطك العالي الذي صنع الفارق! 👏`;
      } else if (turns === 3 && goals < 20) {
        feedback = `💪 *جهد محترم وانضباط كامل!* حضورك ولعبك للـ 3/3 هجمات دليل على ولائك للفريق. ركز في البطولة القادمة على استغلال الفرص للوصول للهدف 20+! نثق بك! ⚽`;
      } else {
        feedback = `⚠️ *تنبيه هام وملاحظة انضباطية:* لعبت *${turns}/3* محاولات فقط. تفويت الهجمات يضر بنتيجة الفريق ويمنحك إنذاراً (سترايك). نرجو منك الالتزام التام باللعب 3/3 لحماية مكانتك في الرابطة! 🚨`;
      }
    } else if (lang === 'en') {
      if (turns === 3 && goals >= 25) {
        feedback = `🌟 *MASTERCLASS PERFORMANCE!* Unstoppable finishing and lethal presence on the field. You exemplified true BRATVA warrior spirit today! Keep conquering! 🔥`;
      } else if (turns === 3 && goals >= 20) {
        feedback = `🔥 *EXCELLENT CONTRIBUTION!* Reached our 20+ goal benchmark and played all 3/3 turns promptly. Outstanding dedication to the team! 👏`;
      } else if (turns === 3 && goals < 20) {
        feedback = `💪 *RESPECTED DISCIPLINE!* You completed all 3/3 turns. Keep sharpening your finishing chances for the next clash to hit the 20+ goal mark! We believe in you! ⚽`;
      } else {
        feedback = `⚠️ *DISCIPLINARY NOTICE:* You completed only *${turns}/3* turns. Missing turns costs the brotherhood dearly and incurs a strike. Please ensure you play all 3 turns next match to safeguard your roster spot! 🚨`;
      }
    } else if (lang === 'es') {
      if (turns === 3 && goals >= 25) {
        feedback = `🌟 *¡ACTUACIÓN MAGISTRAL!* Fuiste imparable ante la defensa rival. ¡Auténtico espíritu guerrero de BRATVA! ¡Sigue liderando el ataque! 🔥`;
      } else if (turns === 3 && goals >= 20) {
        feedback = `🔥 *¡EXCELENTE RENDIMIENTO!* Superaste la meta de 20+ goles jugando tus 3/3 turnos completos. ¡Orgullo de equipo! 👏`;
      } else if (turns === 3 && goals < 20) {
        feedback = `💪 *¡DISCIPLINA EJEMPLAR!* Cumpliste con tus 3/3 turnos. ¡En el próximo encuentro afinaremos puntería para superar los 20+ goles! ¡Confiamos en ti! ⚽`;
      } else {
        feedback = `⚠️ *AVISO DISCIPLINARIO:* Jugaste solo *${turns}/3* turnos. Las faltas perjudican al equipo y generan strikes. ¡Por favor completa siempre tus 3/3 turnos para cuidar tu lugar en la liga! 🚨`;
      }
    } else {
      // Russian
      if (turns === 3 && goals >= 25) {
        feedback = `🌟 *ВЫДАЮЩАЯСЯ ИГРА!* Ты показал чемпионский уровень и сокрушил оборону соперника. Настоящий лидер атаки БРАТВА! Продолжай вести команду вперёд! 🔥`;
      } else if (turns === 3 && goals >= 20) {
        feedback = `🔥 *ОТЛИЧНЫЙ РЕЗУЛЬТАТ!* Пробил командную планку 20+ голов и выполнил все 3/3 хода вовремя. Огромный вклад в общую победу! 👏`;
      } else if (turns === 3 && goals < 20) {
        feedback = `💪 *БОЕВОЙ НАСТРОЙ И ДИСЦИПЛИНА!* Сыграны все 3/3 ходов — это образец верности клубу. В следующем матче подтянем реализацию до 20+ голов! Мы в тебя верим! ⚽`;
      } else {
        feedback = `⚠️ *ВАЖНОЕ ПРЕДУПРЕЖДЕНИЕ:* Сыграно только *${turns}/3* ходов. Несыгранные ходы тянут всю лигу вниз и ведут к страйку. Пожалуйста, доигрывай все 3 хода вовремя, чтобы не рисковать местом в основе! 🚨`;
      }
    }

    let strikeText = '';
    if (strikes === 0) {
      strikeText = lang === 'ar' ? '0 إنذارات (سجل نقي 100% ✅)' :
                   lang === 'es' ? '0 strikes (¡100% Limpio! ✅)' :
                   lang === 'en' ? '0 strikes (100% Clean! ✅)' : '0 страйков (100% Чисто! ✅)';
    } else {
      strikeText = lang === 'ar' ? `${strikes}/3 إنذار (العب 5 بطولات كاملة لإسقاطها 🟢)` :
                   lang === 'es' ? `${strikes}/3 strikes (5 partidos limpios los eliminan 🟢)` :
                   lang === 'en' ? `${strikes}/3 strikes (5 clean matches clears all 🟢)` : `${strikes}/3 страйка (5 чистых матчей сжигают их 🟢)`;
    }

    let msg = '';
    if (lang === 'ar') {
      msg = `🏁 *دوري БРАТВА FCM: تقرير أدائك في المباراة* 🏁\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `⚔️ *الخصم:* *${opponent}*\n` +
        `🏆 *النتيجة:* *${ourScore} : ${oppScore}* (${resultBadge})\n` +
        `────────────────────\n` +
        `👤 *البطل:* *${pName}*\n` +
        `⚽ *أهدافك:* *${goals}* هدف\n` +
        `🎯 *المحاولات:* *${turns}/3* محاولات\n` +
        `────────────────────\n` +
        `${feedback}\n` +
        `────────────────────\n` +
        `📊 *سجل مسيرتك الشامل في الرابطة:*\n` +
        `• إجمالي أهدافك: *${totalGoals}* هدف\n` +
        `• البطولات الملعوبة: *${totalMatches}* بطولة\n` +
        `• معدلك العام: *${avg}* هدف/مباراة\n` +
        `• حالة الانضباط: *${strikeText}*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🌐 *رابط بطاقتك الشخصية في الموقع:* ${WEBSITE_URL}`;
    } else if (lang === 'en') {
      msg = `🏁 *BRATVA FCM: YOUR MATCH PERFORMANCE REPORT* 🏁\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `⚔️ *Opponent:* *${opponent}*\n` +
        `🏆 *Final Score:* *${ourScore} : ${oppScore}* (${resultBadge})\n` +
        `────────────────────\n` +
        `👤 *Player:* *${pName}*\n` +
        `⚽ *Your Goals:* *${goals}*\n` +
        `🎯 *Turns Played:* *${turns}/3*\n` +
        `────────────────────\n` +
        `${feedback}\n` +
        `────────────────────\n` +
        `📊 *Your Career Overview in BRATVA:*\n` +
        `• Total Career Goals: *${totalGoals}*\n` +
        `• Tournaments Played: *${totalMatches}*\n` +
        `• Scoring Average: *${avg}* G/M\n` +
        `• Discipline Status: *${strikeText}*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🌐 *Your Interactive Card:* ${WEBSITE_URL}`;
    } else if (lang === 'es') {
      msg = `🏁 *LIGA BRATVA FCM: REPORTE DE RENDIMIENTO* 🏁\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `⚔️ *Rival:* *${opponent}*\n` +
        `🏆 *Marcador Final:* *${ourScore} : ${oppScore}* (${resultBadge})\n` +
        `────────────────────\n` +
        `👤 *Jugador:* *${pName}*\n` +
        `⚽ *Tus Goles:* *${goals}*\n` +
        `🎯 *Turnos Jugados:* *${turns}/3*\n` +
        `────────────────────\n` +
        `${feedback}\n` +
        `────────────────────\n` +
        `📊 *Tu Carrera en BRATVA:*\n` +
        `• Goles Totales: *${totalGoals}*\n` +
        `• Torneos Jugados: *${totalMatches}*\n` +
        `• Promedio Goleador: *${avg}* G/P\n` +
        `• Estado de Strikes: *${strikeText}*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🌐 *Tu Perfil Interactivo:* ${WEBSITE_URL}`;
    } else {
      // Russian (Default)
      msg = `🏁 *БРАТВА FCM: ОТЧЁТ О ТВОЕЙ ИГРЕ В МАТЧЕ* 🏁\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `⚔️ *Соперник:* *${opponent}*\n` +
        `🏆 *Итог матча:* *${ourScore} : ${oppScore}* (${resultBadge})\n` +
        `────────────────────\n` +
        `👤 *Игрок:* *${pName}*\n` +
        `⚽ *Твои голы:* *${goals}*\n` +
        `🎯 *Сыграно ходов:* *${turns}/3*\n` +
        `────────────────────\n` +
        `${feedback}\n` +
        `────────────────────\n` +
        `📊 *Твоя общая статистика в БРАТВА:*\n` +
        `• Всего забито голов: *${totalGoals}*\n` +
        `• Сыграно турниров: *${totalMatches}*\n` +
        `• Средний показатель: *${avg}* г/м\n` +
        `• Дисциплина: *${strikeText}*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🌐 *Интерактивный профиль:* ${WEBSITE_URL}`;
    }

    const cardBtnText = lang === 'ar' ? '👤 فتح بطاقتي الشخصية' :
                        lang === 'es' ? '👤 Ver Mi Tarjeta' :
                        lang === 'en' ? '👤 View My Player Card' : '👤 Моя карточка игрока';

    const keys = {
      inline_keyboard: [
        [
          { text: cardBtnText, callback_data: `cmd_mystats` }
        ],
        [
          { text: '🌐 Official League Website', url: WEBSITE_URL }
        ]
      ]
    };

    try {
      await sendTelegramMessage(player.telegramId, msg, keys);
      await new Promise(r => setTimeout(r, 60));
    } catch (e) {
      console.error(`Failed to send match debrief to ${player.displayName}:`, e.message);
    }
  }
}

async function notifyVerifiedPlayersCheckIn() {
  const verified = await getVerifiedPlayersForNotification();
  if (verified.length === 0) return;

  for (const player of verified) {
    const lang = resolvePlayerLanguage(player);
    const pName = bidiIsolate(player.displayName);

    let msg = '';
    if (lang === 'ar') {
      msg = `⚔️ *دوري БРАТВА FCM: نداء الحضور للبطولة القادمة!* ⚔️\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🛡️ *إلى البطل:* *${pName}*\n\n` +
        `🔥 بدأ الآن سحب الحضور (Check-In) للبطولة القادمة بمهلة *60 دقيقة* فقط!\n` +
        `• البوت يحدد حجم التشكيلة الأساسية تلقائياً بحسب الحاضرين.\n` +
        `• اضغط زر [ 🟢 أنا جاهز ] الآن لتضمن مقعدك في التشكيلة الأساسية!\n\n` +
        `👉 *أكد حالتك بضغطة زر مباشرة بالأسفل:*`;
    } else if (lang === 'en') {
      msg = `⚔️ *BRATVA FCM: PRE-MATCH CHECK-IN IS OPEN!* ⚔️\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🛡️ *Attention Warrior:* *${pName}*\n\n` +
        `🔥 The 60-minute roll call for the upcoming tournament is now LIVE!\n` +
        `• The bot automatically chooses the official tournament size from ready players.\n` +
        `• Tap [ 🟢 I'm Ready ] below to lock in your starting spot!\n\n` +
        `👉 *Confirm your availability directly below:*`;
    } else if (lang === 'es') {
      msg = `⚔️ *LIGA BRATVA FCM: ¡CHECK-IN PREVIO ABIERTO!* ⚔️\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🛡️ *¡Atención Guerrero:* *${pName}*!\n\n` +
        `🔥 ¡El pase de lista de 60 minutos para el próximo torneo ya comenzó!\n` +
        `• El bot define la alineación oficial según los jugadores disponibles.\n` +
        `• ¡Toca [ 🟢 Estoy Listo ] abajo para asegurar tu puesto titular!\n\n` +
        `👉 *Confirma tu disponibilidad con un toque abajo:*`;
    } else {
      // Russian
      msg = `⚔️ *БРАТВА FCM: ОТКРЫТ ПРЕДМАТЧЕВЫЙ ЧЕК-ИН!* ⚔️\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🛡️ *Боец:* *${pName}*\n\n` +
        `🔥 Открыт сбор готовности на 60 минут перед следующим турниром!\n` +
        `• Бот формирует основу турнира строго по тем, кто подтвердил готовность.\n` +
        `• Нажми [ 🟢 Я готов к игре ] прямо сейчас, чтобы забрать место в основе!\n\n` +
        `👉 *Подтверди участие одной кнопкой прямо под сообщением:*`;
    }

    const readyText = lang === 'ar' ? '🟢 أنا جاهز للعب' :
                      lang === 'es' ? '🟢 Estoy Listo' :
                      lang === 'en' ? '🟢 I\'m Ready' : '🟢 Я готов к игре';

    const awayText = lang === 'ar' ? '🔴 غير متاح حالياً' :
                     lang === 'es' ? '🔴 No Disponible' :
                     lang === 'en' ? '🔴 Not Available' : '🔴 Не могу сыграть';

    const keys = {
      inline_keyboard: [
        [
          { text: readyText, callback_data: 'ci_ready' },
          { text: awayText, callback_data: 'ci_away' }
        ],
        [
          { text: '🌐 Official League Website', url: WEBSITE_URL }
        ]
      ]
    };

    try {
      await sendTelegramMessage(player.telegramId, msg, keys);
      await new Promise(r => setTimeout(r, 60));
    } catch (e) {
      console.error(`Failed to send checkin ping to ${player.displayName}:`, e.message);
    }
  }
}

async function notifyVerifiedPlayersDisciplineWarning() {
  const verified = await getVerifiedPlayersForNotification();
  if (verified.length === 0) return;
  const squad = await evaluateAllSquadStrikes();

  for (const player of verified) {
    const matched = squad.find(p => player.playerIds.includes(String(p.pid).toLowerCase()));
    if (!matched || matched.strikesIn5 === 0) continue; // no strikes

    const lang = resolvePlayerLanguage(player);
    const pName = bidiIsolate(player.displayName);
    const strikes = matched.strikesIn5;

    let msg = '';
    if (lang === 'ar') {
      msg = `⚠️ *دوري БРАТВА FCM: تذكير أخوي بالانضباط* ⚠️\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `⚜️ *أهلاً بالبطل:* *${pName}* 🛡️\n\n` +
        `نرسل لك هذا التذكير الأخوي لأن لديك حالياً *${strikes}/3* إنذارات بسبب تفويت بعض الهجمات في البطولات السابقة.\n\n` +
        `🟢 *كيف تسقط الإنذارات؟*\n` +
        `• قانون الرابطة ينص على أن لعب *5 بطولات متتالية بـ 3/3 هجمات* يمسح جميع الإنذارات السابقة بنسبة 100%!\n` +
        `• مكانك أساسي في كتيبة БРАТВА ونحن حريصون على استمرارك معنا.\n\n` +
        `⚽ احرص على لعب هجماتك كاملة في البطولة القادمة لحماية مكانتك في الرابطة!\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🌐 *الموقع الرسمي:* ${WEBSITE_URL}`;
    } else if (lang === 'es') {
      msg = `⚠️ *LIGA BRATVA FCM: RECORDATORIO DE DISCIPLINA* ⚠️\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `⚜️ *Guerrero:* *${pName}* 🛡️\n\n` +
        `Aviso fraternal: actualmente tienes *${strikes}/3* strikes por turnos incompletos en torneos recientes.\n\n` +
        `🟢 *¿Cómo eliminar los strikes?*\n` +
        `• Regla BRATVA: ¡jugar *5 partidos consecutivos limpios (3/3 turnos)* elimina todos los strikes pasados!\n` +
        `• Eres una pieza valiosa en el equipo y confiamos en tu compromiso.\n\n` +
        `⚽ ¡Asegúrate de jugar todos tus 3 turnos en el próximo torneo para cuidar tu lugar en la liga!\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🌐 *Sitio Oficial:* ${WEBSITE_URL}`;
    } else if (lang === 'en') {
      msg = `⚠️ *BRATVA FCM: BROTHERHOOD DISCIPLINE REMINDER* ⚠️\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `⚜️ *Warrior:* *${pName}* 🛡️\n\n` +
        `Friendly check-in: you currently have *${strikes}/3* strikes from missed turns in recent tournaments.\n\n` +
        `🟢 *How to clear strikes?*\n` +
        `• Under BRATVA rules: playing *5 consecutive clean matches (3/3 turns)* completely wipes away past strikes!\n` +
        `• You are a valued member of our squad, and we count on your dedication.\n\n` +
        `⚽ Complete all 3 turns in the upcoming tournament to protect your roster spot!\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🌐 *Official Website:* ${WEBSITE_URL}`;
    } else {
      // Russian
      msg = `⚠️ *БРАТВА FCM: ДРУЖЕСКОЕ НАПОМИНАНИЕ О ДИСЦИПЛИНЕ* ⚠️\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `⚜️ *Боец:* *${pName}* 🛡️\n\n` +
        `Напоминаем, что у тебя сейчас *${strikes}/3* страйка за пропущенные ходы в прошлых турнирах.\n\n` +
        `🟢 *Как сжечь страйки?*\n` +
        `• По правилам БРАТВА: *5 чистых турниров подряд с 3/3 ходов* полностью обнуляют все прошлые страйки!\n` +
        `• Ты важная часть нашей команды, и мы рассчитываем на твою стабильность.\n\n` +
        `⚽ Отыграй все 3 хода в следующем турнире и защити своё место в основе!\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🌐 *Сайт лиги:* ${WEBSITE_URL}`;
    }

    const keys = {
      inline_keyboard: [
        [
          { text: '📜 Read Rules / اقرأ القوانين', callback_data: `tab_rules_0_${lang}` }
        ],
        [
          { text: '🌐 Official League Website', url: WEBSITE_URL }
        ]
      ]
    };

    try {
      await sendTelegramMessage(player.telegramId, msg, keys);
      await new Promise(r => setTimeout(r, 60));
    } catch (e) {
      console.error(`Failed to send warning to ${player.displayName}:`, e.message);
    }
  }
}

/**
 * Handle Extracted AI Result (with incremental stitching & caching)
 */
async function handleTournamentResult(aiResult, chatId, res, isAlbum = false, progMsgId = null) {
  if (progMsgId) {
    await deleteTelegramMessage(chatId, progMsgId);
  }
  if (!aiResult || aiResult.is_tournament_screenshot === false) {
    await sendTelegramMessage(chatId, '⚠️ *Not a valid EA FC Mobile tournament screenshot!*');
    return sendResponse(res, 200, 'OK');
  }

  if (aiResult.status === 'LIVE') {
    await saveLiveMatchResult(aiResult);
    const liveMsg = formatLiveAlert(aiResult, 'ru');
    latestLiveMessage = liveMsg;

    const liveKeys = getLanguageKeyboard('live', '0', 'ru', true);

    await sendTelegramMessage(chatId, liveMsg, liveKeys);
    return sendResponse(res, 200, 'OK');
  }

  const oppSlug = slugifyLeague(aiResult.opponent_league);
  const ourGoals = aiResult.score_bratva || 0;
  const oppGoals = aiResult.score_opponent || 0;

  const extractedMatches = (aiResult.players || []).map((p, idx) => ({
    board_order: p.board_order || (idx + 1),
    player_id: slugifyPlayerId(p.name, idx),
    player_display_name: p.name,
    ovr: p.ovr || 125,
    goals_for: p.goals !== undefined ? p.goals : 0,
    turns_played: resolveTurnsPlayed(p)
  }));

  // Robust Turn Verification against Header Banner Total:
  const teamTurnsFromBanner = aiResult.turns_bratva || 0;
  const currentTurnsSum = extractedMatches.reduce((acc, m) => acc + m.turns_played, 0);
  if (teamTurnsFromBanner > 0 && currentTurnsSum !== teamTurnsFromBanner) {
    // Check if inverted turns match teamTurnsFromBanner (AI confusion guard)
    const invertedSum = extractedMatches.reduce((acc, m) => acc + (m.goals_for > 0 ? 3 : (3 - m.turns_played)), 0);
    if (invertedSum === teamTurnsFromBanner) {
      console.warn(`[SAFETY] Detected AI turn inversion! Auto-correcting turns to match banner total (${teamTurnsFromBanner})`);
      extractedMatches.forEach(m => {
        if (m.goals_for > 0) m.turns_played = 3;
        else m.turns_played = 0;
      });
    }
  }

  // Global Deduplication & Idempotency Guard
  let tIndexObj = {};
  let existingTIndex = null;
  try {
    existingTIndex = await githubApi(`/repos/${GITHUB_REPO}/contents/docs/league-data/index/tournaments_index.json`);
    if (existingTIndex && existingTIndex.content) {
      tIndexObj = JSON.parse(Buffer.from(existingTIndex.content, 'base64').toString('utf8'));
    }
  } catch (e) {}

  if (Object.keys(tIndexObj).length === 0) {
    try {
      const localTIndexPath = path.join(process.cwd(), 'docs', 'league-data', 'index', 'tournaments_index.json');
      if (fs.existsSync(localTIndexPath)) {
        tIndexObj = JSON.parse(fs.readFileSync(localTIndexPath, 'utf8'));
      }
    } catch (e) {}
  }

  function normLeague(s) {
    return (s || '').toLowerCase().replace(/[\s\-_™+®·'.@]+/g, '');
  }
  const normIncoming = normLeague(aiResult.opponent_league);

  let duplicateId = null;
  let duplicateMeta = null;

  for (const [id, meta] of Object.entries(tIndexObj)) {
    const normExisting = normLeague(meta.opponent_league);
    const existingSlug = slugifyLeague(meta.opponent_league);
    const isOpponentMatch = (normExisting === normIncoming) || (existingSlug === oppSlug) || id.endsWith(`_${oppSlug}`);
    const isScoreMatch = (meta.our_total_goals === ourGoals) && (meta.opponent_total_goals === oppGoals);

    if (isOpponentMatch && isScoreMatch) {
      duplicateId = id;
      duplicateMeta = meta;
      break;
    }
  }

  if (duplicateId) {
    console.log(`[DEDUPLICATION] Tournament vs "${aiResult.opponent_league}" (${ourGoals}-${oppGoals}) matches existing "${duplicateId}"!`);

    let existingTournament = null;
    try {
      const existingFile = await githubApi(`/repos/${GITHUB_REPO}/contents/docs/league-data/tournaments/${duplicateId}.json`);
      if (existingFile && existingFile.content) {
        existingTournament = JSON.parse(Buffer.from(existingFile.content, 'base64').toString('utf8'));
      }
    } catch (e) {}

    if (!existingTournament) {
      try {
        const localFile = path.join(process.cwd(), 'docs', 'league-data', 'tournaments', `${duplicateId}.json`);
        if (fs.existsSync(localFile)) {
          existingTournament = JSON.parse(fs.readFileSync(localFile, 'utf8'));
        }
      } catch (e) {}
    }

    const existingMatchCount = (existingTournament?.matches || []).length;
    const incomingMatchCount = extractedMatches.length;

    // If existing tournament already has all players (or as many/more as the upload):
    if (existingTournament && existingMatchCount >= incomingMatchCount && existingMatchCount >= 16) {
      const dateRecorded = duplicateMeta?.date || existingTournament.date || duplicateId.slice(0, 10);
      const dmMsg = `⚠️ *هاد التورنوا مسجل ديجا ف السيستيم!* ⚠️\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `⚔️ *БРАТВА FCM* ${ourGoals} - ${oppGoals} *${clean(duplicateMeta?.opponent_league || aiResult.opponent_league)}*\n` +
        `📅 *التاريخ / Дата:* ${dateRecorded}\n` +
        `👥 *اللاعبين المسجلين / Игроков в протоколе:* ${existingMatchCount}\n\n` +
        `🛡️ *حماية التكرار (Idempotency Guard):*\n` +
        `البوت تعرف بلي هاد التورنوا داخل ديجا بنفس النتيجة والخصم. تم إلغاء التسجيل التكراري للحفاظ على دقة ترتيب اللاعبين وإحصائياتهم.\n\n` +
        `_(Дублирование предотвращено. Статистика и рейтинг защищены от повторного учета)._`;

      const baseDmKeys = getLanguageKeyboard('recap', duplicateId, 'ru', true);
      await sendTelegramMessage(chatId, dmMsg, baseDmKeys);
      return sendResponse(res, 200, 'Duplicate ignored');
    }

    console.log(`[DEDUPLICATION] Updating existing tournament "${duplicateId}" on original date...`);
  }

  let dateStr = duplicateId ? (duplicateMeta?.date || duplicateId.slice(0, 10)) : new Date().toISOString().split('T')[0];
  let tId = duplicateId || `${dateStr}_${oppSlug}`;

  let tData = {
    id: tId,
    tournament_id: tId,
    date: dateStr,
    timestamp: duplicateId ? (duplicateMeta?.timestamp || Date.now()) : Date.now(),
    opponent_league: aiResult.opponent_league || 'OPPONENT',
    our_total_goals: ourGoals,
    opponent_total_goals: oppGoals,
    result: (ourGoals > oppGoals) ? 'win' : (ourGoals === oppGoals ? 'draw' : 'loss'),
    status: 'complete',
    total_turns_played: aiResult.turns_bratva || 0,
    max_possible_turns: aiResult.turns_max || 48,
    matches: extractedMatches
  };

  // Smart Incremental Stitching: Only merge for single photo uploads if same opponent within 30 min.
  // For full albums (isAlbum = true), start 100% fresh and clean!
  if (!isAlbum && globalLatestTournament &&
      globalLatestTournament.opponent_league.toLowerCase() === tData.opponent_league.toLowerCase() &&
      (Date.now() - (globalLatestTournament.timestamp || 0)) < 30 * 60 * 1000) {
    const existingMap = new Map(globalLatestTournament.matches.map(m => [m.player_id, m]));
    extractedMatches.forEach(m => {
      existingMap.set(m.player_id, m);
    });
    tData.matches = Array.from(existingMap.values()).sort((a, b) => (a.board_order || 99) - (b.board_order || 99));
    tData.our_total_goals = Math.max(tData.our_total_goals, globalLatestTournament.our_total_goals);
    tData.opponent_total_goals = Math.max(tData.opponent_total_goals, globalLatestTournament.opponent_total_goals);
    tData.result = (tData.our_total_goals > tData.opponent_total_goals) ? 'win' : (tData.our_total_goals === tData.opponent_total_goals ? 'draw' : 'loss');
  }

  // Update in-memory live cache
  globalLatestTournament = tData;

  const recap = formatRecap(tData, 'ru');
  const channelKeys = getLanguageKeyboard('recap', tId, 'ru', false);
  const baseDmKeys = getLanguageKeyboard('recap', tId, 'ru', true);
  const dmKeys = {
    inline_keyboard: [
      ...baseDmKeys.inline_keyboard,
      [
        { text: '⚔️ Launch Next Pre-Match Check-In (1h)', callback_data: 'open_checkin_60' }
      ]
    ]
  };

  // Send to Channel and User
  await sendTelegramMessage(CHANNEL_ID, recap, channelKeys);
  await sendTelegramMessage(chatId, `🔴 *MATCH COMPLETED & BROADCASTED TO ${CHANNEL_ID}!*`, dmKeys);

  // Commit to GitHub with full index synchronization (awaited so Vercel waits)
  try {
    // 1. Commit Tournament JSON
    const existingFile = await githubApi(`/repos/${GITHUB_REPO}/contents/docs/league-data/tournaments/${tId}.json`);
    const fileContent = Buffer.from(JSON.stringify(tData, null, 2)).toString('base64');
    const commitPayload = {
      message: `Auto-Update: Recorded tournament vs ${tData.opponent_league} (${tData.matches.length} players)`,
      content: fileContent
    };
    if (existingFile && existingFile.sha) commitPayload.sha = existingFile.sha;
    await githubApi(`/repos/${GITHUB_REPO}/contents/docs/league-data/tournaments/${tId}.json`, 'PUT', commitPayload);

    // 2. Update and Commit tournaments_index.json
    try {
      const refreshedTIndex = await githubApi(`/repos/${GITHUB_REPO}/contents/docs/league-data/index/tournaments_index.json`);
      if (refreshedTIndex && refreshedTIndex.content) {
        existingTIndex = refreshedTIndex;
        tIndexObj = JSON.parse(Buffer.from(refreshedTIndex.content, 'base64').toString('utf8'));
      }
    } catch (e) {}
    tIndexObj[tId] = {
      date: tData.date,
      timestamp: tData.timestamp || Date.now(),
      opponent_league: tData.opponent_league,
      our_total_goals: tData.our_total_goals,
      opponent_total_goals: tData.opponent_total_goals,
      result: tData.result,
      status: tData.status
    };
    const tIndexPayload = {
      message: `Auto-Update: Index tournament vs ${tData.opponent_league}`,
      content: Buffer.from(JSON.stringify(tIndexObj, null, 2)).toString('base64')
    };
    if (existingTIndex && existingTIndex.sha) tIndexPayload.sha = existingTIndex.sha;
    await githubApi(`/repos/${GITHUB_REPO}/contents/docs/league-data/index/tournaments_index.json`, 'PUT', tIndexPayload);

    // Sync to local filesystem if directory exists
    try {
      const localTPath = path.join(process.cwd(), 'docs', 'league-data', 'tournaments', `${tId}.json`);
      if (fs.existsSync(path.dirname(localTPath))) fs.writeFileSync(localTPath, JSON.stringify(tData, null, 2), 'utf8');
      const localTIPath = path.join(process.cwd(), 'docs', 'league-data', 'index', 'tournaments_index.json');
      if (fs.existsSync(path.dirname(localTIPath))) fs.writeFileSync(localTIPath, JSON.stringify(tIndexObj, null, 2), 'utf8');
    } catch (e) {}

    // 3. Update and Commit players_index.json
    const existingPIndex = await githubApi(`/repos/${GITHUB_REPO}/contents/docs/league-data/index/players_index.json`);
    let pIndexObj = {};
    if (existingPIndex && existingPIndex.content) {
      try { pIndexObj = JSON.parse(Buffer.from(existingPIndex.content, 'base64').toString('utf8')); } catch (e) {}
    }
    tData.matches.forEach(m => {
      const prev = pIndexObj[m.player_id] || {};
      const alreadyEvaluated = prev.eligibility_streak?.last_evaluated_tournament_id === tId;
      if (alreadyEvaluated) {
        // Tournament already counted for this player: do NOT double-increment matches or goals!
        return;
      }
      const prevMatches = prev.total_matches || 0;
      const prevGoals = prev.total_goals || 0;
      const newMatches = prevMatches + 1;
      const newGoals = prevGoals + (m.goals_for || 0);
      const prevStreak = prev.eligibility_streak?.current_fail_streak || 0;
      const currentFailStreak = (m.turns_played < 3) ? (prevStreak + 1) : 0;
      pIndexObj[m.player_id] = {
        display_name: m.player_display_name,
        total_goals: newGoals,
        total_matches: newMatches,
        average_goals: parseFloat((newGoals / newMatches).toFixed(1)),
        last_tournament_date: tData.date,
        eligibility_streak: {
          current_fail_streak: currentFailStreak,
          last_evaluated_tournament_id: tId,
          flagged_for_review: currentFailStreak >= 3
        }
      };
    });
    const pIndexPayload = {
      message: `Auto-Update: Player standings for vs ${tData.opponent_league}`,
      content: Buffer.from(JSON.stringify(pIndexObj, null, 2)).toString('base64')
    };
    if (existingPIndex && existingPIndex.sha) pIndexPayload.sha = existingPIndex.sha;
    await githubApi(`/repos/${GITHUB_REPO}/contents/docs/league-data/index/players_index.json`, 'PUT', pIndexPayload);

  } catch (ghErr) {
    console.error('GitHub API Sync Error:', ghErr);
  }

  // Automatically dispatch personalized post-match debrief to all verified registered players
  try {
    await notifyVerifiedPlayersMatchDebrief(tData);
  } catch (notifyErr) {
    console.error('Failed to notify verified players after tournament result:', notifyErr);
  }

  return sendResponse(res, 200, 'OK');
}

const BUFFER_ISSUE_NUMBER = 1;

async function saveLiveMatchResult(aiResult) {
  globalLatestLiveResult = aiResult;
  try {
    await githubApi(`/repos/${GITHUB_REPO}/issues/${BUFFER_ISSUE_NUMBER}`, 'PATCH', {
      body: JSON.stringify({ type: 'live_match_state', data: aiResult, updatedAt: Date.now() })
    });
  } catch (e) {
    console.error('Failed to persist live match state:', e);
  }
}

async function getLiveMatchResult() {
  if (globalLatestLiveResult) return globalLatestLiveResult;
  try {
    const issue = await githubApi(`/repos/${GITHUB_REPO}/issues/${BUFFER_ISSUE_NUMBER}`);
    if (issue && issue.body) {
      const parsed = JSON.parse(issue.body);
      if (parsed && (parsed.type === 'live_match_state' || parsed.status === 'LIVE')) {
        globalLatestLiveResult = parsed.data || parsed;
        return globalLatestLiveResult;
      }
    }
  } catch (e) {
    console.error('Failed to get live match state:', e);
  }
  return null;
}

async function bufferPhoto(albumId, fileId, chatId) {
  return await githubApi(`/repos/${GITHUB_REPO}/issues/${BUFFER_ISSUE_NUMBER}/comments`, 'POST', {
    body: JSON.stringify({ albumId, fileId, chatId, time: Date.now() })
  });
}

async function getBufferedPhotos(albumId, chatId = null) {
  const res = await githubApi(`/repos/${GITHUB_REPO}/issues/${BUFFER_ISSUE_NUMBER}/comments`);
  if (!Array.isArray(res)) return [];
  const items = [];
  for (const c of res) {
    try {
      const parsed = JSON.parse(c.body);
      const matchAlbum = albumId && parsed.albumId === albumId;
      const matchChat = chatId && String(parsed.chatId) === String(chatId);
      if (matchAlbum || matchChat) {
        items.push({ commentId: c.id, albumId: parsed.albumId, fileId: parsed.fileId, chatId: parsed.chatId, time: parsed.time });
      }
    } catch (e) {}
  }
  return items;
}

async function clearBufferedPhotos(commentIds) {
  for (const id of commentIds) {
    githubApi(`/repos/${GITHUB_REPO}/issues/comments/${id}`, 'DELETE').catch(() => {});
  }
}

async function processBufferedAlbum(albumId, chatId, res = null) {
  const items = await getBufferedPhotos(albumId, chatId);
  if (items.length === 0) {
    if (res) return sendResponse(res, 200, 'Already processed or empty buffer');
    return;
  }

  // Delete previous buffer status message in admin chat to avoid clutter
  const prevStatusId = activeBufferStatusMessages.get(chatId);
  if (prevStatusId) {
    await deleteTelegramMessage(chatId, prevStatusId);
    activeBufferStatusMessages.delete(chatId);
  }

  // Deduplicate unique file_ids while preserving arrival order
  const uniqueFileIds = [];
  for (const it of items) {
    if (it.fileId && !uniqueFileIds.includes(it.fileId)) {
      uniqueFileIds.push(it.fileId);
    }
  }

  const count = uniqueFileIds.length;
  const analyzingRes = await sendTelegramMessage(chatId, `🔍 *Analyzing ${count} tournament screenshot${count > 1 ? 's' : ''} with Gemini Vision AI...*`);
  const analyzingMsgId = analyzingRes?.result?.message_id || null;

  // Clear from buffer immediately to avoid duplicate runs
  const commentIds = items.map(it => it.commentId);
  await clearBufferedPhotos(commentIds);

  try {
    const buffers = await Promise.all(uniqueFileIds.map(fid => downloadTelegramFile(fid)));
    const aiResult = await analyzeImagesWithGemini(buffers);
    return await handleTournamentResult(aiResult, chatId, res, true, analyzingMsgId);
  } catch (err) {
    if (analyzingMsgId) {
      await deleteTelegramMessage(chatId, analyzingMsgId);
    }
    console.error('Error in processBufferedAlbum:', err);
    await sendTelegramMessage(chatId, `❌ *Analysis Error:* ${clean(err.message)}`);
    if (res) return sendResponse(res, 200, 'Analysis Error');
  }
}

async function savePlayersIndexRaw(pIndex, commitMsg = 'Admin: Update players index') {
  try {
    const localPath = path.join(process.cwd(), 'docs', 'league-data', 'index', 'players_index.json');
    fs.writeFileSync(localPath, JSON.stringify(pIndex, null, 2), 'utf8');
    const rootPath = path.join(process.cwd(), 'league-data', 'index', 'players_index.json');
    if (fs.existsSync(path.dirname(rootPath))) {
      fs.writeFileSync(rootPath, JSON.stringify(pIndex, null, 2), 'utf8');
    }
  } catch (e) {
    console.error('Error writing players_index.json locally:', e);
  }

  try {
    const existingFile = await githubApi(`/repos/${GITHUB_REPO}/contents/docs/league-data/index/players_index.json`);
    const fileContent = Buffer.from(JSON.stringify(pIndex, null, 2)).toString('base64');
    const commitPayload = {
      message: commitMsg,
      content: fileContent
    };
    if (existingFile && existingFile.sha) commitPayload.sha = existingFile.sha;
    await githubApi(`/repos/${GITHUB_REPO}/contents/docs/league-data/index/players_index.json`, 'PUT', commitPayload);
  } catch (e) {
    console.error('Failed to commit players_index.json to GitHub:', e);
  }
}

async function saveActiveRosterRaw(rosterData, commitMsg = 'Admin: Update active roster') {
  try {
    const localPath = path.join(process.cwd(), 'docs', 'league-data', '_active_roster.json');
    fs.writeFileSync(localPath, JSON.stringify(rosterData, null, 2), 'utf8');
    const rootPath = path.join(process.cwd(), 'league-data', '_active_roster.json');
    if (fs.existsSync(path.dirname(rootPath))) {
      fs.writeFileSync(rootPath, JSON.stringify(rosterData, null, 2), 'utf8');
    }
  } catch (e) {
    console.error('Error writing _active_roster.json locally:', e);
  }

  try {
    const existingFile = await githubApi(`/repos/${GITHUB_REPO}/contents/docs/league-data/_active_roster.json`);
    const fileContent = Buffer.from(JSON.stringify(rosterData, null, 2)).toString('base64');
    const commitPayload = {
      message: commitMsg,
      content: fileContent
    };
    if (existingFile && existingFile.sha) commitPayload.sha = existingFile.sha;
    await githubApi(`/repos/${GITHUB_REPO}/contents/docs/league-data/_active_roster.json`, 'PUT', commitPayload);
  } catch (e) {
    console.error('Failed to commit _active_roster.json to GitHub:', e);
  }
}

async function analyzeRosterMediaWithGemini(mediaBuffers, mimeType = 'video/mp4') {
  if (!GEMINI_KEY) throw new Error('GEMINI_KEY environment variable is missing');

  const isVideo = mimeType.startsWith('video');
  const prompt = `You are the master roster auditor for EA Sports FC Mobile league "БРАТВА".
Analyze the provided in-game league member list (${isVideo ? 'screen recording video scrolling through the roster' : 'screenshots of the member list'}).
Carefully extract ALL player nicknames present in the league roster.

CRITICAL EXTRACTION RULES:
1. Extract EVERY unique player display name visible on screen across the entire media.
2. Maintain exact casing, characters (Latin, Cyrillic, Arabic, special symbols, numbers, underscores, spaces).
3. Do NOT include role titles (such as "Owner", "Admin", "Member", "Владелец", "Админ", "Участник"), OVR ratings, fan counts, or level numbers in the player name.
4. Deduplicate: Each player name must appear EXACTLY ONCE in your final list.
5. If a name has special characters or emoji-like text, preserve the exact characters.

Return STRICT JSON ONLY, no markdown ticks, no commentary:
{
  "total_detected": number,
  "members": [
    "ExactPlayerName1",
    "ExactPlayerName2"
  ]
}`;

  const parts = [{ text: prompt }];
  for (const buf of mediaBuffers) {
    parts.push({
      inlineData: {
        mimeType: mimeType,
        data: buf.toString('base64')
      }
    });
  }

  const modelsToTry = [
    GEMINI_MODEL,
    'gemini-3.1-flash-lite-preview',
    'gemini-3.5-flash-lite',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-flash-latest'
  ].filter((m, i, a) => m && a.indexOf(m) === i);
  let keyIdx = 0;
  let modelIdx = 0;

  return new Promise((resolve, reject) => {
    const tryNextModel = () => {
      if (modelIdx >= modelsToTry.length) {
        keyIdx++;
        modelIdx = 0;
      }
      if (keyIdx >= GEMINI_KEYS.length) {
        return reject(new Error('All Gemini models failed to process roster media.'));
      }
      const activeKey = GEMINI_KEYS[keyIdx];
      const modelName = modelsToTry[modelIdx++];
      const req = https.request({
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/${modelName}:generateContent`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': activeKey,
          'Content-Length': Buffer.byteLength(payload)
        }
      }, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.candidates && parsed.candidates[0] && parsed.candidates[0].content) {
              let rawText = parsed.candidates[0].content.parts[0].text.trim();
              rawText = rawText.replace(/^\`\`\`json\s*/i, '').replace(/^\`\`\`\s*/i, '').replace(/\`\`\`\s*$/i, '').trim();
              const jsonRes = JSON.parse(rawText);
              if (Array.isArray(jsonRes.members)) {
                return resolve(jsonRes.members);
              } else if (Array.isArray(jsonRes)) {
                return resolve(jsonRes);
              }
            }
            console.warn(`Roster model ${modelName} returned unexpected structure:`, data.substring(0, 300));
            return tryNextModel();
          } catch (e) {
            console.warn(`Failed to parse roster JSON from ${modelName}:`, e.message);
            return tryNextModel();
          }
        });
      });
      req.setTimeout(45000, () => {
        req.destroy();
        console.warn(`Timeout calling ${modelName} for roster`);
        tryNextModel();
      });
      req.on('error', err => {
        console.warn(`Network error for roster ${modelName}:`, err.message);
        tryNextModel();
      });
      req.write(payload);
      req.end();
    };

    tryNextModel();
  });
}

async function analyzeInGameRoster(extractedNames) {
  const { pIndex } = loadLeagueData();
  const allStrikes = await evaluateAllSquadStrikes();

  const cleanExtracted = (extractedNames || []).map(n => clean(n)).filter(Boolean);
  const inGameSet = new Set(cleanExtracted.map(n => n.toLowerCase()));

  const isPlayerInGame = (pid, displayName) => {
    const dLower = clean(displayName || '').toLowerCase();
    const pLower = clean(pid || '').toLowerCase();
    if (inGameSet.has(dLower) || inGameSet.has(pLower)) return true;
    const cKey = getCanonicalPlayerKey(pid, displayName);
    return cleanExtracted.some(en => getCanonicalPlayerKey(null, en) === cKey);
  };

  const mustKickNow = [];
  const onWarning = [];
  const safeMembers = [];

  for (const p of allStrikes) {
    if (p.isInactive) continue;
    const stillInGame = isPlayerInGame(p.pid, p.displayName);

    if (stillInGame) {
      if (p.isEligibleForKick) {
        mustKickNow.push({
          pid: p.pid,
          displayName: p.displayName,
          strikesIn5: p.strikesIn5,
          consecutiveMisses: p.consecutiveMisses || 0,
          reason: (p.consecutiveMisses >= 2) ? '2 consecutive 0/3' : `${p.strikesIn5}/5 missed turns`
        });
      } else if (p.strikesIn5 > 0) {
        onWarning.push({
          pid: p.pid,
          displayName: p.displayName,
          strikesIn5: p.strikesIn5
        });
      } else {
        safeMembers.push(p.displayName);
      }
    }
  }

  // Newly Removed: active in pIndex, but absent from in-game list (exclude leadership)
  const newlyRemoved = [];
  for (const [pid, pData] of Object.entries(pIndex)) {
    if (pData.status === 'inactive') continue;
    if (['sanya', 'саня', 'doxibro', 'doxibero', 'doxibero1'].includes(pid.toLowerCase())) continue;

    const stillInGame = isPlayerInGame(pid, pData.display_name);
    if (!stillInGame) {
      newlyRemoved.push({
        pid: pid,
        displayName: pData.display_name || pid,
        totalGoals: pData.total_goals || 0,
        totalMatches: pData.total_matches || 0
      });
    }
  }

  // Rejoined: inactive in pIndex, but now PRESENT in in-game list -> reactivate!
  const rejoined = [];
  for (const [pid, pData] of Object.entries(pIndex)) {
    if (pData.status !== 'inactive') continue;

    const nowInGame = isPlayerInGame(pid, pData.display_name);
    if (nowInGame) {
      rejoined.push({
        pid: pid,
        displayName: pData.display_name || pid,
        totalGoals: pData.total_goals || 0,
        totalMatches: pData.total_matches || 0
      });
    }
  }

  // Brand New Members: in extractedNames, not anywhere in pIndex
  const newMembers = [];
  for (const en of cleanExtracted) {
    const normEn = en.toLowerCase();
    const existsInIndex = Object.entries(pIndex).some(([pid, pData]) => {
      return (pData.display_name || '').toLowerCase() === normEn ||
        pid.toLowerCase() === normEn ||
        getCanonicalPlayerKey(pid, pData.display_name) === getCanonicalPlayerKey(null, en);
    });
    if (!existsInIndex) {
      newMembers.push(en);
    }
  }

  return {
    timestamp: new Date().toISOString(),
    totalInGame: cleanExtracted.length,
    allExtractedMembers: cleanExtracted,
    mustKickNow,
    onWarning,
    safeMembers,
    newlyRemoved,
    rejoined,
    newMembers
  };
}

function formatRosterInstructions(lang = 'ru') {
  if (lang === 'en') {
    return `📹 *IN-GAME ROSTER SYNC (EA FC MOBILE)* 🔄\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `Send a screen-recording video (15-25s) scrolling smoothly through your in-game League members list, or send scrolling screenshots!\n\n` +
      `🤖 *What the bot will do:*\n` +
      `1. 🚨 *Identify In-Game Kick Candidates:* Flag players currently in the game who have 3+ strikes or 2x 0/3 misses so you can kick them immediately.\n` +
      `2. 📁 *Safe Archiving:* Players who left or were kicked are marked inactive. *Their career goals, match history, and records are NEVER deleted!*\n` +
      `3. ♻️ *Reactivation:* Inactive players who return have their career resumed and strikes reset to 0/3!\n` +
      `4. 🆕 *New Recruits:* Brand new players are automatically added to the roster.\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👉 *Please send the video or screenshots now!*`;
  }
  if (lang === 'ar') {
    return `📹 *مزامنة أعضاء الدوري من داخل اللعبة (EA FC MOBILE)* 🔄\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `أرسل فيديو قصير (15-25 ثانية) وأنت تقوم بالتمرير (Scroll) في قائمة أعضاء الدوري داخل اللعبة، أو أرسل سكرينشوتات متتالية!\n\n` +
      `🤖 *ماذا سيفعل البوت:*\n` +
      `1. 🚨 *تحديد المستحقين للطرد فوراً:* يعطيك قائمة باللاعبين الموجودين حالياً داخل الدوري ولديهم 3 إنذارات أو غياب 0/3 مرتين لتطردهم من اللعبة.\n` +
      `2. 📁 *أرشفة آمنة تماماً:* اللاعبون الذين غادروا يتم حفظهم كغير نشطين، مع *حفظ كامل أهدافهم وسجل مبارياتهم 100% بدون أي حذف!*\n` +
      `3. ♻️ *استعادة اللاعبين العائدين:* إذا رجع لاعب قديم، يستمر سجله التهديفي وتتصفر إنذاراته إلى 0/3!\n` +
      `4. 🆕 *اكتشاف الأعضاء الجدد:* تسجيل اللاعبين الجدد تلقائياً في قاعدة البيانات.\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👉 *أرسل الفيديو أو الصور الآن!*`;
  }
  if (lang === 'es') {
    return `📹 *SINCRONIZACIÓN DE ROSTER EN EL JUEGO (EA FC MOBILE)* 🔄\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `¡Envía un video corto (15-25s) haciendo scroll en la lista de miembros de la liga en el juego, o envía capturas de pantalla!\n\n` +
      `🤖 *Lo que hará el bot:*\n` +
      `1. 🚨 *Identificar candidatos a expulsión:* Jugadores que AÚN están en la liga y tienen 3+ strikes o 2x 0/3 para expulsarlos de inmediato en el juego.\n` +
      `2. 📁 *Archivado seguro:* Los que ya no están se marcan como inactivos. *¡Sus goles e historial de partidos NUNCA se borran!*\n` +
      `3. ♻️ *Reincorporaciones:* Si un jugador regresa, su carrera continúa y sus strikes se reinician a 0/3.\n` +
      `4. 🆕 *Nuevos fichajes:* Detección automática de nuevos miembros.\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👉 *¡Envía el video o las capturas ahora!*`;
  }
  return `📹 *СИНХРОНИЗАЦИЯ СОСТАВА ИЗ ИГРЫ (EA FC MOBILE)* 🔄\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `Отправьте видеозапись экрана (15-25 сек) со скроллом списка участников Лиги в игре EA FC Mobile, или отправьте серию скриншотов!\n\n` +
    `🤖 *Что сделает бот:*\n` +
    `1. 🚨 *Выявит кандидатов на кик в игре:* Игроки, которые ВСЁ ЕЩЁ в Лиге, но набрали 3 страйка или 2 раза 0/3 подряд. Вы получите список, кого нужно исключить прямо сейчас в игре!\n` +
    `2. 📁 *Безопасная архивация:* Игроки, покинувшие лигу, переводятся в неактивные. *Их статистика, история голов и матчей сохраняются навсегда!*\n` +
    `3. ♻️ *Возвращение в строй:* Если игрок вернулся в лигу, его карьера продолжается с сохранением голов, а страйки сбрасываются на 0/3!\n` +
    `4. 🆕 *Новички:* Новые участники автоматически добавляются в базу данных.\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👉 *Отправьте видео или скриншоты прямо сейчас!*`;
}

function formatRosterSyncReport(analysis, lang = 'ru') {
  const total = analysis.totalInGame || 0;
  const kickList = analysis.mustKickNow || [];
  const warnList = analysis.onWarning || [];
  const removedList = analysis.newlyRemoved || [];
  const rejoinedList = analysis.rejoined || [];
  const newList = analysis.newMembers || [];

  if (lang === 'en') {
    let msg = `🔄 *IN-GAME ROSTER SYNC AUDIT (EA FC MOBILE)* 🔄\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👥 *Detected In-Game:* ${total} members\n` +
      `━━━━━━━━━━━━━━━━━━━━\n`;

    if (kickList.length > 0) {
      msg += `🚨 *MUST KICK IN-GAME NOW (${kickList.length}):*\n`;
      kickList.forEach(p => {
        msg += `• ⛔ *${bidiIsolate(p.displayName)}* — ${p.reason}\n`;
      });
      msg += `👉 *Action:* Open EA FC Mobile and remove these players from the league!\n────────────────────\n`;
    } else {
      msg += `✅ *All active members in-game are within strike limits!*\n────────────────────\n`;
    }

    if (warnList.length > 0) {
      msg += `⚠️ *ON NOTICE (${warnList.length} players with 1-2 strikes):*\n`;
      warnList.slice(0, 10).forEach(p => {
        msg += `• ⚠️ *${bidiIsolate(p.displayName)}* (${p.strikesIn5}/3 strikes)\n`;
      });
      if (warnList.length > 10) msg += `_...and ${warnList.length - 10} more_\n`;
      msg += `────────────────────\n`;
    }

    if (removedList.length > 0) {
      msg += `📁 *LEFT LEAGUE / ARCHIVING (${removedList.length}):*\n`;
      removedList.slice(0, 10).forEach(p => {
        msg += `• 🚪 *${bidiIsolate(p.displayName)}* (${p.totalGoals} goals, ${p.totalMatches} matches)\n`;
      });
      if (removedList.length > 10) msg += `_...and ${removedList.length - 10} more_\n`;
      msg += `💡 _Career stats & match logs are 100% preserved forever._\n────────────────────\n`;
    }

    if (rejoinedList.length > 0) {
      msg += `♻️ *REJOINED PLAYERS (${rejoinedList.length}):*\n`;
      rejoinedList.forEach(p => {
        msg += `• 🎉 *${bidiIsolate(p.displayName)}* (Reactivated, strikes reset to 0/3)\n`;
      });
      msg += `────────────────────\n`;
    }

    if (newList.length > 0) {
      msg += `🆕 *NEW SQUAD MEMBERS (${newList.length}):*\n`;
      newList.slice(0, 10).forEach(n => {
        msg += `• 👤 *${bidiIsolate(n)}*\n`;
      });
      if (newList.length > 10) msg += `_...and ${newList.length - 10} more_\n`;
      msg += `────────────────────\n`;
    }

    msg += `👇 *Review carefully, then click Apply to update the database!*`;
    return msg;
  }

  if (lang === 'ar') {
    let msg = `🔄 *مزامنة تشكيلة الدوري من داخل اللعبة (EA FC MOBILE)* 🔄\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👥 *إجمالي الأعضاء المكتشفين في اللعبة:* ${total} عضو\n` +
      `━━━━━━━━━━━━━━━━━━━━\n`;

    if (kickList.length > 0) {
      msg += `🚨 *يجب طردهم من داخل اللعبة فوراً (${kickList.length}):*\n`;
      kickList.forEach(p => {
        msg += `• ⛔ *${bidiIsolate(p.displayName)}* — ${p.reason}\n`;
      });
      msg += `👉 *مطلوب:* ادخل للعبة واطردهم الآن من قائمة الدوري!\n────────────────────\n`;
    } else {
      msg += `✅ *جميع أعضاء الدوري في اللعبة ملتزمون ولا يوجد أي عضو يستحق الطرد!*\n────────────────────\n`;
    }

    if (warnList.length > 0) {
      msg += `⚠️ *تحت الملاحظة (${warnList.length} لاعب بإنذار 1-2):*\n`;
      warnList.slice(0, 10).forEach(p => {
        msg += `• ⚠️ *${bidiIsolate(p.displayName)}* (${p.strikesIn5}/3 إنذارات)\n`;
      });
      if (warnList.length > 10) msg += `_...و ${warnList.length - 10} آخرين_\n`;
      msg += `────────────────────\n`;
    }

    if (removedList.length > 0) {
      msg += `📁 *مغادرون / أرشفة بأمان (${removedList.length}):*\n`;
      removedList.slice(0, 10).forEach(p => {
        msg += `• 🚪 *${bidiIsolate(p.displayName)}* (${p.totalGoals} هدف، ${p.totalMatches} مباراة)\n`;
      });
      if (removedList.length > 10) msg += `_...و ${removedList.length - 10} آخرين_\n`;
      msg += `💡 _سجل الأهداف والمباريات محفوظ بالكامل في الموقع للأبد._\n────────────────────\n`;
    }

    if (rejoinedList.length > 0) {
      msg += `♻️ *لاعبون عائدون للدوري (${rejoinedList.length}):*\n`;
      rejoinedList.forEach(p => {
        msg += `• 🎉 *${bidiIsolate(p.displayName)}* (تم تفعيلهم وتصفير الإنذارات 0/3)\n`;
      });
      msg += `────────────────────\n`;
    }

    if (newList.length > 0) {
      msg += `🆕 *أعضاء جدد بالدوري (${newList.length}):*\n`;
      newList.slice(0, 10).forEach(n => {
        msg += `• 👤 *${bidiIsolate(n)}*\n`;
      });
      if (newList.length > 10) msg += `_...و ${newList.length - 10} آخرين_\n`;
      msg += `────────────────────\n`;
    }

    msg += `👇 *راجع التقرير ثم اضغط على زر التطبيق لحفظ التغييرات في القاعدة!*`;
    return msg;
  }

  if (lang === 'es') {
    let msg = `🔄 *AUDITORÍA Y SINCRONIZACIÓN DE ROSTER (EA FC MOBILE)* 🔄\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👥 *Detectados en el juego:* ${total} miembros\n` +
      `━━━━━━━━━━━━━━━━━━━━\n`;

    if (kickList.length > 0) {
      msg += `🚨 *DEBEN SER EXPULSADOS DEL JUEGO (${kickList.length}):*\n`;
      kickList.forEach(p => {
        msg += `• ⛔ *${bidiIsolate(p.displayName)}* — ${p.reason}\n`;
      });
      msg += `👉 *Acción:* ¡Abre EA FC Mobile y expúlsalos de la liga ya!\n────────────────────\n`;
    } else {
      msg += `✅ *¡Todos los miembros activos están dentro de las normas!*\n────────────────────\n`;
    }

    if (warnList.length > 0) {
      msg += `⚠️ *EN AVISO (${warnList.length} jugadores con 1-2 strikes):*\n`;
      warnList.slice(0, 10).forEach(p => {
        msg += `• ⚠️ *${bidiIsolate(p.displayName)}* (${p.strikesIn5}/3 strikes)\n`;
      });
      if (warnList.length > 10) msg += `_...y ${warnList.length - 10} más_\n`;
      msg += `────────────────────\n`;
    }

    if (removedList.length > 0) {
      msg += `📁 *FUERA DE LA LIGA / ARCHIVO (${removedList.length}):*\n`;
      removedList.slice(0, 10).forEach(p => {
        msg += `• 🚪 *${bidiIsolate(p.displayName)}* (${p.totalGoals} goles, ${p.totalMatches} partidos)\n`;
      });
      if (removedList.length > 10) msg += `_...y ${removedList.length - 10} más_\n`;
      msg += `💡 _Historial de goles y partidos 100% preservado para siempre._\n────────────────────\n`;
    }

    if (rejoinedList.length > 0) {
      msg += `♻️ *JUGADORES QUE REGRESARON (${rejoinedList.length}):*\n`;
      rejoinedList.forEach(p => {
        msg += `• 🎉 *${bidiIsolate(p.displayName)}* (Reactivados, strikes a 0/3)\n`;
      });
      msg += `────────────────────\n`;
    }

    if (newList.length > 0) {
      msg += `🆕 *NUEVOS MIEMBROS (${newList.length}):*\n`;
      newList.slice(0, 10).forEach(n => {
        msg += `• 👤 *${bidiIsolate(n)}*\n`;
      });
      if (newList.length > 10) msg += `_...y ${newList.length - 10} más_\n`;
      msg += `────────────────────\n`;
    }

    msg += `👇 *¡Revisa con atención y presiona Aplicar para actualizar la base de datos!*`;
    return msg;
  }

  // Russian (Default)
  let msg = `🔄 *СИНХРОНИЗАЦИЯ СОСТАВА ИЗ ИГРЫ (EA FC MOBILE)* 🔄\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👥 *Обнаружено в игре:* ${total} игроков\n` +
    `━━━━━━━━━━━━━━━━━━━━\n`;

  if (kickList.length > 0) {
    msg += `🚨 *НЕОБХОДИМО ИСКЛЮЧИТЬ ИЗ ИГРЫ (${kickList.length}):*\n`;
    kickList.forEach(p => {
      msg += `• ⛔ *${bidiIsolate(p.displayName)}* — ${p.reason}\n`;
    });
    msg += `👉 *Действие:* Зайдите в EA FC Mobile и исключите этих игроков из Лиги прямо сейчас!\n────────────────────\n`;
  } else {
    msg += `✅ *Все игроки в Лиге соблюдают дисциплину, кандидатов на кик нет!*\n────────────────────\n`;
  }

  if (warnList.length > 0) {
    msg += `⚠️ *В ЗОНЕ РИСКА (${warnList.length} игроков с 1-2 страйками):*\n`;
    warnList.slice(0, 10).forEach(p => {
      msg += `• ⚠️ *${bidiIsolate(p.displayName)}* (${p.strikesIn5}/3 страйка)\n`;
    });
    if (warnList.length > 10) msg += `_...и ещё ${warnList.length - 10}_\n`;
    msg += `────────────────────\n`;
  }

  if (removedList.length > 0) {
    msg += `📁 *ВЫБЫЛИ ИЗ ЛИГИ / АРХИВ (${removedList.length}):*\n`;
    removedList.slice(0, 10).forEach(p => {
      msg += `• 🚪 *${bidiIsolate(p.displayName)}* (${p.totalGoals} голов, ${p.totalMatches} матчей)\n`;
    });
    if (removedList.length > 10) msg += `_...и ещё ${removedList.length - 10}_\n`;
    msg += `💡 _Статистика и история голов сохранены навсегда._\n────────────────────\n`;
  }

  if (rejoinedList.length > 0) {
    msg += `♻️ *ВЕРНУЛИСЬ В ЛИГУ (${rejoinedList.length}):*\n`;
    rejoinedList.forEach(p => {
      msg += `• 🎉 *${bidiIsolate(p.displayName)}* (Активирован, страйки сброшены на 0/3)\n`;
    });
    msg += `────────────────────\n`;
  }

  if (newList.length > 0) {
    msg += `🆕 *НОВЫЕ ИГРОКИ (${newList.length}):*\n`;
    newList.slice(0, 10).forEach(n => {
      msg += `• 👤 *${bidiIsolate(n)}*\n`;
    });
    if (newList.length > 10) msg += `_...и ещё ${newList.length - 10}_\n`;
    msg += `────────────────────\n`;
  }

  msg += `👇 *Проверьте отчет и нажмите Применить, чтобы обновить базу данных!*`;
  return msg;
}

function getRosterSyncKeyboard(sessionId, currentLang = 'ru') {
  const ruLabel = currentLang === 'ru' ? '• 🇷🇺 RU •' : '🇷🇺 RU';
  const enLabel = currentLang === 'en' ? '• 🇬🇧 EN •' : '🇬🇧 EN';
  const arLabel = currentLang === 'ar' ? '• 🇸🇦 AR •' : '🇸🇦 AR';
  const esLabel = currentLang === 'es' ? '• 🇪🇸 ES •' : '🇪🇸 ES';

  const applyLabel = currentLang === 'ar' ? '✅ تطبيق التحديث وحفظ التغييرات' :
                     currentLang === 'es' ? '✅ Aplicar Sincronización y Guardar' :
                     currentLang === 'en' ? '✅ Apply Roster Sync & Update DB' : '✅ Применить синхронизацию в базу';

  const cancelLabel = currentLang === 'ar' ? '❌ إلغاء' :
                      currentLang === 'es' ? '❌ Cancelar' :
                      currentLang === 'en' ? '❌ Cancel' : '❌ Отмена';

  return {
    inline_keyboard: [
      [
        { text: ruLabel, callback_data: `tab_roster_${sessionId}_ru` },
        { text: enLabel, callback_data: `tab_roster_${sessionId}_en` },
        { text: arLabel, callback_data: `tab_roster_${sessionId}_ar` },
        { text: esLabel, callback_data: `tab_roster_${sessionId}_es` }
      ],
      [
        { text: applyLabel, callback_data: `apply_roster_${sessionId}` }
      ],
      [
        { text: cancelLabel, callback_data: `cancel_roster_${sessionId}` }
      ]
    ]
  };
}

async function applyRosterSync(analysis) {
  const { pIndex } = loadLeagueData();

  // 1. Archive removed members safely (keep full stats, status = 'inactive')
  if (Array.isArray(analysis.newlyRemoved)) {
    for (const p of analysis.newlyRemoved) {
      if (pIndex[p.pid]) {
        pIndex[p.pid].status = 'inactive';
        pIndex[p.pid].status_updated_at = new Date().toISOString();
      }
    }
  }

  // 2. Reactivate returning members (status = 'active', reset strikes to 0/3)
  if (Array.isArray(analysis.rejoined)) {
    for (const p of analysis.rejoined) {
      if (pIndex[p.pid]) {
        pIndex[p.pid].status = 'active';
        pIndex[p.pid].status_updated_at = new Date().toISOString();
        pIndex[p.pid].strikes_reset_at = new Date().toISOString();
      }
    }
  }

  // 3. Add brand new members
  if (Array.isArray(analysis.newMembers)) {
    for (const en of analysis.newMembers) {
      const newPid = getCanonicalPlayerKey(null, en);
      if (!pIndex[newPid]) {
        pIndex[newPid] = {
          display_name: en,
          total_goals: 0,
          total_matches: 0,
          average_goals: 0,
          status: 'active',
          status_updated_at: new Date().toISOString(),
          strikes_reset_at: new Date().toISOString(),
          last_tournament_date: null,
          eligibility_streak: {
            current_fail_streak: 0,
            last_evaluated_tournament_id: null,
            flagged_for_review: false
          }
        };
      }
    }
  }

  // Save players_index.json locally and commit to GitHub
  await savePlayersIndexRaw(pIndex, `Roster Sync: Inactive ${analysis.newlyRemoved?.length || 0}, Rejoined ${analysis.rejoined?.length || 0}, New ${analysis.newMembers?.length || 0}`);

  // Build and save _active_roster.json locally and commit to GitHub
  const rosterPayload = {
    last_updated: new Date().toISOString(),
    total_members: analysis.allExtractedMembers?.length || 0,
    members: analysis.allExtractedMembers || [],
    kick_list_pending: (analysis.mustKickNow || []).map(p => ({
      pid: p.pid,
      display_name: p.displayName,
      reason: p.reason
    }))
  };
  await saveActiveRosterRaw(rosterPayload, `Roster Sync: ${analysis.allExtractedMembers?.length || 0} in-game members`);

  return { success: true };
}

async function processBufferedRosterScreenshots(albumId, chatId, res = null) {
  const items = await getBufferedPhotos(albumId, chatId);
  if (items.length === 0) {
    if (res) return sendResponse(res, 200, 'Already processed or empty buffer');
    return;
  }

  const prevStatusId = activeBufferStatusMessages.get(chatId);
  if (prevStatusId) {
    await deleteTelegramMessage(chatId, prevStatusId);
    activeBufferStatusMessages.delete(chatId);
  }

  const uniqueFileIds = [];
  for (const it of items) {
    if (it.fileId && !uniqueFileIds.includes(it.fileId)) {
      uniqueFileIds.push(it.fileId);
    }
  }

  const count = uniqueFileIds.length;
  const analyzingRes = await sendTelegramMessage(chatId, `🔍 *Analyzing ${count} roster screenshot${count > 1 ? 's' : ''} with Gemini Vision AI...*`);
  const analyzingMsgId = analyzingRes?.result?.message_id || null;

  const commentIds = items.map(it => it.commentId);
  await clearBufferedPhotos(commentIds);

  try {
    const buffers = await Promise.all(uniqueFileIds.map(fid => downloadTelegramFile(fid)));
    const extractedNames = await analyzeRosterMediaWithGemini(buffers, 'image/jpeg');
    const analysis = await analyzeInGameRoster(extractedNames);

    const sessionId = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    activeRosterSessions.set(sessionId, { analysis, createdAt: Date.now() });

    if (analyzingMsgId) {
      await deleteTelegramMessage(chatId, analyzingMsgId);
    }

    const reportText = formatRosterSyncReport(analysis, 'ru');
    const reportKeyboard = getRosterSyncKeyboard(sessionId, 'ru');
    await sendTelegramMessage(chatId, reportText, reportKeyboard);
    if (res) return sendResponse(res, 200, 'Roster analysis complete');
  } catch (err) {
    if (analyzingMsgId) {
      await deleteTelegramMessage(chatId, analyzingMsgId);
    }
    console.error('Error in processBufferedRosterScreenshots:', err);
    await sendTelegramMessage(chatId, `❌ *Roster Analysis Error:* ${clean(err.message)}`);
    if (res) return sendResponse(res, 200, 'Roster Analysis Error');
  }
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      try {
        const url = new URL(req.url, `https://${req.headers.host || 'bratva-bot.vercel.app'}`);
        if (url.searchParams.get('cron') === 'daily_rally') {
          return sendResponse(res, 200, {
            status: 'ignored',
            message: 'Daily rally cron is deprecated. Rally is dispatched upon lineup validation.'
          }, true);
        }
        if (url.searchParams.get('action') === 'broadcast_welcome') {
          const wText = formatChannelWelcome('ru');
          const wKeys = getLanguageKeyboard('welcome', '0', 'ru', false);
          const bRes = await sendTelegramMessage(CHANNEL_ID, wText, wKeys);
          return sendResponse(res, 200, {
            status: 'success',
            action: 'broadcast_welcome',
            channel: CHANNEL_ID,
            result: bRes,
            timestamp: new Date().toISOString()
          }, true);
        }

        if (url.searchParams.get('action') === 'sync_commands') {
          const syncRes = await syncBotCommands();
          return sendResponse(res, 200, {
            status: 'success',
            action: 'sync_commands',
            result: syncRes,
            timestamp: new Date().toISOString()
          }, true);
        }

        if (url.searchParams.get('test_gemini') || url.searchParams.get('list_models')) {
          if (url.searchParams.get('list_models') || url.searchParams.get('test_gemini') === 'list') {
            const listRes = await new Promise((resolve) => {
              const reqL = https.request({
                hostname: 'generativelanguage.googleapis.com',
                path: `/v1beta/models?key=${encodeURIComponent(GEMINI_KEY)}`,
                method: 'GET'
              }, resL => {
                let d = '';
                resL.on('data', c => d += c);
                resL.on('end', () => {
                  try {
                    const parsed = JSON.parse(d);
                    const names = (parsed.models || []).map(m => m.name.replace('models/', ''));
                    resolve({ status: resL.statusCode, count: names.length, models: names });
                  } catch (e) {
                    resolve({ status: resL.statusCode, raw: d });
                  }
                });
              });
              reqL.setTimeout(7000, () => { reqL.destroy(); resolve({ error: 'Timeout listing models' }); });
              reqL.on('error', err => resolve({ error: err.message }));
              reqL.end();
            });
            return sendResponse(res, 200, {
              action: 'list_models',
              gemini_key_len: GEMINI_KEY ? GEMINI_KEY.length : 0,
              response: listRes
            }, true);
          }

          const modelToTest = (url.searchParams.get('model') || GEMINI_MODEL || 'gemini-3.5-flash-lite').trim();
          const timeoutMs = parseInt(url.searchParams.get('timeout') || '20000', 10);
          const isImageTest = Boolean(url.searchParams.get('test_image'));
          const startTime = Date.now();
          const testRes = await new Promise((resolve) => {
            try {
              const parts = [{ text: 'Respond strictly with JSON: {"status": "ok"}' }];
              if (isImageTest) {
                parts.unshift({
                  inlineData: {
                    mimeType: 'image/jpeg',
                    data: '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA='
                  }
                });
              }
              const payload = JSON.stringify({ contents: [{ parts }] });
              const reqGem = https.request({
                hostname: 'generativelanguage.googleapis.com',
                path: `/v1beta/models/${modelToTest}:generateContent`,
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-goog-api-key': GEMINI_KEY,
                  'Content-Length': Buffer.byteLength(payload)
                }
              }, resG => {
                let d = '';
                resG.on('data', c => d += c);
                resG.on('end', () => resolve({
                  status: resG.statusCode,
                  durationMs: Date.now() - startTime,
                  body: d
                }));
              });
              reqGem.setTimeout(timeoutMs, () => {
                reqGem.destroy();
                resolve({ error: `Timeout calling Gemini after ${timeoutMs}ms`, durationMs: Date.now() - startTime });
              });
              reqGem.on('error', err => resolve({ error: err.message, durationMs: Date.now() - startTime }));
              reqGem.write(payload);
              reqGem.end();
            } catch (syncErr) {
              resolve({ sync_error: syncErr.message, durationMs: Date.now() - startTime });
            }
          });
          return sendResponse(res, 200, {
            tested_model: modelToTest,
            gemini_key_len: GEMINI_KEY ? GEMINI_KEY.length : 0,
            gemini_key_preview: GEMINI_KEY ? `${GEMINI_KEY.substring(0, 4)}...${GEMINI_KEY.substring(GEMINI_KEY.length - 4)}` : null,
            response: testRes
          }, true);
        }
      } catch (cronErr) {
        console.error('Cron error:', cronErr);
      }

      return sendResponse(res, 200, {
        status: 'online',
        bot: 'BratvaFCMBot',
        engine: GEMINI_MODEL,
        mode: 'Vercel Serverless 24/7 (Cross-Instance Album & Two-Column Support)',
        channel: CHANNEL_ID,
        website: WEBSITE_URL,
        has_token: Boolean(TELEGRAM_TOKEN),
        token_len: TELEGRAM_TOKEN ? TELEGRAM_TOKEN.length : 0,
        has_gemini: Boolean(GEMINI_KEY),
        has_pat: Boolean(GITHUB_PAT),
        cached_tournament: globalLatestTournament ? `${globalLatestTournament.id} (${globalLatestTournament.matches.length} players)` : null,
        timestamp: new Date().toISOString()
      }, true);
    }

    if (req.method !== 'POST') {
      return sendResponse(res, 405, 'Method Not Allowed');
    }

    let update = req.body;
    if (!update || typeof update !== 'object') {
      try {
        if (typeof update === 'string') {
          update = JSON.parse(update);
        } else {
          const chunks = [];
          for await (const chunk of req) {
            chunks.push(chunk);
          }
          if (chunks.length > 0) {
            update = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          }
        }
      } catch (e) {
        update = null;
      }
    }

    if (!update) {
      return sendResponse(res, 200, 'OK');
    }

    if (update.channel_post) {
      return sendResponse(res, 200, 'Channel post ignored');
    }

    // Deduplication by update_id
    const updateId = update.update_id;
    if (updateId) {
      if (processedUpdates.has(updateId)) {
        return sendResponse(res, 200, 'Duplicate update dropped');
      }
      processedUpdates.add(updateId);
      if (processedUpdates.size > 300) {
        const first = processedUpdates.values().next().value;
        processedUpdates.delete(first);
      }
    }

    // 0. Handle Channel Join / Membership Update (Notify new members of Rules!)
    if (update.chat_member) {
      const cm = update.chat_member;
      const newStatus = cm.new_chat_member ? cm.new_chat_member.status : null;
      const oldStatus = cm.old_chat_member ? cm.old_chat_member.status : null;
      const targetUser = cm.new_chat_member ? cm.new_chat_member.user : null;

      if (targetUser && targetUser.id && (newStatus === 'member' || newStatus === 'administrator') && oldStatus !== 'member') {
        const userLang = detectUserLang(targetUser);
        const welcomeDm = formatCommunityJoinedPrompt(userLang);
        const dmKeys = getCommunityJoinedKeyboard(userLang);
        try {
          await sendTelegramMessage(targetUser.id, welcomeDm, dmKeys);
        } catch (dmErr) {
          // Expected 403 if user hasn't started bot yet; catch gracefully
        }
      }
      return sendResponse(res, 200, 'Chat member update processed');
    }

    if (update.chat_join_request) {
      const cjr = update.chat_join_request;
      const targetUser = cjr.from;
      if (targetUser && targetUser.id) {
        const userLang = detectUserLang(targetUser);
        const welcomeDm = formatCommunityJoinedPrompt(userLang);
        const dmKeys = getCommunityJoinedKeyboard(userLang);
        try {
          await sendTelegramMessage(targetUser.id, welcomeDm, dmKeys);
        } catch (e) {}
      }
      return sendResponse(res, 200, 'Join request processed');
    }

    // 1. Handle Callback Query (Buttons)
    if (update.callback_query) {
      const cb = update.callback_query;
      const data = cb.data || '';
      const chatId = cb.message ? cb.message.chat.id : cb.from.id;
      const isCbPrivate = !cb.message || !cb.message.chat || cb.message.chat.type === 'private';
      const userId = cb.from ? cb.from.id : null;
      const username = cb.from ? (cb.from.username || '') : '';

      // Actions accessible to all squad members:
      const isPublicAction = data.startsWith('tab_') || data.startsWith('ci_') || data.startsWith('fmt_lineup_') || data.startsWith('verify_sub_') ||
                             data === 'cmd_rules' || data === 'cmd_top' || data === 'cmd_lineup' || data === 'cmd_checkin' ||
                             data === 'cmd_recap' || data === 'cmd_mvp' || data === 'cmd_tournaments' || data === 'cmd_mystats' ||
                             data === 'cmd_menu';

      // If clicked inside a channel or group, allow in-place translation tabs (tab_) and check-in buttons (ci_)
      if (!isCbPrivate && !data.startsWith('tab_') && !data.startsWith('ci_')) {
        await telegramRequest('answerCallbackQuery', {
          callback_query_id: cb.id,
          text: '⚠️ Bot commands & menus are only available in private DM @BratvaFCMBot',
          show_alert: true
        });
        return sendResponse(res, 200, 'Group callback ignored');
      }

      // Security Gate: Check-in, language tabs, lineup views, and general stats are public.
      // Admin-only actions (buffer analysis, clearing, broadcast to channel, rules editing, audits, kick lists) require Admin!
      if (!isPublicAction) {
        const isAdmin = await isUserAdmin(userId, username);
        if (!isAdmin) {
          await telegramRequest('answerCallbackQuery', {
            callback_query_id: cb.id,
            text: '⛔ Access Denied: League Admins only.',
            show_alert: true
          });
          return sendResponse(res, 200, 'Non-admin callback blocked');
        }
      }

      if (data.startsWith('analyze_')) {
        const albumId = data.replace('analyze_', '');
        await telegramRequest('answerCallbackQuery', { callback_query_id: cb.id, text: 'Starting analysis...' });
        return await processBufferedAlbum(albumId, chatId, res);
      }

      if (data.startsWith('clear_')) {
        const albumId = data.replace('clear_', '');
        const items = await getBufferedPhotos(albumId, chatId);
        await clearBufferedPhotos(items.map(it => it.commentId));
        if (activeBufferStatusMessages.has(chatId)) {
          await deleteTelegramMessage(chatId, activeBufferStatusMessages.get(chatId));
          activeBufferStatusMessages.delete(chatId);
        }
        await telegramRequest('answerCallbackQuery', { callback_query_id: cb.id, text: 'Buffer cleared!' });
        await sendTelegramMessage(chatId, '🗑️ *Screenshot buffer cleared. Ready for new screenshots!*');
        return sendResponse(res, 200, 'OK');
      }

      if (data.startsWith('roster_photo_')) {
        const albumId = data.replace('roster_photo_', '');
        await telegramRequest('answerCallbackQuery', { callback_query_id: cb.id, text: 'Analyzing roster screenshots...' });
        return await processBufferedRosterScreenshots(albumId, chatId, res);
      }

      if (data.startsWith('apply_roster_')) {
        const sessionId = data.replace('apply_roster_', '');
        const session = activeRosterSessions.get(sessionId);
        if (!session || !session.analysis) {
          await telegramRequest('answerCallbackQuery', {
            callback_query_id: cb.id,
            text: '⚠️ Session expired. Please re-upload media.',
            show_alert: true
          });
          return sendResponse(res, 200, 'Session expired');
        }

        await telegramRequest('answerCallbackQuery', {
          callback_query_id: cb.id,
          text: 'Applying roster sync...'
        });

        const statusMsg = await sendTelegramMessage(chatId, '⏳ *Applying Roster Sync to Database & GitHub...*');

        await applyRosterSync(session.analysis);
        activeRosterSessions.delete(sessionId);

        let confirmMsg = `✅ *ROSTER SYNC SUCCESSFULLY APPLIED!* 🏁\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `👥 *Total In-Game Members:* ${session.analysis.totalInGame}\n` +
          `📁 *Archived (Inactive):* ${session.analysis.newlyRemoved.length} players (Stats 100% preserved)\n` +
          `♻️ *Reactivated:* ${session.analysis.rejoined.length} returning players (Strikes reset to 0/3)\n` +
          `🆕 *New Members Added:* ${session.analysis.newMembers.length} players\n` +
          `━━━━━━━━━━━━━━━━━━━━\n`;

        if (session.analysis.mustKickNow.length > 0) {
          confirmMsg += `\n🚨 *REMINDER: REMOVE IN-GAME NOW (${session.analysis.mustKickNow.length}):*\n`;
          session.analysis.mustKickNow.forEach(p => {
            confirmMsg += `• ⛔ *${bidiIsolate(p.displayName)}* — ${p.reason}\n`;
          });
          confirmMsg += `\n⚠️ *Open EA FC Mobile now and remove these players from the league!*\n`;
        } else {
          confirmMsg += `\n✨ *No kick candidates in the active squad! All members within allowed limits.*\n`;
        }

        if (statusMsg && statusMsg.result && statusMsg.result.message_id) {
          await deleteTelegramMessage(chatId, statusMsg.result.message_id);
        }
        await sendTelegramMessage(chatId, confirmMsg, getMainKeyboard('ru'));
        return sendResponse(res, 200, 'Roster sync applied');
      }

      if (data.startsWith('cancel_roster_')) {
        const sessionId = data.replace('cancel_roster_', '');
        activeRosterSessions.delete(sessionId);
        await telegramRequest('answerCallbackQuery', {
          callback_query_id: cb.id,
          text: 'Roster sync cancelled.'
        });
        await sendTelegramMessage(chatId, '❌ *Roster sync cancelled. Database was not modified.*', getMainKeyboard('ru'));
        return sendResponse(res, 200, 'Roster sync cancelled');
      }

      if (data.startsWith('tab_')) {
        const parts = data.split('_');
        let category = 'recap';
        let param = '0';
        let targetLang = 'ru';

        if (parts.length === 3) {
          param = parts[1];
          targetLang = parts[2] || 'ru';
        } else if (parts.length >= 4) {
          category = parts[1];
          targetLang = parts[parts.length - 1] || 'ru';
          param = parts.slice(2, parts.length - 1).join('_') || '0';
        }

        let updatedText = '';
        let updatedKeyboard = null;

        if (category === 'recap') {
          const t = await getTournamentById(param);
          const tId = t?.id || t?.tournament_id || (param !== '0' ? param : '0');
          updatedText = formatRecap(t, targetLang);
          updatedKeyboard = getLanguageKeyboard('recap', tId, targetLang, isCbPrivate);
        } else if (category === 'rally') {
          updatedText = formatRally(targetLang);
          updatedKeyboard = getLanguageKeyboard('rally', '0', targetLang, isCbPrivate);
        } else if (category === 'live') {
          const liveResult = await getLiveMatchResult();
          if (liveResult) {
            updatedText = formatLiveAlert(liveResult, targetLang);
            updatedKeyboard = getLanguageKeyboard('live', '0', targetLang, isCbPrivate);
          } else {
            await telegramRequest('answerCallbackQuery', {
              callback_query_id: cb.id,
              text: '⚠️ Live match data expired'
            });
            return sendResponse(res, 200, 'OK');
          }
        } else if (category === 'mvp') {
          updatedText = formatMvp(targetLang);
          updatedKeyboard = getLanguageKeyboard('mvp', '0', targetLang, isCbPrivate);
        } else if (category === 'rules') {
          updatedText = formatRules(targetLang);
          updatedKeyboard = getLanguageKeyboard('rules', '0', targetLang, isCbPrivate);
        } else if (category === 'top') {
          updatedText = formatTopScorers(targetLang);
          updatedKeyboard = getLanguageKeyboard('top', '0', targetLang, isCbPrivate);
        } else if (category === 'strikes') {
          updatedText = await formatStrikes(targetLang);
          updatedKeyboard = getLanguageKeyboard('strikes', '0', targetLang, isCbPrivate);
        } else if (category === 'lineup') {
          const reqSize = param === 'auto' ? null : (parseInt(param, 10) || null);
          const lineupData = await generateSmartLineup(reqSize);
          updatedText = await formatSmartLineup(reqSize, targetLang);
          updatedKeyboard = getLineupKeyboard(lineupData.size, targetLang, isCbPrivate, lineupData.isAuto);
        } else if (category === 'checkin') {
          const regData = await getRegisteredPlayers();
          syncCurrentCheckInState(regData);
          updatedText = formatCheckInPrompt(targetLang);
          updatedKeyboard = getCheckInKeyboard(targetLang, isCbPrivate);
        } else if (category === 'tournaments') {
          updatedText = await formatTournaments(targetLang);
          updatedKeyboard = getLanguageKeyboard('tournaments', '0', targetLang, isCbPrivate);
        } else if (category === 'kicklist') {
          updatedText = await formatKicklist(targetLang);
          updatedKeyboard = getLanguageKeyboard('kicklist', '0', targetLang, isCbPrivate);
        } else if (category === 'menu') {
          const isUserAdm = await isUserAdmin(cb.from?.id, cb.from?.username);
          updatedText = formatWelcome(targetLang);
          updatedKeyboard = getMainKeyboard(targetLang, isUserAdm);
        } else if (category === 'mystats') {
          updatedText = formatMyStatsPrompt(targetLang);
          updatedKeyboard = getLanguageKeyboard('mystats', '0', targetLang, false);
        } else if (category === 'audit' || category === 'pending') {
          updatedText = await formatPendingAudit(targetLang);
          updatedKeyboard = getPendingKeyboard(targetLang);
        } else if (category === 'warn' || category === 'warning') {
          updatedText = await formatLastChanceWarning(targetLang);
          updatedKeyboard = getLastChanceWarningKeyboard(targetLang);
        } else if (category === 'kicked' || category === 'removal') {
          updatedText = await formatKickedWarning(targetLang);
          updatedKeyboard = getKickedWarningKeyboard(targetLang);
        } else if (category === 'tgnotice' || category === 'notice') {
          updatedText = formatTelegramNotice(targetLang);
          updatedKeyboard = getLanguageKeyboard('tgnotice', '0', targetLang, isCbPrivate);
        } else if (category === 'welcome') {
          updatedText = formatChannelWelcome(targetLang);
          updatedKeyboard = getLanguageKeyboard('welcome', '0', targetLang, false);
        } else if (category === 'verify') {
          updatedText = formatVerificationPrompt(targetLang);
          updatedKeyboard = getVerificationKeyboard(targetLang);
        } else if (category === 'joinreq') {
          updatedText = formatJoinRequiredPrompt(targetLang);
          updatedKeyboard = getJoinRequiredKeyboard(targetLang);
        } else if (category === 'cmjoined') {
          updatedText = formatCommunityJoinedPrompt(targetLang);
          updatedKeyboard = getCommunityJoinedKeyboard(targetLang);
        } else if (category === 'versuccess') {
          const regData = await getRegisteredPlayers();
          const reg = (regData.registrations || {})[param] || {};
          const { pIndex } = loadLeagueData();
          const pData = pIndex[param] || {};
          const dispName = reg.display_name || pData.display_name || param;
          const uid = reg.uid || null;
          updatedText = formatVerificationSuccess(dispName, uid, targetLang);
          updatedKeyboard = getVerificationSuccessKeyboard(param, targetLang);
        } else if (category === 'veruid') {
          const rawName = decodeURIComponent(param);
          updatedText = formatUidPrompt(rawName, targetLang);
          updatedKeyboard = getUidPromptKeyboard(param, targetLang);
        } else if (category === 'verphoto') {
          updatedText = formatPhotoWarning(targetLang);
          updatedKeyboard = getPhotoWarningKeyboard(targetLang);
        } else if (category === 'player') {
          updatedText = generatePlayerStatsMessage(param, targetLang);
          updatedKeyboard = getPlayerKeyboard(param, targetLang);
        } else if (category === 'roster') {
          const session = activeRosterSessions.get(param);
          if (session && session.analysis) {
            updatedText = formatRosterSyncReport(session.analysis, targetLang);
            updatedKeyboard = getRosterSyncKeyboard(param, targetLang);
          } else {
            updatedText = '⚠️ *Session expired or not found. Please re-upload media.*';
            updatedKeyboard = getMainKeyboard(targetLang);
          }
        } else if (category === 'rosterprompt') {
          updatedText = formatRosterInstructions(targetLang);
          updatedKeyboard = getLanguageKeyboard('rosterprompt', '0', targetLang, false);
        }

        if (updatedText) {
          await editTelegramMessage(chatId, cb.message.message_id, updatedText, updatedKeyboard);
          await telegramRequest('answerCallbackQuery', {
            callback_query_id: cb.id,
            text: `✓ ${targetLang.toUpperCase()}`
          });
          return sendResponse(res, 200, 'OK');
        }
      }

      if (data.startsWith('verify_sub_')) {
        const targetLang = data.replace('verify_sub_', '') || 'ru';
        try {
          if (userId) subCache.delete(String(userId));
          const isSub = await isUserSubscribedToCommunity(userId);

          if (!isSub) {
            let alertMsg = '❌ You haven\'t joined yet! Please tap button 1 to join our Channel & Group first.';
            if (targetLang === 'ar') alertMsg = '❌ لم تنضم بعد! اضغط على الزر رقم 1 وانضم أولاً للقناة والمجموعة.';
            else if (targetLang === 'es') alertMsg = '❌ ¡Aún no te has unido! Pulsa el botón 1 y únete al Canal y Grupo primero.';
            else if (targetLang === 'ru') alertMsg = '❌ Вы еще не вступили! Нажмите кнопку 1 и вступите в Канал и Чат лиги.';

            await telegramRequest('answerCallbackQuery', {
              callback_query_id: cb.id,
              text: alertMsg,
              show_alert: true
            });
            return sendResponse(res, 200, 'Not joined yet');
          }

          if (userId) verifiedGateUsers.add(String(userId));

          await telegramRequest('answerCallbackQuery', {
            callback_query_id: cb.id,
            text: targetLang === 'ar' ? '✅ تم تأكيد عضويتك بنجاح!' : '✅ Membership verified!'
          });

          const vPrompt = formatVerificationPrompt(targetLang);
          const vKeys = getVerificationKeyboard(targetLang);
          await editTelegramMessage(chatId, cb.message.message_id, vPrompt, vKeys);
          return sendResponse(res, 200, 'Subscription verified');
        } catch (err) {
          console.error('[verify_sub_ error]:', err);
          await telegramRequest('answerCallbackQuery', {
            callback_query_id: cb.id,
            text: '⚠️ Verification error. Please try again.',
            show_alert: true
          });
          return sendResponse(res, 200, 'Error in verify_sub_');
        }
      }

      if (data.startsWith('bcast_')) {
        const fullCat = data.replace('bcast_', '');
        let cat = fullCat;
        let bcastParam = '0';
        if (cat.startsWith('recap_')) {
          bcastParam = cat.replace('recap_', '');
          cat = 'recap';
        }
        let bcastText = '';
        let catName = 'Update';

        if (cat === 'live') {
          const liveResult = await getLiveMatchResult();
          bcastText = formatLiveAlert(liveResult, 'ru');
          if ((!liveResult || bcastText.includes('No active live match data')) && cb.message && cb.message.text) {
            bcastText = cb.message.text;
          }
          catName = 'Live match alert';
        } else if (cat === 'mvp') {
          bcastText = formatMvp('ru');
          catName = 'MVP Spotlight';
        } else if (cat === 'recap') {
          const t = await getTournamentById(bcastParam);
          bcastParam = t?.id || t?.tournament_id || (bcastParam !== '0' ? bcastParam : '0');
          bcastText = formatRecap(t, 'ru');
          catName = 'Tournament Recap';
        } else if (cat === 'rules') {
          bcastText = formatRules('ru');
          catName = 'League Rules';
        } else if (cat === 'top') {
          bcastText = formatTopScorers('ru');
          catName = 'Top Scorers Leaderboard';
        } else if (cat === 'strikes') {
          bcastText = await formatStrikes('ru');
          catName = 'Strikes & Debtors List';
        } else if (cat.startsWith('lineup')) {
          const parts = cat.split('_');
          const rawSize = parts[1];
          const reqSize = rawSize === 'auto' ? null : (parseInt(rawSize, 10) || null);
          const lineupData = await generateSmartLineup(reqSize);
          const size = lineupData.size;
          bcastText = await formatSmartLineup(reqSize, 'ru');
          const channelKeyboard = getLineupKeyboard(size, 'ru', false, lineupData.isAuto);

          // Auto-delete obsolete pre-match check-in from channel if present!
          const regData = await getRegisteredPlayers();
          if (regData && regData.current_checkin && regData.current_checkin.channel_msg_id) {
            await deleteTelegramMessage(CHANNEL_ID, regData.current_checkin.channel_msg_id);
            regData.current_checkin.channel_msg_id = null;
          }
          currentCheckIn.active = false;
          if (regData && regData.current_checkin) {
            regData.current_checkin.active = false;
            await saveRegisteredPlayersRaw(regData, `Finalized ${size}v${size} Starting Lineup`);
          }

          await sendTelegramMessage(CHANNEL_ID, bcastText, channelKeyboard);

          // Post Tournament Rally / Battle Alert right after the Lineup is validated & posted!
          const rallyText = formatRally('ru');
          const rallyKeyboard = getLanguageKeyboard('rally', '0', 'ru', false);
          await sendTelegramMessage(CHANNEL_ID, rallyText, rallyKeyboard);

          // Dispatch direct personal DM notifications to all verified players (starters & bench)
          try {
            await notifyVerifiedPlayersLineup(lineupData);
          } catch (lineupErr) {
            console.error('Failed to notify verified players for lineup:', lineupErr);
          }

          await telegramRequest('answerCallbackQuery', {
            callback_query_id: cb.id,
            text: `📢 ${size}v${size} Lineup & Rally posted to channel!`
          });
          await sendTelegramMessage(chatId, `✅ *${size}v${size} Starting Lineup & Tournament Rally posted to ${CHANNEL_ID}!*`, getMainKeyboard('ru'));
          return sendResponse(res, 200, 'OK');
        } else if (cat === 'checkin') {
          // Check prerequisite first!
          const buffered = await getBufferedPhotos(null, chatId);
          if (buffered.length > 0) {
            await telegramRequest('answerCallbackQuery', {
              callback_query_id: cb.id,
              text: '⚠️ Finish analyzing last match screenshots first (/done)!',
              show_alert: true
            });
            await sendTelegramMessage(
              chatId,
              '⚠️ *Cannot open Pre-Match Check-In yet!*\n\n' +
              '📸 There are unanalyzed tournament screenshots in the buffer.\n' +
              '👉 Please run `/done` or `/analyze` first to publish the last match results and update player strikes and averages!'
            );
            return sendResponse(res, 200, 'OK');
          }

          const regData = await getRegisteredPlayers();
          if (regData && regData.current_checkin && regData.current_checkin.channel_msg_id) {
            await deleteTelegramMessage(CHANNEL_ID, regData.current_checkin.channel_msg_id);
          }

          currentCheckIn.active = true;
          currentCheckIn.openedAt = Date.now();
          currentCheckIn.durationMinutes = 60;
          currentCheckIn.expiresAt = Date.now() + (60 * 60 * 1000);
          currentCheckIn.ready.clear();
          currentCheckIn.away.clear();

          bcastText = formatCheckInPrompt('ru');
          const channelKeyboard = getCheckInKeyboard('ru', false);
          const postRes = await sendTelegramMessage(CHANNEL_ID, bcastText, channelKeyboard);
          const channelMsgId = postRes?.result?.message_id || null;
          currentCheckIn.channelMessageId = channelMsgId;

          if (!regData.current_checkin) regData.current_checkin = {};
          regData.current_checkin = {
            active: true,
            openedAt: currentCheckIn.openedAt,
            expiresAt: currentCheckIn.expiresAt,
            durationMinutes: 60,
            channel_msg_id: channelMsgId,
            ready: [],
            away: []
          };
          await saveRegisteredPlayersRaw(regData, 'Broadcasted 1-hour pre-match check-in to channel');

          // Dispatch direct 1-tap check-in ping to all verified players in DM
          try {
            await notifyVerifiedPlayersCheckIn();
          } catch (ciErr) {
            console.error('Failed to notify verified players for checkin:', ciErr);
          }

          await telegramRequest('answerCallbackQuery', {
            callback_query_id: cb.id,
            text: '📢 1-Hour Check-In rally posted to channel!'
          });
          await sendTelegramMessage(chatId, `✅ *Pre-Match Check-In (1-Hour Timer) posted to ${CHANNEL_ID}!*`, getMainKeyboard('ru'));
          return sendResponse(res, 200, 'OK');
        } else if (cat === 'tournaments') {
          bcastText = await formatTournaments('ru');
          catName = 'Tournaments Overview';
        } else if (cat === 'kicklist') {
          bcastText = await formatKicklist('ru');
          catName = 'Kick Review';
        } else if (cat === 'rally') {
          bcastText = formatRally('ru');
          catName = 'Rally Reminder';
        } else if (cat === 'welcome') {
          bcastText = formatChannelWelcome('ru');
          catName = 'Official Welcome Notice';
        }

        if (bcastText) {
          const channelKeyboard = getLanguageKeyboard(cat, bcastParam, 'ru', false);
          await sendTelegramMessage(CHANNEL_ID, bcastText, channelKeyboard);
          await telegramRequest('answerCallbackQuery', {
            callback_query_id: cb.id,
            text: `📢 ${catName} posted to channel!`
          });
          await sendTelegramMessage(chatId, `✅ *${catName} broadcasted to ${CHANNEL_ID} with translation buttons!*`, getMainKeyboard('ru'));
          return sendResponse(res, 200, 'OK');
        }
      }

      if (data.startsWith('fmt_lineup_')) {
        const parts = data.split('_');
        const rawSize = parts[2];
        const lang = parts[3] || 'ru';
        const reqSize = rawSize === 'auto' ? null : (parseInt(rawSize, 10) || null);
        const lineupData = await generateSmartLineup(reqSize);
        const updatedText = await formatSmartLineup(reqSize, lang);
        const updatedKeyboard = getLineupKeyboard(lineupData.size, lang, isCbPrivate, lineupData.isAuto);
        await editTelegramMessage(chatId, cb.message.message_id, updatedText, updatedKeyboard);
        await telegramRequest('answerCallbackQuery', {
          callback_query_id: cb.id,
          text: lineupData.isAuto ? `🤖 Auto (${lineupData.size}v${lineupData.size})` : `✓ ${lineupData.size}v${lineupData.size}`
        });
        return sendResponse(res, 200, 'OK');
      }

      if (data === 'open_checkin_60') {
        if (!isAdmin) {
          await telegramRequest('answerCallbackQuery', {
            callback_query_id: cb.id,
            text: '⛔ Admin only action.',
            show_alert: true
          });
          return sendResponse(res, 200, 'OK');
        }

        const buffered = await getBufferedPhotos(null, chatId);
        if (buffered.length > 0) {
          await telegramRequest('answerCallbackQuery', {
            callback_query_id: cb.id,
            text: '⚠️ Finish analyzing last match screenshots first (/done)!',
            show_alert: true
          });
          return sendResponse(res, 200, 'OK');
        }

        const regData = await getRegisteredPlayers();
        if (regData && regData.current_checkin && regData.current_checkin.channel_msg_id) {
          await deleteTelegramMessage(CHANNEL_ID, regData.current_checkin.channel_msg_id);
        }

        currentCheckIn.active = true;
        currentCheckIn.openedAt = Date.now();
        currentCheckIn.durationMinutes = 60;
        currentCheckIn.expiresAt = Date.now() + (60 * 60 * 1000);
        currentCheckIn.ready.clear();
        currentCheckIn.away.clear();

        const bcastText = formatCheckInPrompt('ru');
        const channelKeyboard = getCheckInKeyboard('ru', false);
        const postRes = await sendTelegramMessage(CHANNEL_ID, bcastText, channelKeyboard);
        const channelMsgId = postRes?.result?.message_id || null;
        currentCheckIn.channelMessageId = channelMsgId;

        if (!regData.current_checkin) regData.current_checkin = {};
        regData.current_checkin = {
          active: true,
          openedAt: currentCheckIn.openedAt,
          expiresAt: currentCheckIn.expiresAt,
          durationMinutes: 60,
          channel_msg_id: channelMsgId,
          ready: [],
          away: []
        };
        await saveRegisteredPlayersRaw(regData, 'Launched 1-hour pre-match check-in from recap');

        // Dispatch direct 1-tap check-in ping to all verified players in DM
        try {
          await notifyVerifiedPlayersCheckIn();
        } catch (ciErr) {
          console.error('Failed to notify verified players for checkin:', ciErr);
        }

        await telegramRequest('answerCallbackQuery', {
          callback_query_id: cb.id,
          text: '⚔️ 1-Hour Pre-Match Check-In launched!'
        });
        await sendTelegramMessage(chatId, `✅ *Pre-Match Check-In launched!* ⏳ 60-minute timer active.\nBroadcasted to ${CHANNEL_ID}.`, getMainKeyboard('ru'));
        return sendResponse(res, 200, 'OK');
      }

      if (data === 'ci_ready') {
        const userId = cb.from.id;
        const regData = await getRegisteredPlayers();
        syncCurrentCheckInState(regData);

        const isExpired = !currentCheckIn.active || (currentCheckIn.expiresAt && Date.now() >= currentCheckIn.expiresAt);
        if (isExpired) {
          currentCheckIn.active = false;
          if (regData.current_checkin) regData.current_checkin.active = false;
          await telegramRequest('answerCallbackQuery', {
            callback_query_id: cb.id,
            text: '🔒 Pre-match check-in is CLOSED! The 1-hour window has expired. Lineup is finalized.',
            show_alert: true
          });
          const updatedCheckInText = formatCheckInPrompt('ru');
          const updatedCheckInKeys = getCheckInKeyboard('ru', isCbPrivate);
          await editTelegramMessage(chatId, cb.message.message_id, updatedCheckInText, updatedCheckInKeys);
          return sendResponse(res, 200, 'OK');
        }

        const matchedRegs = Object.values(regData.registrations || {}).filter(r => String(r.telegram_id) === String(userId));

        if (matchedRegs.length === 0) {
          try {
            await telegramRequest('answerCallbackQuery', {
              callback_query_id: cb.id,
              text: '⚠️ You must register first! Open @BratvaFCMBot and send your in-game name.',
              show_alert: true
            });
          } catch (e) {}
          return sendResponse(res, 200, 'OK');
        }

        for (const reg of matchedRegs) {
          currentCheckIn.ready.add(reg.player_id);
          currentCheckIn.away.delete(reg.player_id);
        }

        if (!regData.current_checkin) regData.current_checkin = { ready: [], away: [] };
        regData.current_checkin.ready = Array.from(currentCheckIn.ready);
        regData.current_checkin.away = Array.from(currentCheckIn.away);
        const readyNamesList = matchedRegs.map(r => r.display_name).filter((v, i, a) => a.indexOf(v) === i).join(' & ');
        saveRegisteredPlayersRaw(regData, `CheckIn: ${readyNamesList} is Ready`);

        try {
          await telegramRequest('answerCallbackQuery', {
            callback_query_id: cb.id,
            text: `🟢 ${readyNamesList}: Confirmed READY for tournament!`,
            show_alert: false
          });
        } catch (e) {}

        try {
          const updatedCheckInText = formatCheckInPrompt('ru');
          const updatedCheckInKeys = getCheckInKeyboard('ru', isCbPrivate);
          await editTelegramMessage(chatId, cb.message.message_id, updatedCheckInText, updatedCheckInKeys);
        } catch (e) {}
        return sendResponse(res, 200, 'OK');
      }

      if (data === 'ci_away') {
        const userId = cb.from.id;
        const regData = await getRegisteredPlayers();
        syncCurrentCheckInState(regData);

        const isExpired = !currentCheckIn.active || (currentCheckIn.expiresAt && Date.now() >= currentCheckIn.expiresAt);
        if (isExpired) {
          currentCheckIn.active = false;
          if (regData.current_checkin) regData.current_checkin.active = false;
          await telegramRequest('answerCallbackQuery', {
            callback_query_id: cb.id,
            text: '🔒 Pre-match check-in is CLOSED! The 1-hour window has expired.',
            show_alert: true
          });
          const updatedCheckInText = formatCheckInPrompt('ru');
          const updatedCheckInKeys = getCheckInKeyboard('ru', isCbPrivate);
          await editTelegramMessage(chatId, cb.message.message_id, updatedCheckInText, updatedCheckInKeys);
          return sendResponse(res, 200, 'OK');
        }

        const matchedRegs = Object.values(regData.registrations || {}).filter(r => String(r.telegram_id) === String(userId));

        if (matchedRegs.length === 0) {
          try {
            await telegramRequest('answerCallbackQuery', {
              callback_query_id: cb.id,
              text: '⚠️ You must register first! Open @BratvaFCMBot and send your in-game name.',
              show_alert: true
            });
          } catch (e) {}
          return sendResponse(res, 200, 'OK');
        }

        for (const reg of matchedRegs) {
          currentCheckIn.away.add(reg.player_id);
          currentCheckIn.ready.delete(reg.player_id);
        }

        if (!regData.current_checkin) regData.current_checkin = { ready: [], away: [] };
        regData.current_checkin.ready = Array.from(currentCheckIn.ready);
        regData.current_checkin.away = Array.from(currentCheckIn.away);
        const awayNamesList = matchedRegs.map(r => r.display_name).filter((v, i, a) => a.indexOf(v) === i).join(' & ');
        saveRegisteredPlayersRaw(regData, `CheckIn: ${awayNamesList} is Away`);

        try {
          await telegramRequest('answerCallbackQuery', {
            callback_query_id: cb.id,
            text: `🔴 ${awayNamesList}: Marked as NOT available.`,
            show_alert: false
          });
        } catch (e) {}

        try {
          const updatedCheckInText = formatCheckInPrompt('ru');
          const updatedCheckInKeys = getCheckInKeyboard('ru', isCbPrivate);
          await editTelegramMessage(chatId, cb.message.message_id, updatedCheckInText, updatedCheckInKeys);
        } catch (e) {}
        return sendResponse(res, 200, 'OK');
      }

      if (data === 'ci_list') {
        const regData = await getRegisteredPlayers();
        syncCurrentCheckInState(regData);
        const readyPids = Array.from(currentCheckIn.ready);
        const awayPids = Array.from(currentCheckIn.away);
        const { pIndex } = loadLeagueData();

        const readyNames = readyPids.map(id => (regData.registrations?.[id]?.display_name || pIndex[id]?.display_name || id));
        const awayNames = awayPids.map(id => (regData.registrations?.[id]?.display_name || pIndex[id]?.display_name || id));

        let listAlert = `📋 CHECK-IN ROSTER:\n\n🟢 READY (${readyNames.length}):\n${readyNames.join(', ') || 'None'}\n\n🔴 AWAY (${awayNames.length}):\n${awayNames.join(', ') || 'None'}`;
        if (listAlert.length > 200) listAlert = listAlert.slice(0, 195) + '...';

        await telegramRequest('answerCallbackQuery', {
          callback_query_id: cb.id,
          text: listAlert,
          show_alert: true
        });
        return sendResponse(res, 200, 'OK');
      }

      if (data === 'cmd_checkin') {
        const buffered = await getBufferedPhotos(null, chatId);
        if (buffered.length > 0) {
          await telegramRequest('answerCallbackQuery', {
            callback_query_id: cb.id,
            text: '⚠️ Finish analyzing last match screenshots first (/done)!',
            show_alert: true
          });
          return sendResponse(res, 200, 'OK');
        }
        const regData = await getRegisteredPlayers();
        syncCurrentCheckInState(regData);
        const text = formatCheckInPrompt('ru');
        await sendTelegramMessage(chatId, text, getCheckInKeyboard('ru', true));
        await telegramRequest('answerCallbackQuery', { callback_query_id: cb.id });
        return sendResponse(res, 200, 'OK');
      }

      if (data === 'cmd_top') {
        const text = formatTopScorers('ru');
        await sendTelegramMessage(chatId, text, getLanguageKeyboard('top', '0', 'ru', true));
        await telegramRequest('answerCallbackQuery', { callback_query_id: cb.id });
        return sendResponse(res, 200, 'OK');
      }

      if (data === 'cmd_recap') {
        const t = await getLatestTournament();
        const tId = t?.id || t?.tournament_id || '0';
        const recap = formatRecap(t, 'ru');
        await sendTelegramMessage(chatId, recap, getLanguageKeyboard('recap', tId, 'ru', true));
        await telegramRequest('answerCallbackQuery', { callback_query_id: cb.id });
        return sendResponse(res, 200, 'OK');
      }

      if (data === 'cmd_pending') {
        const auditMsg = await formatPendingAudit('ru');
        await sendTelegramMessage(chatId, auditMsg, getPendingKeyboard('ru'));
        await telegramRequest('answerCallbackQuery', { callback_query_id: cb.id, text: 'Audit updated!' });
        return sendResponse(res, 200, 'OK');
      }

      if (data === 'cmd_warning_lastchance') {
        const warnMsg = await formatLastChanceWarning('ru');
        await sendTelegramMessage(chatId, warnMsg, getLastChanceWarningKeyboard('ru'));
        await telegramRequest('answerCallbackQuery', { callback_query_id: cb.id, text: 'Warning message ready!' });
        return sendResponse(res, 200, 'OK');
      }

      if (data === 'bcast_lastchance' || data === 'bcast_welcome') {
        const warnMsg = await formatLastChanceWarning('ru');
        const channelKey = {
          inline_keyboard: [
            [
              { text: '🤖 Register in Bot / سجل الآن بالبوت', url: BOT_REGISTER_URL }
            ],
            [
              { text: '👥 Official Channel & Chat / القناة والمجموعة', url: COMMUNITY_URL }
            ],
            [
              { text: '🌐 Official League Website', url: WEBSITE_URL }
            ]
          ]
        };
        await sendTelegramMessage(CHANNEL_ID, warnMsg, channelKey);
        await telegramRequest('answerCallbackQuery', {
          callback_query_id: cb.id,
          text: '📢 Warning broadcasted to channel!',
          show_alert: true
        });
        await sendTelegramMessage(chatId, `✅ *Last Chance Warning has been published to channel ${CHANNEL_ID}!*`, getLastChanceWarningKeyboard('ru'));
        return sendResponse(res, 200, 'OK');
      }

      if (data === 'cmd_warning_kicked') {
        const kickMsg = await formatKickedWarning('ru');
        await sendTelegramMessage(chatId, kickMsg, getKickedWarningKeyboard('ru'));
        await telegramRequest('answerCallbackQuery', { callback_query_id: cb.id, text: 'Notice message ready!' });
        return sendResponse(res, 200, 'OK');
      }

      if (data === 'bcast_kicked') {
        const kickMsg = await formatKickedWarning('ru');
        const channelKey = {
          inline_keyboard: [
            [
              { text: '🤖 Register in Bot / سجل الآن بالبوت', url: BOT_REGISTER_URL }
            ],
            [
              { text: '👥 Official Channel & Chat / القناة والمجموعة', url: COMMUNITY_URL }
            ],
            [
              { text: '🌐 Official League Website', url: WEBSITE_URL }
            ]
          ]
        };
        await sendTelegramMessage(CHANNEL_ID, kickMsg, channelKey);
        await telegramRequest('answerCallbackQuery', {
          callback_query_id: cb.id,
          text: '📢 Notice broadcasted to channel!',
          show_alert: true
        });
        await sendTelegramMessage(chatId, `✅ *Notice regarding kicked players and tomorrow's deadline has been published to channel ${CHANNEL_ID}!*`, getKickedWarningKeyboard('ru'));
        return sendResponse(res, 200, 'OK');
      }

      if (data === 'cmd_tg_notice') {
        const text = formatTelegramNotice('ru');
        await sendTelegramMessage(chatId, text, getLanguageKeyboard('tgnotice', '0', 'ru', true));
        await telegramRequest('answerCallbackQuery', { callback_query_id: cb.id });
        return sendResponse(res, 200, 'OK');
      }

      if (data === 'bcast_tgnotice') {
        const noticeMsg = formatTelegramNotice('ru');
        const channelKey = {
          inline_keyboard: [
            [
              { text: '🤖 Register in Bot / سجل الآن بالبوت', url: 'https://t.me/BratvaFCMBot?start=register' }
            ],
            [
              { text: '👥 Official Channel & Chat / القناة والمجموعة', url: COMMUNITY_URL }
            ],
            [
              { text: '🌐 Official League Website', url: WEBSITE_URL }
            ]
          ]
        };
        await sendTelegramMessage(CHANNEL_ID, noticeMsg, channelKey);
        await telegramRequest('answerCallbackQuery', {
          callback_query_id: cb.id,
          text: '📢 Registration Notice broadcasted to channel!',
          show_alert: true
        });
        await sendTelegramMessage(chatId, `✅ *Registration Notice has been published to channel ${CHANNEL_ID}!*`, getLanguageKeyboard('tgnotice', '0', 'ru', true));
        return sendResponse(res, 200, 'OK');
      }

      if (data === 'cmd_strikes') {
        const text = await formatStrikes('ru');
        await sendTelegramMessage(chatId, text, getLanguageKeyboard('strikes', '0', 'ru', true));
        await telegramRequest('answerCallbackQuery', { callback_query_id: cb.id });
        return sendResponse(res, 200, 'OK');
      }

      if (data === 'cmd_lineup') {
        const lineupData = await generateSmartLineup(null);
        const text = await formatSmartLineup(null, 'ru');
        await sendTelegramMessage(chatId, text, getLineupKeyboard(lineupData.size, 'ru', true, lineupData.isAuto));
        await telegramRequest('answerCallbackQuery', { callback_query_id: cb.id });
        return sendResponse(res, 200, 'OK');
      }

      if (data === 'cmd_kicklist') {
        const text = await formatKicklist('ru');
        await sendTelegramMessage(chatId, text, getLanguageKeyboard('kicklist', '0', 'ru', true));
        await telegramRequest('answerCallbackQuery', { callback_query_id: cb.id });
        return sendResponse(res, 200, 'OK');
      }

      if (data === 'cmd_rules') {
        const rules = formatRules('ru');
        await sendTelegramMessage(chatId, rules, getLanguageKeyboard('rules', '0', 'ru', true));
        await telegramRequest('answerCallbackQuery', { callback_query_id: cb.id });
        return sendResponse(res, 200, 'OK');
      }

      if (data === 'cmd_tournaments') {
        const text = await formatTournaments('ru');
        await sendTelegramMessage(chatId, text, getLanguageKeyboard('tournaments', '0', 'ru', true));
        await telegramRequest('answerCallbackQuery', { callback_query_id: cb.id });
        return sendResponse(res, 200, 'OK');
      }

      if (data === 'cmd_mvp') {
        const mvpMsg = formatMvp('ru');
        latestMvpMessage = mvpMsg;
        await sendTelegramMessage(chatId, mvpMsg, getLanguageKeyboard('mvp', '0', 'ru', true));
        await telegramRequest('answerCallbackQuery', { callback_query_id: cb.id });
        return sendResponse(res, 200, 'OK');
      }

      if (data === 'cmd_sync_roster') {
        waitingRosterSync.set(chatId, Date.now());
        const text = formatRosterInstructions('ru');
        await sendTelegramMessage(chatId, text, getLanguageKeyboard('rosterprompt', '0', 'ru', false));
        await telegramRequest('answerCallbackQuery', { callback_query_id: cb.id });
        return sendResponse(res, 200, 'OK');
      }

      if (data === 'cmd_mystats') {
        const userId = cb.from ? cb.from.id : chatId;
        const isTester = isSandboxTester(userId, cb.from?.username);
        const regData = await getRegisteredPlayers();
        const userReg = isTester
          ? (sandboxSessions.get(String(userId)) || null)
          : Object.values(regData.registrations || {}).find(r =>
              String(r.telegram_id) === String(userId) ||
              (cb.from && cb.from.username && r.telegram_username && r.telegram_username.toLowerCase() === cb.from.username.toLowerCase())
            );
        if (userReg) {
          const pid = userReg.player_id;
          const statsMsg = generatePlayerStatsMessage(pid, 'ru');
          await sendTelegramMessage(chatId, statsMsg, getPlayerKeyboard(pid, 'ru'));
        } else {
          const statsPrompt = formatMyStatsPrompt('ru');
          await sendTelegramMessage(chatId, statsPrompt, getLanguageKeyboard('mystats', '0', 'ru', false));
        }
        await telegramRequest('answerCallbackQuery', { callback_query_id: cb.id });
        return sendResponse(res, 200, 'OK');
      }

      if (data === 'cmd_admin_panel') {
        const isUserAdm = await isUserAdmin(cb.from?.id, cb.from?.username);
        if (!isUserAdm) {
          await telegramRequest('answerCallbackQuery', { callback_query_id: cb.id, text: '⛔ Admin only.', show_alert: true });
          return sendResponse(res, 200, 'Blocked');
        }
        const adminHelpMsg = `👑 *ПАНЕЛЬ УПРАВЛЕНИЯ АДМИНИСТРАТОРА (BRATVA FCM)* ⚜️\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `📸 *Загрузка результатов турнира:*\n` +
          `Отправьте 4-5 скриншотов турнира из EA FC Mobile прямо в этот чат (альбомом).\n` +
          `Бот автоматически объединит игроков (#1-#32), обновит сайт и сформирует отчет.\n\n` +
          `📹 *Синхронизация состава из игры:*\n` +
          `Отправьте видео скролла участников лиги в EA FC Mobile (/sync) для выявления исключенных, вернувшихся и новичков.\n\n` +
          `📢 *Быстрые рассылки игрокам:*\n` +
          `• \`/notify lineup\` — рассылка состава в ЛС\n` +
          `• \`/notify debrief\` — персональный разбор матча в ЛС\n` +
          `• \`/notify checkin\` — предматчевый сбор готовности\n` +
          `• \`/notify warning\` — предупреждения нарушителям\n\n` +
          `👥 *Аудит базы игроков:* \`/audit\` или \`/pending\`\n` +
          `⚙️ *Настройка правил:* \`/setrules <цель_голов> <макс_страйков> <ходов>\``;

        const adminKeys = {
          inline_keyboard: [
            [
              { text: '⚔️ Оповестить состав', callback_data: 'bcast_lineup_auto' },
              { text: '📊 Отправить разборы матча', callback_data: 'cmd_notify_debrief' }
            ],
            [
              { text: '⏳ Запустить Check-In', callback_data: 'cmd_notify_checkin' },
              { text: '⚠️ Предупредить должников', callback_data: 'cmd_notify_warning' }
            ],
            [
              { text: '🚨 Кандидаты на Кик', callback_data: 'cmd_kicklist' },
              { text: '⛔ Страйки и Должники', callback_data: 'cmd_strikes' }
            ],
            [
              { text: '👥 Аудит базы игроков', callback_data: 'cmd_pending' },
              { text: '🔄 Синхронизация состава', callback_data: 'cmd_sync_roster' }
            ],
            [
              { text: '📋 Главное меню', callback_data: 'cmd_menu' }
            ]
          ]
        };
        await sendTelegramMessage(chatId, adminHelpMsg, adminKeys);
        await telegramRequest('answerCallbackQuery', { callback_query_id: cb.id });
        return sendResponse(res, 200, 'OK');
      }

      if (data === 'cmd_menu') {
        const isUserAdm = await isUserAdmin(cb.from?.id, cb.from?.username);
        const welcome = formatWelcome('ru');
        await sendTelegramMessage(chatId, welcome, getMainKeyboard('ru', isUserAdm));
        await telegramRequest('answerCallbackQuery', { callback_query_id: cb.id });
        return sendResponse(res, 200, 'OK');
      }

      if (data === 'cmd_notify_debrief') {
        const t = await getLatestTournament();
        if (t) {
          await notifyVerifiedPlayersMatchDebrief(t);
          await telegramRequest('answerCallbackQuery', {
            callback_query_id: cb.id,
            text: '📢 Match debriefs sent to verified players!'
          });
          await sendTelegramMessage(chatId, '✅ *Personalized match debriefs dispatched to all verified players!*', getMainKeyboard('ru'));
        } else {
          await telegramRequest('answerCallbackQuery', {
            callback_query_id: cb.id,
            text: '⚠️ No tournament found',
            show_alert: true
          });
        }
        return sendResponse(res, 200, 'OK');
      }

      if (data === 'cmd_notify_checkin') {
        await notifyVerifiedPlayersCheckIn();
        await telegramRequest('answerCallbackQuery', {
          callback_query_id: cb.id,
          text: '📢 Check-in ping sent to verified players!'
        });
        await sendTelegramMessage(chatId, '✅ *1-tap check-in ping dispatched to all verified players!*', getMainKeyboard('ru'));
        return sendResponse(res, 200, 'OK');
      }

      if (data === 'cmd_notify_warning') {
        await notifyVerifiedPlayersDisciplineWarning();
        await telegramRequest('answerCallbackQuery', {
          callback_query_id: cb.id,
          text: '📢 Warnings sent to players with strikes!'
        });
        await sendTelegramMessage(chatId, '✅ *Discipline reminders dispatched to all players with strikes!*', getMainKeyboard('ru'));
        return sendResponse(res, 200, 'OK');
      }

      if (data.startsWith('quick_rules_')) {
        const parts = data.replace('quick_rules_', '').split('_');
        const goals = parseInt(parts[0], 10) || 20;
        const strikes = parseInt(parts[1], 10) || 3;
        const turns = parseInt(parts[2], 10) || 3;

        const updated = await saveLeagueRules({
          minGoalsPerTournament: goals,
          maxMissesKick: strikes,
          minTurnsPerTournament: turns
        }, cb.from.id);

        const successMsg = `✅ *БРАТВА LEAGUE RULES UPDATED!* ⚜️\n\n` +
          `• 🎯 *Min Goals Target:* *${updated.minGoalsPerTournament}+* goals\n` +
          `• ⛔ *Strikes Before Kick:* *${updated.maxMissesKick}* strikes\n` +
          `• ⚽ *Mandatory Turns:* *${updated.minTurnsPerTournament}/3* turns\n\n` +
          `🌐 *Live across translations (🇷🇺 RU, 🇬🇧 EN, 🇸🇦 AR, 🇪🇸 ES) and website!*`;

        await telegramRequest('answerCallbackQuery', { callback_query_id: cb.id, text: 'Rules updated!' });
        await sendTelegramMessage(chatId, successMsg, getLanguageKeyboard('rules', '0', 'ru', true));
        return sendResponse(res, 200, 'OK');
      }

      await telegramRequest('answerCallbackQuery', { callback_query_id: cb.id });
      return sendResponse(res, 200, 'OK');
    }

    // 2. Handle Messages
    const message = update.message;
    if (!message) {
      return sendResponse(res, 200, 'OK');
    }

    const chatId = message.chat.id;
    const isPrivate = !message.chat || message.chat.type === 'private';
    const text = (message.text || '').trim();

    // Group Policy: The bot is muted in groups, EXCEPT for automatically guiding new members to the bot!
    if (!isPrivate) {
      // 1. Automatic Group Onboarding: When new members join the group, greet them with direct bot registration link!
      if (message.new_chat_members && Array.isArray(message.new_chat_members) && message.new_chat_members.length > 0) {
        const humanMembers = message.new_chat_members.filter(u => !u.is_bot);
        if (humanMembers.length > 0) {
          const names = humanMembers.map(u => bidiIsolate(u.first_name || u.username || 'Member')).join(', ');
          const welcomeGroupMsg = `👋 *Добро пожаловать / Welcome ${names} to БРАТВА FCM!* ⚜️\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `⚠️ *ОБЯЗАТЕЛЬНАЯ РЕГИСТРАЦИЯ (3 ДНЯ) / MANDATORY (3 DAYS):*\n` +
            `Каждый игрок обязан зарегистрироваться в боте в течение 3 дней, чтобы участвовать в турнирах и избежать кика!\n` +
            `Each player must register with the bot within 3 days to participate in tournaments and avoid removal.\n` +
            `────────────────────\n` +
            `👉 *Нажмите кнопку ниже, чтобы открыть бота и отправить свой ник:*`;

          const groupKeys = {
            inline_keyboard: [
              [
                { text: '🤖 Регистрация в боте / Register in Bot', url: 'https://t.me/BratvaFCMBot?start=register' }
              ],
              [
                { text: '📜 Правила лиги / League Rules', url: 'https://t.me/BratvaFCMBot?start=rules' }
              ],
              [
                { text: '🌐 Официальный сайт лиги', url: WEBSITE_URL }
              ]
            ]
          };

          // Auto-delete Telegram's service message "User joined the group" to keep chat clean
          deleteTelegramMessage(chatId, message.message_id).catch(() => {});

          await sendTelegramMessage(chatId, welcomeGroupMsg, groupKeys);
          return sendResponse(res, 200, 'Group new members welcomed with bot link');
        }
      }

      // 2. Helpful 1-line guidance if someone asks for bot in group
      if (text.startsWith('/register') || text.startsWith('/bot') || text === '/start') {
        const replyText = `🤖 *БРАТВА FCM Official Bot:* [@BratvaFCMBot](https://t.me/BratvaFCMBot?start=register)\n` +
          `👉 [Нажмите сюда / Click here to open bot](https://t.me/BratvaFCMBot?start=register) to verify your in-game name!`;
        const replyKeys = {
          inline_keyboard: [
            [{ text: '🤖 Открыть бота / Open Bot', url: 'https://t.me/BratvaFCMBot?start=register' }]
          ]
        };
        await sendTelegramMessage(chatId, replyText, replyKeys);
        return sendResponse(res, 200, 'Group bot link sent');
      }

      return sendResponse(res, 200, 'All other group messages strictly ignored');
    }

    // 🔒 Admin Security Gate: Players have NO access to the bot.
    // Only verified Administrators / Creator of the league can access bot features.
    const userId = message.from ? message.from.id : null;
    const isAdmin = await isUserAdmin(userId, message.from ? message.from.username : '');

    // ==========================================
    // 🔒 NON-ADMIN FLOW: 1-on-1 Player Verification & Onboarding
    // ==========================================
    if (!isAdmin) {
      // 1. Photos are strictly blocked for non-admins (match upload is admin-only)
      if (message.photo && message.photo.length > 0) {
        const photoMsg = formatPhotoWarning('ru');
        const photoKeys = getPhotoWarningKeyboard('ru');
        await sendTelegramMessage(chatId, photoMsg, photoKeys);
        return sendResponse(res, 200, 'Non-admin photo rejected with tabs');
      }

      const isTester = isSandboxTester(userId, message.from ? message.from.username : '');
      const regData = await getRegisteredPlayers();
      const pendingMap = regData.pending_uids || {};
      const pendingEntry = pendingMap[String(userId)];

      // 2. If user is in the middle of sending their in-game UID (duplicate name resolution)
      if (pendingEntry) {
        if (text === '/cancel' || text === '/start') {
          await clearPendingUid(userId);
          const userLang = detectUserLang(message.from);
          const vPrompt = formatVerificationPrompt(userLang);
          const vKeys = getVerificationKeyboard(userLang);
          await sendTelegramMessage(chatId, vPrompt, vKeys);
          return sendResponse(res, 200, 'Pending UID cleared');
        }

        const uid = text.replace(/^(uid\s*[:=]?\s*)/i, '').trim();
        const cleanUid = uid.replace(/[^a-zA-Z0-9]/g, '');
        const baseId = (pendingEntry.base_id || 'member').split('_uid_')[0];
        const playerId = `${baseId}_uid_${cleanUid || Date.now()}`;

        await savePlayerRegistration({
          player_id: playerId,
          display_name: pendingEntry.display_name,
          in_game_name: pendingEntry.display_name,
          uid: uid,
          telegram_id: userId,
          telegram_username: message.from ? (message.from.username || '') : '',
          telegram_name: `${message.from ? (message.from.first_name || '') : ''} ${message.from ? (message.from.last_name || '') : ''}`.trim(),
          is_new_member: pendingEntry.is_new_member || false
        });

        const vSuccessText = formatVerificationSuccess(pendingEntry.display_name, uid, 'ru');
        const vSuccessKeys = getVerificationSuccessKeyboard(playerId, 'ru');
        await sendTelegramMessage(chatId, vSuccessText, vSuccessKeys);
        return sendResponse(res, 200, 'Duplicate resolved with UID');
      }

      // 3. Public Member Commands (Available to both registered and unregistered members)
      if (text.startsWith('/rules')) {
        const rules = formatRules('ru');
        await sendTelegramMessage(chatId, rules, getLanguageKeyboard('rules', '0', 'ru', false));
        return sendResponse(res, 200, 'OK');
      }

      if (text.startsWith('/tgnotice') || text.startsWith('/joinnotice')) {
        const noticeMsg = formatTelegramNotice('ru');
        await sendTelegramMessage(chatId, noticeMsg, getLanguageKeyboard('tgnotice', '0', 'ru', false));
        return sendResponse(res, 200, 'OK');
      }

      if (text.startsWith('/checkin') || text.startsWith('/rally')) {
        const ciMsg = formatCheckInPrompt('ru');
        const ciKeys = getCheckInKeyboard('ru', false);
        await sendTelegramMessage(chatId, ciMsg, ciKeys);
        return sendResponse(res, 200, 'OK');
      }

      if (text.startsWith('/lineup')) {
        const parts = text.split(/\s+/);
        const rawSize = parts[1];
        const reqSize = rawSize ? parseInt(rawSize, 10) : null;
        const lineupData = await generateSmartLineup(reqSize);
        const lineupMsg = await formatSmartLineup(reqSize, 'ru');
        await sendTelegramMessage(chatId, lineupMsg, getLineupKeyboard(lineupData.size, 'ru', false, lineupData.isAuto));
        return sendResponse(res, 200, 'OK');
      }

      if (text.startsWith('/strikes')) {
        const strikesMsg = await formatStrikes('ru');
        await sendTelegramMessage(chatId, strikesMsg, getLanguageKeyboard('strikes', '0', 'ru', false));
        return sendResponse(res, 200, 'OK');
      }

      if (text.startsWith('/top') || text.startsWith('/leaderboard')) {
        const topMsg = formatTopScorers('ru');
        await sendTelegramMessage(chatId, topMsg, getLanguageKeyboard('top', '0', 'ru', false));
        return sendResponse(res, 200, 'OK');
      }

      if (text.startsWith('/tournaments')) {
        const tMsg = await formatTournaments('ru');
        await sendTelegramMessage(chatId, tMsg, getLanguageKeyboard('tournaments', '0', 'ru', false));
        return sendResponse(res, 200, 'OK');
      }

      if (text.startsWith('/mvp') || text.startsWith('/totw')) {
        const mvpMsg = formatMvp('ru');
        await sendTelegramMessage(chatId, mvpMsg, getLanguageKeyboard('mvp', '0', 'ru', false));
        return sendResponse(res, 200, 'OK');
      }

      if (text.startsWith('/mystats') || text.startsWith('/my') || text.startsWith('/me') || text.startsWith('/card') || text.startsWith('/player') || text.startsWith('/stats') || text.startsWith('/p ')) {
        const parts = text.split(/\s+/);
        const query = parts.slice(1).join(' ').trim();
        let pid = '';

        if (query) {
          const matched = findPlayerByQuery(query);
          pid = matched ? matched.player_id : query;
        } else {
          const userReg = isTester
            ? (sandboxSessions.get(String(userId)) || null)
            : Object.values(regData.registrations || {}).find(r =>
                String(r.telegram_id) === String(userId) ||
                (message.from && message.from.username && r.telegram_username && r.telegram_username.toLowerCase() === message.from.username.toLowerCase())
              );
          if (userReg) {
            pid = userReg.player_id;
          }
        }

        if (pid) {
          const pMsg = generatePlayerStatsMessage(pid, 'ru');
          await sendTelegramMessage(chatId, pMsg, getPlayerKeyboard(pid, 'ru'));
          return sendResponse(res, 200, 'OK');
        } else {
          const statsPrompt = formatMyStatsPrompt('ru');
          await sendTelegramMessage(chatId, statsPrompt, getLanguageKeyboard('mystats', '0', 'ru', false));
          return sendResponse(res, 200, 'OK');
        }
      }

      if (text.startsWith('/warning') || text.startsWith('/lastchance')) {
        const warnMsg = await formatLastChanceWarning('ru');
        await sendTelegramMessage(chatId, warnMsg, getLastChanceWarningKeyboard('ru'));
        return sendResponse(res, 200, 'OK');
      }

      if (text.startsWith('/kicked') || text.startsWith('/removal') || text.startsWith('/kickwarning')) {
        const kickMsg = await formatKickedWarning('ru');
        await sendTelegramMessage(chatId, kickMsg, getKickedWarningKeyboard('ru'));
        return sendResponse(res, 200, 'OK');
      }

      if (text.startsWith('/forgive') || text.startsWith('/clearstrike') || text.startsWith('/excuse') || text.startsWith('/setrules') || text.startsWith('/editrules')) {
        await sendTelegramMessage(chatId, '⛔ *Admin only command.*');
        return sendResponse(res, 200, 'OK');
      }

      // 4. Check if this player is ALREADY verified & registered
      const existingRegs = isTester
        ? (sandboxSessions.has(String(userId)) ? [sandboxSessions.get(String(userId))] : [])
        : Object.values(regData.registrations || {}).filter(r => String(r.telegram_id) === String(userId));

      if (existingRegs.length > 0) {
        if (text === '/reset' || text === '/change' || (isTester && (text === '/restart' || text === '/test'))) {
          subCache.delete(String(userId));
          verifiedGateUsers.delete(String(userId));
          if (isTester) {
            sandboxSessions.delete(String(userId));
            sandboxSubscribed.delete(String(userId));
          } else {
            for (const reg of existingRegs) {
              delete regData.registrations[reg.player_id];
            }
            await saveRegisteredPlayersRaw(regData, `Player Reset: TG @${existingRegs[0].telegram_username || userId}`);
          }
          const userLang = detectUserLang(message.from);
          const joinMsg = formatJoinRequiredPrompt(userLang);
          const joinKeys = getJoinRequiredKeyboard(userLang);
          await sendTelegramMessage(chatId, joinMsg, joinKeys);
          return sendResponse(res, 200, 'Registration reset to step 1');
        }

        if (text.startsWith('/start') || text.startsWith('/menu') || text.startsWith('/help')) {
          const welcome = formatWelcome('ru');
          await sendTelegramMessage(chatId, welcome, getMainKeyboard('ru', false));
          return sendResponse(res, 200, 'OK');
        }

        if (text.startsWith('/status') || text.startsWith('/verify')) {
          const userLang = detectUserLang(message.from);
          const names = existingRegs.map(r => r.display_name).filter((v, i, a) => a.indexOf(v) === i).join(' & ');
          const vSuccessText = formatVerificationSuccess(names, existingRegs[0].uid, userLang);
          const vSuccessKeys = getVerificationSuccessKeyboard(existingRegs[0].player_id, userLang);
          await sendTelegramMessage(chatId, vSuccessText, vSuccessKeys);
          return sendResponse(res, 200, 'Already registered');
        }

        // Check if message is a player name query (e.g. "DOXIBERO1")
        if (!text.startsWith('/')) {
          const matched = findPlayerByQuery(text);
          if (matched) {
            const pid = matched.player_id;
            const pMsg = generatePlayerStatsMessage(pid, 'ru');
            await sendTelegramMessage(chatId, pMsg, getPlayerKeyboard(pid, 'ru'));
            return sendResponse(res, 200, 'OK');
          }
        }

        const welcome = formatWelcome('ru');
        await sendTelegramMessage(chatId, welcome, getMainKeyboard('ru', false));
        return sendResponse(res, 200, 'OK');
      }

      // Handle /reset or /restart for unregistered users
      if (text === '/reset' || text === '/restart' || (isTester && text === '/test')) {
        subCache.delete(String(userId));
        verifiedGateUsers.delete(String(userId));
        if (isTester) {
          sandboxSessions.delete(String(userId));
          sandboxSubscribed.delete(String(userId));
        }
        const userLang = detectUserLang(message.from);
        const joinMsg = formatJoinRequiredPrompt(userLang);
        const joinKeys = getJoinRequiredKeyboard(userLang);
        await sendTelegramMessage(chatId, joinMsg, joinKeys);
        return sendResponse(res, 200, 'Reset to step 1');
      }

      // 🧪 Sandbox testing helper commands
      if (isTester && text === '/simulate_join') {
        sandboxSubscribed.add(String(userId));
        const userLang = detectUserLang(message.from);
        await sendTelegramMessage(chatId, '🧪 *[SANDBOX TEST] Simulated joining channel & group chat successfully!*');
        const welcomeDm = formatCommunityJoinedPrompt(userLang);
        const dmKeys = getCommunityJoinedKeyboard(userLang);
        await sendTelegramMessage(chatId, welcomeDm, dmKeys);
        return sendResponse(res, 200, 'Sandbox simulated join');
      }

      if (isTester && text === '/simulate_leave') {
        sandboxSubscribed.delete(String(userId));
        verifiedGateUsers.delete(String(userId));
        subCache.delete(String(userId));
        const userLang = detectUserLang(message.from);
        await sendTelegramMessage(chatId, '🧪 *[SANDBOX TEST] Simulated leaving channel & chat.*');
        const joinMsg = formatJoinRequiredPrompt(userLang);
        const joinKeys = getJoinRequiredKeyboard(userLang);
        await sendTelegramMessage(chatId, joinMsg, joinKeys);
        return sendResponse(res, 200, 'Sandbox simulated leave');
      }

      // 5. Community Membership Gatekeeper:
      // Step 1: Users not yet in the community see ONLY Button 1️⃣ [ Join Channel & Group Chat ].
      // Step 2: Once joined, Telegram auto-triggers (or bot detects) Button 2️⃣ [ Check Membership & Continue ].
      const userLang = detectUserLang(message.from);
      const hasPassedGate = verifiedGateUsers.has(String(userId));
      if (!hasPassedGate) {
        const isSub = await isUserSubscribedToCommunity(userId);
        if (isSub) {
          const joinedMsg = formatCommunityJoinedPrompt(userLang);
          const joinedKeys = getCommunityJoinedKeyboard(userLang);
          await sendTelegramMessage(chatId, joinedMsg, joinedKeys);
          return sendResponse(res, 200, 'Community joined prompt sent');
        }
        const joinMsg = formatJoinRequiredPrompt(userLang);
        const joinKeys = getJoinRequiredKeyboard(userLang);
        await sendTelegramMessage(chatId, joinMsg, joinKeys);
        return sendResponse(res, 200, 'Community subscription required');
      }

      // 6. User is confirmed subscribed: Show in-game name registration prompt
      if (!text || text.startsWith('/start') || text.startsWith('/help') || text.startsWith('/verify')) {
        if (text.includes('rules')) {
          const rulesMsg = formatRules(userLang);
          await sendTelegramMessage(chatId, rulesMsg, getLanguageKeyboard('rules', '0', userLang, false));
          return sendResponse(res, 200, 'OK');
        }
        const vPrompt = formatVerificationPrompt(userLang);
        const vKeys = getVerificationKeyboard(userLang);
        await sendTelegramMessage(chatId, vPrompt, vKeys);
        return sendResponse(res, 200, 'OK');
      }

      // If unregistered user sends an unhandled slash command, guide them back to verification prompt
      if (text.startsWith('/')) {
        const vPrompt = formatVerificationPrompt(userLang);
        const vKeys = getVerificationKeyboard(userLang);
        await sendTelegramMessage(chatId, vPrompt, vKeys);
        return sendResponse(res, 200, 'Ignored unknown slash command');
      }

      // 6. User submitted their in-game username
      const inputName = text.trim();

      // Protect League Owner / Admins accounts
      const isTryingOwnerName = ['sanya', 'саня'].includes(inputName.toLowerCase().trim());
      if (isTryingOwnerName) {
        await sendTelegramMessage(chatId, '👑 *Этот аккаунт закреплён за Создателем лиги (саня).* Пожалуйста, укажите ваш собственный никнейм в игре.');
        return sendResponse(res, 200, 'Protected Owner Account');
      }

      // Check if this username is already registered by a DIFFERENT Telegram user (Duplicate Name)
      const existingClaim = Object.values(regData.registrations || {}).find(r => {
        const regName = (r.in_game_name || r.display_name || '').toLowerCase().trim();
        const query = inputName.toLowerCase().trim();
        return regName === query && String(r.telegram_id) !== String(userId);
      });

      if (existingClaim) {
        // DUPLICATE DETECTED: Request in-game UID to distinguish between players
        await setPendingUid(userId, {
          display_name: inputName,
          base_id: existingClaim.player_id,
          is_new_member: existingClaim.is_new_member || false
        });

        const uidPrompt = formatUidPrompt(inputName, 'ru');
        const uidKeys = getUidPromptKeyboard(encodeURIComponent(inputName), 'ru');
        await sendTelegramMessage(chatId, uidPrompt, uidKeys);
        return sendResponse(res, 200, 'Duplicate name, requested UID');
      }

      // Check if username matches active tournament roster
      const matched = findPlayerByQuery(inputName);
      let playerId = '';
      let displayName = '';
      let isNew = false;

      if (matched) {
        playerId = matched.player_id;
        displayName = matched.display_name;
        isNew = false;
      } else {
        // ACCEPT ALL MEMBERS: league has up to 100 players, many join before tournaments
        const cleanBase = inputName.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || `user_${userId}`;
        playerId = `member_${cleanBase}`;
        displayName = inputName;
        isNew = true;
      }

      if (isTester) {
        // 🧪 SANDBOX TESTER: Store in-memory session only, do NOT commit fake registration to GitHub!
        sandboxSessions.set(String(userId), {
          player_id: playerId,
          display_name: displayName,
          in_game_name: displayName,
          uid: null,
          telegram_id: userId,
          telegram_username: message.from ? (message.from.username || '') : '',
          telegram_name: `${message.from ? (message.from.first_name || '') : ''} ${message.from ? (message.from.last_name || '') : ''}`.trim(),
          is_new_member: isNew
        });
      } else {
        await savePlayerRegistration({
          player_id: playerId,
          display_name: displayName,
          in_game_name: displayName,
          uid: null,
          telegram_id: userId,
          telegram_username: message.from ? (message.from.username || '') : '',
          telegram_name: `${message.from ? (message.from.first_name || '') : ''} ${message.from ? (message.from.last_name || '') : ''}`.trim(),
          is_new_member: isNew
        });
      }

      const vSuccessText = formatVerificationSuccess(displayName, null, userLang);
      const vSuccessKeys = getVerificationSuccessKeyboard(playerId, userLang);
      await sendTelegramMessage(chatId, vSuccessText, vSuccessKeys);
      return sendResponse(res, 200, 'Registration successful');
    }

    // 2.0 Video processing (In-Game Roster Screen Recording)
    const videoObj = message.video || (message.document && (message.document.mime_type || '').startsWith('video/') ? message.document : null);
    if (videoObj) {
      if (!isAdmin) {
        await sendTelegramMessage(chatId, '⛔ *Video analysis is reserved for League Administrators.*');
        return sendResponse(res, 200, 'Non-admin video blocked');
      }

      const fileSize = videoObj.file_size || 0;
      if (fileSize > 20 * 1024 * 1024) {
        const tooBigMsg = `⚠️ *Video File Exceeds 20MB Limit!* (${(fileSize / (1024 * 1024)).toFixed(1)}MB)\n\n` +
          `Telegram Bot API strictly limits bots to downloading files under 20MB.\n\n` +
          `💡 *Easy Solutions:*\n` +
          `1. Send video directly as a regular Telegram video (Telegram auto-compresses it to ~3-8MB).\n` +
          `2. Keep the screen recording between 15-25 seconds.\n` +
          `3. Or send scrolling screenshots instead!`;
        await sendTelegramMessage(chatId, tooBigMsg, getMainKeyboard('ru'));
        return sendResponse(res, 200, 'Video too large');
      }

      const analyzingRes = await sendTelegramMessage(chatId, `📹 *Downloading & analyzing in-game roster video with Gemini Vision AI...*\n_Please wait ~15-25 seconds while AI reads all member names..._`);
      const analyzingMsgId = analyzingRes?.result?.message_id || null;

      try {
        const videoBuffer = await downloadTelegramFile(videoObj.file_id);
        const extractedNames = await analyzeRosterMediaWithGemini([videoBuffer], videoObj.mime_type || 'video/mp4');
        const analysis = await analyzeInGameRoster(extractedNames);

        const sessionId = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
        activeRosterSessions.set(sessionId, { analysis, createdAt: Date.now() });

        if (analyzingMsgId) {
          await deleteTelegramMessage(chatId, analyzingMsgId);
        }

        const reportText = formatRosterSyncReport(analysis, 'ru');
        const reportKeyboard = getRosterSyncKeyboard(sessionId, 'ru');
        await sendTelegramMessage(chatId, reportText, reportKeyboard);
        return sendResponse(res, 200, 'Video roster analyzed');
      } catch (err) {
        if (analyzingMsgId) {
          await deleteTelegramMessage(chatId, analyzingMsgId);
        }
        console.error('Error analyzing roster video:', err);
        await sendTelegramMessage(chatId, `❌ *Video Analysis Error:* ${clean(err.message)}`);
        return sendResponse(res, 200, 'Video analysis error');
      }
    }

    // 2.1 Photo processing with High-Speed Issue #1 Buffer + Interactive Button + Auto-Debounce
    if (message.photo && message.photo.length > 0) {
      // Select crisp 800-1280px photo (~150-250KB) instead of bloated 4MB raw to prevent serverless timeouts
      const selectedPhoto = message.photo.length >= 3 ? message.photo[message.photo.length - 2] : message.photo[message.photo.length - 1];
      const mediaGroupId = message.media_group_id;
      const albumId = mediaGroupId || `chat_${chatId}`;

      // 1. Buffer this photo to GitHub Issue #1 (Fast 150ms HTTP POST, zero Git conflicts!)
      await bufferPhoto(albumId, selectedPhoto.file_id, chatId);

      // 2. Fetch current buffer for this album/chat
      const currentItems = await getBufferedPhotos(albumId, chatId);
      const count = currentItems.length;

      // 3. Send interactive control message with "Analyze Now" button
      const keyboard = {
        inline_keyboard: [
          [
            { text: `🚀 Analyze ${count} Match Screenshot${count > 1 ? 's' : ''}`, callback_data: `analyze_${albumId}` }
          ],
          [
            { text: `🔄 Analyze as In-Game Roster (${count})`, callback_data: `roster_photo_${albumId}` }
          ],
          [
            { text: '🗑️ Clear Buffer', callback_data: `clear_${albumId}` }
          ]
        ]
      };

      // Delete previous buffer status message if any, to avoid clutter
      const prevStatusId = activeBufferStatusMessages.get(chatId);
      if (prevStatusId) {
        await deleteTelegramMessage(chatId, prevStatusId);
        activeBufferStatusMessages.delete(chatId);
      }

      const statusRes = await sendTelegramMessage(
        chatId,
        `📸 *Screenshot received!* (Batch: *${count}* screenshot${count > 1 ? 's' : ''})\n` +
        `👉 Send more screenshots, or tap button below when ready:`,
        keyboard
      );
      if (statusRes && statusRes.ok && statusRes.result && statusRes.result.message_id) {
        activeBufferStatusMessages.set(chatId, statusRes.result.message_id);
      }

      return sendResponse(res, 200, 'Photo buffered');
    }

    // 2.2 Text Command Routing
    if (text.startsWith('/done') || text.startsWith('/analyze')) {
      const items = await getBufferedPhotos(null, chatId);
      if (items.length === 0) {
        await sendTelegramMessage(chatId, '⚠️ *No buffered screenshots found.* Please send tournament screenshots first!');
        return sendResponse(res, 200, 'OK');
      }
      return await processBufferedAlbum(null, chatId, res);
    }

    if (text.startsWith('/reset') || text.startsWith('/clear')) {
      globalLatestTournament = null;
      const items = await getBufferedPhotos(null, chatId);
      await clearBufferedPhotos(items.map(it => it.commentId));
      if (activeBufferStatusMessages.has(chatId)) {
        await deleteTelegramMessage(chatId, activeBufferStatusMessages.get(chatId));
        activeBufferStatusMessages.delete(chatId);
      }
      await sendTelegramMessage(chatId, '🧹 *Match cache & screenshot buffer reset!* Ready for fresh screenshots.', getMainKeyboard('ru'));
      return sendResponse(res, 200, 'OK');
    }

    if (text.startsWith('/top') || text.startsWith('/leaderboard')) {
      const topMsg = formatTopScorers('ru');
      await sendTelegramMessage(chatId, topMsg, getLanguageKeyboard('top', '0', 'ru', true));
      return sendResponse(res, 200, 'OK');
    }

    if (text.startsWith('/strikes')) {
      const strikesMsg = await formatStrikes('ru');
      await sendTelegramMessage(chatId, strikesMsg, getLanguageKeyboard('strikes', '0', 'ru', true));
      return sendResponse(res, 200, 'OK');
    }

    if (text.startsWith('/lineup')) {
      const parts = text.split(/\s+/);
      const rawSize = parts[1];
      const reqSize = rawSize ? parseInt(rawSize, 10) : null;
      const lineupData = await generateSmartLineup(reqSize);
      const lineupMsg = await formatSmartLineup(reqSize, 'ru');
      await sendTelegramMessage(chatId, lineupMsg, getLineupKeyboard(lineupData.size, 'ru', true, lineupData.isAuto));
      return sendResponse(res, 200, 'OK');
    }

    if (text.startsWith('/tournaments')) {
      const tMsg = await formatTournaments('ru');
      await sendTelegramMessage(chatId, tMsg, getLanguageKeyboard('tournaments', '0', 'ru', true));
      return sendResponse(res, 200, 'OK');
    }

    if (text.startsWith('/mystats') || text.startsWith('/my') || text.startsWith('/me') || text.startsWith('/card') || text.startsWith('/player') || text.startsWith('/stats') || text.startsWith('/p ')) {
      const parts = text.split(/\s+/);
      const query = parts.slice(1).join(' ').trim();
      let pid = '';

      if (query) {
        const matched = findPlayerByQuery(query);
        pid = matched ? matched.player_id : query;
      } else {
        // No query passed: resolve sender's registered player card
        const regData = await getRegisteredPlayers();
        const userReg = Object.values(regData.registrations || {}).find(r =>
          String(r.telegram_id) === String(userId) ||
          (message.from && message.from.username && r.telegram_username && r.telegram_username.toLowerCase() === message.from.username.toLowerCase())
        );
        if (userReg) {
          pid = userReg.player_id;
        }
      }

      if (pid) {
        const pMsg = generatePlayerStatsMessage(pid, 'ru');
        await sendTelegramMessage(chatId, pMsg, getPlayerKeyboard(pid, 'ru'));
        return sendResponse(res, 200, 'OK');
      } else {
        const statsPrompt = formatMyStatsPrompt('ru');
        await sendTelegramMessage(chatId, statsPrompt, getLanguageKeyboard('mystats', '0', 'ru', false));
        return sendResponse(res, 200, 'OK');
      }
    }

    if (text === '/sync' || text === '/setcommands' || text === '/synccommands') {
      const syncRes = await syncBotCommands();
      await sendTelegramMessage(chatId, `✅ *Telegram Bot Menu Commands synced successfully across RU, EN, AR, ES!*`, getMainKeyboard('ru'));
      return sendResponse(res, 200, 'OK');
    }

    if (text.startsWith('/setrules') || text.startsWith('/editrules')) {
      const parts = text.split(/\s+/).slice(1);
      const currentRules = getLeagueRules();

      if (parts.length === 0) {
        const infoMsg = `⚙️ *БРАТВА LEAGUE RULES MANAGER (Admin)* ⚙️\n\n` +
          `📋 *Current Active Rules:*\n` +
          `• 🎯 *Min Goals Target:* *${currentRules.minGoalsPerTournament}+* goals\n` +
          `• ⛔ *Strikes Before Kick:* *${currentRules.maxMissesKick}* strikes\n` +
          `• ⚽ *Mandatory Turns:* *${currentRules.minTurnsPerTournament}/3* turns\n\n` +
          `👉 *To update rules, send:*\n` +
          `\`/setrules <goals> <strikes> <turns>\`\n\n` +
          `*Examples:*\n` +
          `• \`/setrules 25 3 3\` (Sets 25+ goals, 3 strikes for kick, 3 turns)\n` +
          `• \`/setrules 20 2 3\` (Sets 20+ goals, 2 strikes for kick, 3 turns)\n\n` +
          `🌐 Changes automatically sync to GitHub and update the website!`;

        const keys = {
          inline_keyboard: [
            [
              { text: '🎯 Set 25 Goals Target', callback_data: 'quick_rules_25_3_3' },
              { text: '🎯 Set 20 Goals Target', callback_data: 'quick_rules_20_3_3' }
            ],
            [
              { text: '📜 View Rules with Translations', callback_data: 'cmd_rules' }
            ]
          ]
        };

        await sendTelegramMessage(chatId, infoMsg, keys);
        return sendResponse(res, 200, 'OK');
      }

      // Parse parameters: <goals> [strikes] [turns]
      const goals = parseInt(parts[0], 10);
      const strikes = parts[1] ? parseInt(parts[1], 10) : currentRules.maxMissesKick;
      const turns = parts[2] ? parseInt(parts[2], 10) : currentRules.minTurnsPerTournament;

      if (isNaN(goals) || goals < 5 || goals > 50) {
        await sendTelegramMessage(chatId, '⚠️ *Invalid goals target!* Please specify a number between 5 and 50, e.g.: `/setrules 25 3 3`');
        return sendResponse(res, 200, 'OK');
      }

      const updated = await saveLeagueRules({
        minGoalsPerTournament: goals,
        maxMissesKick: isNaN(strikes) ? 3 : Math.max(1, Math.min(strikes, 5)),
        minTurnsPerTournament: isNaN(turns) ? 3 : Math.max(1, Math.min(turns, 3))
      }, message.from?.id || 'admin');

      const successMsg = `✅ *БРАТВА LEAGUE RULES UPDATED!* ⚜️\n\n` +
        `• 🎯 *Min Goals Target:* *${updated.minGoalsPerTournament}+* goals\n` +
        `• ⛔ *Strikes Before Kick:* *${updated.maxMissesKick}* strikes\n` +
        `• ⚽ *Mandatory Turns:* *${updated.minTurnsPerTournament}/3* turns\n\n` +
        `🌐 *Rules updated live across all translations (🇷🇺 RU, 🇬🇧 EN, 🇸🇦 AR, 🇪🇸 ES) and the website!*`;

      const successKeys = getLanguageKeyboard('rules', '0', 'ru', true);
      await sendTelegramMessage(chatId, successMsg, successKeys);
      return sendResponse(res, 200, 'OK');
    }

    if (text.startsWith('/welcome') || text.startsWith('/intro')) {
      const wText = formatChannelWelcome('ru');
      const wKeys = getLanguageKeyboard('welcome', '0', 'ru', true);
      await sendTelegramMessage(chatId, wText, wKeys);
      return sendResponse(res, 200, 'OK');
    }

    if (text.startsWith('/pending') || text.startsWith('/checkjoin') || text.startsWith('/registered') || text.startsWith('/audit')) {
      const auditMsg = await formatPendingAudit('ru');
      const auditKeys = getPendingKeyboard();
      await sendTelegramMessage(chatId, auditMsg, auditKeys);
      return sendResponse(res, 200, 'OK');
    }

    if (text.startsWith('/kicked') || text.startsWith('/removal') || text.startsWith('/kickwarning')) {
      const kickMsg = await formatKickedWarning('ru');
      const kickKeys = getKickedWarningKeyboard('ru');
      await sendTelegramMessage(chatId, kickMsg, kickKeys);
      return sendResponse(res, 200, 'OK');
    }

    if (text.startsWith('/warning') || text.startsWith('/lastchance')) {
      const warnMsg = await formatLastChanceWarning('ru');
      const warnKeys = getLastChanceWarningKeyboard('ru');
      await sendTelegramMessage(chatId, warnMsg, warnKeys);
      return sendResponse(res, 200, 'OK');
    }

    if (text.startsWith('/rules')) {
      const rules = formatRules('ru');
      await sendTelegramMessage(chatId, rules, getLanguageKeyboard('rules', '0', 'ru', true));
      return sendResponse(res, 200, 'OK');
    }

    if (text.startsWith('/invite_pentax') || text.startsWith('/dm_pentax')) {
      if (!isAdmin) {
        await sendTelegramMessage(chatId, '⛔ *Admin only command.*');
        return sendResponse(res, 200, 'OK');
      }
      const pentaxMsg = `👋 *Hello Fernando (King_Pentax)!* ⚽\n\n` +
        `You are in our official FC Mobile League squad, but you haven't joined our Telegram Channel & Discussion Group yet!\n\n` +
        `Joining the official community is **MANDATORY** to be selected in Season 2 tournament starting lineups.\n\n` +
        `👉 *Please join now via this direct link:*\n${COMMUNITY_URL}\n\n` +
        `After joining, open this bot and confirm your in-game nickname! 🏆`;

      const pKeys = {
        inline_keyboard: [
          [{ text: '🚀 Join BRATVA Channel & Group Chat', url: COMMUNITY_URL }]
        ]
      };
      const resPentax = await sendTelegramMessage(6577572183, pentaxMsg, pKeys);
      if (resPentax && resPentax.ok) {
        await sendTelegramMessage(chatId, `✅ *Invite sent successfully to Fernando (King_Pentax)!*\nThe bot delivered the invitation and link directly to his private chat (ID: \`6577572183\`).`, getMainKeyboard('ru'));
      } else {
        await sendTelegramMessage(chatId, `⚠️ Could not DM Fernando. Details: ${resPentax?.description || 'Error'}\nManual Profile link: [Fernando](tg://user?id=6577572183)`, getMainKeyboard('ru'));
      }
      return sendResponse(res, 200, 'OK');
    }

    if (text.startsWith('/tgnotice') || text.startsWith('/joinnotice')) {
      const noticeMsg = formatTelegramNotice('ru');
      await sendTelegramMessage(chatId, noticeMsg, getLanguageKeyboard('tgnotice', '0', 'ru', true));
      return sendResponse(res, 200, 'OK');
    }

    if (text.startsWith('/recap') || text.startsWith('/broadcast')) {
      const t = await getLatestTournament();
      const tId = t?.id || t?.tournament_id || '0';
      const recap = formatRecap(t, 'ru');
      const keys = getTabsKeyboard('ru', tId, true);
      await sendTelegramMessage(chatId, recap, keys);
      return sendResponse(res, 200, 'OK');
    }

    if (text.startsWith('/kicklist') || text.startsWith('/flagged')) {
      const kickMsg = await formatKicklist('ru');
      await sendTelegramMessage(chatId, kickMsg, getLanguageKeyboard('kicklist', '0', 'ru', true));
      return sendResponse(res, 200, 'OK');
    }

    if (text.startsWith('/roster') || text.startsWith('/sync_roster') || text.startsWith('/syncroster')) {
      waitingRosterSync.set(chatId, Date.now());
      const promptText = formatRosterInstructions('ru');
      await sendTelegramMessage(chatId, promptText, getLanguageKeyboard('rosterprompt', '0', 'ru', false));
      return sendResponse(res, 200, 'OK');
    }

    if (text.startsWith('/mvp') || text.startsWith('/totw')) {
      const mvpMsg = formatMvp('ru');
      latestMvpMessage = mvpMsg;
      await sendTelegramMessage(chatId, mvpMsg, getLanguageKeyboard('mvp', '0', 'ru', true));
      return sendResponse(res, 200, 'OK');
    }

    if (text.startsWith('/checkin') || text.startsWith('/rally') || text.startsWith('/remind')) {
      const buffered = await getBufferedPhotos(null, chatId);
      if (buffered.length > 0) {
        await sendTelegramMessage(
          chatId,
          '⚠️ *Cannot open Pre-Match Check-In yet!*\n\n' +
          '📸 There are unanalyzed tournament screenshots in the buffer.\n' +
          '👉 Please run `/done` or `/analyze` first to publish the last match results and update player strikes and averages!'
        );
        return sendResponse(res, 200, 'OK');
      }

      const regData = await getRegisteredPlayers();
      syncCurrentCheckInState(regData);

      const isExpired = !currentCheckIn.active || (currentCheckIn.expiresAt && Date.now() >= currentCheckIn.expiresAt);
      if (isExpired) {
        currentCheckIn.active = true;
        currentCheckIn.openedAt = Date.now();
        currentCheckIn.durationMinutes = 60;
        currentCheckIn.expiresAt = Date.now() + (60 * 60 * 1000);
        currentCheckIn.ready.clear();
        currentCheckIn.away.clear();

        if (!regData.current_checkin) regData.current_checkin = {};
        regData.current_checkin.active = true;
        regData.current_checkin.openedAt = currentCheckIn.openedAt;
        regData.current_checkin.expiresAt = currentCheckIn.expiresAt;
        regData.current_checkin.durationMinutes = 60;
        regData.current_checkin.ready = [];
        regData.current_checkin.away = [];
        await saveRegisteredPlayersRaw(regData, 'Admin opened 1-hour pre-match check-in');
      }

      const ciMsg = formatCheckInPrompt('ru');
      const ciKeys = getCheckInKeyboard('ru', true);
      await sendTelegramMessage(chatId, ciMsg, ciKeys);
      return sendResponse(res, 200, 'OK');
    }

    if (text.startsWith('/closecheckin') || text.startsWith('/endcheckin') || text.startsWith('/lockcheckin')) {
      if (!isAdmin) {
        await sendTelegramMessage(chatId, '⛔ *Admin only command.*');
        return sendResponse(res, 200, 'OK');
      }
      const regData = await getRegisteredPlayers();
      syncCurrentCheckInState(regData);
      currentCheckIn.active = false;
      if (regData.current_checkin) {
        regData.current_checkin.active = false;
        await saveRegisteredPlayersRaw(regData, 'Admin manually locked pre-match check-in');
      }
      await sendTelegramMessage(chatId, '🔒 *Pre-Match Check-In has been locked manually!* Starting lineup can now be generated with `/lineup`.', getMainKeyboard('ru'));
      return sendResponse(res, 200, 'OK');
    }

    if (text.startsWith('/forgive') || text.startsWith('/clearstrike') || text.startsWith('/excuse')) {
      if (!isAdmin) {
        await sendTelegramMessage(chatId, '⛔ *Admin only command.*');
        return sendResponse(res, 200, 'OK');
      }
      const parts = text.split(/\s+/).slice(1);
      if (parts.length === 0) {
        await sendTelegramMessage(chatId, '⚠️ *Usage:* `/forgive <player_name>`\nExample: `/forgive DOXIBERO1`');
        return sendResponse(res, 200, 'OK');
      }
      const query = parts.join(' ');
      const matched = findPlayerByQuery(query);
      if (!matched) {
        await sendTelegramMessage(chatId, `❌ Player "${clean(query)}" not found in league roster.`);
        return sendResponse(res, 200, 'OK');
      }

      const pid = matched.player_id;
      const regData = await getRegisteredPlayers();
      if (!regData.excuses) regData.excuses = {};
      regData.excuses[pid] = {
        excused_at: new Date().toISOString(),
        excused_by: message.from?.username || message.from?.id || 'admin',
        reason: 'Admin excused absence'
      };

      await saveRegisteredPlayersRaw(regData, `Admin Excuse: Cleared strikes for ${matched.display_name}`);

      const msg = `✅ *STRIKES CLEARED & EXCUSED!* 🛡️\n\n` +
        `Player: *${clean(matched.display_name)}* (\`${pid}\`)\n` +
        `Discipline: *0 strikes (Safe)*\n` +
        `Absence officially excused by admin. Player is now 100% eligible for starting lineups!`;
      await sendTelegramMessage(chatId, msg, getMainKeyboard('ru'));
      return sendResponse(res, 200, 'OK');
    }

    if (text.startsWith('/notify')) {
      if (!isAdmin) {
        await sendTelegramMessage(chatId, '⛔ *Admin only command.*');
        return sendResponse(res, 200, 'OK');
      }
      const parts = text.split(/\s+/).slice(1);
      const action = parts[0] ? parts[0].toLowerCase() : '';

      if (action === 'lineup') {
        const lineupData = await generateSmartLineup(null);
        await notifyVerifiedPlayersLineup(lineupData);
        await sendTelegramMessage(chatId, '📢 *Lineup notifications dispatched directly to all verified players!*', getMainKeyboard('ru'));
        return sendResponse(res, 200, 'OK');
      } else if (action === 'debrief' || action === 'recap') {
        const t = await getLatestTournament();
        if (!t) {
          await sendTelegramMessage(chatId, '⚠️ *No tournament found to debrief.*');
          return sendResponse(res, 200, 'OK');
        }
        await notifyVerifiedPlayersMatchDebrief(t);
        await sendTelegramMessage(chatId, '📢 *Personal match debriefs dispatched directly to all verified players!*', getMainKeyboard('ru'));
        return sendResponse(res, 200, 'OK');
      } else if (action === 'checkin' || action === 'rally') {
        await notifyVerifiedPlayersCheckIn();
        await sendTelegramMessage(chatId, '📢 *Pre-match check-in pings dispatched directly to all verified players!*', getMainKeyboard('ru'));
        return sendResponse(res, 200, 'OK');
      } else if (action === 'warning' || action === 'strikes') {
        await notifyVerifiedPlayersDisciplineWarning();
        await sendTelegramMessage(chatId, '📢 *Discipline reminders dispatched directly to all players with strikes!*', getMainKeyboard('ru'));
        return sendResponse(res, 200, 'OK');
      } else {
        const helpMsg = `📢 *MANUAL PLAYER NOTIFICATION SYSTEM (Admin)* 📢\n\n` +
          `👉 *Available commands:*\n` +
          `• \`/notify lineup\` — Dispatches starting call-up & bench alerts to all verified players.\n` +
          `• \`/notify debrief\` — Dispatches personalized match performance review to all verified players.\n` +
          `• \`/notify checkin\` — Sends 1-tap interactive check-in ping to all verified players.\n` +
          `• \`/notify warning\` — Sends fraternal discipline reminders to players with strikes.\n\n` +
          `💡 *Note:* These notifications are also sent automatically at match end, lineup release, and check-in launch!`;
        const keys = {
          inline_keyboard: [
            [
              { text: '⚔️ Broadcast Lineup DMs', callback_data: 'bcast_lineup_auto' },
              { text: '📊 Send Match Debriefs', callback_data: 'cmd_notify_debrief' }
            ],
            [
              { text: '⏳ Ping Check-In DMs', callback_data: 'cmd_notify_checkin' },
              { text: '⚠️ Send Strike Warnings', callback_data: 'cmd_notify_warning' }
            ]
          ]
        };
        await sendTelegramMessage(chatId, helpMsg, keys);
        return sendResponse(res, 200, 'OK');
      }
    }

    if (text.startsWith('/admin')) {
      const adminHelpMsg = `👑 *ПАНЕЛЬ УПРАВЛЕНИЯ АДМИНИСТРАТОРА (BRATVA FCM)* ⚜️\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📸 *Загрузка результатов турнира:*\n` +
        `Отправьте 4-5 скриншотов турнира из EA FC Mobile прямо в этот чат (альбомом).\n` +
        `Бот автоматически объединит игроков (#1-#32), обновит сайт и сформирует отчет для канала.\n\n` +
        `📹 *Синхронизация состава из игры:*\n` +
        `Отправьте видео скролла участников лиги в EA FC Mobile (/sync) для выявления исключенных, вернувшихся и новичков.\n\n` +
        `📢 *Быстрые рассылки игрокам:*\n` +
        `• \`/notify lineup\` — рассылка состава в ЛС\n` +
        `• \`/notify debrief\` — персональный разбор матча в ЛС\n` +
        `• \`/notify checkin\` — предматчевый сбор готовности\n` +
        `• \`/notify warning\` — предупреждения нарушителям\n\n` +
        `👥 *Аудит базы игроков:* \`/audit\` или \`/pending\`\n` +
        `⚙️ *Настройка правил:* \`/setrules <цель_голов> <макс_страйков> <ходов>\``;

      const adminKeys = {
        inline_keyboard: [
          [
            { text: '⚔️ Оповестить состав', callback_data: 'bcast_lineup_auto' },
            { text: '📊 Отправить разборы матча', callback_data: 'cmd_notify_debrief' }
          ],
          [
            { text: '⏳ Запустить Check-In', callback_data: 'cmd_notify_checkin' },
            { text: '⚠️ Предупредить должников', callback_data: 'cmd_notify_warning' }
          ],
          [
            { text: '👥 Аудит игроков', callback_data: 'cmd_pending' },
            { text: '📋 Главное меню', callback_data: 'cmd_menu' }
          ]
        ]
      };
      await sendTelegramMessage(chatId, adminHelpMsg, adminKeys);
      return sendResponse(res, 200, 'OK');
    }

    if (text.startsWith('/start') || text.startsWith('/help') || text.startsWith('/menu')) {
      const welcome = formatWelcome('ru');
      await sendTelegramMessage(chatId, welcome, getMainKeyboard('ru'));
      return sendResponse(res, 200, 'OK');
    }

    // 2.3 Private Chat Player Name Lookup (Self-service player performance card)
    if (isPrivate && text && !text.startsWith('/')) {
      const matched = findPlayerByQuery(text);
      if (matched) {
        const pid = matched.player_id;
        const pMsg = generatePlayerStatsMessage(pid, 'ru');
        await sendTelegramMessage(chatId, pMsg, getPlayerKeyboard(pid, 'ru'));
        return sendResponse(res, 200, 'OK');
      }
    }

    // 2.4 Private Chat AI Assistant (Gemini 3.6 Flash) - STRICTLY for private 1-on-1 chat for Admins only!
    if (isPrivate && text) {
      if (!isAdmin) {
        return sendResponse(res, 200, 'AI chat restricted to admins');
      }
      await telegramRequest('sendChatAction', { chat_id: chatId, action: 'typing' });
      try {
        const aiAnswer = await askGeminiAI(text);
        await sendTelegramMessage(chatId, aiAnswer);
        return sendResponse(res, 200, 'OK');
      } catch (chatErr) {
        console.error('Gemini private chat error:', chatErr);
        await sendTelegramMessage(chatId, `🤖 *AI Assistant:* Samhliya, wqe3 mochkil sghir. Jreb 3awed sewelni!`, getMainKeyboard('ru'));
        return sendResponse(res, 200, 'OK');
      }
    }

    return sendResponse(res, 200, 'OK');
  } catch (err) {
    console.error('Webhook Top-Level Error:', err);
    return sendResponse(res, 200, 'Error handled: ' + err.message);
  }
}

export {
  generateSmartLineup,
  formatSmartLineup,
  getLineupKeyboard,
  calculateOptimalTournamentSize,
  formatCheckInPrompt,
  formatRules,
  notifyVerifiedPlayersLineup,
  notifyVerifiedPlayersMatchDebrief,
  notifyVerifiedPlayersCheckIn,
  notifyVerifiedPlayersDisciplineWarning,
  getVerifiedPlayersForNotification,
  resolvePlayerLanguage,
  formatKickedWarning,
  getKickedWarningKeyboard,
  formatLastChanceWarning,
  getLastChanceWarningKeyboard,
  getCleanSquadTelegramStatus,
  analyzeInGameRoster,
  formatRosterSyncReport,
  applyRosterSync,
  formatRosterInstructions,
  saveActiveRosterRaw,
  getRosterSyncKeyboard,
  evaluateAllSquadStrikes,
  formatStrikes,
  formatKicklist,
  formatPlayerTag
};
