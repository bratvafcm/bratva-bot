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

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_KEY = process.env.GEMINI_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const GITHUB_PAT = process.env.GITHUB_PAT;
const GITHUB_REPO = process.env.GITHUB_REPO || 'bratvafcm/bratvafcm.github.io';
const CHANNEL_ID = process.env.CHANNEL_ID || '@BRATVAFCM';
const WEBSITE_URL = process.env.WEBSITE_URL || 'https://bratvafcm.github.io/';
const COMMUNITY_URL = 'https://t.me/addlist/c2IRI0ZsvfEwYzU0';

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

async function isUserAdmin(userId) {
  if (!userId) return false;
  const strId = String(userId);

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

  return { pIndex, tIndex, players, tournaments };
}

async function getLatestTournament() {
  if (globalLatestTournament) return globalLatestTournament;
  const { tournaments } = loadLeagueData();
  if (tournaments && tournaments.length > 0) return tournaments[0];
  const tIndex = await fetchGithubJson('docs/league-data/index/tournaments_index.json');
  if (tIndex) {
    const ids = Object.keys(tIndex).reverse();
    if (ids[0]) return await fetchGithubJson(`docs/league-data/tournaments/${ids[0]}.json`);
  }
  return null;
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
   - "limit_remaining": Text under "LIMIT" column: "0/3", "1/3", "2/3", or "3/3".
   - "turns_played":
     * "0/3" = 3 turns played (0 left) -> 3
     * "1/3" = 2 turns played (1 left) -> 2
     * "2/3" = 1 turn played (2 left) -> 1
     * "3/3" = 0 turns played (3 left, STRIKE) -> 0

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
        inline_data: {
          mime_type: 'image/jpeg',
          data: buf.toString('base64')
        }
      });
    }

    const payload = JSON.stringify({ contents: [{ parts }] });

    const callModel = (modelName) => {
      const req = https.request({
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/${modelName}:generateContent?key=${GEMINI_KEY}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.candidates && parsed.candidates[0].content) {
              let rawText = parsed.candidates[0].content.parts[0].text.trim();
              rawText = rawText.replace(/^\`\`\`json\s*/i, '').replace(/^\`\`\`\s*/i, '').replace(/\`\`\`\s*$/i, '').trim();
              resolve(JSON.parse(rawText));
            } else if (modelName !== 'gemini-3.8-flash') {
              console.warn(`Model ${modelName} returned error, trying fallback gemini-3.8-flash:`, data);
              callModel('gemini-3.8-flash');
            } else {
              reject(new Error(`Gemini API Error: ${data}`));
            }
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    };

    callModel(GEMINI_MODEL);
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

    const callModel = (modelName) => {
      const req = https.request({
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/${modelName}:generateContent?key=${GEMINI_KEY}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.candidates && parsed.candidates[0].content) {
              const answer = parsed.candidates[0].content.parts[0].text.trim();
              resolve(answer);
            } else if (modelName !== 'gemini-3.8-flash') {
              callModel('gemini-3.8-flash');
            } else {
              reject(new Error(`Gemini Chat Error: ${data}`));
            }
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    };

    callModel(GEMINI_MODEL);
  });
}

function getMainKeyboard(currentLang = 'ru') {
  const ruLabel = currentLang === 'ru' ? '• 🇷🇺 RU •' : '🇷🇺 RU';
  const enLabel = currentLang === 'en' ? '• 🇬🇧 EN •' : '🇬🇧 EN';
  const arLabel = currentLang === 'ar' ? '• 🇸🇦 AR •' : '🇸🇦 AR';
  const esLabel = currentLang === 'es' ? '• 🇪🇸 ES •' : '🇪🇸 ES';

  const myStatsLabel = currentLang === 'ar' ? '👤 إحصائياتي الشخصية (أرسل اسمك)' :
                       currentLang === 'es' ? '👤 Mis Estadísticas (Escribe tu Nick)' :
                       currentLang === 'en' ? '👤 My Stats / Player Card' : '👤 Моя Статистика (Напиши ник)';

  const topLabel = currentLang === 'ar' ? '🏆 الهدافون' :
                   currentLang === 'es' ? '🏆 Goleadores' :
                   currentLang === 'en' ? '🏆 Top Scorers' : '🏆 Топ Бомбардиров';

  const recapLabel = currentLang === 'ar' ? '⭐ آخر ملخص' :
                     currentLang === 'es' ? '⭐ Último Resumen' :
                     currentLang === 'en' ? '⭐ Last Recap' : '⭐ Последний Матч';

  const mvpLabel = currentLang === 'ar' ? '👑 نجم الأسبوع' :
                   currentLang === 'es' ? '👑 Jugador MVP' :
                   currentLang === 'en' ? '👑 MVP Spotlight' : '👑 Лучший Игрок';

  const lineupLabel = currentLang === 'ar' ? '🎯 التشكيلة الذكية' :
                      currentLang === 'es' ? '🎯 Mejor Alineación' :
                      currentLang === 'en' ? '🎯 Smart Lineup' : '🎯 Основа Лиги';

  const checkinLabel = currentLang === 'ar' ? '⚔️ تأكيد الجاهزية (Check-In)' :
                       currentLang === 'es' ? '⚔️ Check-In Pre-Partido' :
                       currentLang === 'en' ? '⚔️ Pre-Match Check-In' : '⚔️ Предматчевый Сбор';

  const strikesLabel = currentLang === 'ar' ? '⛔ الإنذارات والمقصرون' :
                       currentLang === 'es' ? '⛔ Strikes y Deudores' :
                       currentLang === 'en' ? '⛔ Strikes & Debtors' : '⛔ Страйки и Должники';

  const kickLabel = currentLang === 'ar' ? '🚨 مراجعة الاستبعاد' :
                    currentLang === 'es' ? '🚨 Revisión Expulsión' :
                    currentLang === 'en' ? '🚨 Kick Review' : '🚨 Кандидаты на Кик';

  const rulesLabel = currentLang === 'ar' ? '📜 القوانين (هام جداً)' :
                     currentLang === 'es' ? '📜 Reglas (IMPORTANTE)' :
                     currentLang === 'en' ? '📜 Rules (IMPORTANT)' : '📜 Правила Лиги (ВАЖНО)';

  const tournLabel = currentLang === 'ar' ? '📊 سجل البطولات' :
                     currentLang === 'es' ? '📊 Torneos' :
                     currentLang === 'en' ? '📊 Tournaments' : '📊 Все Турниры';

  const webLabel = currentLang === 'ar' ? '🌐 الموقع الرسمي للدوري' :
                   currentLang === 'es' ? '🌐 Web Oficial de la Liga' :
                   currentLang === 'en' ? '🌐 Official League Website' : '🌐 Официальный Сайт Лиги';

  return {
    inline_keyboard: [
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
        { text: strikesLabel, callback_data: 'cmd_strikes' },
        { text: kickLabel, callback_data: 'cmd_kicklist' }
      ],
      [
        { text: tournLabel, callback_data: 'cmd_tournaments' }
      ],
      [
        { text: '👥 Telegram Audit (3-Day Kick Tracker)', callback_data: 'cmd_pending' }
      ],
      [
        { text: webLabel, url: WEBSITE_URL }
      ]
    ]
  };
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

async function getRegisteredPlayers() {
  if (inMemoryRegistered) {
    syncCurrentCheckInState(inMemoryRegistered);
    return inMemoryRegistered;
  }
  try {
    const localPath = path.join(process.cwd(), 'docs', 'league-data', 'registered_players.json');
    if (fs.existsSync(localPath)) {
      const data = JSON.parse(fs.readFileSync(localPath, 'utf8'));
      inMemoryRegistered = data;
      syncCurrentCheckInState(data);
      return data;
    }
  } catch (e) {}

  try {
    const file = await githubApi(`/repos/${GITHUB_REPO}/contents/docs/league-data/registered_players.json`);
    if (file && file.content) {
      const content = Buffer.from(file.content, 'base64').toString('utf8');
      const data = JSON.parse(content);
      inMemoryRegistered = data;
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
  inMemoryRegistered = data;

  try {
    const localPath = path.join(process.cwd(), 'docs', 'league-data', 'registered_players.json');
    fs.writeFileSync(localPath, JSON.stringify(data, null, 2), 'utf8');
    const altPath = path.join(process.cwd(), 'league-data', 'registered_players.json');
    if (fs.existsSync(path.dirname(altPath))) {
      fs.writeFileSync(altPath, JSON.stringify(data, null, 2), 'utf8');
    }
  } catch (e) {}

  try {
    const existingFile = await githubApi(`/repos/${GITHUB_REPO}/contents/docs/league-data/registered_players.json`);
    const fileContent = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
    const commitPayload = {
      message: commitMsg,
      content: fileContent
    };
    if (existingFile && existingFile.sha) commitPayload.sha = existingFile.sha;
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
    menu: 'Main Menu'
  };
  const title = categoryTitles[category] || 'to Channel';

  const rows = [];
  if (includeBroadcastBtn) {
    rows.push([
      { text: `📢 Post ${title} to Channel`, callback_data: `bcast_${category}` }
    ]);
  }

  rows.push([
    { text: ruLabel, callback_data: `tab_${category}_${param}_ru` },
    { text: enLabel, callback_data: `tab_${category}_${param}_en` },
    { text: arLabel, callback_data: `tab_${category}_${param}_ar` },
    { text: esLabel, callback_data: `tab_${category}_${param}_es` }
  ]);

  if (category === 'welcome') {
    rows.push([
      { text: '🤖 Регистрация в боте / Register in Bot', url: 'https://t.me/BratvaFCMBot?start=register' }
    ]);
    rows.push([
      { text: '💬 Join Discussion Chat / Чат группы', url: COMMUNITY_URL }
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
  const list = Object.entries(pIndex).map(([id, data]) => ({
    id,
    name: bidiIsolate(data.display_name || id),
    goals: data.total_goals || 0,
    matches: data.total_matches || 0,
    avg: data.average_goals || 0
  })).sort((a, b) => b.goals - a.goals);

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

  const evaluated = Object.entries(pIndex).map(([id, pData]) => {
    const fullPlayer = (players || []).find(p => p && p.player_id === id) || pData || {};
    const pMatches = fullPlayer.matches || [];
    const horizon = rules.rollingHorizon || 5;
    const recentMatches = pMatches.slice(-horizon);

    let totalGoalsIn5 = 0;
    let strikesCount = 0;

    recentMatches.forEach(m => {
      totalGoalsIn5 += (m.goals_for || 0);
      const turns = m.turns_played !== undefined ? m.turns_played : 0;
      if (turns < (rules.minTurnsPerTournament || 3)) {
        strikesCount += 1;
      }
    });

    const last5Avg = recentMatches.length > 0 ? parseFloat((totalGoalsIn5 / recentMatches.length).toFixed(1)) : 0;

    // Consecutive 0/3 check: check last 2 matches the player was fielded in
    let consecutive0 = 0;
    if (pMatches.length >= 2) {
      const last2 = pMatches.slice(-2);
      const m1Turns = last2[0].turns_played !== undefined ? last2[0].turns_played : 0;
      const m2Turns = last2[1].turns_played !== undefined ? last2[1].turns_played : 0;
      if (m1Turns === 0 && m2Turns === 0) {
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

    const isLeadership = ['sanya', 'саня', 'doxibro', 'doxibero', 'doxibero1'].includes(id.toLowerCase()) ||
      Boolean(regData && regData.registrations && regData.registrations[id] && (regData.registrations[id].is_admin || regData.registrations[id].is_owner || regData.registrations[id].role === 'Owner' || regData.registrations[id].role === 'Admin'));

    const isEligibleForKick = !isExcused && !isLeadership && (consecutiveKick || strikeKick);

    const isTelegramVerified = Boolean(isLeadership || (regData && regData.registrations && regData.registrations[id]));

    return {
      pid: id,
      displayName: clean(fullPlayer.display_name || (pData && pData.display_name) || id),
      last5Avg,
      totalMatches: pMatches.length,
      recentMatchesCount: recentMatches.length,
      strikesIn5: strikesCount,
      consecutiveMisses: consecutive0,
      consecutiveKick,
      strikeKick,
      isEligibleForKick,
      isExcused,
      isTelegramVerified,
      isDecayed: recentMatches.length >= horizon && strikesCount === 0
    };
  });

  return evaluated;
}

async function formatStrikes(lang = 'ru') {
  const squad = await evaluateAllSquadStrikes();
  const rules = getLeagueRules();

  const critical = [];
  const warnings = [];

  squad.forEach(p => {
    const nameIso = bidiIsolate(p.displayName);
    if (p.isEligibleForKick) {
      const reason = p.consecutiveKick ? (lang === 'ar' ? 'غياب بطولتين متتاليتين 0/3' : lang === 'es' ? '2 torneos seguidos 0/3' : lang === 'en' ? '2 consecutive 0/3' : '2 турнира подряд 0/3')
                                      : `${p.strikesIn5}/${rules.rollingHorizon} ${lang === 'ar' ? 'إنذارات' : lang === 'es' ? 'strikes' : lang === 'en' ? 'strikes' : 'страйка'}`;
      critical.push(`• 🚨 *${nameIso}* — ${reason} ⛔`);
    } else if (p.strikesIn5 > 0) {
      warnings.push(`• ⚠️ *${nameIso}* — ${p.strikesIn5}/${rules.maxMissesKick} ${lang === 'ar' ? 'إنذارات (آخر 5)' : lang === 'es' ? 'strikes (últimos 5)' : lang === 'en' ? 'strikes (last 5)' : 'страйка (посл. 5)'}`);
    }
  });

  if (lang === 'en') {
    let msg = `⛔ *BRATVA FCM: ROLLING 5-MATCH STRIKES REPORT* ⛔\n` +
      `━━━━━━━━━━━━━━━━━━━━\n`;
    if (critical.length > 0) msg += `🚨 *CRITICAL (ELIGIBLE FOR KICK):*\n${critical.join('\n')}\n────────────────────\n`;
    if (warnings.length > 0) msg += `⚠️ *ACTIVE WARNINGS (1-2 STRIKES):*\n${warnings.join('\n')}\n────────────────────\n`;
    if (critical.length === 0 && warnings.length === 0) msg += `✅ *100% CLEAN DISCIPLINE!*\nAll active squad members have 0 strikes!\n────────────────────\n`;
    msg += `⚖️ *Rules:* 3 strikes in 5 matches OR 2 consecutive 0/3 = Kick.\n` +
      `🟢 *Decay:* 5 consecutive clean matches (3/3) clears past strikes!\n` +
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
      `🟢 *إسقاط الإنذارات:* لعب 5 بطولات متتالية بـ 3/3 يمسح جميع الإنذارات السابقة!\n` +
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
      `🟢 *Limpieza:* ¡5 partidos limpios consecutivos (3/3) eliminan strikes!\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🌐 *Sitio Oficial:* ${WEBSITE_URL}`;
    return msg;
  }

  // Russian (Default)
  let msg = `⛔ *БРАТВА: ОТЧЕТ ПО СТРАЙКАМ (ПОСЛЕДНИЕ 5 ТУРНИРОВ)* ⛔\n` +
    `━━━━━━━━━━━━━━━━━━━━\n`;
  if (critical.length > 0) msg += `🚨 *КАНДИДАТЫ НА КИК (3 страйка / 0/3 x2):*\n${critical.join('\n')}\n────────────────────\n`;
  if (warnings.length > 0) msg += `⚠️ *ПРЕДУПРЕЖДЕНИЯ (1-2 СТРАЙКА):*\n${warnings.join('\n')}\n────────────────────\n`;
  if (critical.length === 0 && warnings.length === 0) msg += `✅ *100% ИДЕАЛЬНАЯ ДИСЦИПЛИНА!*\nУ всех игроков основы 0 страйков за последние 5 турниров!\n────────────────────\n`;
  msg += `⚖️ *Правила:* 3 страйка из 5 или 2 матча подряд 0/3 = Кик.\n` +
    `🟢 *Сгорание:* 5 чистых матчей подряд (3/3) полностью сжигают страйки!\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🌐 *Сайт лиги:* ${WEBSITE_URL}`;
  return msg;
}

async function generateSmartLineup(requestedSize = 16) {
  const size = [4, 8, 12, 16, 20, 24, 32].includes(requestedSize) ? requestedSize : 16;
  const allSquad = await evaluateAllSquadStrikes();

  // Restore check-in state from persisted registered_players.json if memory is cold
  try {
    const regData = await getRegisteredPlayers();
    syncCurrentCheckInState(regData);
  } catch (e) {}

  const hasReadyCheckIn = currentCheckIn && currentCheckIn.ready && currentCheckIn.ready.size > 0;
  let eligibleCandidates = [];

  if (hasReadyCheckIn) {
    eligibleCandidates = allSquad.filter(p => currentCheckIn.ready.has(p.pid) && !p.isEligibleForKick);
    if (eligibleCandidates.length < size) {
      const remaining = allSquad.filter(p => !currentCheckIn.ready.has(p.pid) && !p.isEligibleForKick);
      remaining.sort((a, b) => b.last5Avg - a.last5Avg);
      eligibleCandidates = eligibleCandidates.concat(remaining);
    }
  } else {
    eligibleCandidates = allSquad.filter(p => !p.isEligibleForKick);
  }

  // Sort: Clean discipline (0 strikes) first, then personal 5-match average goals
  eligibleCandidates.sort((a, b) => {
    if (a.strikesIn5 === 0 && b.strikesIn5 > 0) return -1;
    if (a.strikesIn5 > 0 && b.strikesIn5 === 0) return 1;
    if (b.last5Avg !== a.last5Avg) return b.last5Avg - a.last5Avg;
    return b.totalMatches - a.totalMatches;
  });

  const starting = eligibleCandidates.slice(0, size);
  const bench = eligibleCandidates.slice(size, size + Math.min(8, Math.max(0, eligibleCandidates.length - size)));

  return {
    size,
    starting,
    bench,
    totalAvailable: eligibleCandidates.length,
    isCheckInUsed: hasReadyCheckIn
  };
}

async function formatSmartLineup(requestedSize = 16, lang = 'ru') {
  const lineupData = await generateSmartLineup(requestedSize);
  const size = lineupData.size;
  const starting = lineupData.starting;
  const bench = lineupData.bench;

  const startingLines = starting.map((p, idx) => {
    const num = idx + 1;
    const padNum = num < 10 ? ` ${num}` : `${num}`;
    const nameIso = bidiIsolate(p.displayName);
    if (lang === 'en') return `${padNum}. 🟢 *${nameIso}* — avg *${p.last5Avg}*G`;
    if (lang === 'ar') return `${padNum}. 🟢 *${nameIso}* — معدل *${p.last5Avg}* هدف`;
    if (lang === 'es') return `${padNum}. 🟢 *${nameIso}* — prom *${p.last5Avg}*G`;
    return `${padNum}. 🟢 *${nameIso}* — ср. *${p.last5Avg}*Г`;
  });

  const benchLines = bench.map((p, idx) => {
    const num = size + idx + 1;
    const padNum = num < 10 ? ` ${num}` : `${num}`;
    const nameIso = bidiIsolate(p.displayName);
    if (lang === 'en') return `${padNum}. 🟡 *${nameIso}* — avg *${p.last5Avg}*G (Reserve)`;
    if (lang === 'ar') return `${padNum}. 🟡 *${nameIso}* — معدل *${p.last5Avg}* هدف (احتياط)`;
    if (lang === 'es') return `${padNum}. 🟡 *${nameIso}* — prom *${p.last5Avg}*G (Reserva)`;
    return `${padNum}. 🟡 *${nameIso}* — ср. *${p.last5Avg}*Г (Запас)`;
  });

  if (lang === 'en') {
    let msg = `🎯 *BRATVA FCM: OFFICIAL LINEUP (${size}v${size})* 🎯\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `⚜️ *STARTING SQUAD (TOP ${size}):*\n${startingLines.join('\n')}\n`;
    if (benchLines.length > 0) {
      msg += `────────────────────\n📋 *BENCH & RESERVES:*\n${benchLines.join('\n')}\n`;
    }
    msg += `━━━━━━━━━━━━━━━━━━━━\n` +
      `⚡ *Selection Criteria:*\n` +
      `1. Checked in [ 🟢 Ready ] before match\n` +
      `2. Clean discipline (0 strikes)\n` +
      `3. Top scoring average in personal last 5 games!\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🌐 *Official Website:* ${WEBSITE_URL}`;
    return msg;
  }

  if (lang === 'ar') {
    let msg = `🎯 *دوري БРАТВА: التشكيلة الرسمية (${size} ضد ${size})* 🎯\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `⚜️ *التشكيلة الأساسية (أفضل ${size} لاعبين):*\n${startingLines.join('\n')}\n`;
    if (benchLines.length > 0) {
      msg += `────────────────────\n📋 *دكة البدلاء (الاحتياط):*\n${benchLines.join('\n')}\n`;
    }
    msg += `━━━━━━━━━━━━━━━━━━━━\n` +
      `⚡ *معايير الاختيار الذكية:*\n` +
      `1. تأكيد الجاهزية [ 🟢 أنا جاهز ] قبل المباراة\n` +
      `2. انضباط كامل وسجل نظيف (0 إنذارات)\n` +
      `3. أعلى معدل تهديفي في آخر 5 مباريات للاعب!\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🌐 *الموقع الرسمي للدوري:* ${WEBSITE_URL}`;
    return msg;
  }

  if (lang === 'es') {
    let msg = `🎯 *LIGA BRATVA: ALINEACIÓN OFICIAL (${size}v${size})* 🎯\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `⚜️ *TITULARES (TOP ${size}):*\n${startingLines.join('\n')}\n`;
    if (benchLines.length > 0) {
      msg += `────────────────────\n📋 *BANQUILLO Y RESERVAS:*\n${benchLines.join('\n')}\n`;
    }
    msg += `━━━━━━━━━━━━━━━━━━━━\n` +
      `⚡ *Criterios de Selección:*\n` +
      `1. Confirmación de disponibilidad [ 🟢 Estoy Listo ]\n` +
      `2. 0 strikes (disciplina perfecta)\n` +
      `3. Mayor promedio de goles en sus últimos 5 partidos!\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🌐 *Sitio Oficial:* ${WEBSITE_URL}`;
    return msg;
  }

  // Russian (Default)
  let msg = `🎯 *БРАТВА: БОЕВОЙ СОСТАВ НА ТУРНИР (${size}x${size})* 🎯\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `⚜️ *ОСНОВНОЙ СОСТАВ (ТОП-${size}):*\n${startingLines.join('\n')}\n`;
  if (benchLines.length > 0) {
    msg += `────────────────────\n📋 *СКАМЕЙКА ЗАПАСНЫХ (РЕЗЕРВ):*\n${benchLines.join('\n')}\n`;
  }
  msg += `━━━━━━━━━━━━━━━━━━━━\n` +
    `⚡ *Критерии отбора:*\n` +
    `1. Чек-ин готовности [ 🟢 Готов к игре ] перед матчем\n` +
    `2. Безупречная дисциплина (0 страйков)\n` +
    `3. Лучшая результативность в своих последних 5 матчах!\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🌐 *Сайт лиги:* ${WEBSITE_URL}`;
  return msg;
}

const formatLineup = (lang = 'ru') => formatSmartLineup(16, lang);

function getLineupKeyboard(size = 16, currentLang = 'ru', isPrivate = false) {
  const ruLabel = currentLang === 'ru' ? '• 🇷🇺 RU •' : '🇷🇺 RU';
  const enLabel = currentLang === 'en' ? '• 🇬🇧 EN •' : '🇬🇧 EN';
  const arLabel = currentLang === 'ar' ? '• 🇸🇦 AR •' : '🇸🇦 AR';
  const esLabel = currentLang === 'es' ? '• 🇪🇸 ES •' : '🇪🇸 ES';

  const rows = [
    [
      { text: size === 4 ? '• 4v4 •' : '4v4', callback_data: `fmt_lineup_4_${currentLang}` },
      { text: size === 8 ? '• 8v8 •' : '8v8', callback_data: `fmt_lineup_8_${currentLang}` },
      { text: size === 16 ? '• 16v16 •' : '16v16', callback_data: `fmt_lineup_16_${currentLang}` },
      { text: size === 24 ? '• 24v24 •' : '24v24', callback_data: `fmt_lineup_24_${currentLang}` },
      { text: size === 32 ? '• 32v32 •' : '32v32', callback_data: `fmt_lineup_32_${currentLang}` }
    ],
    [
      { text: ruLabel, callback_data: `tab_lineup_${size}_ru` },
      { text: enLabel, callback_data: `tab_lineup_${size}_en` },
      { text: arLabel, callback_data: `tab_lineup_${size}_ar` },
      { text: esLabel, callback_data: `tab_lineup_${size}_es` }
    ]
  ];

  if (isPrivate) {
    rows.push([
      { text: `📢 Post ${size}v${size} Lineup to Channel`, callback_data: `bcast_lineup_${size}` }
    ]);
  }

  rows.push([
    { text: '🌐 Open Official League Website', url: WEBSITE_URL }
  ]);

  return { inline_keyboard: rows };
}

function formatCheckInPrompt(lang = 'ru') {
  const readyPids = Array.from(currentCheckIn.ready);
  const awayPids = Array.from(currentCheckIn.away);
  const { pIndex } = loadLeagueData();
  const regData = inMemoryRegistered || { registrations: {} };

  const readyNames = readyPids.map(id => bidiIsolate(regData.registrations?.[id]?.display_name || pIndex[id]?.display_name || id));
  const awayNames = awayPids.map(id => bidiIsolate(regData.registrations?.[id]?.display_name || pIndex[id]?.display_name || id));

  const readyCount = readyNames.length;
  const awayCount = awayNames.length;

  const now = Date.now();
  const isExpired = !currentCheckIn.active || (currentCheckIn.expiresAt && now >= currentCheckIn.expiresAt);
  const remainingMs = currentCheckIn.expiresAt ? Math.max(0, currentCheckIn.expiresAt - now) : 0;
  const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60000));

  let statusHeader = '';
  let footerText = '';

  if (lang === 'en') {
    statusHeader = !isExpired
      ? `⏳ *STATUS:* 🟢 *OPEN (Closes in: ${remainingMinutes} min | 60 min limit)*`
      : `🔒 *STATUS:* 🔴 *CLOSED (Time Expired — Lineup Finalized)*`;
    footerText = !isExpired
      ? `👉 *Tap a button below to confirm your status:*`
      : `📋 *Check-in closed. View the confirmed starting lineup below:*`;
  } else if (lang === 'ar') {
    statusHeader = !isExpired
      ? `⏳ *الحالة:* 🟢 *تسجيل الحضور مفتوح (متبقي: ${remainingMinutes} دقيقة | مهلة 60 د)*`
      : `🔒 *الحالة:* 🔴 *تم إغلاق تسجيل الحضور (انتهى الوقت المحدد — جاري إعلان التشكيلة)*`;
    footerText = !isExpired
      ? `👉 *اضغط على الزر بالأسفل لتأكيد حالتك الآن:*`
      : `📋 *انتهى وقت التسجيل. يمكنك الاطلاع على التشكيلة الأساسية بالأسفل:*`;
  } else if (lang === 'es') {
    statusHeader = !isExpired
      ? `⏳ *ESTADO:* 🟢 *ABIERTO (Cierra en: ${remainingMinutes} min | 60 min límite)*`
      : `🔒 *ESTADO:* 🔴 *CERRADO (Tiempo agotado — Alineación final)*`;
    footerText = !isExpired
      ? `👉 *Toca un botón abajo para confirmar tu estado:*`
      : `📋 *Check-in finalizado. Consulta la alineación confirmada abajo:*`;
  } else {
    // Russian (Default)
    statusHeader = !isExpired
      ? `⏳ *СТАТУС:* 🟢 *ИДЁТ ЧЕК-ИН (Осталось: ${remainingMinutes} мин | 60 мин лимит)*`
      : `🔒 *СТАТУС:* 🔴 *ЧЕК-ИН ЗАКРЫТ (Время истекло — формируется основа)*`;
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

function formatTournaments(lang = 'ru') {
  const { tournaments } = loadLeagueData();
  const list = (tournaments || []).slice(0, 5);
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

  const totalMatches = fullPlayer.matches ? fullPlayer.matches.length : (indexData.total_matches || 0);
  const totalGoals = fullPlayer.matches ? fullPlayer.matches.reduce((s, m) => s + (m.goals_for || 0), 0) : (indexData.total_goals || 0);
  const avg = totalMatches > 0 ? (totalGoals / totalMatches).toFixed(1) : (indexData.average_goals || 0);
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
    return `⚜️ *BRATVA FCM LEAGUE BOT (24/7 Cloud)* ⚜️\n\n` +
      `📸 *Send tournament screenshots from EA FC Mobile!*\n` +
      `Upload 4-5 screenshots together as an album!\n` +
      `I merge all players (#1 to #32), update the live website, and broadcast recaps to the channel!\n\n` +
      `👥 *Telegram Community (Channel + Group):*\n${COMMUNITY_URL}\n\n` +
      `💬 *Player Profile / AI Chat:* Type any player name (e.g. \`DOXIBERO1\`) for their instant card, or ask any question!\n\n` +
      `📋 *Main Menu:* Choose an option below 👇`;
  }
  if (lang === 'ar') {
    return `⚜️ *بوت دوري براتفا FCM LEAGUE (سحابي 24/7)* ⚜️\n\n` +
      `📸 *أرسل لقطات شاشة (Screenshots) لنتائج بطولة EA FC Mobile!*\n` +
      `يمكنك إرسال حتى 4-5 لقطات شاشة معاً دفعة واحدة كألبوم!\n` +
      `سأقوم بدمج جميع اللاعبين (#1 إلى #32)، وتحديث الموقع الرسمي، وبث التقرير في القناة!\n\n` +
      `👥 *مجتمع تيليجرام (القناة + المجموعة):*\n${COMMUNITY_URL}\n\n` +
      `💬 *الملف الشخصي / الدردشة:* اكتب اسم أي لاعب (مثل \`DOXIBERO1\`) لعرض بطاقته، أو اسأل أي سؤال!\n\n` +
      `📋 *القائمة الرئيسية:* اختر من الأزرار أدناه 👇`;
  }
  if (lang === 'es') {
    return `⚜️ *BOT DE LA LIGA BRATVA FCM (Nube 24/7)* ⚜️\n\n` +
      `📸 *¡Envíame capturas de pantalla del torneo de EA FC Mobile!*\n` +
      `¡Puedes enviar de 4 a 5 capturas juntas como un álbum!\n` +
      `¡Uniré a todos los jugadores (#1 al #32), actualizaré la web oficial y publicaré el resumen en el canal!\n\n` +
      `👥 *Comunidad de Telegram (Canal + Grupo):*\n${COMMUNITY_URL}\n\n` +
      `💬 *Perfil de Jugador / Chat:* ¡Escribe el nombre de cualquier jugador (ej. \`DOXIBERO1\`) para ver su tarjeta o haz cualquier pregunta!\n\n` +
      `📋 *Menú Principal:* Elige una opción abajo 👇`;
  }
  return `⚜️ *БРАТВА FCM LEAGUE BOT (24/7 Cloud)* ⚜️\n\n` +
    `📸 *Отправь мне скриншоты турнира из EA FC Mobile!*\n` +
    `Можешь отправить сразу до 4-5 скриншотов турнира (альбомом)!\n` +
    `Я объединю всех игроков от 1 до 32, обновлю сайт и отправлю отчет в канал!\n\n` +
    `👥 *Telegram Сообщество (Канал + Чат):*\n${COMMUNITY_URL}\n\n` +
    `💬 *Профиль игрока / Чат:* Напиши имя игрока (например \`DOXIBERO1\`), чтобы увидеть карточку, или задай любой вопрос!\n\n` +
    `📋 *Главное меню:* Выберите действие ниже 👇`;
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

function formatVerificationPrompt(lang = 'ru') {
  if (lang === 'en') {
    return `⚜️ *BRATVA FCM — SQUAD ENTRY* ⚜️\n\n` +
      `Welcome to our league! Joining our official channel and team chat is mandatory for all members.\n\n` +
      `👉 *Please send your EA FC Mobile username here in chat*\n` +
      `_(Type it exactly as it appears in the game)_\n\n` +
      `⚡ Once sent, the bot will immediately give you your link to join our official channel & squad chat!`;
  }
  if (lang === 'ar') {
    return `⚜️ *دوري БРАТВА FCM — الانضمام للقناة والفريق* ⚜️\n\n` +
      `أهلاً بك في الفريق! الانضمام إلى القناة الرسمية ومجموعة الفريق إلزامي لجميع اللاعبين.\n\n` +
      `👉 *أرسل اسم المستخدم (username) الخاص بك في EA FC Mobile هنا في المحادثة*\n` +
      `_(اكتب اسمك تماماً كما يظهر داخل اللعبة)_\n\n` +
      `⚡ بمجرد إرسال اسمك، ستحصل فوراً على رابط الدخول إلى القناة والمجموعة الرسمية!`;
  }
  if (lang === 'es') {
    return `⚜️ *BRATVA FCM — ACCESO AL EQUIPO* ⚜️\n\n` +
      `¡Bienvenido a la liga! Unirse al canal oficial y al chat del equipo es obligatorio para todos los participantes.\n\n` +
      `👉 *Envía tu nombre de usuario de EA FC Mobile aquí en el chat*\n` +
      `_(Escríbelo exactamente como aparece en el juego)_\n\n` +
      `⚡ ¡Una vez enviado, el bot te dará de inmediato el enlace para unirte a nuestro canal y chat privado!`;
  }
  return `⚜️ *БРАТВА FCM — ВХОД В КАНАЛ И ЧАТ* ⚜️\n\n` +
    `Приветствуем в нашей лиге! Вход в официальный канал и чат команды обязателен для всех участников.\n\n` +
    `👉 *Напиши свое имя пользователя (username) в EA FC Mobile сюда в чат*\n` +
    `_(В точности так, как в игре)_\n\n` +
    `⚡ Бот сразу выдаст тебе ссылку для входа в наш закрытый канал и чат лиги!`;
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
  if (lang === 'en') {
    return `✅ *ACCOUNT CONFIRMED!* ⚜️\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 *Player:* *${nameIso}*${uidText}\n` +
      `🔰 *Status:* Active Squad Member\n` +
      `────────────────────\n` +
      `⚠️ *IMPORTANT TO READ (MANDATORY):*\n` +
      `Please read our official League Rules by tapping [ 📜 Read League Rules (IMPORTANT) ] below to avoid strikes and removal from the team!\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👉 *Next Step:* Tap buttons below to join our community and read the rules:`;
  }
  if (lang === 'ar') {
    return `✅ *تم تأكيد حسابك بنجاح!* ⚜️\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 *اللاعب:* *${nameIso}*${uidText}\n` +
      `🔰 *الحالة:* عضو نشط في الفريق\n` +
      `────────────────────\n` +
      `⚠️ *تنبيه هام جداً (إلزامي للقراءة):*\n` +
      `يرجى قراءة قوانين الدوري الرسمية بالضغط على [ 📜 اقرأ قوانين الدوري (هام جداً) ] بالأسفل لتجنب الإنذارات والاستبعاد!\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👉 *الخطوة التالية:* اضغط على الأزرار بالأسفل للانضمام للقناة وقراءة القوانين:`;
  }
  if (lang === 'es') {
    return `✅ *¡CUENTA CONFIRMADA CON ÉXITO!* ⚜️\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 *Jugador:* *${nameIso}*${uidText}\n` +
      `🔰 *Estado:* Miembro Activo del Equipo\n` +
      `────────────────────\n` +
      `⚠️ *AVISO IMPORTANTE (LECTURA OBLIGATORIA):*\n` +
      `¡Lee las reglas oficiales de la liga pulsando [ 📜 Leer Reglas (IMPORTANTE) ] abajo para evitar strikes y expulsión!\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👉 *Siguiente paso:* Toca los botones de abajo para unirte al canal y leer las reglas:`;
  }
  return `✅ *АККАУНТ УСПЕШНО ПОДТВЕРЖДЕН!* ⚜️\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 *Игрок:* *${nameIso}*${uidText}\n` +
    `🔰 *Статус:* В составе лиги (Active)\n` +
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

  return {
    inline_keyboard: [
      [
        { text: ruLabel, callback_data: `tab_versuccess_${playerId}_ru` },
        { text: enLabel, callback_data: `tab_versuccess_${playerId}_en` },
        { text: arLabel, callback_data: `tab_versuccess_${playerId}_ar` },
        { text: esLabel, callback_data: `tab_versuccess_${playerId}_es` }
      ],
      [
        { text: rulesBtnLabel, callback_data: `tab_rules_0_${currentLang}` }
      ],
      [
        { text: folderLabel, url: COMMUNITY_URL }
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
  return normName || normPid;
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

  const leadership = [];
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

    const isOwner = key === 'sanya' || (reg && (reg.is_owner || reg.role === 'Owner'));
    const isAdmin = key === 'doxibro' || key === 'doxibero1' || (reg && (reg.is_admin || reg.role === 'Admin'));

    if (isOwner) {
      const tgUser = reg && reg.telegram_username ? ` → @${reg.telegram_username}` : (reg && reg.telegram_id ? ` → ID:${reg.telegram_id}` : '');
      const ownerLabel = lang === 'ar' ? 'مؤسس ورئيس الدوري' :
                         lang === 'es' ? 'Creador y Dueño de la Liga' :
                         lang === 'en' ? 'League Creator & Owner' :
                         'Создатель и Владелец лиги';
      leadership.push(`• 👑 *${clean(pInfo.displayName)}* — ${ownerLabel}${tgUser}`);
    } else if (isAdmin) {
      const tgUser = reg && reg.telegram_username ? ` → @${reg.telegram_username}` : (reg && reg.telegram_id ? ` → ID:${reg.telegram_id}` : '');
      const adminLabel = lang === 'ar' ? 'مسؤول الدوري' :
                         lang === 'es' ? 'Administrador' :
                         lang === 'en' ? 'League Admin' :
                         'Администратор лиги';
      leadership.push(`• 🛡️ *${clean(pInfo.displayName)}* — ${adminLabel}${tgUser}`);
    } else if (reg) {
      const tgUser = reg.telegram_username ? `@${reg.telegram_username}` : (reg.telegram_id ? `ID:${reg.telegram_id}` : 'Verified');
      const uidTag = reg.uid ? ` [UID: ${reg.uid}]` : '';
      const newTag = reg.is_new_member ? ' *(New)*' : '';
      verified.push(`• *${clean(pInfo.displayName)}*${uidTag}${newTag} → ${tgUser}`);
    } else {
      pending.push(`• *${clean(pInfo.displayName)}*`);
    }
  }

  // Sort leadership so Owner is first
  leadership.sort((a, b) => {
    if (a.includes('👑') && !b.includes('👑')) return -1;
    if (!a.includes('👑') && b.includes('👑')) return 1;
    return a.localeCompare(b);
  });

  const total = playersByKey.size;
  const vCount = leadership.length + verified.length;
  const pCount = pending.length;
  const pct = total > 0 ? Math.round((vCount / total) * 100) : 0;

  if (lang === 'en') {
    let msg = `📋 *БРАТВА FCM — TELEGRAM SQUAD AUDIT* ⚜️\n\n` +
      `📊 *Registration Status (3-Day Deadline):*\n` +
      `• Total Roster: *${total}* players\n` +
      `• 👑 Leadership (Owner & Admins): *${leadership.length}* (100% verified)\n` +
      `• ✅ Verified on Telegram: *${vCount}* (${pct}%)\n` +
      `• ❌ Not Registered (To Kick): *${pCount}* (${100 - pct}%)\n\n`;

    if (leadership.length > 0) {
      msg += `👑 *LEAGUE LEADERSHIP (Admins & Owner):*\n${leadership.join('\n')}\n\n`;
    }

    if (pCount > 0) {
      msg += `❌ *PLAYERS NOT YET ON TELEGRAM (${pCount}):*\n` +
        `${pending.slice(0, 30).join('\n')}${pending.length > 30 ? `\n_...and ${pending.length - 30} more_` : ''}\n\n` +
        `⚠️ *Anyone remaining on this ❌ list after the 3-day deadline will be kicked from the in-game league!*\n\n`;
    } else {
      msg += `🎉 *100% SQUAD VERIFIED!* All members have successfully registered on Telegram!\n\n`;
    }

    if (verified.length > 0) {
      msg += `✅ *VERIFIED SQUAD MEMBERS (${verified.length}):*\n` +
        `${verified.slice(0, 20).join('\n')}${verified.length > 20 ? `\n_...and ${verified.length - 20} more_` : ''}`;
    }
    return msg;
  }

  if (lang === 'ar') {
    let msg = `📋 *دوري БРАТВА — تدقيق أعضاء تيليجرام* ⚜️\n\n` +
      `📊 *حالة التسجيل (مهلة 3 أيام):*\n` +
      `• إجمالي اللاعبين: *${total}* لاعباً\n` +
      `• 👑 إدارة الدوري (المالك والمسؤولون): *${leadership.length}* (100% موثقون)\n` +
      `• ✅ المسجلون في تيليجرام: *${vCount}* (${pct}%)\n` +
      `• ❌ غير مسجلين (عرضة للاستبعاد): *${pCount}* (${100 - pct}%)\n\n`;

    if (leadership.length > 0) {
      msg += `👑 *إدارة ورئاسة الدوري (المالك والمسؤولون):*\n${leadership.join('\n')}\n\n`;
    }

    if (pCount > 0) {
      msg += `❌ *أعضاء لم يسجلوا بعد في تيليجرام (${pCount}):*\n` +
        `${pending.slice(0, 30).join('\n')}${pending.length > 30 ? `\n_...و ${pending.length - 30} آخرين_` : ''}\n\n` +
        `⚠️ *كل من يبقى في هذه القائمة ❌ بعد انتهاء مهلة الـ 3 أيام سيتم استبعاده فوراً من الدوري داخل اللعبة!*\n\n`;
    } else {
      msg += `🎉 *اكتمل التوثيق 100%!* جميع أعضاء الفريق انضموا وسجلوا بنجاح في تيليجرام!\n\n`;
    }

    if (verified.length > 0) {
      msg += `✅ *الأعضاء الموثقون (${verified.length}):*\n` +
        `${verified.slice(0, 20).join('\n')}${verified.length > 20 ? `\n_...و ${verified.length - 20} آخرين_` : ''}`;
    }
    return msg;
  }

  if (lang === 'es') {
    let msg = `📋 *БРАТВА FCM — AUDITORÍA DE REGISTRO EN TELEGRAM* ⚜️\n\n` +
      `📊 *Estado de Registro (Plazo de 3 Días):*\n` +
      `• Plantilla Total: *${total}* jugadores\n` +
      `• 👑 Liderazgo (Dueño y Admins): *${leadership.length}* (100% verificados)\n` +
      `• ✅ Verificados en Telegram: *${vCount}* (${pct}%)\n` +
      `• ❌ No Registrados (Para Expulsión): *${pCount}* (${100 - pct}%)\n\n`;

    if (leadership.length > 0) {
      msg += `👑 *LIDERAZGO DE LA LIGA (Dueño y Admins):*\n${leadership.join('\n')}\n\n`;
    }

    if (pCount > 0) {
      msg += `❌ *JUGADORES QUE AÚN NO ESTÁN EN TELEGRAM (${pCount}):*\n` +
        `${pending.slice(0, 30).join('\n')}${pending.length > 30 ? `\n_...y ${pending.length - 30} más_` : ''}\n\n` +
        `⚠️ *¡Cualquiera que permanezca en esta lista ❌ tras 3 días será expulsado de la liga en el juego!*\n\n`;
    } else {
      msg += `🎉 *¡100% DE LA PLANTILLA VERIFICADA!* ¡Todos los miembros están registrados en Telegram!\n\n`;
    }

    if (verified.length > 0) {
      msg += `✅ *MIEMBROS VERIFICADOS (${verified.length}):*\n` +
        `${verified.slice(0, 20).join('\n')}${verified.length > 20 ? `\n_...y ${verified.length - 20} más_` : ''}`;
    }
    return msg;
  }

  // Russian (Default)
  let msg = `📋 *БРАТВА FCM — TELEGRAM SQUAD AUDIT* ⚜️\n\n` +
    `📊 *Статус регистрации (Дедлайн 3 дня / 72ч):*\n` +
    `• Общий состав: *${total}* бойцов\n` +
    `• 👑 Руководство (Владелец и Админы): *${leadership.length}* (100% подтверждены)\n` +
    `• ✅ Подтверждено в Telegram: *${vCount}* (${pct}%)\n` +
    `• ❌ Не зарегистрированы (На кик): *${pCount}* (${100 - pct}%)\n\n`;

  if (leadership.length > 0) {
    msg += `👑 *РУКОВОДСТВО ЛИГИ (Владелец и Админы):*\n${leadership.join('\n')}\n\n`;
  }

  if (pCount > 0) {
    msg += `❌ *ИГРОКИ НЕ В TELEGRAM (${pCount}):*\n` +
      `${pending.slice(0, 30).join('\n')}${pending.length > 30 ? `\n_...и ещё ${pending.length - 30}_` : ''}\n\n` +
      `⚠️ *Все, кто останется в этом списке ❌ после 3 дней (72ч), будут исключены из состава Лиги в игре!*\n\n`;
  } else {
    msg += `🎉 *100% СОСТАВА В TELEGRAM!* Все бойцы успешно подтвердили регистрацию!\n\n`;
  }

  if (verified.length > 0) {
    msg += `✅ *ПОДТВЕРЖДЁННЫЕ УЧАСТНИКИ (${verified.length}):*\n` +
      `${verified.slice(0, 20).join('\n')}${verified.length > 20 ? `\n_...и ещё ${verified.length - 20}_` : ''}`;
  }

  return msg;
}

function getPendingKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🔄 Refresh Audit Live', callback_data: 'cmd_pending' }
      ],
      [
        { text: '📢 Broadcast Welcome to Channel', callback_data: 'bcast_welcome' }
      ],
      [
        { text: '📋 Back to Admin Menu', callback_data: 'cmd_menu' }
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
  const critical = [];
  const warning = [];

  squad.forEach(p => {
    const nameIso = bidiIsolate(p.displayName);
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
      critical.push(`• 🚨 *${nameIso}* — ${reason} (${kickTag})`);
    } else if (p.strikesIn5 > 0) {
      const warnTag = lang === 'ar' ? 'إنذار سترايك ❌' :
                      lang === 'es' ? 'Strike de aviso ❌' :
                      lang === 'en' ? 'Warning strike ❌' : 'Предупреждение ❌';
      warning.push(`• ⚠️ *${nameIso}* — ${p.strikesIn5}/${rules.maxMissesKick} (${warnTag})`);
    }
  });

  if (lang === 'en') {
    let msg = `📋 *БРАТВА INACTIVITY & KICK REVIEW* 📋\n` +
      `━━━━━━━━━━━━━━━━━━━━\n`;
    if (critical.length > 0) msg += `🚨 *CRITICAL: ELIGIBLE FOR KICK (${rules.maxMissesKick}+ STRIKES OR 2x 0/3):*\n${critical.join('\n')}\n────────────────────\n`;
    if (warning.length > 0) msg += `⚠️ *ON NOTICE (1-${rules.maxMissesKick - 1} STRIKES):*\n${warning.join('\n')}\n────────────────────\n`;
    if (critical.length === 0 && warning.length === 0) msg += `✅ *PERFECT SQUAD DISCIPLINE!*\nAll active members have 0 strikes. Squad is 100% active!\n────────────────────\n`;
    msg += `⚖️ *Official Rule:* 3 strikes in 5 matches OR 2 consecutive 0/3 = automatic kick.\n` +
      `🟢 *Decay:* 5 clean matches clears past strikes!\n` +
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
      `🟢 *سقوط الإنذارات:* لعب 5 بطولات متتالية بـ 3/3 يمسح الإنذارات السابقة!\n` +
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
      `🟢 *Limpieza:* ¡5 partidos limpios eliminan los strikes!\n` +
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
    `🟢 *Сгорание:* 5 чистых матчей подряд сжигают страйки!\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🌐 *Полная таблица:* ${WEBSITE_URL}`;
  return msg;
}

function formatRules(lang = 'ru') {
  const rules = getLeagueRules();
  if (lang === 'en') {
    return `📜 *OFFICIAL BRATVA FCM LEAGUE RULEBOOK* 📜\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `1️⃣ ⚽ *Attendance & Turns (Mandatory 3/3):*\n` +
      `• Every member must complete all *${rules.minTurnsPerTournament}/3* turns in every tournament.\n` +
      `• Unplayed turns (<3) = *1 Strike*.\n` +
      `• 🚨 *3 strikes in your last 5 tournaments* = *AUTOMATIC KICK*.\n` +
      `• ⛔ *2 consecutive 0/3 tournaments* = *IMMEDIATE KICK*.\n` +
      `• 🟢 *Decay:* Playing 5 consecutive clean matches (3/3) clears all past strikes!\n` +
      `────────────────────\n` +
      `2️⃣ 📱 *Telegram 3-Day Registration Deadline:*\n` +
      `• Verify your account in this bot and join the channel & chat within *${rules.telegramDeadlineDays || 3} days* of joining the in-game league.\n` +
      `• Unregistered accounts after 3 days = *KICK*.\n` +
      `────────────────────\n` +
      `3️⃣ 🎯 *Goal Target (20+) & Starting Lineup Selection:*\n` +
      `• Minimum benchmark: *${rules.minGoalsPerTournament}+ goals* per tournament.\n` +
      `• Starting spots (4v4, 8v8, 16v16, 24v24, 32v32) are awarded based on:\n` +
      `  1. Checked in as [ 🟢 Ready ] before match start\n` +
      `  2. Clean discipline (0 strikes)\n` +
      `  3. Top scoring average in **your own last 5 matches played**!\n` +
      `────────────────────\n` +
      `4️⃣ 🛡️ *Advance Notice & Excuses:*\n` +
      `• If an emergency occurs, notify admins before check-in closes.\n` +
      `• Admins can excuse an absence via \`/forgive <player>\` (resets strikes to 0).\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👥 *Telegram Community (Channel + Group):*\n${COMMUNITY_URL}\n\n` +
      `🌐 *Official Website:* ${WEBSITE_URL}`;
  }
  if (lang === 'ar') {
    return `📜 *دستور وقوانين دوري БРАТВА FCM الرسمية* 📜\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `1️⃣ ⚽ *الحضور وإكمال الهجمات (إلزامي 3/3):*\n` +
      `• يجب على كل لاعب لعب جميع *${rules.minTurnsPerTournament}/3* محاولات في كل بطولة.\n` +
      `• أي تفويت للمحاولات (<3) = *إنذار (سترايك)*.\n` +
      `• 🚨 *3 إنذارات خلال آخر 5 بطولات* = *طرد نهائي واستبعاد* من الدوري.\n` +
      `• ⛔ *تفويت بطولتين متتاليتين (0/3 مرتين)* = *طرد فوري ومباشر*.\n` +
      `• 🟢 *إلغاء الإنذارات:* لعب 5 بطولات متتالية بـ 3/3 يمسح جميع الإنذارات السابقة!\n` +
      `────────────────────\n` +
      `2️⃣ 📱 *مهلة التسجيل في تيليجرام (3 أيام):*\n` +
      `• كل لاعب ملزم بتأكيد حسابه في البوت والانضمام للقناة خلال *${rules.telegramDeadlineDays || 3} أيام* من انضمامه للدوري في اللعبة.\n` +
      `• الحسابات غير المسجلة بعد 3 أيام = *طرد من الدوري*.\n` +
      `────────────────────\n` +
      `3️⃣ 🎯 *المعدل التهديفي (20+ هدف) واختيار التشكيلة الأساسية:*\n` +
      `• الهدف الأدنى المطلوب: *${rules.minGoalsPerTournament}+ هدف* في البطولة.\n` +
      `• مقاعد التشكيلة الأساسية (4 ضد 4 حتى 32 ضد 32) تُمنح وفق:\n` +
      `  1. تأكيد الجاهزية [ 🟢 أنا جاهز ] قبل بدء البطولة\n` +
      `  2. سجل انضباط نظيف (0 إنذارات)\n` +
      `  3. أعلى معدل تهديفي للاعب في **آخر 5 مباريات لعبها هو شخصياً**!\n` +
      `────────────────────\n` +
      `4️⃣ 🛡️ *الأعذار والغياب الطارئ:*\n` +
      `• في حال وجود ظرف طارئ، يجب إبلاغ الإدارة في شات الفريق قبل إغلاق التسجيل.\n` +
      `• يمكن للإدارة إسقاط الإنذار عبر أمر \`/forgive <اسم_اللاعب>\`.\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👥 *مجتمع تيليجرام الرسمي (القناة + المجموعة):*\n${COMMUNITY_URL}\n\n` +
      `🌐 *الموقع الرسمي للدوري:* ${WEBSITE_URL}`;
  }
  if (lang === 'es') {
    return `📜 *REGLAMENTO OFICIAL DE LA LIGA BRATVA FCM* 📜\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `1️⃣ ⚽ *Asistencia y Turnos (Obligatorio 3/3):*\n` +
      `• Todo jugador debe completar sus *${rules.minTurnsPerTournament}/3* turnos en cada torneo.\n` +
      `• Turnos incompletos (<3) = *1 Strike*.\n` +
      `• 🚨 *3 strikes en tus últimos 5 torneos* = *EXPULSIÓN AUTOMÁTICA*.\n` +
      `• ⛔ *2 torneos consecutivos con 0/3* = *EXPULSIÓN DIRECTA*.\n` +
      `• 🟢 *Limpieza:* ¡5 partidos consecutivos limpios (3/3) eliminan todos los strikes!\n` +
      `────────────────────\n` +
      `2️⃣ 📱 *Plazo de Registro en Telegram (3 Días):*\n` +
      `• Es obligatorio verificar tu cuenta en el bot y unirte al canal/grupo en *${rules.telegramDeadlineDays || 3} días*.\n` +
      `• Sin registrar tras 3 días = *EXPULSIÓN* de la liga.\n` +
      `────────────────────\n` +
      `3️⃣ 🎯 *Objetivo de Goles (20+) y Titularidad:*\n` +
      `• Objetivo mínimo: *${rules.minGoalsPerTournament}+ goles* por torneo.\n` +
      `• La alineación titular (4v4, 8v8, 16v16, 24v24, 32v32) se elige por:\n` +
      `  1. Confirmar [ 🟢 Estoy Listo ] antes del partido\n` +
      `  2. 0 strikes (disciplina perfecta)\n` +
      `  3. Mayor promedio de goles en **tus propios últimos 5 partidos jugados**!\n` +
      `────────────────────\n` +
      `4️⃣ 🛡️ *Avisos y Justificaciones:*\n` +
      `• En caso de emergencia, avisa a los administradores antes del cierre.\n` +
      `• Los administradores pueden justificar con \`/forgive <jugador>\`.\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👥 *Comunidad de Telegram (Canal + Grupo):*\n${COMMUNITY_URL}\n\n` +
      `🌐 *Sitio Oficial:* ${WEBSITE_URL}`;
  }

  // Russian (Default)
  return `📜 *ОФИЦИАЛЬНЫЙ СВОД ПРАВИЛ БРАТВА FCM* 📜\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `1️⃣ ⚽ *Явка и Ходы (Обязательно 3/3):*\n` +
    `• Каждый участник обязан сыграть все *${rules.minTurnsPerTournament}/3* ходов в каждом турнире.\n` +
    `• Несыгранные ходы (<3) = *1 Страйк*.\n` +
    `• 🚨 *3 страйка в последних 5 турнирах* = *АВТОМАТИЧЕСКИЙ КИК*.\n` +
    `• ⛔ *2 турнира подряд по 0/3* = *ПРЯМОЙ КИК*.\n` +
    `• 🟢 *Сгорание:* 5 чистых матчей подряд с 3/3 полностью снимают все страйки!\n` +
    `────────────────────\n` +
    `2️⃣ 📱 *Срок регистрации в Telegram (3 дня):*\n` +
    `• В течение *${rules.telegramDeadlineDays || 3} дней* игрок обязан подтвердить аккаунт в боте и вступить в канал/чат.\n` +
    `• Не зарегистрированные через 3 дня = *КИК* из лиги.\n` +
    `────────────────────\n` +
    `3️⃣ 🎯 *Планка голов и Основа на турниры:*\n` +
    `• Цель лиги: *${rules.minGoalsPerTournament}+ голов* за турнир.\n` +
    `• Стартовый состав (4v4, 8v8, 16v16, 24v24, 32v32) выбирается по:\n` +
    `  1. Чек-ин готовности [ 🟢 Готов к игре ] перед матчем\n` +
    `  2. 0 страйков (строгая дисциплина)\n` +
    `  3. Лучший средний показатель забитых голов в **своих последних 5 матчах**!\n` +
    `────────────────────\n` +
    `4️⃣ 🛡️ *Предупреждения и Уважительные причины:*\n` +
    `• Предупредите админов в чате ДО закрытия сбора.\n` +
    `• Админ может аннулировать страйк командой \`/forgive <игрок>\`.\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👥 *Сообщество лиги (Канал + Чат):*\n${COMMUNITY_URL}\n\n` +
    `🌐 *Официальный сайт:* ${WEBSITE_URL}`;
}

const generateTopScorersMessage = (lang = 'ru') => formatTopScorers(lang);
const generateStrikesMessage = (lang = 'ru') => formatStrikes(lang);
const generateLineupMessage = (lang = 'ru') => formatLineup(lang);
const generateTournamentsMessage = (lang = 'ru') => formatTournaments(lang);
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

function formatLiveAlert(aiResult, lang = 'ru') {
  if (!aiResult) return 'No active live match data.';
  const opp = clean(aiResult.opponent_league || 'OPPONENT');
  const ourG = aiResult.score_bratva || 0;
  const oppG = aiResult.score_opponent || 0;
  const timeInfo = clean(aiResult.time_info || 'Live in progress');
  const unplayed = (aiResult.players || []).filter(p => (p.turns_played !== undefined && p.turns_played < 3) || p.limit_remaining === '3/3');
  const pLines = unplayed.length > 0
    ? unplayed.map(p => `⌛ | ${clean(p.name)} | ${p.turns_played ?? 0}/3`).join('\n')
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

  const dateStr = new Date().toISOString().split('T')[0];
  const oppSlug = (aiResult.opponent_league || 'opponent').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const tId = `${dateStr}_${oppSlug}`;

  const extractedMatches = (aiResult.players || []).map((p, idx) => ({
    board_order: p.board_order || (idx + 1),
    player_id: (p.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || `player_${idx}`,
    player_display_name: p.name,
    ovr: p.ovr || 125,
    goals_for: p.goals !== undefined ? p.goals : 0,
    turns_played: p.turns_played !== undefined ? p.turns_played : (p.limit_remaining === '0/3' ? 3 : (p.limit_remaining === '3/3' ? 0 : 2))
  }));

  let tData = {
    id: tId,
    date: dateStr,
    timestamp: Date.now(),
    opponent_league: aiResult.opponent_league || 'OPPONENT',
    our_total_goals: aiResult.score_bratva || 0,
    opponent_total_goals: aiResult.score_opponent || 0,
    result: (aiResult.score_bratva > aiResult.score_opponent) ? 'win' : (aiResult.score_bratva === aiResult.score_opponent ? 'draw' : 'loss'),
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
  const channelKeys = getLanguageKeyboard('recap', '0', 'ru', false);
  const baseDmKeys = getLanguageKeyboard('recap', '0', 'ru', true);
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
    const existingTIndex = await githubApi(`/repos/${GITHUB_REPO}/contents/docs/league-data/index/tournaments_index.json`);
    let tIndexObj = {};
    if (existingTIndex && existingTIndex.content) {
      try { tIndexObj = JSON.parse(Buffer.from(existingTIndex.content, 'base64').toString('utf8')); } catch (e) {}
    }
    tIndexObj[tId] = {
      date: tData.date,
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

    // 3. Update and Commit players_index.json
    const existingPIndex = await githubApi(`/repos/${GITHUB_REPO}/contents/docs/league-data/index/players_index.json`);
    let pIndexObj = {};
    if (existingPIndex && existingPIndex.content) {
      try { pIndexObj = JSON.parse(Buffer.from(existingPIndex.content, 'base64').toString('utf8')); } catch (e) {}
    }
    tData.matches.forEach(m => {
      const prev = pIndexObj[m.player_id] || {};
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
  const analyzingRes = await sendTelegramMessage(chatId, `🔍 *Analyzing ${count} tournament screenshot${count > 1 ? 's' : ''} together with Gemini 3.6 Flash...*`);
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

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      try {
        const url = new URL(req.url, `https://${req.headers.host || 'bratva-bot.vercel.app'}`);
        if (url.searchParams.get('cron') === 'daily_rally') {
          const rallyMsg = formatRally('ru');
          const rallyKeys = getLanguageKeyboard('rally', '0', 'ru');
          await sendTelegramMessage(CHANNEL_ID, rallyMsg, rallyKeys);
          return sendResponse(res, 200, {
            status: 'success',
            action: 'daily_rally_broadcast',
            channel: CHANNEL_ID,
            timestamp: new Date().toISOString()
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

        if (url.searchParams.get('test_gemini')) {
          const modelToTest = url.searchParams.get('model') || GEMINI_MODEL || 'gemini-2.5-flash';
          const testRes = await new Promise((resolve) => {
            const payload = JSON.stringify({ contents: [{ parts: [{ text: 'Respond strictly with JSON: {"status": "ok"}' }] }] });
            const reqGem = https.request({
              hostname: 'generativelanguage.googleapis.com',
              path: `/v1beta/models/${modelToTest}:generateContent?key=${GEMINI_KEY}`,
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
              }
            }, resG => {
              let d = '';
              resG.on('data', c => d += c);
              resG.on('end', () => resolve({ status: resG.statusCode, body: d }));
            });
            reqGem.on('error', err => resolve({ error: err.message }));
            reqGem.write(payload);
            reqGem.end();
          });
          return sendResponse(res, 200, { tested_model: modelToTest, response: testRes }, true);
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
        const welcomeDm = `👋 *Welcome to BRATVA FCM!* ⚜️\n\n` +
          `⚠️ *IMPORTANT TO READ (هام جداً للقراءة / ВАЖНО К ПРОЧТЕНИЮ):*\n` +
          `Please read our official League Rules to avoid strikes and removal from the team!\n\n` +
          `⚽ *Core Rules:* Complete all 3/3 turns in tournaments & register your in-game name within 3 days.\n\n` +
          `👉 *Tap button below to read the complete rulebook:*`;

        const dmKeys = {
          inline_keyboard: [
            [
              { text: '📜 Read League Rules (IMPORTANT) / اقرأ القوانين', callback_data: 'tab_rules_0_en' }
            ],
            [
              { text: '🌐 Official League Website', url: WEBSITE_URL }
            ]
          ]
        };
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
        const welcomeDm = `👋 *Welcome to BRATVA FCM!* ⚜️\n\n` +
          `⚠️ *IMPORTANT TO READ (هام جداً للقراءة / ВАЖНО К ПРОЧТЕНИЮ):*\n` +
          `Please read our official League Rules to avoid strikes and removal from the team!\n\n` +
          `⚽ *Core Rules:* Complete all 3/3 turns in tournaments & register your in-game name within 3 days.\n\n` +
          `👉 *Tap button below to read the complete rulebook:*`;

        const dmKeys = {
          inline_keyboard: [
            [
              { text: '📜 Read League Rules (IMPORTANT) / اقرأ القوانين', callback_data: 'tab_rules_0_en' }
            ],
            [
              { text: '🌐 Official League Website', url: WEBSITE_URL }
            ]
          ]
        };
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

      // Actions accessible to all squad members:
      const isPublicAction = data.startsWith('tab_') || data.startsWith('ci_') || data.startsWith('fmt_lineup_') ||
                             data === 'cmd_rules' || data === 'cmd_top' || data === 'cmd_lineup' || data === 'cmd_checkin' ||
                             data === 'cmd_recap' || data === 'cmd_mvp' || data === 'cmd_tournaments' || data === 'cmd_mystats' ||
                             data === 'cmd_strikes' || data === 'cmd_kicklist' || data === 'cmd_menu';

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
      // Admin-only actions (buffer analysis, clearing, broadcast to channel, rules editing, audits) require Admin!
      if (!isPublicAction) {
        const userId = cb.from ? cb.from.id : null;
        const isAdmin = await isUserAdmin(userId);
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
          param = parts[2];
          targetLang = parts[3] || 'ru';
        }

        let updatedText = '';
        let updatedKeyboard = null;

        if (category === 'recap') {
          const t = await getLatestTournament();
          updatedText = formatRecap(t, targetLang);
          updatedKeyboard = getLanguageKeyboard('recap', param, targetLang, isCbPrivate);
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
          const size = parseInt(param, 10) || 16;
          updatedText = await formatSmartLineup(size, targetLang);
          updatedKeyboard = getLineupKeyboard(size, targetLang, isCbPrivate);
        } else if (category === 'checkin') {
          const regData = await getRegisteredPlayers();
          syncCurrentCheckInState(regData);
          updatedText = formatCheckInPrompt(targetLang);
          updatedKeyboard = getCheckInKeyboard(targetLang, isCbPrivate);
        } else if (category === 'tournaments') {
          updatedText = formatTournaments(targetLang);
          updatedKeyboard = getLanguageKeyboard('tournaments', '0', targetLang, isCbPrivate);
        } else if (category === 'kicklist') {
          updatedText = await formatKicklist(targetLang);
          updatedKeyboard = getLanguageKeyboard('kicklist', '0', targetLang, isCbPrivate);
        } else if (category === 'menu') {
          updatedText = formatWelcome(targetLang);
          updatedKeyboard = getMainKeyboard(targetLang);
        } else if (category === 'mystats') {
          updatedText = formatMyStatsPrompt(targetLang);
          updatedKeyboard = getLanguageKeyboard('mystats', '0', targetLang, false);
        } else if (category === 'welcome') {
          updatedText = formatChannelWelcome(targetLang);
          updatedKeyboard = getLanguageKeyboard('welcome', '0', targetLang, false);
        } else if (category === 'verify') {
          updatedText = formatVerificationPrompt(targetLang);
          updatedKeyboard = getVerificationKeyboard(targetLang);
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

      if (data.startsWith('bcast_')) {
        const cat = data.replace('bcast_', '');
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
          const t = await getLatestTournament();
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
          const size = parseInt(parts[1], 10) || 16;
          bcastText = await formatSmartLineup(size, 'ru');
          const channelKeyboard = getLineupKeyboard(size, 'ru', false);

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
          await telegramRequest('answerCallbackQuery', {
            callback_query_id: cb.id,
            text: `📢 ${size}v${size} Lineup posted to channel!`
          });
          await sendTelegramMessage(chatId, `✅ *${size}v${size} Starting Lineup posted to ${CHANNEL_ID}!*`, getMainKeyboard('ru'));
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

          await telegramRequest('answerCallbackQuery', {
            callback_query_id: cb.id,
            text: '📢 1-Hour Check-In rally posted to channel!'
          });
          await sendTelegramMessage(chatId, `✅ *Pre-Match Check-In (1-Hour Timer) posted to ${CHANNEL_ID}!*`, getMainKeyboard('ru'));
          return sendResponse(res, 200, 'OK');
        } else if (cat === 'tournaments') {
          bcastText = formatTournaments('ru');
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
          const channelKeyboard = getLanguageKeyboard(cat, '0', 'ru', false);
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
        const size = parseInt(parts[2], 10) || 16;
        const lang = parts[3] || 'ru';
        const updatedText = await formatSmartLineup(size, lang);
        const updatedKeyboard = getLineupKeyboard(size, lang, isCbPrivate);
        await editTelegramMessage(chatId, cb.message.message_id, updatedText, updatedKeyboard);
        await telegramRequest('answerCallbackQuery', { callback_query_id: cb.id, text: `✓ ${size}v${size}` });
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
        const recap = formatRecap(t, 'ru');
        await sendTelegramMessage(chatId, recap, getLanguageKeyboard('recap', '0', 'ru', true));
        await telegramRequest('answerCallbackQuery', { callback_query_id: cb.id });
        return sendResponse(res, 200, 'OK');
      }

      if (data === 'cmd_pending') {
        const auditMsg = await formatPendingAudit('ru');
        await sendTelegramMessage(chatId, auditMsg, getPendingKeyboard());
        await telegramRequest('answerCallbackQuery', { callback_query_id: cb.id, text: 'Audit updated!' });
        return sendResponse(res, 200, 'OK');
      }

      if (data === 'cmd_strikes') {
        const text = await formatStrikes('ru');
        await sendTelegramMessage(chatId, text, getLanguageKeyboard('strikes', '0', 'ru', true));
        await telegramRequest('answerCallbackQuery', { callback_query_id: cb.id });
        return sendResponse(res, 200, 'OK');
      }

      if (data === 'cmd_lineup') {
        const text = await formatSmartLineup(16, 'ru');
        await sendTelegramMessage(chatId, text, getLineupKeyboard(16, 'ru', true));
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
        const text = formatTournaments('ru');
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

      if (data === 'cmd_kicklist') {
        const text = formatKicklist('ru');
        await sendTelegramMessage(chatId, text, getLanguageKeyboard('kicklist', '0', 'ru', true));
        await telegramRequest('answerCallbackQuery', { callback_query_id: cb.id });
        return sendResponse(res, 200, 'OK');
      }

      if (data === 'cmd_mystats') {
        const statsPrompt = formatMyStatsPrompt('ru');
        await sendTelegramMessage(chatId, statsPrompt, getLanguageKeyboard('mystats', '0', 'ru', false));
        await telegramRequest('answerCallbackQuery', { callback_query_id: cb.id });
        return sendResponse(res, 200, 'OK');
      }

      if (data === 'cmd_menu') {
        const welcome = formatWelcome('ru');
        await sendTelegramMessage(chatId, welcome, getMainKeyboard('ru'));
        await telegramRequest('answerCallbackQuery', { callback_query_id: cb.id });
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
    const isAdmin = await isUserAdmin(userId);

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

      const regData = await getRegisteredPlayers();
      const pendingMap = regData.pending_uids || {};
      const pendingEntry = pendingMap[String(userId)];

      // 2. If user is in the middle of sending their in-game UID (duplicate name resolution)
      if (pendingEntry) {
        if (text === '/cancel' || text === '/start') {
          await clearPendingUid(userId);
          const vPrompt = formatVerificationPrompt('ru');
          const vKeys = getVerificationKeyboard('ru');
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

      if (text.startsWith('/checkin') || text.startsWith('/rally')) {
        const ciMsg = formatCheckInPrompt('ru');
        const ciKeys = getCheckInKeyboard('ru', false);
        await sendTelegramMessage(chatId, ciMsg, ciKeys);
        return sendResponse(res, 200, 'OK');
      }

      if (text.startsWith('/lineup')) {
        const parts = text.split(/\s+/);
        const requestedSize = parts[1] ? parseInt(parts[1], 10) : 16;
        const size = [4, 8, 12, 16, 20, 24, 32].includes(requestedSize) ? requestedSize : 16;
        const lineupMsg = await formatSmartLineup(size, 'ru');
        await sendTelegramMessage(chatId, lineupMsg, getLineupKeyboard(size, 'ru', false));
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
        const tMsg = formatTournaments('ru');
        await sendTelegramMessage(chatId, tMsg, getLanguageKeyboard('tournaments', '0', 'ru', false));
        return sendResponse(res, 200, 'OK');
      }

      if (text.startsWith('/mvp') || text.startsWith('/totw')) {
        const mvpMsg = formatMvp('ru');
        await sendTelegramMessage(chatId, mvpMsg, getLanguageKeyboard('mvp', '0', 'ru', false));
        return sendResponse(res, 200, 'OK');
      }

      if (text.startsWith('/player') || text.startsWith('/stats') || text.startsWith('/p ')) {
        const parts = text.split(/\s+/);
        const query = parts.slice(1).join(' ');
        const matched = findPlayerByQuery(query);
        const pid = matched ? matched.player_id : query;
        const pMsg = generatePlayerStatsMessage(query, 'ru');
        await sendTelegramMessage(chatId, pMsg, getPlayerKeyboard(pid, 'ru'));
        return sendResponse(res, 200, 'OK');
      }

      if (text.startsWith('/forgive') || text.startsWith('/clearstrike') || text.startsWith('/excuse') || text.startsWith('/setrules') || text.startsWith('/editrules')) {
        await sendTelegramMessage(chatId, '⛔ *Admin only command.*');
        return sendResponse(res, 200, 'OK');
      }

      // 4. Check if this player is ALREADY verified & registered
      const existingRegs = Object.values(regData.registrations || {}).filter(r => String(r.telegram_id) === String(userId));
      if (existingRegs.length > 0) {
        if (text === '/reset' || text === '/change') {
          for (const reg of existingRegs) {
            delete regData.registrations[reg.player_id];
          }
          await saveRegisteredPlayersRaw(regData, `Player Reset: TG @${existingRegs[0].telegram_username || userId}`);
          const vPrompt = formatVerificationPrompt('ru');
          const vKeys = getVerificationKeyboard('ru');
          await sendTelegramMessage(chatId, vPrompt, vKeys);
          return sendResponse(res, 200, 'Registration reset');
        }

        const names = existingRegs.map(r => r.display_name).filter((v, i, a) => a.indexOf(v) === i).join(' & ');
        const vSuccessText = formatVerificationSuccess(names, existingRegs[0].uid, 'ru');
        const vSuccessKeys = getVerificationSuccessKeyboard(existingRegs[0].player_id, 'ru');
        await sendTelegramMessage(chatId, vSuccessText, vSuccessKeys);
        return sendResponse(res, 200, 'Already registered');
      }

      // 5. New / Unregistered Player -> Show multilingual verification prompt (or rules if deep-linked)
      if (!text || text.startsWith('/start') || text.startsWith('/help') || text.startsWith('/verify')) {
        if (text.includes('rules')) {
          const rulesMsg = formatRules('ru');
          await sendTelegramMessage(chatId, rulesMsg, getLanguageKeyboard('rules', '0', 'ru', false));
          return sendResponse(res, 200, 'OK');
        }
        const vPrompt = formatVerificationPrompt('ru');
        const vKeys = getVerificationKeyboard('ru');
        await sendTelegramMessage(chatId, vPrompt, vKeys);
        return sendResponse(res, 200, 'OK');
      }

      // If unregistered user sends an unhandled slash command, guide them back to verification prompt
      if (text.startsWith('/')) {
        const vPrompt = formatVerificationPrompt('ru');
        const vKeys = getVerificationKeyboard('ru');
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

      const vSuccessText = formatVerificationSuccess(displayName, null, 'ru');
      const vSuccessKeys = getVerificationSuccessKeyboard(playerId, 'ru');
      await sendTelegramMessage(chatId, vSuccessText, vSuccessKeys);
      return sendResponse(res, 200, 'Registration successful');
    }

    // 2.1 Photo processing with High-Speed Issue #1 Buffer + Interactive Button + Auto-Debounce
    if (message.photo && message.photo.length > 0) {
      const largestPhoto = message.photo[message.photo.length - 1];
      const mediaGroupId = message.media_group_id;
      const albumId = mediaGroupId || `chat_${chatId}`;

      // 1. Buffer this photo to GitHub Issue #1 (Fast 150ms HTTP POST, zero Git conflicts!)
      await bufferPhoto(albumId, largestPhoto.file_id, chatId);

      // 2. Fetch current buffer for this album/chat
      const currentItems = await getBufferedPhotos(albumId, chatId);
      const count = currentItems.length;

      // 3. Send interactive control message with "Analyze Now" button
      const keyboard = {
        inline_keyboard: [
          [
            { text: `🚀 Analyze ${count} Screenshot${count > 1 ? 's' : ''} Now`, callback_data: `analyze_${albumId}` }
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

      // 4. For Albums (media_group_id): The first photo waits 22 seconds for mobile upload lag,
      // then auto-processes if user hasn't clicked the button yet!
      if (mediaGroupId && count === 1) {
        await new Promise(resolve => setTimeout(resolve, 22000));
        const pending = await getBufferedPhotos(albumId, chatId);
        if (pending.length > 0) {
          return await processBufferedAlbum(albumId, chatId, res);
        }
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
      const requestedSize = parts[1] ? parseInt(parts[1], 10) : 16;
      const size = [4, 8, 12, 16, 20, 24, 32].includes(requestedSize) ? requestedSize : 16;
      const lineupMsg = await formatSmartLineup(size, 'ru');
      await sendTelegramMessage(chatId, lineupMsg, getLineupKeyboard(size, 'ru', true));
      return sendResponse(res, 200, 'OK');
    }

    if (text.startsWith('/tournaments')) {
      const tMsg = formatTournaments('ru');
      await sendTelegramMessage(chatId, tMsg, getLanguageKeyboard('tournaments', '0', 'ru', true));
      return sendResponse(res, 200, 'OK');
    }

    if (text.startsWith('/player') || text.startsWith('/stats') || text.startsWith('/p ')) {
      const parts = text.split(/\s+/);
      const query = parts.slice(1).join(' ');
      const matched = findPlayerByQuery(query);
      const pid = matched ? matched.player_id : query;
      const pMsg = generatePlayerStatsMessage(query, 'ru');
      await sendTelegramMessage(chatId, pMsg, getPlayerKeyboard(pid, 'ru'));
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

    if (text.startsWith('/rules')) {
      const rules = formatRules('ru');
      await sendTelegramMessage(chatId, rules, getLanguageKeyboard('rules', '0', 'ru', true));
      return sendResponse(res, 200, 'OK');
    }

    if (text.startsWith('/recap') || text.startsWith('/broadcast')) {
      const t = await getLatestTournament();
      const recap = formatRecap(t, 'ru');
      const keys = getTabsKeyboard('ru', 0, true);
      await sendTelegramMessage(chatId, recap, keys);
      return sendResponse(res, 200, 'OK');
    }

    if (text.startsWith('/kicklist') || text.startsWith('/flagged')) {
      const kickMsg = await formatKicklist('ru');
      await sendTelegramMessage(chatId, kickMsg, getLanguageKeyboard('kicklist', '0', 'ru', true));
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
