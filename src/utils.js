import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

// Base path for all league data
export const LEAGUE_DATA_DIR = path.resolve('league-data');
export const PLAYERS_DIR = path.join(LEAGUE_DATA_DIR, 'players');
export const TOURNAMENTS_DIR = path.join(LEAGUE_DATA_DIR, 'tournaments');
export const INDEX_DIR = path.join(LEAGUE_DATA_DIR, 'index');
export const REVIEW_DIR = path.join(LEAGUE_DATA_DIR, '_review');
export const RAW_DIR = path.join(LEAGUE_DATA_DIR, '_raw');

/**
 * Convert a display name to a stable player_id slug.
 * Lowercase, spaces to underscores, strip special chars, handle Cyrillic by transliterating.
 */
export function slugify(name) {
    if (!name) return '';
    const cyrillicMap = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
        'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
        'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
        'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
    };
    
    let slug = String(name).normalize('NFKC').toLowerCase().split('').map(char => cyrillicMap[char] !== undefined ? cyrillicMap[char] : char).join('');
    
    slug = slug.replace(/\s+/g, '_');
    slug = slug.replace(/[^a-z0-9_]/g, '');
    
    return slug;
}

/**
 * Derive match result from goals.
 * @returns 'win' | 'loss' | 'draw'
 */
export function deriveResult(goalsFor, goalsAgainst) {
    if (goalsFor > goalsAgainst) return 'win';
    if (goalsFor < goalsAgainst) return 'loss';
    return 'draw';
}

/**
 * Current timestamp in ISO 8601 UTC format.
 */
export function nowISO() {
    return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Copy a screenshot file to _raw/<tournamentId>/
 */
export function copyToRaw(screenshotAbsPath, tournamentId) {
    const rawTournamentDir = path.join(RAW_DIR, tournamentId);
    if (!existsSync(rawTournamentDir)) {
        mkdirSync(rawTournamentDir, { recursive: true });
    }
    const fileName = path.basename(screenshotAbsPath);
    const destPath = path.join(rawTournamentDir, fileName);
    copyFileSync(screenshotAbsPath, destPath);
    
    return `_raw/${tournamentId}/${fileName}`;
}

/**
 * Read a JSON file, return parsed object. Returns null if file doesn't exist.
 */
export function readJSON(filePath) {
    if (!existsSync(filePath)) return null;
    try {
        const content = readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
    } catch (e) {
        return null;
    }
}

/**
 * Write an object as formatted JSON to a file.
 */
export function writeJSON(filePath, data) {
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Arabic transliteration map for generating readable slugs.
 */
const arabicMap = {
    'ا': 'a', 'أ': 'a', 'إ': 'i', 'آ': 'aa', 'ب': 'b', 'ت': 't', 'ث': 'th',
    'ج': 'j', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z',
    'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a',
    'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
    'ه': 'h', 'و': 'w', 'ي': 'y', 'ى': 'a', 'ة': 'a', 'ء': '', 'ئ': 'y', 'ؤ': 'w',
};

/**
 * Generate tournament ID from date and opponent league name.
 * Handles Latin, Cyrillic, and Arabic league names.
 */
export function generateTournamentId(dateStr, opponentLeague) {
    let slug = opponentLeague.toLowerCase().split('').map(char => {
        const cyrillicMap = {
            'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
            'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
            'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
            'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
        };
        if (cyrillicMap[char] !== undefined) return cyrillicMap[char];
        if (arabicMap[char] !== undefined) return arabicMap[char];
        return char;
    }).join('');
    
    slug = slug.replace(/\s+/g, '-');
    slug = slug.replace(/[^a-z0-9-]/g, '');
    slug = slug.replace(/-+/g, '-').replace(/^-|-$/g, ''); // clean up multiple/trailing dashes
    
    // Fallback if slug is empty (all characters were stripped)
    if (!slug) slug = 'unknown-league';
    
    const baseId = `${dateStr}_${slug}`;
    let id = baseId;
    let counter = 2;
    
    while (existsSync(path.join(TOURNAMENTS_DIR, `${id}.json`))) {
        id = `${baseId}-${counter}`;
        counter++;
    }
    
    return id;
}
