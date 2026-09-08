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

function getMainKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🏆 Top Scorers', callback_data: 'cmd_top' },
        { text: '⭐ Last Recap', callback_data: 'cmd_recap' }
      ],
      [
        { text: '👑 MVP Spotlight', callback_data: 'cmd_mvp' },
        { text: '🎯 Best Lineup', callback_data: 'cmd_lineup' }
      ],
      [
        { text: '⛔ Strikes & Debtors', callback_data: 'cmd_strikes' },
        { text: '🚨 Kick Review', callback_data: 'cmd_kicklist' }
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

function getLanguageKeyboard(category = 'recap', param = '0', currentLang = 'ru') {
  const ruLabel = currentLang === 'ru' ? '• 🇷🇺 RU •' : '🇷🇺 RU';
  const enLabel = currentLang === 'en' ? '• 🇬🇧 EN •' : '🇬🇧 EN';
  const arLabel = currentLang === 'ar' ? '• 🇲🇦 AR •' : '🇲🇦 AR';
  const esLabel = currentLang === 'es' ? '• 🇪🇸 ES •' : '🇪🇸 ES';

  return {
    inline_keyboard: [
      [
        { text: ruLabel, callback_data: `tab_${category}_${param}_ru` },
        { text: enLabel, callback_data: `tab_${category}_${param}_en` },
        { text: arLabel, callback_data: `tab_${category}_${param}_ar` },
        { text: esLabel, callback_data: `tab_${category}_${param}_es` }
      ],
      [
        { text: '🌐 Open Official League Website', url: WEBSITE_URL }
      ]
    ]
  };
}

function getTabsKeyboard(lang, tIndexNum = 0) {
  return getLanguageKeyboard('recap', String(tIndexNum), lang);
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

function generateKicklistMessage() {
  const { pIndex } = loadLeagueData();
  const critical = [];
  const warning = [];

  Object.entries(pIndex).forEach(([id, data]) => {
    const name = clean(data.display_name || id);
    const streak = data.eligibility_streak?.current_fail_streak || 0;
    const isFlagged = data.eligibility_streak?.flagged_for_review || streak >= 3;
    if (isFlagged || streak >= 3) {
      critical.push(`🚨 *${name}* — ${streak} consecutive misses (ELIGIBLE FOR KICK ⛔)`);
    } else if (streak > 0) {
      warning.push(`⚠️ *${name}* — ${streak}/3 misses (Warning strike ❌)`);
    }
  });

  let msg = `📋 *БРАТВА INACTIVITY & KICK REVIEW* 📋\n\n`;
  if (critical.length > 0) {
    msg += `🚨 *CRITICAL: ELIGIBLE FOR IMMEDIATE KICK (3+ STRIKES):*\n${critical.join('\n')}\n\n`;
  }
  if (warning.length > 0) {
    msg += `⚠️ *ON NOTICE (1-2 STRIKES):*\n${warning.join('\n')}\n\n`;
  }
  if (critical.length === 0 && warning.length === 0) {
    msg += `✅ *PERFECT LEAGUE DISCIPLINE!*\nAll active members have 0 strikes. Squad is 100% active!\n\n`;
  }

  msg += `⚖️ *Official Rule:* 3 missed tournaments in a row = automatic kick.\n🌐 *Full Standings:*\n${WEBSITE_URL}`;
  return msg;
}

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
    return `👑 *كتيبة БРАТВА: أفضل لاعب في الأسبوع (MVP)* 👑\n\n` +
      `⭐ *الأسطورة MVP:* *${mvp.name}* 🥇\n` +
      `⚽ مجموع الأهداف: *${mvp.goals}* (${mvp.matches} بطولات، *معدل ${mvp.avg}* بيت/ماتش)\n` +
      `🎯 الانضباط: *100% (0 سترايك)*\n\n` +
      `🥈 *الوصيف (2):* ${runnerUp ? `${runnerUp.name} (${runnerUp.goals} هدف، معدل ${runnerUp.avg})` : '-'}\n` +
      `🥉 *المركز الثالث (3):* ${third ? `${third.name} (${third.goals} هدف، معدل ${third.avg})` : '-'}\n\n` +
      `⚡ أداء استثنائي وتألق كبير مع كتيبة БРАТВА!\n` +
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
  if (lang === 'en') {
    return `⚔️ *БРАТВА LEAGUE: TOURNAMENT RALLY!* ⚔️\n\n` +
      `🛡️ *Attention БРАТВА Squad!* Tournament is LIVE!\n` +
      `⚽ All members must complete *3/3* turns!\n` +
      `🎯 Target: *20+ goals* minimum!\n` +
      `⛔ Missed tournament = strike (3 strikes = automatic kick)!\n\n` +
      `🌐 *League Website:*\n${WEBSITE_URL}`;
  }
  if (lang === 'ar') {
    return `⚔️ *كتيبة БРАТВА: نداء المعركة للجميع!* ⚔️\n\n` +
      `🛡️ *يا شباب БРАТВА!* التورنوا الجديد بدا دابا!\n` +
      `⚽ ضروري كل واحد يلعب *3/3* أشواط ديالو كاملة!\n` +
      `🎯 الهدف الأدنى: *20+ بيت*!\n` +
      `⛔ تضييع الماتش = إنذار سترايك (3 سترايكات = طرد مباشر)!\n\n` +
      `🌐 *الموقع المباشر:*\n${WEBSITE_URL}`;
  }
  if (lang === 'es') {
    return `⚔️ *LIGA БРАТВА: ¡LLAMADA A LA BATALLA!* ⚔️\n\n` +
      `🛡️ *¡Guerreros de БРАТВА!* ¡El nuevo torneo ha comenzado!\n` +
      `⚽ ¡Obligatorio jugar los *3/3* turnos en el partido!\n` +
      `🎯 Objetivo mínimo: *¡20+ goles*!\n` +
      `⛔ Falta en torneo = strike automático (¡3 strikes = expulsión)!\n\n` +
      `🌐 *Sitio oficial:*\n${WEBSITE_URL}`;
  }

  // Russian (Default)
  return `⚔️ *БРАТВА LEAGUE: БОЕВОЙ СБОР!* ⚔️\n\n` +
    `🛡️ *Бойцы БРАТВА!* Новый турнир стартовал!\n` +
    `⚽ Обязательно сыграть *3/3* ходов в матче!\n` +
    `🎯 Планка: *20+ голов*!\n` +
    `⛔ Пропуск турнира = автоматический страйк (3 страйка = кик)!\n\n` +
    `🌐 *Сайт лиги:*\n${WEBSITE_URL}`;
}

const generateRallyMessage = (lang = 'ru') => formatRally(lang);

function formatLiveAlert(aiResult, lang = 'ru') {
  if (!aiResult) return 'No active live match data.';
  const opp = clean(aiResult.opponent_league || 'OPPONENT');
  const ourG = aiResult.score_bratva || 0;
  const oppG = aiResult.score_opponent || 0;
  const timeInfo = clean(aiResult.time_info || 'Live in progress');
  const unplayed = (aiResult.players || []).filter(p => p.turns_played < 3 || p.limit_remaining === '3/3');
  const pLines = unplayed.length > 0
    ? unplayed.map(p => `[ ⏳ | ${clean(p.name)} | ${p.turns_played}/3 ]`).join('\n')
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
    return `🟢 *مباراة مباشرة: ضد ${opp}*\n` +
      `⚽ *النتيجة الحالية:* ${ourG} - ${oppG}\n` +
      `⏳ *الوقت المتبقي:* ${timeInfo}\n\n` +
      `⛔ *تنبيه: لاعبين باقين ما لعبوش كاملين:*\n${pLines}\n\n` +
      `⚡ *مطلوب دابا:* دخلو للعبة وكملو 3/3 أشواط ديالكم لتفادي السترايك!\n\n` +
      `🌐 *الموقع المباشر:* ${WEBSITE_URL}`;
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
    globalLatestLiveResult = aiResult;
    const liveMsg = formatLiveAlert(aiResult, 'multi');
    latestLiveMessage = liveMsg;

    const liveKeys = {
      inline_keyboard: [
        [
          { text: '📢 Post Live Alert to Channel', callback_data: 'bcast_live' }
        ],
        [
          { text: '• 🇷🇺 RU •', callback_data: 'tab_live_0_ru' },
          { text: '🇬🇧 EN', callback_data: 'tab_live_0_en' },
          { text: '🇲🇦 AR', callback_data: 'tab_live_0_ar' },
          { text: '🇪🇸 ES', callback_data: 'tab_live_0_es' }
        ],
        [
          { text: '🌐 Official League Website', url: WEBSITE_URL }
        ]
      ]
    };

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
  const keys = getLanguageKeyboard('recap', '0', 'ru');

  // Send to Channel and User
  await sendTelegramMessage(CHANNEL_ID, recap, keys);
  await sendTelegramMessage(chatId, `🔴 *MATCH COMPLETED & BROADCASTED TO ${CHANNEL_ID}!*`, keys);

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
          updatedKeyboard = getLanguageKeyboard('recap', param, targetLang);
        } else if (category === 'rally') {
          updatedText = formatRally(targetLang);
          updatedKeyboard = getLanguageKeyboard('rally', '0', targetLang);
        } else if (category === 'live') {
          updatedText = formatLiveAlert(globalLatestLiveResult, targetLang);
          updatedKeyboard = getLanguageKeyboard('live', '0', targetLang);
        } else if (category === 'mvp') {
          updatedText = formatMvp(targetLang);
          updatedKeyboard = getLanguageKeyboard('mvp', '0', targetLang);
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

      if (data === 'cmd_top') {
        const text = generateTopScorersMessage();
        await sendTelegramMessage(chatId, text, getMainKeyboard());
        await telegramRequest('answerCallbackQuery', { callback_query_id: cb.id });
        return sendResponse(res, 200, 'OK');
      }

      if (data === 'cmd_recap') {
        const t = await getLatestTournament();
        const recap = formatRecap(t, 'ru');
        await sendTelegramMessage(chatId, recap, getLanguageKeyboard('recap', '0', 'ru'));
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

      if (data === 'bcast_live') {
        const liveMsg = formatLiveAlert(globalLatestLiveResult, 'ru');
        const liveKeys = getLanguageKeyboard('live', '0', 'ru');
        await sendTelegramMessage(CHANNEL_ID, liveMsg, liveKeys);
        await telegramRequest('answerCallbackQuery', { callback_query_id: cb.id, text: '📢 Live alert posted to channel!' });
        await sendTelegramMessage(chatId, `✅ *Live match alert broadcasted to ${CHANNEL_ID}!*`);
        return sendResponse(res, 200, 'OK');
      }

      if (data === 'bcast_mvp') {
        const mvpMsg = formatMvp('ru');
        const mvpKeys = getLanguageKeyboard('mvp', '0', 'ru');
        await sendTelegramMessage(CHANNEL_ID, mvpMsg, mvpKeys);
        await telegramRequest('answerCallbackQuery', { callback_query_id: cb.id, text: '👑 MVP spotlight posted!' });
        await sendTelegramMessage(chatId, `✅ *MVP Spotlight broadcasted to ${CHANNEL_ID}!*`);
        return sendResponse(res, 200, 'OK');
      }

      if (data === 'cmd_mvp') {
        const mvpMsg = formatMvp('ru');
        latestMvpMessage = mvpMsg;
        const mvpKeys = {
          inline_keyboard: [
            [
              { text: '📢 Post MVP to Channel', callback_data: 'bcast_mvp' }
            ],
            [
              { text: '• 🇷🇺 RU •', callback_data: 'tab_mvp_0_ru' },
              { text: '🇬🇧 EN', callback_data: 'tab_mvp_0_en' },
              { text: '🇲🇦 AR', callback_data: 'tab_mvp_0_ar' },
              { text: '🇪🇸 ES', callback_data: 'tab_mvp_0_es' }
            ],
            [
              { text: '🌐 Official League Website', url: WEBSITE_URL }
            ]
          ]
        };
        await sendTelegramMessage(chatId, mvpMsg, mvpKeys);
        await telegramRequest('answerCallbackQuery', { callback_query_id: cb.id });
        return sendResponse(res, 200, 'OK');
      }

      if (data === 'cmd_kicklist') {
        const text = generateKicklistMessage();
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
    const isPrivate = !message.chat || message.chat.type === 'private';
    const text = (message.text || '').trim();

    // In channels or public groups, completely ignore chat so the bot NEVER talks in channel/groups
    if (!isPrivate && !text.startsWith('/')) {
      return sendResponse(res, 200, 'Non-private chatter ignored');
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
      await sendTelegramMessage(chatId, '🧹 *Match cache & screenshot buffer reset!* Ready for fresh screenshots.', getMainKeyboard());
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

    if (text.startsWith('/kicklist') || text.startsWith('/flagged')) {
      const kickMsg = generateKicklistMessage();
      await sendTelegramMessage(chatId, kickMsg, getMainKeyboard());
      return sendResponse(res, 200, 'OK');
    }

    if (text.startsWith('/mvp') || text.startsWith('/totw')) {
      const mvpMsg = formatMvp('ru');
      latestMvpMessage = mvpMsg;
      const mvpKeys = {
        inline_keyboard: [
          [
            { text: '📢 Post MVP to Channel', callback_data: 'bcast_mvp' }
          ],
          [
            { text: '• 🇷🇺 RU •', callback_data: 'tab_mvp_0_ru' },
            { text: '🇬🇧 EN', callback_data: 'tab_mvp_0_en' },
            { text: '🇲🇦 AR', callback_data: 'tab_mvp_0_ar' },
            { text: '🇪🇸 ES', callback_data: 'tab_mvp_0_es' }
          ],
          [
            { text: '🌐 Official League Website', url: WEBSITE_URL }
          ]
        ]
      };
      await sendTelegramMessage(chatId, mvpMsg, mvpKeys);
      return sendResponse(res, 200, 'OK');
    }

    if (text.startsWith('/rally') || text.startsWith('/remind')) {
      const rallyMsg = formatRally('ru');
      const rallyKeys = getLanguageKeyboard('rally', '0', 'ru');
      await sendTelegramMessage(CHANNEL_ID, rallyMsg, rallyKeys);
      await sendTelegramMessage(chatId, `📢 *Tournament rally reminder sent to ${CHANNEL_ID}!*`, getMainKeyboard());
      return sendResponse(res, 200, 'OK');
    }

    if (text.startsWith('/start') || text.startsWith('/help') || text.startsWith('/menu')) {
      const welcome = `⚜️ *БРАТВА FCM LEAGUE BOT (24/7 Cloud)* ⚜️\n\n` +
        `📸 *Отправь мне скриншоты турнира из EA FC Mobile!*\n` +
        `Можешь отправить сразу до 4-5 скриншотов турнира (альбомом)!\n` +
        `Я объединю всех игроков от 1 до 32, обновлю сайт и отправлю отчет в канал!\n\n` +
        `💬 *AI Chat (Private):* Tqder tsowlni direct hna f chat b Darija, English aw Russian!\n\n` +
        `📋 *Доступные команды:* Выберите кнопку ниже 👇`;

      await sendTelegramMessage(chatId, welcome, getMainKeyboard());
      return sendResponse(res, 200, 'OK');
    }

    // 2.3 Private Chat AI Assistant (Gemini 3.6 Flash) - STRICTLY for private 1-on-1 chat!
    if (isPrivate && text) {
      await telegramRequest('sendChatAction', { chat_id: chatId, action: 'typing' });
      try {
        const aiAnswer = await askGeminiAI(text);
        await sendTelegramMessage(chatId, aiAnswer);
        return sendResponse(res, 200, 'OK');
      } catch (chatErr) {
        console.error('Gemini private chat error:', chatErr);
        await sendTelegramMessage(chatId, `🤖 *AI Assistant:* Samhliya, wqe3 mochkil sghir. Jreb 3awed sewelni!`, getMainKeyboard());
        return sendResponse(res, 200, 'OK');
      }
    }

    return sendResponse(res, 200, 'OK');
  } catch (err) {
    console.error('Webhook Top-Level Error:', err);
    return sendResponse(res, 200, 'Error handled: ' + err.message);
  }
}
