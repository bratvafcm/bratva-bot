/**
 * БРАТВА FCM LEAGUE TELEGRAM BOT
 * Powered by Telegram Bot API + Google Gemini 3.5 Flash Vision AI
 * Zero external npm dependencies - Runs on vanilla Node.js!
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec } = require('child_process');

// Load configuration
const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const TELEGRAM_TOKEN = config.telegram_token;
const GEMINI_KEY = config.gemini_key;
const GEMINI_MODEL = config.gemini_model || 'gemini-3.5-flash';
const PROJECT_ROOT = path.resolve(__dirname, '..');

const TOURNAMENTS_DIR = path.join(PROJECT_ROOT, 'docs', 'league-data', 'tournaments');
const PLAYERS_DIR = path.join(PROJECT_ROOT, 'docs', 'league-data', 'players');
const T_INDEX_PATH = path.join(PROJECT_ROOT, 'docs', 'league-data', 'index', 'tournaments_index.json');
const P_INDEX_PATH = path.join(PROJECT_ROOT, 'docs', 'league-data', 'index', 'players_index.json');

// Helper: Telegram API Request
function telegramRequest(method, params = {}) {
  return new Promise((resolve, reject) => {
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
async function sendMessage(chatId, text, parseMode = null) {
  const params = { chat_id: chatId, text };
  if (parseMode) params.parse_mode = parseMode;
  return telegramRequest('sendMessage', params);
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

// Helper: Gemini Vision AI Analysis
function analyzeImageWithGemini(imageBuffer) {
  return new Promise((resolve, reject) => {
    const base64Data = imageBuffer.toString('base64');
    const prompt = `You are the expert data extraction assistant for EA Sports FC Mobile league "БРАТВА".
Analyze this tournament screenshot thoroughly and return ONLY a valid, raw JSON object (no markdown ticks, no backticks, no markdown code block).

JSON Schema to follow:
{
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
1. Status is "LIVE" if header says LEAGUE or has a green/white countdown clock (like 03:49:49 or 23:55:00).
2. Status is "HISTORY" if header says HISTORY or says X HOURS AGO / X DAYS AGO.
3. In FC Mobile: "LIMIT 3/3" means player hasn't played ANY turn (0/3 turns played). "LIMIT 0/3" means player played all 3 turns (3/3 played).
4. Extract only players belonging to БРАТВА (Left column under БРАТВА / MY TEAM).`;

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
            // Remove markdown code fences if present
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

// Generate Last Match Recap
function generateLastRecap() {
  const { tournaments, players } = loadLeagueData();
  const lastT = tournaments[0];
  if (!lastT) return 'No tournaments recorded yet.';

  const dDivider = '----------------------------\n----------------------------';
  const lastOpp = lastT.opponent_league || 'OPPONENT';
  const ourScore = lastT.our_total_goals || 0;
  const oppScore = lastT.opponent_total_goals || 0;
  const isWin = ourScore > oppScore;
  const isDraw = ourScore === oppScore;

  const performers = ((lastT.matches || []).slice()).sort((a, b) => (b.goals_for || 0) - (a.goals_for || 0));
  const mp1 = performers[0]?.player_display_name || 'Player 1';
  const mp1G = performers[0]?.goals_for || 0;
  const mp2 = performers[1]?.player_display_name || 'Player 2';
  const mp2G = performers[1]?.goals_for || 0;
  const mp3 = performers[2]?.player_display_name || 'Player 3';
  const mp3G = performers[2]?.goals_for || 0;

  let titleRU = `⭐ БРАТВА: МАТЧ vs ${lastOpp}!`;
  let titleEN = `⭐ БРАТВА: MATCH vs ${lastOpp}!`;
  let closingRU = '⚡ Красавцы за голы! В след. матче берем реванш!';
  let closingEN = '⚡ Great goals boys! Next match we get our revenge!';

  if (isWin) {
    titleRU = `⭐ БРАТВА: ПОБЕДА vs ${lastOpp}!`;
    titleEN = `⭐ БРАТВА: BIG WIN vs ${lastOpp}!`;
    closingRU = '⚡ Красавцы парни! Идем дальше за победами!';
    closingEN = "⚡ Awesome game boys! Let's keep winning!";
  } else if (isDraw) {
    titleRU = `⭐ БРАТВА: НИЧЬЯ vs ${lastOpp}!`;
    titleEN = `⭐ БРАТВА: TIE vs ${lastOpp}!`;
    closingRU = '⚡ Боевая ничья! В след. матче только победа!';
    closingEN = '⚡ Hard-fought draw! Next match we take the win!';
  }

  const ru = `${titleRU}\n⚽ Счет: ${ourScore} - ${oppScore}\n⭐ ЛУЧШИЕ ИГРОКИ:\n[ 1 | ${mp1} | ${mp1G}G ]\n[ 2 | ${mp2} | ${mp2G}G ]\n[ 3 | ${mp3} | ${mp3G}G ]\n${closingRU}`;
  const en = `${titleEN}\n⚽ Score: ${ourScore} - ${oppScore}\n⭐ TOP SCORERS:\n[ 1 | ${mp1} | ${mp1G}G ]\n[ 2 | ${mp2} | ${mp2G}G ]\n[ 3 | ${mp3} | ${mp3G}G ]\n${closingEN}`;

  return `${ru}\n${dDivider}\n${en}`;
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

// Process Finished Match from AI & Save to Website
function saveFinishedMatchAI(aiResult) {
  const { tIndex, pIndex } = loadLeagueData();
  const dateStr = new Date().toISOString().split('T')[0];
  const oppSlug = (aiResult.opponent_league || 'opponent').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const tId = `${dateStr}_${oppSlug}`;

  const tData = {
    id: tId,
    date: dateStr,
    opponent_league: aiResult.opponent_league || 'OPPONENT',
    our_total_goals: aiResult.score_bratva || 0,
    opponent_total_goals: aiResult.score_opponent || 0,
    result: (aiResult.score_bratva > aiResult.score_opponent) ? 'win' : (aiResult.score_bratva === aiResult.score_opponent ? 'draw' : 'loss'),
    status: 'complete',
    total_turns_played: aiResult.turns_bratva || 0,
    max_possible_turns: aiResult.turns_max || 48,
    matches: (aiResult.players || []).map((p, idx) => {
      const pId = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      return {
        player_id: pId,
        player_display_name: p.name,
        ovr: p.ovr || 125,
        goals_for: p.goals || 0,
        turns_played: p.turns_played !== undefined ? p.turns_played : (p.limit_remaining === '0/3' ? 3 : 0)
      };
    })
  };

  // 1. Save Tournament File
  fs.writeFileSync(path.join(TOURNAMENTS_DIR, `${tId}.json`), JSON.stringify(tData, null, 2), 'utf8');

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
      pData = JSON.parse(fs.readFileSync(pPath, 'utf8'));
      if (!pData.matches) pData.matches = [];
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

// Bot Main Polling Loop
let lastUpdateId = 0;
async function pollUpdates() {
  try {
    const res = await telegramRequest('getUpdates', { offset: lastUpdateId + 1, timeout: 30 });
    if (res.ok && res.result && res.result.length > 0) {
      for (const update of res.result) {
        lastUpdateId = update.update_id;
        handleTelegramUpdate(update);
      }
    }
  } catch (err) {
    console.error('Polling error:', err.message);
  }
  setTimeout(pollUpdates, 1000);
}

// Handle Incoming Updates
async function handleTelegramUpdate(update) {
  const message = update.message;
  if (!message) return;

  const chatId = message.chat.id;
  const text = (message.text || '').trim();

  // 1. Text Commands
  if (text.startsWith('/start') || text.startsWith('/help')) {
    const helpMsg = `⚜️ *ДОБРО ПОЖАЛОВАТЬ В БРАТВА LEAGUE BOT* ⚜️
Официальный ассистент лиги БРАТВА на базе Gemini AI Vision!

📸 *ГЛАВНАЯ ФУНКЦИЯ:*
Просто отправь мне скриншот турнира из EA FC Mobile!
Я автоматически:
1. Определю LIVE или ИСТОРИЯ
2. Извлеку счет, соперника, игроков и голы
3. Сформирую готовые сообщения для чата
4. При завершении матча — сохраню данные на сайт!

📋 *КОМАНДЫ / COMMANDS:*
⭐ /recap — Итоги последнего матча (Top Scorers)
⛔ /strikes — Список должников со страйками (0/3)
🎯 /lineup [8/16/32] — Рекомендованный состав на турнир
⚙️ /rules — Правила лиги БРАТВА
📊 /tournaments — Список последних 5 турниров`;

    await sendMessage(chatId, helpMsg, 'Markdown');
    return;
  }

  if (text.startsWith('/recap')) {
    const recap = generateLastRecap();
    await sendMessage(chatId, recap);
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
    await sendMessage(chatId, `🏆 *ПОСЛЕДНИЕ ТУРНИРЫ БРАТВА:*\n\n${list}`, 'Markdown');
    return;
  }

  // 2. Photo Handler (Screenshot analysis)
  if (message.photo && message.photo.length > 0) {
    const largestPhoto = message.photo[message.photo.length - 1];
    await sendMessage(chatId, '🔍 *Анализирую скриншот с помощью Gemini Vision AI...*', 'Markdown');

    try {
      const imgBuffer = await downloadTelegramFile(largestPhoto.file_id);
      const aiResult = await analyzeImageWithGemini(imgBuffer);

      if (aiResult.status === 'LIVE') {
        const liveMsg = processLiveMatchAI(aiResult);
        const reply = `🟢 *ОБНАРУЖЕН LIVE ТУРНИР!*\nСоперник: *${aiResult.opponent_league}*\nСчет: *${aiResult.score_bratva} - ${aiResult.score_opponent}*\nОсталось времени: *${aiResult.time_info || 'В процессе'}*\n\n📢 *Готовое сообщение для чата:*\n\n${liveMsg}`;
        await sendMessage(chatId, reply);
      } else {
        // Finished match
        const saved = saveFinishedMatchAI(aiResult);
        const recap = generateLastRecap();
        const strikes = generateStrikesMessage();

        const reply = `🔴 *МАТЧ ЗАВЕРШЕН И СОХРАНЕН НА САЙТ!*\nСоперник: *${aiResult.opponent_league}*\nИтоговый счет: *${aiResult.score_bratva} - ${aiResult.score_opponent}*\n\n⭐ *ИТОГИ МАТЧА:*\n${recap}\n\n⛔ *СТРАЙКИ:*\n${strikes}`;
        await sendMessage(chatId, reply);
      }
    } catch (e) {
      console.error('Photo analysis error:', e);
      await sendMessage(chatId, `❌ Ошибка при анализе скриншота: ${e.message}`);
    }
    return;
  }
}

// Start the bot
console.log('========================================================');
console.log('🤖 БРАТВА FCM LEAGUE TELEGRAM BOT IS STARTING...');
console.log(`📡 Connected to Telegram: @${config.bot_username}`);
console.log(`🧠 AI Vision Engine: ${GEMINI_MODEL}`);
console.log('========================================================');

pollUpdates();
