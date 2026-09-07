/**
 * Vercel Serverless Telegram Webhook Handler for БРАТВА FCM LEAGUE
 * 100% Free, 24/7 Always-On, Zero Credit Card Required
 */

import https from 'https';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_KEY = process.env.GEMINI_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const GITHUB_PAT = process.env.GITHUB_PAT;
const GITHUB_REPO = process.env.GITHUB_REPO || 'fc-bratva/fc-bratva.github.io';
const CHANNEL_ID = process.env.CHANNEL_ID || '@BRATVAFCM';
const WEBSITE_URL = 'https://fc-bratva.github.io/';

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
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
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
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
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

function analyzeImageWithGemini(imageBuffer) {
  return new Promise((resolve, reject) => {
    const base64Data = imageBuffer.toString('base64');
    const prompt = `You are the expert data extraction assistant for EA Sports FC Mobile league "БРАТВА".
Extract tournament data. Return raw JSON:
{
  "is_tournament_screenshot": true,
  "status": "LIVE" or "HISTORY",
  "time_info": "e.g. 03:49:49 or 19 HOURS AGO or 1 DAY AGO",
  "opponent_league": "Opponent team name exactly as written",
  "score_bratva": number,
  "score_opponent": number,
  "turns_bratva": number,
  "turns_max": number,
  "players": [
    {
      "name": "Player display name exactly as shown",
      "ovr": number,
      "goals": number,
      "limit_remaining": "3/3" or "2/3" or "1/3" or "0/3",
      "turns_played": number
    }
  ]
}
RULES:
1. ORDER IS CRITICAL: Extract players in exact visual top-to-bottom board order (#1 to #N).
2. LIMIT 3/3 = 0 turns played; LIMIT 0/3 = 3 turns played.`;

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
            rawText = rawText.replace(/^\`\`\`json\s*/i, '').replace(/^\`\`\`\s*/i, '').replace(/\`\`\`\s*$/i, '').trim();
            resolve(JSON.parse(rawText));
          } else {
            reject(new Error('Invalid response from Gemini API'));
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

function getTabsKeyboard(activeLang = 'ru', tIndexNum = 0) {
  return {
    inline_keyboard: [
      [
        { text: (activeLang === 'ru' ? '• 🇷🇺 Русский •' : '🇷🇺 Русский'), callback_data: `tab_${tIndexNum}_ru` },
        { text: (activeLang === 'en' ? '• 🇬🇧 English •' : '🇬🇧 English'), callback_data: `tab_${tIndexNum}_en` }
      ],
      [
        { text: (activeLang === 'ar' ? '• 🇲🇦 العربية •' : '🇲🇦 العربية'), callback_data: `tab_${tIndexNum}_ar` },
        { text: (activeLang === 'es' ? '• 🇪🇸 Español •' : '🇪🇸 Español'), callback_data: `tab_${tIndexNum}_es` }
      ],
      [
        { text: '🌐 Live League Website', url: WEBSITE_URL }
      ]
    ]
  };
}

function formatRecap(t, lang = 'ru') {
  if (!t) return 'No match data available.';
  const opp = t.opponent_league || 'OPPONENT';
  const ourScore = t.our_total_goals || 0;
  const oppScore = t.opponent_total_goals || 0;
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
      if (turns < 3) missed.push(`[ ❌ | ${m.player_display_name} | ${turns}/3 ]`);
    });
  }

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
      `🌐 *Live Standings:*\n${WEBSITE_URL}`;
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
      `🌐 *الترتيب المباشر:*\n${WEBSITE_URL}`;
  } else {
    // Russian
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
      `🌐 *Таблица и сайт лиги:*\n${WEBSITE_URL}`;
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'online', bot: 'BratvaFCMBot', mode: 'Vercel Serverless 24/7' });
  }

  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const update = req.body;
  if (!update) return res.status(200).send('OK');

  try {
    if (update.callback_query) {
      const cb = update.callback_query;
      const data = cb.data || '';
      const chatId = cb.message ? cb.message.chat.id : cb.from.id;

      if (data.startsWith('tab_')) {
        const parts = data.split('_');
        const tIndexNum = parseInt(parts[1], 10) || 0;
        const targetLang = parts[2] || 'ru';

        const tIndex = await fetchGithubJson('docs/league-data/index/tournaments_index.json');
        const tIds = Object.keys(tIndex || {}).reverse();
        const tId = tIds[tIndexNum] || tIds[0];
        const t = await fetchGithubJson(`docs/league-data/tournaments/${tId}.json`);

        const updatedText = formatRecap(t, targetLang);
        const updatedKeyboard = getTabsKeyboard(targetLang, tIndexNum);

        await telegramRequest('editMessageText', {
          chat_id: chatId,
          message_id: cb.message.message_id,
          text: updatedText,
          parse_mode: 'Markdown',
          reply_markup: updatedKeyboard
        });
        await telegramRequest('answerCallbackQuery', { callback_query_id: cb.id });
      }
      return res.status(200).send('OK');
    }

    const message = update.message;
    if (!message) return res.status(200).send('OK');

    const chatId = message.chat.id;
    const text = (message.text || '').trim();

    if (text.startsWith('/start') || text.startsWith('/help')) {
      const msg = `⚜️ *БРАТВА FCM LEAGUE BOT (24/7 Cloud)* ⚜️\n\n` +
        `📸 Отправь мне скриншот турнира из EA FC Mobile!\n` +
        `Я автоматически обновлю сайт и канал!\n\n` +
        `🌐 *Сайت лиги:* ${WEBSITE_URL}`;
      await telegramRequest('sendMessage', { chat_id: chatId, text: msg, parse_mode: 'Markdown' });
      return res.status(200).send('OK');
    }

    if (text.startsWith('/recap') || text.startsWith('/broadcast')) {
      const tIndex = await fetchGithubJson('docs/league-data/index/tournaments_index.json');
      const tIds = Object.keys(tIndex || {}).reverse();
      const t = await fetchGithubJson(`docs/league-data/tournaments/${tIds[0]}.json`);
      const recap = formatRecap(t, 'ru');
      const keys = getTabsKeyboard('ru', 0);

      await telegramRequest('sendMessage', { chat_id: CHANNEL_ID, text: recap, parse_mode: 'Markdown', reply_markup: keys });
      if (chatId !== CHANNEL_ID) {
        await telegramRequest('sendMessage', { chat_id: chatId, text: `📢 Broadcast sent to ${CHANNEL_ID}!` });
      }
      return res.status(200).send('OK');
    }

    if (message.photo && message.photo.length > 0) {
      await telegramRequest('sendMessage', { chat_id: chatId, text: '🔍 *Analyzing screenshot with Gemini Vision AI...*', parse_mode: 'Markdown' });
      const largestPhoto = message.photo[message.photo.length - 1];
      const imgBuffer = await downloadTelegramFile(largestPhoto.file_id);
      const aiResult = await analyzeImageWithGemini(imgBuffer);

      if (!aiResult || aiResult.is_tournament_screenshot === false) {
        await telegramRequest('sendMessage', { chat_id: chatId, text: '⚠️ *Not a valid EA FC Mobile tournament screenshot!*' });
        return res.status(200).send('OK');
      }

      if (aiResult.status === 'LIVE') {
        const unplayed = (aiResult.players || []).filter(p => p.turns_played < 3 || p.limit_remaining === '3/3');
        const pLines = unplayed.map(p => `[ ⏳ | ${p.name} | ${p.turns_played}/3 ]`).join('\n');
        const liveMsg = `🟢 *LIVE MATCH: vs ${aiResult.opponent_league}*\nScore: ${aiResult.score_bratva} - ${aiResult.score_opponent}\n\n` +
          `⛔ *ATTENTION PLEASE:*\n${pLines}\n\n⏳ Match ending soon! Attack 3/3 ASAP!`;
        await telegramRequest('sendMessage', { chat_id: chatId, text: liveMsg });
        return res.status(200).send('OK');
      }

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
        matches: (aiResult.players || []).map((p, idx) => ({
          player_id: p.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || `player_${idx}`,
          player_display_name: p.name,
          ovr: p.ovr || 125,
          goals_for: p.goals || 0,
          turns_played: p.turns_played !== undefined ? p.turns_played : (p.limit_remaining === '0/3' ? 3 : 0)
        }))
      };

      try {
        const fileContent = Buffer.from(JSON.stringify(tData, null, 2)).toString('base64');
        const existingFile = await githubApi(`/repos/${GITHUB_REPO}/contents/docs/league-data/tournaments/${tId}.json`);
        const commitPayload = {
          message: `Auto-Update: Recorded tournament vs ${tData.opponent_league}`,
          content: fileContent
        };
        if (existingFile && existingFile.sha) commitPayload.sha = existingFile.sha;
        await githubApi(`/repos/${GITHUB_REPO}/contents/docs/league-data/tournaments/${tId}.json`, 'PUT', commitPayload);
      } catch (ghErr) {
        console.error('GitHub API Commit Error:', ghErr);
      }

      const recap = formatRecap(tData, 'ru');
      const keys = getTabsKeyboard('ru', 0);

      await telegramRequest('sendMessage', { chat_id: CHANNEL_ID, text: recap, parse_mode: 'Markdown', reply_markup: keys });
      await telegramRequest('sendMessage', { chat_id: chatId, text: `🔴 *MATCH COMPLETED & BROADCASTED TO ${CHANNEL_ID}!*\n\n${recap}`, parse_mode: 'Markdown', reply_markup: keys });

      return res.status(200).send('OK');
    }

    return res.status(200).send('OK');
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(200).send('Error handled');
  }
};
