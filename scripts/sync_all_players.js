import fs from 'fs';
import path from 'path';

const tDir = path.join(process.cwd(), 'docs', 'league-data', 'tournaments');
const pDir = path.join(process.cwd(), 'docs', 'league-data', 'players');
const pIndexPath = path.join(process.cwd(), 'docs', 'league-data', 'index', 'players_index.json');
const tIndexPath = path.join(process.cwd(), 'docs', 'league-data', 'index', 'tournaments_index.json');
const regPath = path.join(process.cwd(), 'docs', 'league-data', 'registered_players.json');

const pIndex = JSON.parse(fs.readFileSync(pIndexPath, 'utf8'));
const tFiles = fs.readdirSync(tDir).filter(f => f.endsWith('.json')).sort();
const playerMap = {};

tFiles.forEach(f => {
  const t = JSON.parse(fs.readFileSync(path.join(tDir, f), 'utf8'));
  const tId = t.id || t.tournament_id || f.replace('.json', '');
  (t.matches || []).forEach((m, idx) => {
    const pid = String(m.player_id).toLowerCase();
    if (!playerMap[pid]) {
      playerMap[pid] = {
        player_id: pid,
        display_name: m.player_display_name || pid,
        known_aliases: [],
        matches: []
      };
    }
    playerMap[pid].matches.push({
      tournament_id: tId,
      match_index_in_tournament: m.board_order || (idx + 1),
      opponent_display_name: t.opponent_league,
      opponent_id: tId,
      goals_for: m.goals_for || 0,
      goals_against: 0,
      result: t.result || 'win',
      turns_played: m.turns_played !== undefined ? m.turns_played : (m.goals_for > 0 ? 3 : 0),
      player_display_name: m.player_display_name || playerMap[pid].display_name,
      player_id: pid
    });
  });
});

let updatedCount = 0;
for (const [pid, data] of Object.entries(playerMap)) {
  const matches = data.matches;
  matches.sort((a, b) => a.tournament_id.slice(0, 10).localeCompare(b.tournament_id.slice(0, 10)));
  const totalGoals = matches.reduce((s, m) => s + (m.goals_for || 0), 0);
  const totalMatches = matches.length;
  const avg = parseFloat((totalGoals / totalMatches).toFixed(1));

  let failStreak = 0;
  for (let i = matches.length - 1; i >= 0; i--) {
    if (matches[i].turns_played < 3) failStreak++;
    else break;
  }

  const existingFile = path.join(pDir, pid + '.json');
  let existingObj = {};
  if (fs.existsSync(existingFile)) {
    try { existingObj = JSON.parse(fs.readFileSync(existingFile, 'utf8')); } catch(e){}
  }

  const merged = {
    player_id: pid,
    display_name: pIndex[pid]?.display_name || existingObj.display_name || data.display_name,
    known_aliases: existingObj.known_aliases || [],
    total_goals: totalGoals,
    total_matches: totalMatches,
    average_goals: avg,
    matches: matches,
    eligibility_streak: pIndex[pid]?.eligibility_streak || {
      current_fail_streak: failStreak,
      last_evaluated_tournament_id: matches[matches.length - 1].tournament_id,
      flagged_for_review: failStreak >= 3
    }
  };

  fs.writeFileSync(existingFile, JSON.stringify(merged, null, 2), 'utf8');

  const rootPFile = path.join(process.cwd(), 'league-data', 'players', pid + '.json');
  if (fs.existsSync(path.dirname(rootPFile))) {
    fs.writeFileSync(rootPFile, JSON.stringify(merged, null, 2), 'utf8');
  }

  pIndex[pid] = {
    display_name: merged.display_name,
    total_goals: totalGoals,
    total_matches: totalMatches,
    average_goals: avg,
    last_tournament_date: matches[matches.length - 1].tournament_id.slice(0, 10),
    eligibility_streak: merged.eligibility_streak
  };

  updatedCount++;
}

fs.writeFileSync(pIndexPath, JSON.stringify(pIndex, null, 2), 'utf8');
const rootPIndexPath = path.join(process.cwd(), 'league-data', 'index', 'players_index.json');
if (fs.existsSync(path.dirname(rootPIndexPath))) {
  fs.writeFileSync(rootPIndexPath, JSON.stringify(pIndex, null, 2), 'utf8');
}

console.log(`Successfully synced ${updatedCount} players on disk.`);
