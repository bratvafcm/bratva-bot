/**
 * БРАТВА FCM LEAGUE TELEGRAM BOT
 * Powered by Telegram Bot API + Google Gemini 3.5 Flash Vision AI
 * Features:
 *  - 100% Secure: Admin Passcode Protection (bratva2026 / admin123)
 *  - Multilingual: Choose language first (English, Arabic, Russian, Spanish)
 *  - Vision AI: Automatic LIVE vs HISTORY recognition
 *  - Auto-Database & Git Sync
 *  - Zero external npm dependencies - Vanilla Node.js!
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec } = require('child_process');

// Load configuration
const configPath = path.join(__dirname, 'config.json');
const userSettingsPath = path.join(__dirname, 'user_settings.json');

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
if (!config.admin_passcodes) config.admin_passcodes = ['bratva2026', 'admin123'];
if (!config.authorized_users) config.authorized_users = [];

let userSettings = {};
if (fs.existsSync(userSettingsPath)) {
  try { userSettings = JSON.parse(fs.readFileSync(userSettingsPath, 'utf8')); } catch (e) {}
}

function saveUserSettings() {
  fs.writeFileSync(userSettingsPath, JSON.stringify(userSettings, null, 2), 'utf8');
}

function saveConfig() {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}

const TELEGRAM_TOKEN = config.telegram_token;
const GEMINI_KEY = config.gemini_key;
const GEMINI_MODEL = config.gemini_model || 'gemini-3.5-flash';
const PROJECT_ROOT = path.resolve(__dirname, '..');

const TOURNAMENTS_DIR = path.join(PROJECT_ROOT, 'docs', 'league-data', 'tournaments');
const PLAYERS_DIR = path.join(PROJECT_ROOT, 'docs', 'league-data', 'players');
const T_INDEX_PATH = path.join(PROJECT_ROOT, 'docs', 'league-data', 'index', 'tournaments_index.json');
const P_INDEX_PATH = path.join(PROJECT_ROOT, 'docs', 'league-data', 'index', 'players_index.json');

const agent = new https.Agent({ keepAlive: true, timeout: 45000 });

// Helper: Telegram API Request
function telegramRequest(method, params = {}) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(params);
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${TELEGRAM_TOKEN}/${method}`,
      method: 'POST',
      agent: agent,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Helper: Send Message to Telegram Chat
async function sendMessage(chatId, text, parseMode = null, replyMarkup = null) {
  const params = { chat_id: chatId, text };
  if (parseMode) params.parse_mode = parseMode;
  if (replyMarkup) params.reply_markup = replyMarkup;
  return telegramRequest('sendMessage', params);
}

// Helper: Answer Callback Query (for inline buttons)
async function answerCallbackQuery(callbackQueryId, text = null, showAlert = false) {
  const params = { callback_query_id: callbackQueryId };
  if (text) params.text = text;
  if (showAlert) params.show_alert = showAlert;
  return telegramRequest('answerCallbackQuery', params);
}

// Helper: Edit Message Text (for dynamic language tabs in-place)
async function editMessageText(chatId, messageId, text, parseMode = null, replyMarkup = null) {
  const params = { chat_id: chatId, message_id: messageId, text };
  if (parseMode) params.parse_mode = parseMode;
  if (replyMarkup) params.reply_markup = replyMarkup;
  return telegramRequest('editMessageText', params);
}

// Helper: Download file from Telegram
function downloadTelegramFile(fileId) {
  return new Promise(async (resolve, reject) => {
    try {
      const fileInfo = await telegramRequest('getFile', { file_id: fileId });
      if (!fileInfo.ok || !fileInfo.result || !fileInfo.result.file_path) {
        return reject(new Error('Failed to get file path from Telegram'));
      }
      const filePath = fileInfo.result.file_path;
      const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${filePath}`;

      https.get(fileUrl, { agent }, res => {
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

// Helper: Gemini Vision AI Analysis
function analyzeImageWithGemini(imageBuffer) {
  return new Promise((resolve, reject) => {
    const base64Data = imageBuffer.toString('base64');
    const prompt = `You are the expert data extraction assistant for EA Sports FC Mobile league "БРАТВА".

FIRST CRITICAL STEP: VALIDATE SCREENSHOT
Examine if this image is genuinely a tournament match screen of EA Sports FC Mobile (showing league tournament score, turns, or player lists for a league match).
If the image is NOT an EA Sports FC Mobile league tournament screen (for example: random photo, meme, real-life picture, general chat, main menu, pack opening, market screen, or unrelated game), return ONLY:
{
  "is_tournament_screenshot": false,
  "rejection_reason": "Not an EA Sports FC Mobile league tournament screen"
}

If it IS a valid league tournament screenshot, return ONLY a valid, raw JSON object (no markdown ticks, no backticks, no markdown code block) with this schema:
{
  "is_tournament_screenshot": true,
  "status": "LIVE" or "HISTORY",
  "time_info": "e.g. 03:49:49 or 19 HOURS AGO or 1 DAY AGO",
  "opponent_league": "Opponent team name exactly as written",
  "score_bratva": number (goals for БРАТВА),
  "score_opponent": number (goals for opponent),
  "turns_bratva": number (e.g. 32 from 32/48 turns),
  "turns_max": number (e.g. 24 or 48),
  "players": [
    {
      "name": "Player display name exactly as shown",
      "ovr": number,
      "goals": number,
      "limit_remaining": "3/3" or "2/3" or "1/3" or "0/3",
      "turns_played": number (3 - remaining turns: 0/3 remaining means 3 turns played; 3/3 remaining means 0 turns played)
    }
  ]
}

CRITICAL RULES:
1. Status is "LIVE" if header says LEAGUE or has a countdown clock (like 03:49:49 or 23:55:00).
2. Status is "HISTORY" if header says HISTORY or says X HOURS AGO / X DAYS AGO.
3. In FC Mobile: "LIMIT 3/3" means player hasn't played ANY turn (0/3 turns played). "LIMIT 0/3" means player played all 3 turns (3/3 played).
4. Extract only players belonging to БРАТВА (Left column under БРАТВА / MY TEAM).
5. ORDER IS CRITICAL: Extract players in the EXACT sequential order they appear from top to bottom (Board #1 down to Board #N). Do not sort by goals, do not shuffle, do not sort casually. Maintain the exact lineup match order as presented visually on screen.
6. PRESERVE NAMES EXACTLY: Keep exact letters, Cyrillic characters (e.g. саня, Тима), and symbols as displayed.`;

    const payload = JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: 'image/jpeg', data: base64Data } }
        ]
      }]
    });

    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
      method: 'POST',
      agent: agent,
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
          if (parsed.candidates && parsed.candidates[0].content.parts[0].text) {
            let rawText = parsed.candidates[0].content.parts[0].text.trim();
            rawText = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
            const resultJson = JSON.parse(rawText);
            resolve(resultJson);
          } else {
            reject(new Error('Invalid response from Gemini API: ' + data));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Helper: Get Current League Data
function loadLeagueData() {
  const tIndex = JSON.parse(fs.readFileSync(T_INDEX_PATH, 'utf8'));
  const pIndex = JSON.parse(fs.readFileSync(P_INDEX_PATH, 'utf8'));
  const tournaments = Object.keys(tIndex).map(id => {
    const tFile = path.join(TOURNAMENTS_DIR, `${id}.json`);
    return fs.existsSync(tFile) ? JSON.parse(fs.readFileSync(tFile, 'utf8')) : null;
  }).filter(Boolean);
  tournaments.sort((a, b) => new Date(b.date) - new Date(a.date));

  const players = Object.keys(pIndex).map(id => {
    const pFile = path.join(PLAYERS_DIR, `${id}.json`);
    return fs.existsSync(pFile) ? JSON.parse(fs.readFileSync(pFile, 'utf8')) : null;
  }).filter(Boolean);

  return { tIndex, pIndex, tournaments, players };
}

// Interactive Multilingual Tabs Keyboard
function getMatchTabsKeyboard(activeLang = 'ru', tIndexNum = 0, isChannel = false) {
  const keyboard = [
    [
      { text: (activeLang === 'ru' ? '• 🇷🇺 Русский •' : '🇷🇺 Русский'), callback_data: `tab_${tIndexNum}_ru` },
      { text: (activeLang === 'en' ? '• 🇬🇧 English •' : '🇬🇧 English'), callback_data: `tab_${tIndexNum}_en` }
    ],
    [
      { text: (activeLang === 'ar' ? '• 🇲🇦 العربية •' : '🇲🇦 العربية'), callback_data: `tab_${tIndexNum}_ar` },
      { text: (activeLang === 'es' ? '• 🇪🇸 Español •' : '🇪🇸 Español'), callback_data: `tab_${tIndexNum}_es` }
    ],
    [
      { text: '🌐 Live League Website', url: 'https://fc-bratva.github.io/' }
    ]
  ];

  if (config.channel_id && !isChannel) {
    keyboard.unshift([
      { text: '📢 Broadcast to Channel Now', callback_data: `pubchannel_${tIndexNum}` }
    ]);
  }

  return { inline_keyboard: keyboard };
}

// Generate Multilingual Recap Message by Language
function generateRecapByLang(tIndexNum = 0, lang = 'ru') {
  const { tournaments } = loadLeagueData();
  const t = tournaments[tIndexNum];
  if (!t) return 'No match recorded yet.';

  const opp = t.opponent_league || 'OPPONENT';
  const ourScore = t.our_total_goals !== undefined ? t.our_total_goals : 0;
  const oppScore = t.opponent_total_goals !== undefined ? t.opponent_total_goals : 0;
  const isWin = ourScore > oppScore;
  const isDraw = ourScore === oppScore;

  const performers = ((t.matches || []).slice()).sort((a, b) => (b.goals_for || 0) - (a.goals_for || 0));
  const mp1 = performers[0]?.player_display_name || 'Player 1';
  const mp1G = performers[0]?.goals_for || 0;
  const mp2 = performers[1]?.player_display_name || 'Player 2';
  const mp2G = performers[1]?.goals_for || 0;
  const mp3 = performers[2]?.player_display_name || 'Player 3';
  const mp3G = performers[2]?.goals_for || 0;

  const missed = [];
  if (t.matches) {
    t.matches.forEach(m => {
      const turns = m.turns_played !== undefined ? m.turns_played : 0;
      if (turns < 3) {
        missed.push(`[ ❌ | ${m.player_display_name} | ${turns}/3 ]`);
      }
    });
  }

  const websiteLink = 'https://fc-bratva.github.io/';

  if (lang === 'en') {
    let outcome = isWin ? 'BIG WIN' : (isDraw ? 'HARD-FOUGHT DRAW' : 'MATCH RESULT');
    let closing = isWin ? "⚡ Awesome game boys! Let's keep winning!" : "⚡ Hard-fought match! Next time we take the win!";
    let strikesText = missed.length > 0
      ? `⛔ *DISCIPLINE & STRIKES:*\n${missed.join('\n')}\n⛔ Strike 1/3! Must play 3/3 in next match or get kicked!`
      : `✅ *100% DISCIPLINE:* All squad members completed 3/3 turns!`;

    return `⭐ *БРАТВА: ${outcome} vs ${opp}!* ⭐\n\n` +
      `⚽ *Score:* ${ourScore} - ${oppScore}\n\n` +
      `⭐ *TOP SCORERS:*\n` +
      `🥇 [ 1 | ${mp1} | ${mp1G}G ]\n` +
      `🥈 [ 2 | ${mp2} | ${mp2G}G ]\n` +
      `🥉 [ 3 | ${mp3} | ${mp3G}G ]\n\n` +
      `${closing}\n\n` +
      `----------------------------\n` +
      `${strikesText}\n\n` +
      `🌐 *Live Standings:*\n${websiteLink}`;
  } else if (lang === 'ar') {
    let outcome = isWin ? 'انتصار كبير' : (isDraw ? 'تعادل بطولي' : 'نتيجة المباراة');
    let closing = isWin ? "⚡ برافو يا شباب! استمروا في الانتصارات!" : "⚡ ماتش قوي! الماتش الجاي التعويض والفوز!";
    let strikesText = missed.length > 0
      ? `⛔ *قائمة الإنذارات (السترايكات):*\n${missed.join('\n')}\n⛔ إنذار 1/3! لازم تلعب 3/3 الماتش الجاي لتفادي الطرد!`
      : `✅ *انضباط كامل 100%:* كاع الأعضاء لعبو 3/3 أشواط!`;

    return `⭐ *БРАТВА: ${outcome} ضد ${opp}!* ⭐\n\n` +
      `⚽ *النتيجة:* ${ourScore} - ${oppScore}\n\n` +
      `⭐ *أفضل الهدافين:*\n` +
      `🥇 [ 1 | ${mp1} | ${mp1G} هدف ]\n` +
      `🥈 [ 2 | ${mp2} | ${mp2G} هدف ]\n` +
      `🥉 [ 3 | ${mp3} | ${mp3G} هدف ]\n\n` +
      `${closing}\n\n` +
      `----------------------------\n` +
      `${strikesText}\n\n` +
      `🌐 *الترتيب المباشر:*\n${websiteLink}`;
  } else if (lang === 'es') {
    let outcome = isWin ? 'GRAN VICTORIA' : (isDraw ? 'EMPATE COMBATIVO' : 'RESULTADO');
    let closing = isWin ? "⚡ ¡Gran partido chicos! ¡A seguir ganando!" : "⚡ ¡Partido duro! ¡En el próximo partido vamos por la victoria!";
    let strikesText = missed.length > 0
      ? `⛔ *DISCIPLINA Y STRIKES:*\n${missed.join('\n')}\n⛔ ¡Strike 1/3! ¡Obligatorio jugar 3/3 en el próximo partido!`
      : `✅ *100% DISCIPLINA:* ¡Todos completaron 3/3 turnos!`;

    return `⭐ *БРАТВА: ¡${outcome} vs ${opp}!* ⭐\n\n` +
      `⚽ *Resultado:* ${ourScore} - ${oppScore}\n\n` +
      `⭐ *MÁXIMOS GOLEADORES:*\n` +
      `🥇 [ 1 | ${mp1} | ${mp1G}G ]\n` +
      `🥈 [ 2 | ${mp2} | ${mp2G}G ]\n` +
      `🥉 [ 3 | ${mp3} | ${mp3G}G ]\n\n` +
      `${closing}\n\n` +
      `----------------------------\n` +
      `${strikesText}\n\n` +
      `🌐 *Clasificación en vivo:*\n${websiteLink}`;
  } else {
    // Default Russian
    let outcome = isWin ? 'ПОБЕДА' : (isDraw ? 'БОЕВАЯ НИЧЬЯ' : 'МАТЧ');
    let closing = isWin ? "⚡ Красавцы парни! Идем дальше за победами!" : "⚡ Боевой матч! В след. матче только победа!";
    let strikesText = missed.length > 0
      ? `⛔ *ДИСЦИПЛИНА И СТРАЙКИ:*\n${missed.join('\n')}\n⛔ Страйк 1/3! Обязательно 3/3 в след. матче, иначе кик!`
      : `✅ *100% ДИСЦИПЛИНА:* Все игроки сыграли 3/3!`;

    return `⭐ *БРАТВА: ${outcome} vs ${opp}!* ⭐\n\n` +
      `⚽ *Счет:* ${ourScore} - ${oppScore}\n\n` +
      `⭐ *ЛУЧШИЕ ИГРОКИ:*\n` +
      `🥇 [ 1 | ${mp1} | ${mp1G}G ]\n` +
      `🥈 [ 2 | ${mp2} | ${mp2G}G ]\n` +
      `🥉 [ 3 | ${mp3} | ${mp3G}G ]\n\n` +
      `${closing}\n\n` +
      `----------------------------\n` +
      `${strikesText}\n\n` +
      `🌐 *Таблица и сайт лиги:*\n${websiteLink}`;
  }
}

function generateLastRecap(lang = 'ru') {
  return generateRecapByLang(0, lang);
}

// Generate Strikes & Warnings
function generateStrikesMessage() {
  const { tournaments, players } = loadLeagueData();
  const lastT = tournaments[0];
  if (!lastT) return 'No tournaments recorded yet.';

  const dDivider = '----------------------------\n----------------------------';
  const missed = [];
  if (lastT.matches) {
    lastT.matches.forEach(m => {
      const turns = m.turns_played !== undefined ? m.turns_played : 0;
      if (turns < 3) {
        missed.push(`[ ❌ | ${m.player_display_name} | ${turns}/3 ]`);
      }
    });
  }

  if (missed.length === 0) {
    return `✅ 100% ДИСЦИПЛИНА! Все 3/3 сыграны!\n${dDivider}\n✅ 100% DISCIPLINE! All 3/3 played!`;
  }

  const pList = missed.join('\n');
  const header = `⛔ ВНИМАНИЕ / ATTENTION PLEASE ⛔\n${pList}`;
  const ru = `⛔ Страйк 1/3! Обязательно 3/3 в след. матче, иначе кик!`;
  const en = `⛔ Strike 1/3! Must play 3/3 in next match or get kicked!`;

  return `${header}\n${dDivider}\n${ru}\n${dDivider}\n${en}`;
}

// Generate Lineup Recommendations
function generateLineupMessage(size = 8) {
  const { tournaments, players, pIndex } = loadLeagueData();
  const latestT = tournaments[0];
  const dDivider = '----------------------------\n----------------------------';

  const ranked = players.map(p => {
    const lastMatch = latestT?.matches?.find(m => m.player_id === p.player_id);
    const lastMatchGoals = lastMatch ? (lastMatch.goals_for || 0) : null;
    const lastMatchTurns = lastMatch ? (lastMatch.turns_played || 0) : null;

    const totalMatches = p.matches ? p.matches.length : (p.total_matches || 0);
    const totalGoals = p.matches ? p.matches.reduce((sum, m) => sum + (m.goals_for || 0), 0) : (p.total_goals || 0);
    const avgGoals = totalMatches > 0 ? (totalGoals / totalMatches) : 0;
    const failStreak = pIndex[p.player_id]?.eligibility_streak?.current_fail_streak || 0;

    let powerScore = 0;
    if (lastMatch && lastMatchTurns >= 3 && lastMatchGoals > 0) {
      powerScore += lastMatchGoals * 2.0;
    }
    powerScore += avgGoals * 1.5;
    if (failStreak > 0) powerScore -= failStreak * 50;
    if (lastMatchGoals === 0 && lastMatchTurns >= 3) powerScore -= 30;

    return {
      display_name: p.display_name,
      lastMatchGoals,
      avgGoals: Math.round(avgGoals),
      powerScore
    };
  }).sort((a, b) => b.powerScore - a.powerScore).slice(0, size);

  const pLines = ranked.map((p, idx) => {
    const g = p.lastMatchGoals !== null ? `${p.lastMatchGoals}G` : `${p.avgGoals}G`;
    return `[ ${idx + 1} | ${p.display_name} | ${g} ]`;
  }).join('\n');

  const ru = `⭐ БРАТВА: СОСТАВ НА ТУРНИР (ТОП ${size}) ⭐\n${pLines}\n⚡ Заходим и забираем победу!`;
  const en = `⭐ БРАТВА: TOURNAMENT ROSTER (TOP ${size}) ⭐\n${pLines}\n⚡ Jump in for the victory!`;

  return `${ru}\n${dDivider}\n${en}`;
}

// Generate Rules
function generateRulesMessage() {
  const dDivider = '----------------------------\n----------------------------';
  const ru = `⚙️ ПРАВИЛА БРАТВА:\n[ 1 ] Обязательно 3/3 в матче\n[ 2 ] Пропуск 3 турниров = кик\n[ 3 ] Планка: 20+ голов\n[ 4 ] Оценка за 3 турнира`;
  const en = `⚙️ БРАТВА RULES:\n[ 1 ] Mandatory 3/3 every match\n[ 2 ] Missing 3 tournaments = kick\n[ 3 ] Scoring target: 20+ goals\n[ 4 ] Evaluation: last 3 matches`;
  return `${ru}\n${dDivider}\n${en}`;
}

// Generate Detailed Player Stats & Performance
function generatePlayerStatsMessage(query, lang = 'en') {
  if (!query || !query.trim()) {
    return (lang === 'ar')
      ? '⚠️ يرجى كتابة اسم اللاعب بعد الأمر، مثلاً: `/player DOXIBERO1`'
      : (lang === 'ru'
          ? '⚠️ Укажите имя игрока после команды, например: `/player DOXIBERO1`'
          : '⚠️ Please specify a player name, e.g.: `/player DOXIBERO1`');
  }

  const { pIndex, players } = loadLeagueData();
  const q = query.trim().toLowerCase();

  const player = players.find(p => {
    if (!p) return false;
    const pid = (p.player_id || '').toLowerCase();
    const dname = (p.display_name || '').toLowerCase();
    const aliases = (p.known_aliases || []).map(a => a.toLowerCase());
    return pid === q || dname === q || pid.includes(q) || dname.includes(q) || aliases.some(a => a.includes(q));
  });

  if (!player) {
    return (lang === 'ar')
      ? `❌ لم يتم العثور على اللاعب "${query}". جرب الأمر /top لرؤية قائمة اللاعبين.`
      : (lang === 'ru'
          ? `❌ Игрок "${query}" не найден. Попробуйте команду /top для просмотра списка.`
          : `❌ Player "${query}" not found. Try /top to view top players.`);
  }

  const indexData = pIndex[player.player_id] || {};
  const totalMatches = player.matches ? player.matches.length : (indexData.total_matches || 0);
  const totalGoals = player.matches ? player.matches.reduce((sum, m) => sum + (m.goals_for || 0), 0) : (indexData.total_goals || 0);
  const avgGoals = totalMatches > 0 ? (totalGoals / totalMatches).toFixed(1) : 0;
  const failStreak = indexData.eligibility_streak?.current_fail_streak || 0;
  const isFlagged = indexData.eligibility_streak?.flagged_for_review || false;

  let statusBadge = '🟢 Active (منضبط)';
  if (failStreak > 0) statusBadge = `⚠️ Warning (${failStreak} strikes / إنذار)`;
  if (isFlagged) statusBadge = '⛔ Flagged / Inactive';

  // Last 5 matches breakdown
  const recent = (player.matches || []).slice(-5).reverse();
  const recentLines = recent.map(m => {
    const turns = m.turns_played !== undefined ? m.turns_played : 3;
    const strike = turns < 3 ? '❌' : '✅';
    const opp = m.opponent_display_name || 'Opponent';
    return `• vs ${opp}: ${m.goals_for || 0}G (${turns}/3 turns ${strike})`;
  }).join('\n');

  if (lang === 'ar') {
    return `👤 *بروفايل وأداء اللاعب: ${player.display_name}*\n` +
      `----------------------------\n` +
      `🏷️ الحالة: *${statusBadge}*\n` +
      `⚽ مجموع الأهداف: *${totalGoals} هدف*\n` +
      `🏟️ عدد البطولات: *${totalMatches} بطولة*\n` +
      `📊 معدل التهديف: *${avgGoals} هدف / ماتش*\n` +
      `⛔ إنذارات حالية (Strikes): *${failStreak}*\n\n` +
      `📋 *أداء آخر المباريات:*\n${recentLines || 'لا توجد مباريات مسجلة'}`;
  } else if (lang === 'ru') {
    return `👤 *ПРОФИЛЬ И СТАТИСТИКА: ${player.display_name}*\n` +
      `----------------------------\n` +
      `🏷️ Статус: *${statusBadge}*\n` +
      `⚽ Всего голов: *${totalGoals}*\n` +
      `🏟️ Турниров сыграно: *${totalMatches}*\n` +
      `📊 Средний показатель: *${avgGoals} голов/матч*\n` +
      `⛔ Текущие страйки: *${failStreak}*\n\n` +
      `📋 *ПОСЛЕДНИЕ МАТЧИ:*\n${recentLines || 'Нет матчей'}`;
  } else {
    return `👤 *PLAYER PERFORMANCE: ${player.display_name}*\n` +
      `----------------------------\n` +
      `🏷️ Status: *${statusBadge}*\n` +
      `⚽ Total Goals: *${totalGoals}*\n` +
      `🏟️ Tournaments: *${totalMatches}*\n` +
      `📊 Average: *${avgGoals} goals/match*\n` +
      `⛔ Current Strikes: *${failStreak}*\n\n` +
      `📋 *RECENT MATCHES:*\n${recentLines || 'No matches recorded'}`;
  }
}

// Generate Top Scorers Leaderboard
function generateTopScorersMessage(lang = 'en') {
  const { pIndex } = loadLeagueData();
  const sorted = Object.entries(pIndex)
    .map(([id, data]) => ({ id, ...data }))
    .filter(p => (p.total_goals || 0) > 0)
    .sort((a, b) => (b.total_goals || 0) - (a.total_goals || 0))
    .slice(0, 10);

  const list = sorted.map((p, i) => {
    const medal = i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : `${i + 1}.`));
    const avg = p.average_goals !== undefined ? p.average_goals : (p.total_matches > 0 ? (p.total_goals / p.total_matches).toFixed(1) : 0);
    return `${medal} *${p.display_name}* — ${p.total_goals}⚽ (${p.total_matches} تورنوا | معدل: ${avg})`;
  }).join('\n');

  if (lang === 'ar') {
    return `🏆 *أفضل هدافي دوري БРАТВА عبر التاريخ (TOP 10):*\n\n${list}\n\n💡 اكتب \`/player اسم_اللاعب\` لرؤية سجل أي لاعب بالتفصيل!`;
  } else if (lang === 'ru') {
    return `🏆 *ТОП БОМБАРДИРОВ ЛИГИ БРАТВА (TOP 10):*\n\n${list}\n\n💡 Введите \`/player ИмяИгрока\` для детальной статистики!`;
  } else {
    return `🏆 *TOP SCORERS OF БРАТВА LEAGUE (TOP 10):*\n\n${list}\n\n💡 Use \`/player <name>\` to see detailed player stats!`;
  }
}

// Natural Language AI Q&A using Gemini
function answerQuestionWithGemini(userQuestion, userLang = 'en') {
  const { tIndex, pIndex, tournaments, players } = loadLeagueData();

  const topPlayers = Object.values(pIndex)
    .sort((a, b) => (b.total_goals || 0) - (a.total_goals || 0))
    .slice(0, 10)
    .map(p => `${p.display_name}: ${p.total_goals} goals, ${p.total_matches} tournaments, avg ${p.average_goals}`)
    .join('; ');

  const recentT = tournaments.slice(0, 3)
    .map(t => `${t.date} vs ${t.opponent_league}: ${t.our_total_goals}-${t.opponent_total_goals} (${t.result})`)
    .join('; ');

  const systemContext = `You are the AI assistant for EA Sports FC Mobile league "БРАТВА".
League Context:
- Total tournaments recorded: ${tournaments.length}
- Recent tournaments: ${recentT}
- Top players: ${topPlayers}
- League Rules: 3/3 turns mandatory every match, 3 missed tournaments = kick, 20+ goals expected.
Answer the user's question accurately based on this data. Reply concisely in the user's preferred language (${userLang === 'ar' ? 'Arabic/Darija' : userLang}).`;

  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      contents: [{
        parts: [
          { text: `${systemContext}\n\nUser Question: ${userQuestion}` }
        ]
      }]
    });

    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
      method: 'POST',
      agent: agent,
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
          if (parsed.candidates && parsed.candidates[0].content.parts[0].text) {
            resolve(parsed.candidates[0].content.parts[0].text.trim());
          } else {
            resolve('No response from AI.');
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Process Live Match from AI
function processLiveMatchAI(aiResult) {
  const dDivider = '----------------------------\n----------------------------';
  const unplayed = (aiResult.players || []).filter(p => p.turns_played < 3 || p.limit_remaining === '3/3');

  if (unplayed.length === 0) {
    return `✅ Все игроки сыграли свои ходы (3/3)!\n✅ All squad members have played their turns!`;
  }

  const pLines = unplayed.map(p => `[ ⏳ | ${p.name} | ${p.turns_played}/3 ]`).join('\n');
  const header = `⛔ ВНИМАНИЕ / ATTENTION PLEASE ⛔\n${pLines}`;
  const ru = `⏳ До конца турнира мало времени! Сыграйте 3/3, чтобы избежать кика!`;
  const en = `⏳ Match ending soon! Attack 3/3 ASAP to avoid kick!`;

  return `${header}\n${dDivider}\n${ru}\n${dDivider}\n${en}`;
}

// Helper: Resolve player ID accurately (handles Cyrillic, aliases, and known database keys)
function resolvePlayerId(displayName, pIndex = {}, players = []) {
  if (!displayName) return 'player_' + Date.now();
  const cleanName = displayName.trim();
  const lowerName = cleanName.toLowerCase();

  // 1. Direct match with existing player_id in pIndex
  if (pIndex[lowerName]) return lowerName;

  // 2. Direct match with existing display_name or aliases
  const matchedPlayer = players.find(p => 
    (p.display_name && p.display_name.toLowerCase() === lowerName) ||
    (p.known_aliases && p.known_aliases.some(a => a.toLowerCase() === lowerName))
  );
  if (matchedPlayer) return matchedPlayer.player_id;

  // 3. Known transliterations / league mappings
  const translitMap = {
    'саня': 'sanya',
    'тима': 'tima',
    'иван': 'ivan',
    'денис': 'denis',
    'doxibéro': 'doxibro',
    'doxibero': 'doxibro',
    'doxibero1': 'doxibero1',
    'rèdhawk前': 'redhawk',
    'redhawk前': 'redhawk',
    'koustav_007': 'koustav_007',
    'mohamed_osama': 'mohamed_osama'
  };
  if (translitMap[lowerName]) return translitMap[lowerName];

  // 4. Cyrillic transliteration fallback
  let slug = lowerName
    .replace(/а/g, 'a').replace(/б/g, 'b').replace(/в/g, 'v').replace(/г/g, 'g').replace(/д/g, 'd')
    .replace(/е/g, 'e').replace(/ё/g, 'yo').replace(/ж/g, 'zh').replace(/з/g, 'z').replace(/и/g, 'i')
    .replace(/й/g, 'y').replace(/к/g, 'k').replace(/л/g, 'l').replace(/м/g, 'm').replace(/н/g, 'n')
    .replace(/о/g, 'o').replace(/п/g, 'p').replace(/р/g, 'r').replace(/с/g, 's').replace(/т/g, 't')
    .replace(/у/g, 'u').replace(/ф/g, 'f').replace(/х/g, 'kh').replace(/ц/g, 'ts').replace(/ч/g, 'ch')
    .replace(/ш/g, 'sh').replace(/щ/g, 'shch').replace(/ъ/g, '').replace(/ы/g, 'y').replace(/ь/g, '')
    .replace(/э/g, 'e').replace(/ю/g, 'yu').replace(/я/g, 'ya')
    .replace(/[éèêë]/g, 'e').replace(/[àáâãä]/g, 'a').replace(/[íìîï]/g, 'i').replace(/[óòôõö]/g, 'o').replace(/[úùûü]/g, 'u')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return slug || 'player_' + Date.now();
}

// Helper: Calculate match date accurately from time_info
function calculateMatchDate(timeInfo) {
  const now = new Date();
  if (!timeInfo) return now.toISOString().split('T')[0];

  const t = timeInfo.toLowerCase();
  const dayMatch = t.match(/(\d+)\s*d(ay)?/);
  if (dayMatch) {
    const daysAgo = parseInt(dayMatch[1], 10);
    const targetDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    return targetDate.toISOString().split('T')[0];
  }

  return now.toISOString().split('T')[0];
}

// Process Finished Match from AI & Save to Website
function saveFinishedMatchAI(aiResult) {
  const { tIndex, pIndex, players } = loadLeagueData();
  const dateStr = calculateMatchDate(aiResult.time_info);
  const oppSlug = (aiResult.opponent_league || 'opponent').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const tId = `${dateStr}_${oppSlug}`;
  const tFilePath = path.join(TOURNAMENTS_DIR, `${tId}.json`);

  let existingTData = null;
  if (fs.existsSync(tFilePath)) {
    try { existingTData = JSON.parse(fs.readFileSync(tFilePath, 'utf8')); } catch (e) {}
  }

  // Extract new matches from AI in board order
  const newMatches = (aiResult.players || []).map((p, idx) => {
    const pId = resolvePlayerId(p.name, pIndex, players);
    return {
      player_id: pId,
      player_display_name: p.name,
      ovr: p.ovr || 125,
      goals_for: p.goals !== undefined ? p.goals : 0,
      turns_played: p.turns_played !== undefined ? p.turns_played : (p.limit_remaining === '0/3' ? 3 : 0)
    };
  });

  // Merge matches if tournament already exists (multi-screenshot support!)
  let mergedMatches = [];
  if (existingTData && existingTData.matches && existingTData.matches.length > 0) {
    mergedMatches = existingTData.matches.slice();
    newMatches.forEach(nm => {
      const existIdx = mergedMatches.findIndex(em => em.player_id === nm.player_id);
      if (existIdx >= 0) {
        // Update if new match data is more complete
        if (nm.goals_for > 0 && mergedMatches[existIdx].goals_for === 0) {
          mergedMatches[existIdx] = nm;
        }
      } else {
        // Append preserving board order
        mergedMatches.push(nm);
      }
    });
  } else {
    mergedMatches = newMatches;
  }

  const ourScore = Math.max(aiResult.score_bratva || 0, existingTData?.our_total_goals || 0);
  const oppScore = Math.max(aiResult.score_opponent || 0, existingTData?.opponent_total_goals || 0);
  const totalTurns = Math.max(aiResult.turns_bratva || 0, existingTData?.total_turns_played || 0);
  const maxTurns = aiResult.turns_max || existingTData?.max_possible_turns || 48;

  const tData = {
    id: tId,
    date: dateStr,
    opponent_league: aiResult.opponent_league || (existingTData ? existingTData.opponent_league : 'OPPONENT'),
    our_total_goals: ourScore,
    opponent_total_goals: oppScore,
    result: (ourScore > oppScore) ? 'win' : (ourScore === oppScore ? 'draw' : 'loss'),
    status: 'complete',
    total_turns_played: totalTurns,
    max_possible_turns: maxTurns,
    matches: mergedMatches
  };

  // 1. Save Tournament File
  fs.writeFileSync(tFilePath, JSON.stringify(tData, null, 2), 'utf8');

  // 2. Update Tournaments Index
  tIndex[tId] = {
    date: tData.date,
    opponent_league: tData.opponent_league,
    our_total_goals: tData.our_total_goals,
    opponent_total_goals: tData.opponent_total_goals,
    result: tData.result,
    status: tData.status
  };
  fs.writeFileSync(T_INDEX_PATH, JSON.stringify(tIndex, null, 2), 'utf8');

  // 3. Update Players
  tData.matches.forEach((m, idx) => {
    const pPath = path.join(PLAYERS_DIR, `${m.player_id}.json`);
    let pData;
    if (fs.existsSync(pPath)) {
      try { pData = JSON.parse(fs.readFileSync(pPath, 'utf8')); } catch (e) {}
      if (!pData || !pData.matches) pData = { player_id: m.player_id, display_name: m.player_display_name, known_aliases: [], matches: [] };
    } else {
      pData = {
        player_id: m.player_id,
        display_name: m.player_display_name,
        known_aliases: [],
        matches: []
      };
    }

    pData.display_name = m.player_display_name;
    const existingIdx = pData.matches.findIndex(h => h.tournament_id === tId);
    const matchEntry = {
      tournament_id: tId,
      match_index_in_tournament: idx,
      opponent_display_name: tData.opponent_league,
      opponent_id: oppSlug,
      goals_for: m.goals_for,
      goals_against: 0,
      result: tData.result,
      turns_played: m.turns_played,
      player_display_name: m.player_display_name,
      player_id: m.player_id
    };

    if (existingIdx >= 0) pData.matches[existingIdx] = matchEntry;
    else pData.matches.push(matchEntry);

    fs.writeFileSync(pPath, JSON.stringify(pData, null, 2), 'utf8');

    const totalMatches = pData.matches.length;
    const totalGoals = pData.matches.reduce((sum, h) => sum + (h.goals_for || 0), 0);
    const avgGoals = totalMatches > 0 ? Math.round(totalGoals / totalMatches) : 0;
    const prevStreak = pIndex[m.player_id]?.eligibility_streak?.current_fail_streak || 0;
    const currentFailStreak = (m.turns_played < 3) ? (prevStreak + 1) : 0;

    pIndex[m.player_id] = {
      display_name: m.player_display_name,
      total_goals: totalGoals,
      total_matches: totalMatches,
      average_goals: avgGoals,
      last_tournament_date: tData.date,
      eligibility_streak: {
        current_fail_streak: currentFailStreak,
        last_evaluated_tournament_id: tId,
        flagged_for_review: currentFailStreak >= 3
      }
    };
  });

  fs.writeFileSync(P_INDEX_PATH, JSON.stringify(pIndex, null, 2), 'utf8');

  // Push to GitHub if enabled
  if (config.auto_push_github) {
    exec('git add docs/league-data/ ; git commit -m "Auto-Update: Telegram Bot recorded tournament vs ' + tData.opponent_league + '" ; git push origin main', { cwd: PROJECT_ROOT }, (err, stdout, stderr) => {
      if (err) console.error('Git Push Error:', err);
      else console.log('Git Push Success:', stdout);
    });
  }

  return tData;
}

// Multilingual Help Guides
function getHelpMessage(lang = 'en') {
  const guides = {
    en: `⚜️ *WELCOME TO БРАТВА LEAGUE BOT* ⚜️
Official AI Assistant for БРАТВА League powered by Gemini AI Vision!

📸 *MAIN FEATURE:*
Simply send me any EA FC Mobile tournament screenshot!
I will automatically:
1. Detect whether the match is LIVE or COMPLETED
2. Extract score, opponent, players, and goals
3. Generate 1-click copy chat messages
4. On match completion — automatically save to the website!

📋 *COMMANDS:*
👤 /player <name> — Detailed player stats & performance
🏆 /top — All-time top scorers leaderboard
⭐ /recap — Last match review & top scorers
⛔ /strikes — List of debtors with strikes (0/3)
🎯 /lineup [8/16/32] — AI recommended starting roster
⚙️ /rules — Official league constitution
📊 /tournaments — Recent tournament history
🌐 /lang — Change bot language
💬 *You can also ask me ANY question in normal chat!*`,

    ar: `⚜️ *مرحباً بك في بوت دوري БРАТВА* ⚜️
المساعد الذكي الرسمي لدوري БРАТВА مدعوم بالذكاء الاصطناعي Gemini!

📸 *الميزة الأساسية:*
أرسل لي أي لقطة شاشة (Screenshot) لمباراة في EA FC Mobile:
1. أحدد تلقائياً إذا كانت المباراة جارية (LIVE) أو منتهية (HISTORY)
2. أستخرج النتيجة، الخصم، الأهداف، واللاعبين بدقة 100%
3. أجهز لك رسائل النشر الجاهزة للنسخ بنقرة واحدة
4. عند انتهاء المباراة — أقوم بحفظها وتحديث الموقع تلقائياً!

📋 *الأوامر المتاحة:*
👤 /player [اسم اللاعب] — إحصائيات وأداء أي لاعب بالتفصيل
🏆 /top — قائمة أفضل هدافي الدوري عبر التاريخ
⭐ /recap — تقرير آخر مباراة وهدافو الفريق
⛔ /strikes — قائمة الأعضاء الحاصلين على إنذارات (0/3)
🎯 /lineup [8/16/32] — التشكيلة الموصى بها للمباراة القادمة
⚙️ /rules — قوانين ولوائح الدوري
📊 /tournaments — سجل آخر 5 بطولات
🌐 /lang — تغيير لغة البوت
💬 *تقدر تسولني أي سؤال عادي فالشات على اللاعبين أو الدوري!*`,

    ru: `⚜️ *ДОБРО ПОЖАЛОВАТЬ В БРАТВА LEAGUE BOT* ⚜️
Официальный ассистент лиги БРАТВА на базе Gemini AI Vision!

📸 *ГЛАВНАЯ ФУНКЦИЯ:*
Просто отправь мне скриншот турнира из EA FC Mobile!
Я автоматически:
1. Определю LIVE или ИСТОРИЯ
2. Извлеку счет, соперника, игроков и голы
3. Сформирую готовые сообщения для чата
4. При завершении матча — сохраню данные на сайт!

📋 *КОМАНДЫ:*
👤 /player [Имя] — Полная статистика и форма игрока
🏆 /top — Рейтинг лучших бомбардиров за всю историю
⭐ /recap — Итоги последнего матча (Top Scorers)
⛔ /strikes — Список должников со страйками (0/3)
🎯 /lineup [8/16/32] — Рекомендованный состав на турнир
⚙️ /rules — Правила лиги БРАТВА
📊 /tournaments — Список последних 5 турниров
🌐 /lang — Сменить язык бота
💬 *Также можно просто задавать вопросы текстом!*`,

    es: `⚜️ *BIENVENIDO A БРАТВА LEAGUE BOT* ⚜️
¡Asistente oficial de la liga БРАТВА con Gemini AI Vision!

📸 *FUNCIÓN PRINCIPAL:*
Envíame cualquier captura de pantalla del torneo en EA FC Mobile:
1. Detecto automáticamente si es EN VIVO o HISTORIAL
2. Extraigo resultado, rival, jugadores y goles
3. Genero mensajes listos para copiar y pegar en el chat
4. Al finalizar el partido — ¡actualizo la web automáticamente!

📋 *COMANDOS:*
👤 /player [nombre] — Estadísticas detalladas de cualquier jugador
🏆 /top — Tabla de máximos goleadores históricos
⭐ /recap — Resumen del último partido y goleadores
⛔ /strikes — Lista de jugadores con strikes (0/3)
🎯 /lineup [8/16/32] — Alineación recomendada por IA
⚙️ /rules — Reglamento oficial de la liga
📊 /tournaments — Historial de los últimos torneos
🌐 /lang — Cambiar idioma del bot
💬 *¡También puedes hacerme cualquier pregunta en el chat!*`
  };

  return guides[lang] || guides.en;
}

// Language Picker Keyboard
function getLanguageKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🇬🇧 English', callback_data: 'setlang_en' },
        { text: '🇲🇦 / 🇸🇦 العربية', callback_data: 'setlang_ar' }
      ],
      [
        { text: '🇷🇺 Русский', callback_data: 'setlang_ru' },
        { text: '🇪🇸 Español', callback_data: 'setlang_es' }
      ]
    ]
  };
}

// Bot Main Polling Loop
let lastUpdateId = 0;
async function pollUpdates() {
  try {
    const res = await telegramRequest('getUpdates', { offset: lastUpdateId + 1, timeout: 10 });
    if (res && res.ok && res.result && res.result.length > 0) {
      for (const update of res.result) {
        lastUpdateId = update.update_id;
        handleTelegramUpdate(update);
      }
    }
  } catch (err) {
    if (!err.message.includes('ECONNRESET')) {
      console.error('Polling notice:', err.message);
    }
  }
  setTimeout(pollUpdates, 1500);
}

// Handle Incoming Updates
async function handleTelegramUpdate(update) {
  // 0. Handle Bot added as Admin in Channel or Group
  if (update.my_chat_member && update.my_chat_member.chat) {
    const chat = update.my_chat_member.chat;
    if (chat.type === 'channel') {
      const chanId = chat.username ? `@${chat.username}` : String(chat.id);
      config.channel_id = chanId;
      config.auto_broadcast_channel = true;
      saveConfig();
      console.log(`Auto-configured channel: ${chat.title} (${chanId})`);
    }
    return;
  }

  // 1. Handle Callback Query (Inline buttons)
  if (update.callback_query) {
    const cb = update.callback_query;
    const userId = String(cb.from.id);
    const chatId = cb.message ? cb.message.chat.id : cb.from.id;
    const data = cb.data || '';

    if (data.startsWith('setlang_')) {
      const chosenLang = data.replace('setlang_', '');
      if (!userSettings[userId]) userSettings[userId] = {};
      userSettings[userId].lang = chosenLang;
      saveUserSettings();

      await answerCallbackQuery(cb.id, `✓ Language set to ${chosenLang.toUpperCase()}`);
      const guide = getHelpMessage(chosenLang);
      await sendMessage(chatId, `✅ *Language selected / تم اختيار اللغة / Язык выбран:*\n\n${guide}`, 'Markdown');
      return;
    }

    // 1.2 Handle Interactive Language Tabs in Recaps
    if (data.startsWith('tab_')) {
      const parts = data.split('_');
      const tIndexNum = parseInt(parts[1], 10) || 0;
      const targetLang = parts[2] || 'ru';

      const updatedText = generateRecapByLang(tIndexNum, targetLang);
      const isChannel = cb.message && cb.message.chat && cb.message.chat.type === 'channel';
      const updatedKeyboard = getMatchTabsKeyboard(targetLang, tIndexNum, isChannel);

      try {
        await editMessageText(chatId, cb.message.message_id, updatedText, 'Markdown', updatedKeyboard);
        await answerCallbackQuery(cb.id, `✓ ${targetLang.toUpperCase()}`);
      } catch (err) {
        await answerCallbackQuery(cb.id);
      }
      return;
    }

    // 1.3 Handle 1-Click Broadcast to Channel
    if (data.startsWith('pubchannel_')) {
      const parts = data.split('_');
      const tIndexNum = parseInt(parts[1], 10) || 0;

      if (!config.channel_id) {
        await answerCallbackQuery(cb.id, '❌ No channel linked! Use /setchannel @YourChannel first.', true);
        return;
      }

      const chanMsg = generateRecapByLang(tIndexNum, 'ru'); // Default Russian for official broadcast
      const chanKeyboard = getMatchTabsKeyboard('ru', tIndexNum, true);

      try {
        await sendMessage(config.channel_id, chanMsg, 'Markdown', chanKeyboard);
        await answerCallbackQuery(cb.id, '✅ Broadcast sent to Channel!');
        await sendMessage(chatId, `📢 *Successfully published to ${config.channel_id}!*`, 'Markdown');
      } catch (err) {
        console.error('Channel broadcast error:', err);
        await answerCallbackQuery(cb.id, `❌ Failed: ${err.message}`, true);
        await sendMessage(chatId, `❌ Failed to broadcast to ${config.channel_id}: ${err.message}\nMake sure @${config.bot_username} is added as an Administrator in your Channel with permission to post messages.`);
      }
      return;
    }

    await answerCallbackQuery(cb.id);
    return;
  }

  const message = update.message;
  if (!message) return;

  const userId = String(message.from.id);
  const chatId = message.chat.id;
  const text = (message.text || '').trim();

  const isGroupChat = message.chat.type === 'group' || message.chat.type === 'supergroup';

  // Check Authorization
  const isAuthorized = config.authorized_users.includes(userId) || (userSettings[userId] && userSettings[userId].authorized);

  // If not authorized, check if message is the admin passcode
  if (!isAuthorized) {
    const passcodes = config.admin_passcodes || ['bratva2026', 'admin123'];
    if (passcodes.includes(text)) {
      // Grant authorization!
      if (!config.authorized_users.includes(userId)) config.authorized_users.push(userId);
      if (!userSettings[userId]) userSettings[userId] = {};
      userSettings[userId].authorized = true;
      userSettings[userId].authorized_at = new Date().toISOString();
      saveConfig();
      saveUserSettings();

      const successMsg = `🔓 *ДОСТУП РАЗРЕШЕН / ACCESS GRANTED / تم منح صلاحية الوصول!*\n\n` +
        `Добро пожаловать, Администратор! Выберите язык для работы с ботом:\n` +
        `Welcome, Admin! Please choose your preferred language:\n` +
        `مرحباً بك أيها المشرف! يرجى اختيار لغتك المفضلة:`;

      await sendMessage(chatId, successMsg, 'Markdown', getLanguageKeyboard());
      return;
    }

    // In group chats, allow non-admins to use public read commands (/player, /top, /recap, etc.)
    const isPublicCommand = text.startsWith('/player') || text.startsWith('/stats') || text.startsWith('/p ') ||
      text.startsWith('/top') || text.startsWith('/leaderboard') ||
      text.startsWith('/recap') || text.startsWith('/strikes') ||
      text.startsWith('/rules') || text.startsWith('/tournaments') ||
      text.startsWith('/lineup') || text.startsWith('/start') || text.startsWith('/help');

    if (isGroupChat) {
      if (!isPublicCommand) {
        // Silently ignore normal banter or unauthorized messages in groups
        return;
      }
    } else {
      // Private chat: prompt for passcode
      const lockMsg = `🔒 *ACCESS RESTRICTED / ДОСТУП ОГРАНИЧЕН / الدخول مقيد* 🔒\n\n` +
        `⛔ This bot is private to БРАТВА League administrators.\n` +
        `To unlock access, please enter the Admin Passcode:\n` +
        `--------------------------------------------------\n` +
        `Этот бот предназначен только для администраторов лиги БРАТВА.\n` +
        `Для разблокировки введите пароль администратора:\n` +
        `--------------------------------------------------\n` +
        `هذا البوت خاص بمشرفي دوري БРАТВА فقط.\n` +
        `لفتح البوت، يرجى إدخال كلمة سر المشرف:`;

      await sendMessage(chatId, lockMsg, 'Markdown');
      return;
    }
  }

  // Get User Language
  const userLang = (userSettings[userId] && userSettings[userId].lang) ? userSettings[userId].lang : null;

  // If authorized but no language chosen yet, prompt language picker
  if (!userLang && !text.startsWith('/lang')) {
    await sendMessage(chatId, `🌐 *Please choose your language / Выберите язык / اختر لغتك:*`, 'Markdown', getLanguageKeyboard());
    return;
  }

  // 1. Language Command
  if (text.startsWith('/lang') || text.startsWith('/language')) {
    await sendMessage(chatId, `🌐 *Choose your language / Выберите язык / اختر لغتك:*`, 'Markdown', getLanguageKeyboard());
    return;
  }

  // 2. Text Commands
  if (text.startsWith('/start') || text.startsWith('/help')) {
    const helpMsg = getHelpMessage(userLang || 'en');
    await sendMessage(chatId, helpMsg, 'Markdown');
    return;
  }

  if (text.startsWith('/recap')) {
    const prefLang = userLang || 'ru';
    const recap = generateRecapByLang(0, prefLang);
    const tabsKeyboard = getMatchTabsKeyboard(prefLang, 0);
    await sendMessage(chatId, recap, 'Markdown', tabsKeyboard);
    return;
  }

  if (text.startsWith('/setchannel')) {
    const parts = text.split(' ');
    const chan = parts[1] ? parts[1].trim() : '';
    if (!chan) {
      await sendMessage(chatId, `ℹ️ *How to link your channel:*\n\n1. Add @${config.bot_username} as Administrator to your Channel.\n2. Send here: \`/setchannel @YourChannelUsername\`\n(or forward any message from your channel to this chat!)`, 'Markdown');
      return;
    }

    config.channel_id = chan.startsWith('@') || chan.startsWith('-100') ? chan : `@${chan}`;
    saveConfig();
    await sendMessage(chatId, `✅ *Channel linked successfully: ${config.channel_id}!*\n\nThe bot can now broadcast match recaps with interactive language tabs directly to this channel!`, 'Markdown');
    return;
  }

  // Forwarded message from Channel detection
  if (message.forward_from_chat && message.forward_from_chat.type === 'channel') {
    const chanId = message.forward_from_chat.id;
    const chanTitle = message.forward_from_chat.title || 'Channel';
    const chanUsername = message.forward_from_chat.username ? `@${message.forward_from_chat.username}` : chanId;

    config.channel_id = chanUsername;
    saveConfig();
    await sendMessage(chatId, `✅ *Channel detected & linked: ${chanTitle} (${chanUsername})!*\n\nThe bot is now ready to auto-publish match recaps with interactive tabs directly to this channel!`, 'Markdown');
    return;
  }

  if (text.startsWith('/broadcast') || text.startsWith('/publish')) {
    if (!config.channel_id) {
      await sendMessage(chatId, '❌ No channel linked! Use /setchannel @YourChannel first.');
      return;
    }
    const chanRecap = generateRecapByLang(0, 'ru');
    const chanKeys = getMatchTabsKeyboard('ru', 0, true);
    try {
      await sendMessage(config.channel_id, chanRecap, 'Markdown', chanKeys);
      await sendMessage(chatId, `📢 *Recap successfully published to ${config.channel_id}!*`, 'Markdown');
    } catch (e) {
      await sendMessage(chatId, `❌ Failed to broadcast to ${config.channel_id}: ${e.message}`);
    }
    return;
  }

  if (text.startsWith('/strikes')) {
    const strikes = generateStrikesMessage();
    await sendMessage(chatId, strikes);
    return;
  }

  if (text.startsWith('/lineup')) {
    const parts = text.split(' ');
    let size = 8;
    if (parts[1] && ['8', '16', '32'].includes(parts[1])) size = parseInt(parts[1], 10);
    const lineup = generateLineupMessage(size);
    await sendMessage(chatId, lineup);
    return;
  }

  if (text.startsWith('/rules')) {
    const rules = generateRulesMessage();
    await sendMessage(chatId, rules);
    return;
  }

  if (text.startsWith('/tournaments')) {
    const { tournaments } = loadLeagueData();
    const recent = tournaments.slice(0, 5);
    const list = recent.map((t, i) => `${i + 1}. [${t.date}] vs ${t.opponent_league}: ${t.our_total_goals} - ${t.opponent_total_goals} (${t.result.toUpperCase()})`).join('\n');
    await sendMessage(chatId, `🏆 *ПОСЛЕДНИЕ ТУРНИРЫ БРАТВА / RECENT TOURNAMENTS:*\n\n${list}`, 'Markdown');
    return;
  }

  if (text.startsWith('/player') || text.startsWith('/stats') || text.startsWith('/p ')) {
    const parts = text.split(' ');
    const query = parts.slice(1).join(' ').trim();
    const statsMsg = generatePlayerStatsMessage(query, userLang || 'en');
    await sendMessage(chatId, statsMsg, 'Markdown');
    return;
  }

  if (text.startsWith('/top') || text.startsWith('/leaderboard')) {
    const topMsg = generateTopScorersMessage(userLang || 'en');
    await sendMessage(chatId, topMsg, 'Markdown');
    return;
  }

  // Natural Language AI Chat / Player Name Quick Lookup
  if (text && !text.startsWith('/') && (!message.photo || message.photo.length === 0)) {
    const { players } = loadLeagueData();
    const cleanT = text.trim().toLowerCase();
    const isPlayerName = players.some(p => p.player_id.toLowerCase() === cleanT || p.display_name.toLowerCase() === cleanT);

    if (isPlayerName) {
      const statsMsg = generatePlayerStatsMessage(cleanT, userLang || 'en');
      await sendMessage(chatId, statsMsg, 'Markdown');
      return;
    }

    try {
      const typingMsg = (userLang === 'ar')
        ? '🤖 *جاري البحث في قاعدة البيانات والإجابة...*'
        : (userLang === 'ru' ? '🤖 *Ищу в базе данных лиги...*' : '🤖 *Searching league database...*');
      await sendMessage(chatId, typingMsg, 'Markdown');
      const aiAnswer = await answerQuestionWithGemini(text, userLang || 'en');
      await sendMessage(chatId, aiAnswer);
    } catch (e) {
      console.error('AI Q&A error:', e);
      await sendMessage(chatId, `⚠️ ${e.message}`);
    }
    return;
  }

  // 3. Photo Handler (Screenshot analysis)
  if (message.photo && message.photo.length > 0) {
    const largestPhoto = message.photo[message.photo.length - 1];
    const analyzingText = (userLang === 'ar')
      ? '🔍 *جاري تحليل الصورة عبر الذكاء الاصطناعي Gemini Vision...*'
      : (userLang === 'ru'
          ? '🔍 *Анализирую скриншот с помощью Gemini Vision AI...*'
          : (userLang === 'es'
              ? '🔍 *Analizando captura con Gemini Vision AI...*'
              : '🔍 *Analyzing screenshot with Gemini Vision AI...*'));

    await sendMessage(chatId, analyzingText, 'Markdown');

    try {
      const imgBuffer = await downloadTelegramFile(largestPhoto.file_id);
      const aiResult = await analyzeImageWithGemini(imgBuffer);

      // Rejection check for invalid/unrelated images
      if (!aiResult || aiResult.is_tournament_screenshot === false || !aiResult.players || aiResult.players.length === 0) {
        const rejectionMsg = (userLang === 'ar')
          ? `⚠️ *الصورة مرفوضة!*\n\nهذه الصورة ليست لقطة شاشة لبطولة دوري EA FC Mobile.\nيرجى إرسال لقطة شاشة واضحة لبطولة الدوري (БРАТВА vs الخصم).`
          : (userLang === 'ru'
              ? `⚠️ *Скриншот отклонен!*\n\nЭто изображение не является скриншотом турнира EA FC Mobile.\nПожалуйста, отправьте четкий скриншот турнира лиги БРАТВА.`
              : (userLang === 'es'
                  ? `⚠️ *¡Captura rechazada!*\n\nEsta imagen no es una captura de pantalla de un torneo de EA FC Mobile.\nPor favor, envía una captura clara del torneo de la liga БРАТВА.`
                  : `⚠️ *Screenshot Rejected!*\n\nThis image is not a recognized EA FC Mobile league tournament screen.\nPlease send a clear screenshot of a БРАТВА tournament match.`));
        await sendMessage(chatId, rejectionMsg, 'Markdown');
        return;
      }

      if (aiResult.status === 'LIVE') {
        const liveMsg = processLiveMatchAI(aiResult);
        const reply = `🟢 *ОБНАРУЖЕН LIVE ТУРНИР / LIVE MATCH DETECTED!*\n` +
          `Соперник / Opponent: *${aiResult.opponent_league}*\n` +
          `Счет / Score: *${aiResult.score_bratva} - ${aiResult.score_opponent}*\n` +
          `Осталось / Time left: *${aiResult.time_info || 'Live in progress'}*\n\n` +
          `📢 *Готовое сообщение для чата / Ready Broadcast Message:*\n\n${liveMsg}`;
        await sendMessage(chatId, reply);
      } else {
        // Finished match
        const saved = saveFinishedMatchAI(aiResult);
        const prefLang = userLang || 'ru';
        const recap = generateRecapByLang(0, prefLang);
        const tabsKeyboard = getMatchTabsKeyboard(prefLang, 0);

        const reply = `🔴 *МАТЧ ЗАВЕРШЕН И СОХРАНЕН / MATCH COMPLETED & SAVED!*\n\n${recap}`;
        await sendMessage(chatId, reply, 'Markdown', tabsKeyboard);

        // Auto-broadcast if channel_id is set
        if (config.channel_id && config.auto_broadcast_channel) {
          try {
            const chanRecap = generateRecapByLang(0, 'ru');
            const chanKeys = getMatchTabsKeyboard('ru', 0, true);
            await sendMessage(config.channel_id, chanRecap, 'Markdown', chanKeys);
            await sendMessage(chatId, `📢 *Автоматически опубликовано в канале / Auto-published to ${config.channel_id}!*`, 'Markdown');
          } catch (err) {
            console.error('Auto broadcast error:', err);
          }
        }
      }
    } catch (e) {
      console.error('Photo analysis error:', e);
      await sendMessage(chatId, `❌ Error analyzing screenshot: ${e.message}`);
    }
    return;
  }
}

// Start the bot
console.log('========================================================');
console.log('🤖 БРАТВА FCM LEAGUE TELEGRAM BOT IS STARTING...');
console.log(`📡 Connected to Telegram: @${config.bot_username}`);
console.log(`🧠 AI Vision Engine: ${GEMINI_MODEL}`);
console.log(`🔒 Security: Admin Passcode Protection Active`);
console.log('========================================================');

pollUpdates();
