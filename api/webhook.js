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

function clean(str) {
  return String(str || '').replace(/[_*`\[\]()]/g, ' ').trim();
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

  // 2. ADMIN_USER_IDS environment variable whitelist
  const envAdminIds = (process.env.ADMIN_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (envAdminIds.includes(strId)) {
    adminCache.set(strId, { isAdmin: true, expiresAt: Date.now() + 5 * 60 * 1000 });
    return true;
  }

  // 3. Check Channel Creator or Administrator status on CHANNEL_ID
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

  const lineupLabel = currentLang === 'ar' ? '🎯 التشكيلة المثالية' :
                      currentLang === 'es' ? '🎯 Mejor Alineación' :
                      currentLang === 'en' ? '🎯 Best Lineup' : '🎯 Основа Лиги';

  const strikesLabel = currentLang === 'ar' ? '⛔ الإنذارات والمقصرون' :
                       currentLang === 'es' ? '⛔ Strikes y Deudores' :
                       currentLang === 'en' ? '⛔ Strikes & Debtors' : '⛔ Страйки и Должники';

  const kickLabel = currentLang === 'ar' ? '🚨 مراجعة الاستبعاد' :
                    currentLang === 'es' ? '🚨 Revisión Expulsión' :
                    currentLang === 'en' ? '🚨 Kick Review' : '🚨 Кандидаты на Кик';

  const rulesLabel = currentLang === 'ar' ? '📜 القوانين' :
                     currentLang === 'es' ? '📜 Reglas' :
                     currentLang === 'en' ? '📜 Rules' : '📜 Правила Лиги';

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
        { text: topLabel, callback_data: 'cmd_top' },
        { text: recapLabel, callback_data: 'cmd_recap' }
      ],
      [
        { text: mvpLabel, callback_data: 'cmd_mvp' },
        { text: lineupLabel, callback_data: 'cmd_lineup' }
      ],
      [
        { text: strikesLabel, callback_data: 'cmd_strikes' },
        { text: kickLabel, callback_data: 'cmd_kicklist' }
      ],
      [
        { text: rulesLabel, callback_data: 'cmd_rules' },
        { text: tournLabel, callback_data: 'cmd_tournaments' }
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
    minGoalsPerTournament: 20,
    evaluationHorizon: 3
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
  const opp = clean(t.opponent_league || 'OPPONENT');
  const ourScore = t.our_total_goals || 0;
  const oppScore = t.opponent_total_goals || 0;
  const isWin = ourScore > oppScore;
  const isDraw = ourScore === oppScore;

  const performers = ((t.matches || []).slice()).sort((a, b) => (b.goals_for || 0) - (a.goals_for || 0));
  const mp1 = clean(performers[0]?.player_display_name || 'Player 1');
  const mp1G = performers[0]?.goals_for || 0;
  const mp2 = clean(performers[1]?.player_display_name || 'Player 2');
  const mp2G = performers[1]?.goals_for || 0;
  const mp3 = clean(performers[2]?.player_display_name || 'Player 3');
  const mp3G = performers[2]?.goals_for || 0;

  const missed = [];
  if (t.matches) {
    t.matches.forEach(m => {
      const turns = m.turns_played !== undefined ? m.turns_played : 0;
      if (turns < 3) missed.push(`[ ❌ | ${clean(m.player_display_name)} | ${turns}/3 ]`);
    });
  }

  const squadCount = (t.matches || []).length;

  if (lang === 'en') {
    let outcome = isWin ? 'BIG WIN' : (isDraw ? 'HARD-FOUGHT DRAW' : 'MATCH RESULT');
    let closing = isWin ? "⚡ Awesome game boys! Let's keep winning!" : "⚡ Hard-fought match! Next time we take the win!";
    let strikesText = missed.length > 0
      ? `⛔ *DISCIPLINE & STRIKES:*\n${missed.join('\n')}\n⛔ Strike 1/3! Must play 3/3 in next match or get kicked!`
      : `✅ *100% DISCIPLINE:* All ${squadCount} squad members completed 3/3 turns!`;

    return `⭐ *БРАТВА: ${outcome} vs ${opp}!* ⭐\n\n` +
      `⚽ *Score:* ${ourScore} - ${oppScore} (Squad: ${squadCount} players)\n\n` +
      `⭐ *TOP SCORERS:*\n` +
      `🥇 [ 1 | ${mp1} | ${mp1G}G ]\n` +
      `🥈 [ 2 | ${mp2} | ${mp2G}G ]\n` +
      `🥉 [ 3 | ${mp3} | ${mp3G}G ]\n\n` +
      `${closing}\n\n` +
      `----------------------------\n` +
      `${strikesText}\n\n` +
      `🌐 *Live Standings:*\n${WEBSITE_URL}`;
  } else if (lang === 'ar') {
    const rules = getLeagueRules();
    let outcome = isWin ? 'انتصار كبير' : (isDraw ? 'تعادل بطولي' : 'نتيجة المباراة');
    let closing = isWin ? "⚡ أداء رائع يا أبطال! لنواصل الانتصارات!" : "⚡ مباراة قوية! سنعوض بالفوز في البطولة القادمة بإذن الله!";
    let strikesText = missed.length > 0
      ? `⛔ *الانضباط والإنذارات:*\n${missed.join('\n')}\n⛔ إنذار (سترايك 1/${rules.maxMissesKick})! يجب لعب ${rules.minTurnsPerTournament}/3 في البطولة القادمة لتجنب الاستبعاد!`
      : `✅ *انضباط 100%:* جميع الأعضاء الـ ${squadCount} أكملوا جميع محاولاتهم بنجاح!`;

    return `⭐ *БРАТВА: ${outcome} ضد ${opp}!* ⭐\n\n` +
      `⚽ *النتيجة:* ${ourScore} - ${oppScore} (المشاركون: ${squadCount} لاعب)\n\n` +
      `⭐ *أفضل الهدافين:*\n` +
      `🥇 [ 1 | ${mp1} | ${mp1G} هدف ]\n` +
      `🥈 [ 2 | ${mp2} | ${mp2G} هدف ]\n` +
      `🥉 [ 3 | ${mp3} | ${mp3G} هدف ]\n\n` +
      `${closing}\n\n` +
      `----------------------------\n` +
      `${strikesText}\n\n` +
      `🌐 *الترتيب المباشر:*\n${WEBSITE_URL}`;
  } else if (lang === 'es') {
    let outcome = isWin ? 'GRAN VICTORIA' : (isDraw ? 'EMPATE COMBATIVO' : 'RESULTADO DEL PARTIDO');
    let closing = isWin ? "⚡ ¡Gran partido chavales! ¡A seguir ganando!" : "⚡ ¡Partido reñido! ¡La próxima nos llevamos la victoria!";
    let strikesText = missed.length > 0
      ? `⛔ *DISCIPLINA Y STRIKES:*\n${missed.join('\n')}\n⛔ ¡Strike 1/3! ¡Obligatorio jugar 3/3 en el próximo partido!`
      : `✅ *100% DISCIPLINA:* ¡Todos los ${squadCount} miembros jugaron 3/3 turnos!`;

    return `⭐ *БРАТВА: ${outcome} vs ${opp}!* ⭐\n\n` +
      `⚽ *Resultado:* ${ourScore} - ${oppScore} (${squadCount} jugadores)\n\n` +
      `⭐ *MÁXIMOS GOLEADORES:*\n` +
      `🥇 [ 1 | ${mp1} | ${mp1G}G ]\n` +
      `🥈 [ 2 | ${mp2} | ${mp2G}G ]\n` +
      `🥉 [ 3 | ${mp3} | ${mp3G}G ]\n\n` +
      `${closing}\n\n` +
      `----------------------------\n` +
      `${strikesText}\n\n` +
      `🌐 *Clasificación en vivo:*\n${WEBSITE_URL}`;
  } else {
    // Russian (Default)
    let outcome = isWin ? 'ПОБЕДА' : (isDraw ? 'БОЕВАЯ НИЧЬЯ' : 'МАТЧ');
    let closing = isWin ? "⚡ Красавцы парни! Идем дальше за победами!" : "⚡ Боевой матч! В след. матче только победа!";
    let strikesText = missed.length > 0
      ? `⛔ *ДИСЦИПЛИНА И СТРАЙКИ:*\n${missed.join('\n')}\n⛔ Страйк 1/3! Обязательно 3/3 в след. матче, иначе кик!`
      : `✅ *100% ДИСЦИПЛИНА:* Все ${squadCount} игроков сыграли 3/3!`;

    return `⭐ *БРАТВА: ${outcome} vs ${opp}!* ⭐\n\n` +
      `⚽ *Счет:* ${ourScore} - ${oppScore} (В составе: ${squadCount} игроков)\n\n` +
      `⭐ *ЛУЧШИЕ ИГРОКИ:*\n` +
      `🥇 [ 1 | ${mp1} | ${mp1G}G ]\n` +
      `🥈 [ 2 | ${mp2} | ${mp2G}G ]\n` +
      `🥉 [ 3 | ${mp3} | ${mp3G}G ]\n\n` +
      `${closing}\n\n` +
      `----------------------------\n` +
      `${strikesText}\n\n` +
      `🌐 *Таблица и сайт лиги:*\n${WEBSITE_URL}`;
  }
}

function formatTopScorers(lang = 'ru') {
  const { pIndex } = loadLeagueData();
  const list = Object.entries(pIndex).map(([id, data]) => ({
    id,
    name: clean(data.display_name || id),
    goals: data.total_goals || 0,
    matches: data.total_matches || 0,
    avg: data.average_goals || 0
  })).sort((a, b) => b.goals - a.goals);

  if (list.length === 0) return 'No player stats recorded yet.';

  const top10 = list.slice(0, 10);
  const lines = top10.map((p, idx) => {
    const medal = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : `[ ${idx + 1} ]`));
    if (lang === 'en') return `${medal} *${p.name}* — ${p.goals} goals (${p.matches} matches, avg ${p.avg})`;
    if (lang === 'ar') return `${medal} *${p.name}* — ${p.goals} هدف (${p.matches} مباراة، معدل ${p.avg})`;
    if (lang === 'es') return `${medal} *${p.name}* — ${p.goals} goles (${p.matches} partidos, prom. ${p.avg})`;
    return `${medal} *${p.name}* — ${p.goals} голов (${p.matches} матчей, сред. ${p.avg})`;
  });

  if (lang === 'en') {
    return `🏆 *БРАТВА LEAGUE — TOP SCORERS* 🏆\n\n${lines.join('\n')}\n\n🌐 *Full Standings:* ${WEBSITE_URL}`;
  }
  if (lang === 'ar') {
    return `🏆 *دوري БРАТВА — قائمة الهدافين التاريخيين* 🏆\n\n${lines.join('\n')}\n\n🌐 *الترتيب الكامل:* ${WEBSITE_URL}`;
  }
  if (lang === 'es') {
    return `🏆 *LIGA БРАТВА — MÁXIMOS GOLEADORES* 🏆\n\n${lines.join('\n')}\n\n🌐 *Clasificación completa:* ${WEBSITE_URL}`;
  }
  return `🏆 *БРАТВА LEAGUE — ЛУЧШИЕ БОМБАРДИРЫ* 🏆\n\n${lines.join('\n')}\n\n🌐 *Полная таблица:* ${WEBSITE_URL}`;
}

async function formatStrikes(lang = 'ru') {
  const t = await getLatestTournament();
  if (!t) return 'No match data recorded yet.';
  const rules = getLeagueRules();

  const missed = [];
  if (t.matches) {
    t.matches.forEach(m => {
      const turns = m.turns_played !== undefined ? m.turns_played : 0;
      if (turns < rules.minTurnsPerTournament) missed.push(`⌛ | ${clean(m.player_display_name)} | ${turns}/${rules.minTurnsPerTournament}`);
    });
  }

  if (missed.length === 0) {
    if (lang === 'en') return `✅ *100% SQUAD DISCIPLINE!*\nAll members completed all ${rules.minTurnsPerTournament}/3 turns! Outstanding commitment!\n\n🌐 *Website:* ${WEBSITE_URL}`;
    if (lang === 'ar') return `✅ *انضباط 100% في الفريق!*\nجميع الأعضاء لعبوا ${rules.minTurnsPerTournament}/3 محاولات بنجاح! عمل جماعي رائع!\n\n🌐 *الموقع الرسمي:* ${WEBSITE_URL}`;
    if (lang === 'es') return `✅ *¡100% DISCIPLINA EN EL EQUIPO!*\n¡Todos los miembros jugaron sus 3/3 turnos! ¡Excelente trabajo!\n\n🌐 *Sitio oficial:* ${WEBSITE_URL}`;
    return `✅ *100% ДИСЦИПЛИНА!*\nВсе игроки сыграли 3/3 ходов! Отличная командная работа!\n\n🌐 *Сайт лиги:* ${WEBSITE_URL}`;
  }

  if (lang === 'en') {
    return `⛔ *WARNING: UNPLAYED TURNS:*\n${missed.join('\n')}\n\n` +
      `⚠️ Strike 1/${rules.maxMissesKick} received! Must play all 3/3 in next tournament or face removal!\n\n` +
      `🌐 *Website:* ${WEBSITE_URL}`;
  }
  if (lang === 'ar') {
    return `⛔ *تنبيه: محاولات متبقية لم تُلعب:*\n${missed.join('\n')}\n\n` +
      `⚠️ إنذار (سترايك 1/${rules.maxMissesKick})! يجب لعب جميع المحاولات 3/3 في البطولة القادمة لتجنب الاستبعاد من الدوري!\n\n` +
      `🌐 *الموقع الرسمي:* ${WEBSITE_URL}`;
  }
  if (lang === 'es') {
    return `⛔ *ATENCIÓN: TURNOS PENDIENTES:*\n${missed.join('\n')}\n\n` +
      `⚠️ ¡Strike 1/3 asignado! ¡Obligatorio jugar 3/3 en el próximo partido o serás expulsado!\n\n` +
      `🌐 *Sitio oficial:* ${WEBSITE_URL}`;
  }
  return `⛔ *ВНИМАНИЕ: ПРОПУСКИ ХОДОВ:*\n${missed.join('\n')}\n\n` +
    `⚠️ Получен страйк 1/3! В следующем матче обязательно 3/3, иначе кик!\n\n` +
    `🌐 *Сайт лиги:* ${WEBSITE_URL}`;
}

function formatLineup(lang = 'ru') {
  const { pIndex } = loadLeagueData();
  const list = Object.entries(pIndex).map(([id, data]) => ({
    id,
    name: clean(data.display_name || id),
    goals: data.total_goals || 0,
    matches: data.total_matches || 0,
    avg: data.average_goals || 0,
    strikes: data.eligibility_streak?.current_fail_streak || 0
  })).filter(p => p.strikes === 0).sort((a, b) => b.avg - a.avg);

  const lineup = list.slice(0, 8);
  const lines = lineup.map((p, idx) => {
    if (lang === 'en') return `[ 🟢 | ${idx + 1}. ${p.name} | avg ${p.avg}G | ${p.matches}M ]`;
    if (lang === 'ar') return `[ 🟢 | ${idx + 1}. ${p.name} | معدل ${p.avg} هدف | ${p.matches} مباراة ]`;
    if (lang === 'es') return `[ 🟢 | ${idx + 1}. ${p.name} | prom ${p.avg}G | ${p.matches}P ]`;
    return `[ 🟢 | ${idx + 1}. ${p.name} | сред. ${p.avg}Г | ${p.matches}М ]`;
  });

  if (lang === 'en') {
    return `🎯 *RECOMMENDED COMPETITIVE SQUAD (TOP 8):*\n\n${lines.join('\n')}\n\n` +
      `⚡ Ranked by performance & flawless 100% discipline record!\n🌐 *Website:* ${WEBSITE_URL}`;
  }
  if (lang === 'ar') {
    return `🎯 *التشكيلة الأساسية المقترحة (أفضل 8 لاعبين):*\n\n${lines.join('\n')}\n\n` +
      `⚡ تم الترتيب بناءً على الأداء والانضباط الكامل 100% في جميع البطولات!\n🌐 *الموقع الرسمي:* ${WEBSITE_URL}`;
  }
  if (lang === 'es') {
    return `🎯 *ALINEACIÓN COMPETITIVA RECOMENDADA (TOP 8):*\n\n${lines.join('\n')}\n\n` +
      `⚡ ¡Basado en rendimiento y 100% de disciplina impecable!\n🌐 *Sitio:* ${WEBSITE_URL}`;
  }
  return `🎯 *РЕКОМЕНДОВАННЫЙ СОСТАВ (ТОП-8):*\n\n${lines.join('\n')}\n\n` +
    `⚡ На основе результативности и 100% игровой дисциплины!\n🌐 *Сайт лиги:* ${WEBSITE_URL}`;
}

function formatTournaments(lang = 'ru') {
  const { tournaments } = loadLeagueData();
  const list = (tournaments || []).slice(0, 5);
  if (list.length === 0) return 'No tournaments recorded yet.';

  const lines = list.map(t => {
    let resIcon = '🟢 WIN';
    if (t.result === 'draw') resIcon = '🟡 DRAW';
    if (t.result === 'loss') resIcon = '🔴 LOSS';

    if (lang === 'ru') {
      resIcon = t.result === 'win' ? '🟢 ПОБЕДА' : (t.result === 'draw' ? '🟡 НИЧЬЯ' : '🔴 ПОРАЖЕНИЕ');
    } else if (lang === 'ar') {
      resIcon = t.result === 'win' ? '🟢 فوز' : (t.result === 'draw' ? '🟡 تعادل' : '🔴 خسارة');
    } else if (lang === 'es') {
      resIcon = t.result === 'win' ? '🟢 VICTORIA' : (t.result === 'draw' ? '🟡 EMPATE' : '🔴 DERROTA');
    }

    return `• *vs ${clean(t.opponent_league)}* (${t.date}): ${t.our_total_goals} - ${t.opponent_total_goals} [${resIcon}]`;
  });

  if (lang === 'en') {
    return `📊 *RECENT БРАТВА TOURNAMENTS:*\n\n${lines.join('\n')}\n\n🌐 *Full Match History:* ${WEBSITE_URL}`;
  }
  if (lang === 'ar') {
    return `📊 *آخر بطولات دوري БРАТВА:*\n\n${lines.join('\n')}\n\n🌐 *سجل المباريات الكامل:* ${WEBSITE_URL}`;
  }
  if (lang === 'es') {
    return `📊 *ÚLTIMOS TORNEOS DE БРАТВА:*\n\n${lines.join('\n')}\n\n🌐 *Historial completo:* ${WEBSITE_URL}`;
  }
  return `📊 *ПОСЛЕДНИЕ ТУРНИРЫ БРАТВА:*\n\n${lines.join('\n')}\n\n🌐 *Полная история матчей:* ${WEBSITE_URL}`;
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
  const dName = clean(found.display_name || pid);
  const statusIcon = strikes >= 3 ? '🚨' : (strikes > 0 ? '⚠️' : '✅');
  const profileUrl = `${WEBSITE_URL}?player=${encodeURIComponent(pid)}`;

  if (lang === 'en') {
    const statusText = strikes >= 3 ? 'ELIGIBLE FOR KICK (3+ strikes)' : (strikes > 0 ? `Warning (${strikes}/3 strikes)` : 'Active & Safe (0 strikes)');
    return `👤 *PLAYER PROFILE: ${dName}*\n` +
      `----------------------------\n` +
      `⚽ Total Goals: *${totalGoals}*\n` +
      `🏟️ Tournaments: *${totalMatches}*\n` +
      `📊 Scoring Average: *${avg} goals/match*\n` +
      `⛔ Discipline Status: ${statusIcon} *${statusText}*\n\n` +
      `🌐 *Interactive Profile & Match History:*\n${profileUrl}`;
  }
  if (lang === 'ar') {
    const statusText = strikes >= 3 ? 'مؤهل للاستبعاد (3+ غيابات)' : (strikes > 0 ? `إنذار غياب (${strikes}/3)` : 'نشط ومنضبط (0 غيابات)');
    return `👤 *الملف الشخصي للاعب: ${dName}*\n` +
      `----------------------------\n` +
      `⚽ إجمالي الأهداف: *${totalGoals}*\n` +
      `🏟️ البطولات الملعوبة: *${totalMatches}*\n` +
      `📊 المعدل التهديفي: *${avg} هدف/مباراة*\n` +
      `⛔ حالة الانضباط: ${statusIcon} *${statusText}*\n\n` +
      `🌐 *الملف التفاعلي وسجل المباريات:*\n${profileUrl}`;
  }
  if (lang === 'es') {
    const statusText = strikes >= 3 ? 'APTO PARA EXPULSIÓN (3+ faltas)' : (strikes > 0 ? `Aviso (${strikes}/3 strikes)` : 'Activo y Seguro (0 faltas)');
    return `👤 *PERFIL DEL JUGADOR: ${dName}*\n` +
      `----------------------------\n` +
      `⚽ Goles Totales: *${totalGoals}*\n` +
      `🏟️ Torneos Jugados: *${totalMatches}*\n` +
      `📊 Promedio Goleador: *${avg} goles/partido*\n` +
      `⛔ Estado de Disciplina: ${statusIcon} *${statusText}*\n\n` +
      `🌐 *Perfil Interactivo e Historial:*\n${profileUrl}`;
  }

  const statusText = strikes >= 3 ? 'КАНДИДАТ НА КИК (3+ пропуска)' : (strikes > 0 ? `Предупреждение (${strikes}/3 страйка)` : 'Активен и в норме (0 страйков)');
  return `👤 *ПРОФИЛЬ ИГРОКА: ${dName}*\n` +
    `----------------------------\n` +
    `⚽ Всего голов: *${totalGoals}*\n` +
    `🏟️ Турниров сыграно: *${totalMatches}*\n` +
    `📊 Средняя результативность: *${avg} голов/матч*\n` +
    `⛔ Дисциплина: ${statusIcon} *${statusText}*\n\n` +
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

function formatKicklist(lang = 'ru') {
  const { pIndex } = loadLeagueData();
  const rules = getLeagueRules();
  const critical = [];
  const warning = [];

  Object.entries(pIndex).forEach(([id, data]) => {
    const name = clean(data.display_name || id);
    const streak = data.eligibility_streak?.current_fail_streak || 0;
    const isFlagged = data.eligibility_streak?.flagged_for_review || streak >= rules.maxMissesKick;
    if (isFlagged || streak >= rules.maxMissesKick) {
      if (lang === 'en') critical.push(`🚨 *${name}* — ${streak} consecutive misses (ELIGIBLE FOR KICK ⛔)`);
      else if (lang === 'ar') critical.push(`🚨 *${name}* — ${streak} غيابات متتالية (مؤهل للاستبعاد الفوري ⛔)`);
      else if (lang === 'es') critical.push(`🚨 *${name}* — ${streak} ausencias seguidas (APTO PARA EXPULSIÓN ⛔)`);
      else critical.push(`🚨 *${name}* — ${streak} пропуска подряд (КАНДИДАТ НА КИК ⛔)`);
    } else if (streak > 0) {
      if (lang === 'en') warning.push(`⚠️ *${name}* — ${streak}/${rules.maxMissesKick} misses (Warning strike ❌)`);
      else if (lang === 'ar') warning.push(`⚠️ *${name}* — ${streak}/${rules.maxMissesKick} غيابات (إنذار سترايك ❌)`);
      else if (lang === 'es') warning.push(`⚠️ *${name}* — ${streak}/${rules.maxMissesKick} faltas (Strike de aviso ❌)`);
      else warning.push(`⚠️ *${name}* — ${streak}/${rules.maxMissesKick} пропуска (Предупреждение ❌)`);
    }
  });

  if (lang === 'en') {
    let msg = `📋 *БРАТВА INACTIVITY & KICK REVIEW* 📋\n\n`;
    if (critical.length > 0) msg += `🚨 *CRITICAL: ELIGIBLE FOR IMMEDIATE KICK (${rules.maxMissesKick}+ STRIKES):*\n${critical.join('\n')}\n\n`;
    if (warning.length > 0) msg += `⚠️ *ON NOTICE (1-${rules.maxMissesKick - 1} STRIKES):*\n${warning.join('\n')}\n\n`;
    if (critical.length === 0 && warning.length === 0) msg += `✅ *PERFECT SQUAD DISCIPLINE!*\nAll active members have 0 strikes. Squad is 100% active!\n\n`;
    msg += `⚖️ *Official Rule:* ${rules.maxMissesKick} missed tournaments in a row = automatic kick.\n🌐 *Full Standings:* ${WEBSITE_URL}`;
    return msg;
  }
  if (lang === 'ar') {
    let msg = `📋 *دوري БРАТВА: مراجعة الحضور والغياب* 📋\n\n`;
    if (critical.length > 0) msg += `🚨 *حالة حرجة: مؤهلون للاستبعاد الفوري (${rules.maxMissesKick}+ سترايك):*\n${critical.join('\n')}\n\n`;
    if (warning.length > 0) msg += `⚠️ *تحت الملاحظة (1-${rules.maxMissesKick - 1} سترايك):*\n${warning.join('\n')}\n\n`;
    if (critical.length === 0 && warning.length === 0) msg += `✅ *انضباط مثالي! جميع أعضاء الفريق بدون أي إنذار.*\n\n`;
    msg += `⚖️ *القانون الرسمي:* ${rules.maxMissesKick} غيابات متتالية = استبعاد تلقائي من الدوري.\n🌐 *الترتيب الكامل:* ${WEBSITE_URL}`;
    return msg;
  }
  if (lang === 'es') {
    let msg = `📋 *БРАТВА: AUDITORÍA DE INACTIVIDAD Y EXPULSIONES* 📋\n\n`;
    if (critical.length > 0) msg += `🚨 *CRÍTICO: APTOS PARA EXPULSIÓN INMEDIATA (${rules.maxMissesKick}+ STRIKES):*\n${critical.join('\n')}\n\n`;
    if (warning.length > 0) msg += `⚠️ *BAJO AVISO (1-${rules.maxMissesKick - 1} STRIKES):*\n${warning.join('\n')}\n\n`;
    if (critical.length === 0 && warning.length === 0) msg += `✅ *¡DISCIPLINA PERFECTA! Todos los miembros tienen 0 strikes.*\n\n`;
    msg += `⚖️ *Regla oficial:* ${rules.maxMissesKick} torneos consecutivos sin jugar = expulsión automática.\n🌐 *Clasificación:* ${WEBSITE_URL}`;
    return msg;
  }
  let msg = `📋 *БРАТВА: ПРОВЕРКА АКТИВНОСТИ И КАНДИДАТЫ НА КИК* 📋\n\n`;
  if (critical.length > 0) msg += `🚨 *КРИТИЧНО: КАНДИДАТЫ НА ИСКЛЮЧЕНИЕ (${rules.maxMissesKick}+ СТРАЙКА):*\n${critical.join('\n')}\n\n`;
  if (warning.length > 0) msg += `⚠️ *НА ПРЕДУПРЕЖДЕНИИ (1-${rules.maxMissesKick - 1} СТРАЙКА):*\n${warning.join('\n')}\n\n`;
  if (critical.length === 0 && warning.length === 0) msg += `✅ *ИДЕАЛЬНАЯ ДИСЦИПЛИНА! У всех бойцов 0 страйков. Состав 100% активен!*\n\n`;
  msg += `⚖️ *Правило лиги:* ${rules.maxMissesKick} пропуска турниров подряд = автоматический кик.\n🌐 *Полная таблица:* ${WEBSITE_URL}`;
  return msg;
}

function formatRules(lang = 'ru') {
  const rules = getLeagueRules();
  if (lang === 'en') {
    return `📜 *OFFICIAL БРАТВА LEAGUE RULES:* 📜\n\n` +
      `1. ⚽ Mandatory to play all *${rules.minTurnsPerTournament}/3* turns in every tournament!\n` +
      `2. ⚠️ 1 missed tournament = 1 warning strike (1/${rules.maxMissesKick}).\n` +
      `3. ⛔ ${rules.maxMissesKick} consecutive strikes = automatic removal (kick) from league.\n` +
      `4. 🎯 Target: *${rules.minGoalsPerTournament}+ goals* per tournament!\n\n` +
      `👥 *Telegram Community (Channel + Chat):*\n${COMMUNITY_URL}\n\n` +
      `🌐 *Official Website:* ${WEBSITE_URL}`;
  }
  if (lang === 'ar') {
    return `📜 *قوانين دوري БРАТВА الرسمية:* 📜\n\n` +
      `1. ⚽ إلزامي لعب جميع المحاولات *${rules.minTurnsPerTournament}/3* في كل بطولة!\n` +
      `2. ⚠️ تفويت بطولة واحدة = إنذار سترايك (1/${rules.maxMissesKick}).\n` +
      `3. ⛔ ${rules.maxMissesKick} سترايكات متتالية = استبعاد نهائي ومباشر من الدوري.\n` +
      `4. 🎯 الهدف الأدنى: *${rules.minGoalsPerTournament}+ هدف* في كل بطولة!\n\n` +
      `👥 *مجتمع تيليغرام (القناة + المجموعة):*\n${COMMUNITY_URL}\n\n` +
      `🌐 *الموقع الرسمي:* ${WEBSITE_URL}`;
  }
  if (lang === 'es') {
    return `📜 *REGLAS OFICIALES DE LA LIGA БРАТВА:* 📜\n\n` +
      `1. ⚽ ¡Obligatorio jugar los *${rules.minTurnsPerTournament}/3* turnos en cada torneo!\n` +
      `2. ⚠️ 1 torneo sin jugar = 1 strike de aviso (1/${rules.maxMissesKick}).\n` +
      `3. ⛔ ${rules.maxMissesKick} strikes consecutivos = expulsión automática de la liga.\n` +
      `4. 🎯 Objetivo mínimo: *¡${rules.minGoalsPerTournament}+ goles* por torneo!\n\n` +
      `👥 *Comunidad de Telegram (Canal + Chat):*\n${COMMUNITY_URL}\n\n` +
      `🌐 *Sitio oficial:* ${WEBSITE_URL}`;
  }
  return `📜 *ПРАВИЛА ЛИГИ БРАТВА:* 📜\n\n` +
    `1. ⚽ Обязательно играть *${rules.minTurnsPerTournament}/3* в каждом турнире!\n` +
    `2. ⚠️ 1 пропущенный матч = 1 страйк (1/${rules.maxMissesKick}).\n` +
    `3. ⛔ ${rules.maxMissesKick} страйка подряд = исключение из лиги (кик).\n` +
    `4. 🎯 Планка: *${rules.minGoalsPerTournament}+ голов* за турнир!\n\n` +
    `👥 *Telegram Сообщество (Канал + Чат):*\n${COMMUNITY_URL}\n\n` +
    `🌐 *Сайт лиги:* ${WEBSITE_URL}`;
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
async function handleTournamentResult(aiResult, chatId, res, isAlbum = false) {
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
  const dmKeys = getLanguageKeyboard('recap', '0', 'ru', true);

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

  // Deduplicate unique file_ids while preserving arrival order
  const uniqueFileIds = [];
  for (const it of items) {
    if (it.fileId && !uniqueFileIds.includes(it.fileId)) {
      uniqueFileIds.push(it.fileId);
    }
  }

  const count = uniqueFileIds.length;
  await sendTelegramMessage(chatId, `🔍 *Analyzing ${count} tournament screenshot${count > 1 ? 's' : ''} together with Gemini 3.6 Flash...*`);

  // Clear from buffer immediately to avoid duplicate runs
  const commentIds = items.map(it => it.commentId);
  await clearBufferedPhotos(commentIds);

  try {
    const buffers = await Promise.all(uniqueFileIds.map(fid => downloadTelegramFile(fid)));
    const aiResult = await analyzeImagesWithGemini(buffers);
    return await handleTournamentResult(aiResult, chatId, res, true);
  } catch (err) {
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

    // 1. Handle Callback Query (Buttons)
    if (update.callback_query) {
      const cb = update.callback_query;
      const data = cb.data || '';
      const chatId = cb.message ? cb.message.chat.id : cb.from.id;
      const isCbPrivate = !cb.message || !cb.message.chat || cb.message.chat.type === 'private';

      // If clicked inside a group, only allow in-place language translation tabs (tab_)
      // All other bot actions/menus are strictly blocked from posting into groups!
      if (!isCbPrivate && !data.startsWith('tab_')) {
        await telegramRequest('answerCallbackQuery', {
          callback_query_id: cb.id,
          text: '⚠️ Bot commands & menus are only available in private DM @BratvaFCMBot',
          show_alert: true
        });
        return sendResponse(res, 200, 'Group callback ignored');
      }

      // Security Gate: Translation tabs (tab_) are public for channel subscribers.
      // All other interactive actions (analyze, clear, rules, menus, broadcasts) strictly require Admin!
      if (!data.startsWith('tab_')) {
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
          updatedText = formatLineup(targetLang);
          updatedKeyboard = getLanguageKeyboard('lineup', '0', targetLang, isCbPrivate);
        } else if (category === 'tournaments') {
          updatedText = formatTournaments(targetLang);
          updatedKeyboard = getLanguageKeyboard('tournaments', '0', targetLang, isCbPrivate);
        } else if (category === 'kicklist') {
          updatedText = formatKicklist(targetLang);
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
        } else if (cat === 'lineup') {
          bcastText = formatLineup('ru');
          catName = 'Best Lineup';
        } else if (cat === 'tournaments') {
          bcastText = formatTournaments('ru');
          catName = 'Tournaments Overview';
        } else if (cat === 'kicklist') {
          bcastText = formatKicklist('ru');
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

      if (data === 'cmd_strikes') {
        const text = await formatStrikes('ru');
        await sendTelegramMessage(chatId, text, getLanguageKeyboard('strikes', '0', 'ru', true));
        await telegramRequest('answerCallbackQuery', { callback_query_id: cb.id });
        return sendResponse(res, 200, 'OK');
      }

      if (data === 'cmd_lineup') {
        const text = formatLineup('ru');
        await sendTelegramMessage(chatId, text, getLanguageKeyboard('lineup', '0', 'ru', true));
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

    // Strict Policy: The bot ONLY operates in 1-on-1 private DMs with users.
    // In ALL groups/supergroups (Discussion groups, team chats), the bot is 100% MUTED.
    // Zero commands, zero replies, zero photo processing in groups.
    if (!isPrivate) {
      return sendResponse(res, 200, 'All group messages strictly ignored');
    }

    // 🔒 Admin Security Gate: Players have NO access to the bot.
    // Only verified Administrators / Creator of the league can access bot features.
    const userId = message.from ? message.from.id : null;
    const isAdmin = await isUserAdmin(userId);

    if (!isAdmin) {
      const channelUsername = CHANNEL_ID.startsWith('@') ? CHANNEL_ID.slice(1) : CHANNEL_ID;
      const channelLink = `https://t.me/${channelUsername}`;
      const deniedKeyboard = {
        inline_keyboard: [
          [
            { text: '📢 Official Channel', url: channelLink },
            { text: '🌐 League Website', url: WEBSITE_URL }
          ]
        ]
      };

      const deniedMsg =
        `⛔ *BRATVA FCM — ADMIN PORTAL ONLY*\n\n` +
        `🇷🇺 *Этот бот закрыт для игроков и доступен только администрации лиги.*\n` +
        `🇬🇧 *This bot is strictly private for League Admins only.*\n` +
        `🇸🇦 *هذا البوت مخصص حصرياً لإدارة الدوري. لا يمكن للاعبين استخدامه.*\n` +
        `🇪🇸 *Este bot es de uso exclusivo para los administradores de la liga.*\n\n` +
        `📊 *Players can view all matches, rankings & rules here:*\n` +
        `• 📢 *Telegram Channel:* ${CHANNEL_ID}\n` +
        `• 🌐 *Official Website:* ${WEBSITE_URL}\n\n` +
        `_(ID: \`${userId || 'unknown'}\`)_`;

      await sendTelegramMessage(chatId, deniedMsg, deniedKeyboard);
      return sendResponse(res, 200, 'Non-admin access blocked');
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

      await sendTelegramMessage(
        chatId,
        `📸 *Screenshot received!* (Batch: *${count}* screenshot${count > 1 ? 's' : ''})\n` +
        `👉 Send more screenshots, or tap button below when ready:`,
        keyboard
      );

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
      const lineupMsg = formatLineup('ru');
      await sendTelegramMessage(chatId, lineupMsg, getLanguageKeyboard('lineup', '0', 'ru', true));
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
      const kickMsg = formatKicklist('ru');
      await sendTelegramMessage(chatId, kickMsg, getLanguageKeyboard('kicklist', '0', 'ru', true));
      return sendResponse(res, 200, 'OK');
    }

    if (text.startsWith('/mvp') || text.startsWith('/totw')) {
      const mvpMsg = formatMvp('ru');
      latestMvpMessage = mvpMsg;
      await sendTelegramMessage(chatId, mvpMsg, getLanguageKeyboard('mvp', '0', 'ru', true));
      return sendResponse(res, 200, 'OK');
    }

    if (text.startsWith('/rally') || text.startsWith('/remind')) {
      const rallyMsg = formatRally('ru');
      const rallyKeys = getLanguageKeyboard('rally', '0', 'ru', true);
      await sendTelegramMessage(chatId, rallyMsg, rallyKeys);
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

    // 2.4 Private Chat AI Assistant (Gemini 3.6 Flash) - STRICTLY for private 1-on-1 chat!
    if (isPrivate && text) {
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
