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
const GITHUB_REPO = process.env.GITHUB_REPO || 'fc-bratva/fc-bratva.github.io';
const CHANNEL_ID = process.env.CHANNEL_ID || '@BRATVAFCM';
const WEBSITE_URL = 'https://fc-bratva.github.io/';

export const config = {
  maxDuration: 60
};

// Global in-memory cache and state (persists across warm invocations)
let globalLatestTournament = null;
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

function getMainKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🏆 Top Scorers', callback_data: 'cmd_top' },
        { text: '⭐ Last Recap', callback_data: 'cmd_recap' }
      ],
      [
        { text: '⛔ Strikes & Debtors', callback_data: 'cmd_strikes' },
        { text: '🎯 Best Lineup', callback_data: 'cmd_lineup' }
      ],
      [
        { text: '📜 Rules', callback_data: 'cmd_rules' },
        { text: '📊 Tournaments', callback_data: 'cmd_tournaments' }
      ],
      [
        { text: '🌐 Official League Website', url: WEBSITE_URL }
      ]
    ]
  };
}

function getTabsKeyboard(lang, tIndexNum = 0) {
  const ruLabel = lang === 'ru' ? '• 🇷🇺 RU •' : '🇷🇺 RU';
  const enLabel = lang === 'en' ? '• 🇬🇧 EN •' : '🇬🇧 EN';
  const arLabel = lang === 'ar' ? '• 🇲🇦 AR •' : '🇲🇦 AR';
  const esLabel = lang === 'es' ? '• 🇪🇸 ES •' : '🇪🇸 ES';

  return {
    inline_keyboard: [
      [
        { text: ruLabel, callback_data: `tab_${tIndexNum}_ru` },
        { text: enLabel, callback_data: `tab_${tIndexNum}_en` },
        { text: arLabel, callback_data: `tab_${tIndexNum}_ar` },
        { text: esLabel, callback_data: `tab_${tIndexNum}_es` }
      ],
      [
        { text: '🌐 Open Official League Website', url: WEBSITE_URL }
      ]
    ]
  };
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
    let outcome = isWin ? 'انتصار كبير' : (isDraw ? 'تعادل بطولي' : 'نتيجة المباراة');
    let closing = isWin ? "⚡ برافو يا شباب! استمروا في الانتصارات!" : "⚡ ماتش قوي! الماتش الجاي التعويض والفوز!";
    let strikesText = missed.length > 0
      ? `⛔ *قائمة الإنذارات (السترايكات):*\n${missed.join('\n')}\n⛔ إنذار 1/3! لازم تلعب 3/3 الماتش الجاي لتفادي الطرد!`
      : `✅ *انضباط كامل 100%:* كاع ${squadCount} أعضاء لعبو 3/3 أشواط!`;

    return `⭐ *БРАТВА: ${outcome} ضد ${opp}!* ⭐\n\n` +
      `⚽ *النتيجة:* ${ourScore} - ${oppScore} (العدد: ${squadCount} لاعب)\n\n` +
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
    // Russian
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

function generateTopScorersMessage() {
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
    return `${medal} *${p.name}* — ${p.goals} goals (${p.matches} matches, avg ${p.avg})`;
  });

  return `🏆 *БРАТВА LEAGUE — TOP SCORERS* 🏆\n\n${lines.join('\n')}\n\n🌐 *Full Standings:*\n${WEBSITE_URL}`;
}

async function generateStrikesMessage() {
  const t = await getLatestTournament();
  if (!t) return 'No match data recorded yet.';

  const missed = [];
  if (t.matches) {
    t.matches.forEach(m => {
      const turns = m.turns_played !== undefined ? m.turns_played : 0;
      if (turns < 3) missed.push(`[ ❌ | ${clean(m.player_display_name)} | ${turns}/3 ]`);
    });
  }

  if (missed.length === 0) {
    return `✅ *100% ДИСЦИПЛИНА / 100% DISCIPLINE:*\nВсе игроки сыграли 3/3!\nAll members completed 3/3 turns!\n\n🌐 *Website:*\n${WEBSITE_URL}`;
  }

  return `⛔ *ВНИМАНИЕ / ATTENTION PLEASE:*\n${missed.join('\n')}\n\n` +
    `⛔ Страйк 1/3! Обязательно 3/3 в след. матче, иначе кик!\n` +
    `⛔ Strike 1/3! Must play 3/3 in next match or get kicked!\n\n` +
    `🌐 *Website:*\n${WEBSITE_URL}`;
}

function generateLineupMessage() {
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
  const lines = lineup.map((p, idx) => `[ 🟢 | ${idx + 1}. ${p.name} | avg ${p.avg}G | ${p.matches}M ]`);

  return `🎯 *РЕКОМЕНДОВАННЫЙ СОСТАВ / RECOMMENDED LINEUP (TOP 8):*\n\n` +
    `${lines.join('\n')}\n\n` +
    `⚡ Based on performance & 100% discipline record!\n` +
    `🌐 *Website:*\n${WEBSITE_URL}`;
}

async function generateTournamentsMessage() {
  const { tournaments } = loadLeagueData();
  const list = (tournaments || []).slice(0, 5);
  if (list.length === 0) return 'No tournaments recorded yet.';

  const lines = list.map(t => {
    const resIcon = t.result === 'win' ? '🟢 WIN' : (t.result === 'draw' ? '🟡 DRAW' : '🔴 LOSS');
    return `• *vs ${clean(t.opponent_league)}* (${t.date}): ${t.our_total_goals} - ${t.opponent_total_goals} [${resIcon}]`;
  });

  return `📊 *RECENT TOURNAMENTS / ПОСЛЕДНИЕ ТУРНИРЫ:*\n\n${lines.join('\n')}\n\n🌐 *Full Match History:*\n${WEBSITE_URL}`;
}

function generatePlayerStatsMessage(query) {
  if (!query || !query.trim()) {
    return '⚠️ Please specify a player name, e.g.: `/player DOXIBERO1`';
  }
  const { pIndex, players } = loadLeagueData();
  const q = query.trim().toLowerCase();

  const found = players.find(p => {
    if (!p) return false;
    const pid = (p.player_id || '').toLowerCase();
    const dname = (p.display_name || '').toLowerCase();
    const aliases = (p.known_aliases || []).map(a => a.toLowerCase());
    return pid === q || dname === q || pid.includes(q) || dname.includes(q) || aliases.some(a => a.includes(q));
  });

  if (!found) {
    return `❌ Player "${clean(query)}" not found. Try /top to view top players list.\n🌐 ${WEBSITE_URL}`;
  }

  const indexData = pIndex[found.player_id] || {};
  const totalMatches = found.matches ? found.matches.length : (indexData.total_matches || 0);
  const totalGoals = found.matches ? found.matches.reduce((s, m) => s + (m.goals_for || 0), 0) : (indexData.total_goals || 0);
  const avg = totalMatches > 0 ? (totalGoals / totalMatches).toFixed(1) : 0;
  const strikes = indexData.eligibility_streak?.current_fail_streak || 0;

  return `👤 *PLAYER PROFILE: ${clean(found.display_name)}*\n` +
    `----------------------------\n` +
    `⚽ Total Goals: *${totalGoals}*\n` +
    `🏟️ Tournaments: *${totalMatches}*\n` +
    `📊 Average: *${avg} goals/match*\n` +
    `⛔ Current Strikes: *${strikes}*\n\n` +
    `🌐 *Full Player Stats:*\n${WEBSITE_URL}`;
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
    const unplayed = (aiResult.players || []).filter(p => p.turns_played < 3 || p.limit_remaining === '3/3');
    const pLines = unplayed.map(p => `[ ⏳ | ${clean(p.name)} | ${p.turns_played}/3 ]`).join('\n');
    const liveMsg = `🟢 *LIVE MATCH: vs ${clean(aiResult.opponent_league)}*\nScore: ${aiResult.score_bratva} - ${aiResult.score_opponent}\n\n` +
      `⛔ *ATTENTION PLEASE:*\n${pLines}\n\n⏳ Match ending soon! Attack 3/3 ASAP!`;
    await sendTelegramMessage(chatId, liveMsg);
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
  const keys = getTabsKeyboard('ru', 0);

  // Send to Channel and User
  await sendTelegramMessage(CHANNEL_ID, recap, keys);
  await sendTelegramMessage(chatId, `🔴 *MATCH COMPLETED & BROADCASTED TO ${CHANNEL_ID}!*\n\n${recap}`, keys);

  // Commit to GitHub asynchronously
  githubApi(`/repos/${GITHUB_REPO}/contents/docs/league-data/tournaments/${tId}.json`)
    .then(existingFile => {
      const fileContent = Buffer.from(JSON.stringify(tData, null, 2)).toString('base64');
      const commitPayload = {
        message: `Auto-Update: Recorded tournament vs ${tData.opponent_league} (${tData.matches.length} players)`,
        content: fileContent
      };
      if (existingFile && existingFile.sha) commitPayload.sha = existingFile.sha;
      return githubApi(`/repos/${GITHUB_REPO}/contents/docs/league-data/tournaments/${tId}.json`, 'PUT', commitPayload);
    })
    .catch(ghErr => console.error('GitHub API Commit Error:', ghErr));

  return sendResponse(res, 200, 'OK');
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
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

      if (data.startsWith('tab_')) {
        const parts = data.split('_');
        const tIndexNum = parseInt(parts[1], 10) || 0;
        const targetLang = parts[2] || 'ru';

        const t = await getLatestTournament();
        const updatedText = formatRecap(t, targetLang);
        const updatedKeyboard = getTabsKeyboard(targetLang, tIndexNum);

        await editTelegramMessage(chatId, cb.message.message_id, updatedText, updatedKeyboard);
        await telegramRequest('answerCallbackQuery', {
          callback_query_id: cb.id,
          text: `✓ ${targetLang.toUpperCase()}`
        });
        return sendResponse(res, 200, 'OK');
      }

      if (data === 'cmd_top') {
        const text = generateTopScorersMessage();
        await sendTelegramMessage(chatId, text, getMainKeyboard());
        await telegramRequest('answerCallbackQuery', { callback_query_id: cb.id });
        return sendResponse(res, 200, 'OK');
      }

      if (data === 'cmd_recap') {
        const t = await getLatestTournament();
        const recap = formatRecap(t, 'ru');
        await sendTelegramMessage(chatId, recap, getTabsKeyboard('ru', 0));
        await telegramRequest('answerCallbackQuery', { callback_query_id: cb.id });
        return sendResponse(res, 200, 'OK');
      }

      if (data === 'cmd_strikes') {
        const text = await generateStrikesMessage();
        await sendTelegramMessage(chatId, text, getMainKeyboard());
        await telegramRequest('answerCallbackQuery', { callback_query_id: cb.id });
        return sendResponse(res, 200, 'OK');
      }

      if (data === 'cmd_lineup') {
        const text = generateLineupMessage();
        await sendTelegramMessage(chatId, text, getMainKeyboard());
        await telegramRequest('answerCallbackQuery', { callback_query_id: cb.id });
        return sendResponse(res, 200, 'OK');
      }

      if (data === 'cmd_rules') {
        const rules = `📜 *ПРАВИЛА ЛИГИ БРАТВА:*\n\n` +
          `1. Обязательно играть 3/3 в каждом турнире!\n` +
          `2. 1 пропущенный матч = 1 страйк (1/3).\n` +
          `3. 3 страйка = исключение из лиги.\n\n` +
          `🌐 *Сайт лиги:* ${WEBSITE_URL}`;
        await sendTelegramMessage(chatId, rules, getMainKeyboard());
        await telegramRequest('answerCallbackQuery', { callback_query_id: cb.id });
        return sendResponse(res, 200, 'OK');
      }

      if (data === 'cmd_tournaments') {
        const text = await generateTournamentsMessage();
        await sendTelegramMessage(chatId, text, getMainKeyboard());
        await telegramRequest('answerCallbackQuery', { callback_query_id: cb.id });
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
    const text = (message.text || '').trim();

    // 2.1 Photo processing with Cross-Instance Coordination & Album Support
    if (message.photo && message.photo.length > 0) {
      const mediaGroupId = message.media_group_id;
      const largestPhoto = message.photo[message.photo.length - 1];
      const photoId = largestPhoto.file_unique_id || largestPhoto.file_id;

      // Multi-Screenshot Album (Media Group)
      if (mediaGroupId) {
        // Step A: Register photo into shared GitHub temp store
        const tempFileName = `album_${mediaGroupId}_${message.message_id}.json`;
        const tempContent = Buffer.from(JSON.stringify({ fileId: largestPhoto.file_id, chatId })).toString('base64');
        await githubApi(`/repos/${GITHUB_REPO}/contents/.tmp/${tempFileName}`, 'PUT', {
          message: `temp album photo ${tempFileName}`,
          content: tempContent
        });

        // Step B: Elect atomic leader via GitHub distributed lock
        const lockRes = await githubApi(`/repos/${GITHUB_REPO}/contents/.tmp/lock_${mediaGroupId}.json`, 'PUT', {
          message: `lock for album ${mediaGroupId}`,
          content: Buffer.from(JSON.stringify({ leaderId: message.message_id, time: Date.now() })).toString('base64')
        });

        const isLeader = Boolean(lockRes && lockRes.content && lockRes.content.sha);
        if (!isLeader) {
          // Secondary request of the same media group (follower container): photo registered, exit cleanly
          return sendResponse(res, 200, 'Photo registered in album');
        }

        // Designated leader: Wait 4500ms for all sibling photos in the album to arrive and register
        await new Promise(resolve => setTimeout(resolve, 4500));

        // Fetch all album photos from GitHub .tmp
        const tmpFiles = await githubApi(`/repos/${GITHUB_REPO}/contents/.tmp`);
        let albumFileIds = [];
        const lockSha = lockRes.content.sha;

        if (Array.isArray(tmpFiles)) {
          const matching = tmpFiles.filter(f => f.name && f.name.startsWith(`album_${mediaGroupId}_`));
          for (const f of matching) {
            try {
              const fData = await githubApi(`/repos/${GITHUB_REPO}/contents/${f.path}`);
              if (fData && fData.content) {
                const parsed = JSON.parse(Buffer.from(fData.content, 'base64').toString('utf8'));
                if (parsed.fileId && !albumFileIds.includes(parsed.fileId)) {
                  albumFileIds.push(parsed.fileId);
                }
              }
              // Cleanup temp file asynchronously
              githubApi(`/repos/${GITHUB_REPO}/contents/${f.path}`, 'DELETE', {
                message: 'cleanup temp album photo',
                sha: f.sha
              }).catch(() => {});
            } catch (e) {}
          }
        }

        // Cleanup lock file asynchronously
        githubApi(`/repos/${GITHUB_REPO}/contents/.tmp/lock_${mediaGroupId}.json`, 'DELETE', {
          message: 'cleanup album lock',
          sha: lockSha
        }).catch(() => {});

        if (albumFileIds.length === 0) albumFileIds = [largestPhoto.file_id];

        const count = albumFileIds.length;
        await sendTelegramMessage(chatId, `🔍 *Analyzing ${count} tournament screenshots together with Gemini 3.6 Flash...*`);

        const buffers = await Promise.all(albumFileIds.map(fid => downloadTelegramFile(fid)));
        const aiResult = await analyzeImagesWithGemini(buffers);

        return await handleTournamentResult(aiResult, chatId, res, true);
      }

      // Single photo uploaded individually
      if (processingPhotos.has(photoId)) {
        return sendResponse(res, 200, 'Duplicate photo dropped');
      }
      processingPhotos.add(photoId);
      setTimeout(() => processingPhotos.delete(photoId), 90000);

      await sendTelegramMessage(chatId, '🔍 *Analyzing tournament screenshot with Gemini 3.6 Flash...*');
      const imgBuffer = await downloadTelegramFile(largestPhoto.file_id);
      const aiResult = await analyzeImagesWithGemini([imgBuffer]);

      return await handleTournamentResult(aiResult, chatId, res, false);
    }

    // 2.2 Text Command Routing
    if (text.startsWith('/reset') || text.startsWith('/clear')) {
      globalLatestTournament = null;
      await sendTelegramMessage(chatId, '🧹 *Match cache reset!* You can now send fresh screenshots for a clean start.', getMainKeyboard());
      return sendResponse(res, 200, 'OK');
    }

    if (text.startsWith('/top') || text.startsWith('/leaderboard')) {
      const topMsg = generateTopScorersMessage();
      await sendTelegramMessage(chatId, topMsg, getMainKeyboard());
      return sendResponse(res, 200, 'OK');
    }

    if (text.startsWith('/strikes')) {
      const strikesMsg = await generateStrikesMessage();
      await sendTelegramMessage(chatId, strikesMsg, getMainKeyboard());
      return sendResponse(res, 200, 'OK');
    }

    if (text.startsWith('/lineup')) {
      const lineupMsg = generateLineupMessage();
      await sendTelegramMessage(chatId, lineupMsg, getMainKeyboard());
      return sendResponse(res, 200, 'OK');
    }

    if (text.startsWith('/tournaments')) {
      const tMsg = await generateTournamentsMessage();
      await sendTelegramMessage(chatId, tMsg, getMainKeyboard());
      return sendResponse(res, 200, 'OK');
    }

    if (text.startsWith('/player') || text.startsWith('/stats') || text.startsWith('/p ')) {
      const parts = text.split(/\s+/);
      const query = parts.slice(1).join(' ');
      const pMsg = generatePlayerStatsMessage(query);
      await sendTelegramMessage(chatId, pMsg, getMainKeyboard());
      return sendResponse(res, 200, 'OK');
    }

    if (text.startsWith('/rules')) {
      const rules = `📜 *ПРАВИЛА ЛИГИ БРАТВА:*\n\n` +
        `1. Обязательно играть 3/3 в каждом турнире!\n` +
        `2. 1 пропущенный матч = 1 страйк (1/3).\n` +
        `3. 3 страйка = исключение из лиги.\n\n` +
        `🌐 *Сайт лиги:* ${WEBSITE_URL}`;
      await sendTelegramMessage(chatId, rules, getMainKeyboard());
      return sendResponse(res, 200, 'OK');
    }

    if (text.startsWith('/recap') || text.startsWith('/broadcast')) {
      const t = await getLatestTournament();
      const recap = formatRecap(t, 'ru');
      const keys = getTabsKeyboard('ru', 0);
      await sendTelegramMessage(chatId, recap, keys);
      return sendResponse(res, 200, 'OK');
    }

    // 2.3 Default fallback (Welcome & Interactive Menu for ANY text)
    const welcome = `⚜️ *БРАТВА FCM LEAGUE BOT (24/7 Cloud)* ⚜️\n\n` +
      `📸 *Отправь мне скриншоты турнира из EA FC Mobile!*\n` +
      `Можешь отправить сразу до 4-5 скриншотов турнира (альбомом)!\n` +
      `Я объединю всех игроков от 1 до 32, обновлю сайт и отправлю отчет в канал!\n\n` +
      `📋 *Доступные команды:* Выберите кнопку ниже 👇`;

    await sendTelegramMessage(chatId, welcome, getMainKeyboard());
    return sendResponse(res, 200, 'OK');
  } catch (err) {
    console.error('Webhook Top-Level Error:', err);
    return sendResponse(res, 200, 'Error handled: ' + err.message);
  }
}
