/* ============================================
   БРАТВА FC Mobile — Notebook Engine
   Slide animations, sketchy charts, hand-drawn UI
   ============================================ */

const I18N = {
  en: {
    dir: 'ltr',
    league_record: 'League Overview',
    wins: 'Wins',
    draws: 'Draws',
    losses: 'Losses',
    recent_tournament: 'Recent Tournament',
    totw_spotlight: 'MVPs',
    top_performers: 'Top Scorers',
    flagged_players: 'Flagged Review',
    tournament_history: 'Tournament History',
    player: 'Player',
    player_scores: 'Player Scores',
    goals: 'G',
    matches: 'T',
    avg_goals: 'Avg',
    avg_goals_m: 'AVG G/M',
    efficiency: 'EFFICIENCY',
    search_placeholder: 'Search player...',
    no_players_found: 'No players match your search',
    last_match: 'Last Match',
    all_time: 'All Time',
    window_7d: '7 Days',
    window_30d: '30 Days',
    nav_dash: 'DASH',
    nav_tournaments: 'MATCHES',
    nav_roster: 'MEMBERS',
    nav_leaderboard: 'RANKS',
    nav_rules: 'ADMIN',
    loading: 'Loading notes...',
    performance_chart: '7-Day Trend',
    click_point_hint: '(Tap a point for details)',
    turns_completed: 'turns',
    verdict_needs_work: 'Needs work',
    verdict_acceptable: 'Acceptable',
    verdict_good: 'Good',
    verdict_perfect: 'Perfect',
    verdict_champion: 'Champion',
    verdict_legendary: 'Legendary',
    verdict_absent: 'Absent/Skipped',
    verdict_no_tournament: 'No tournament today',
    eligibility_ok: '✓ 0 FAILS • ELIGIBLE',
    eligibility_warn: '⚠️ {n} FAIL STREAK',
    eligibility_flagged: '🚨 FLAGGED ({n} FAILS)',
    full_view: 'FULL VIEW',
    matches_played: 'Matches',
    win_rate: 'Win Rate',
    total_goals: 'TOTAL GOALS',
    top_performer_spotlight: 'Top Performer',
    double_tap_exit: 'DOUBLE-TAP OR ESC TO RETURN',
    rank_top_scorer: '👑 #1 TOP SCORER',
    rank_runner_up: '🥈 #2 RUNNER-UP',
    rank_podium: '🥉 #3 PODIUM',
    rank_num: 'RANK #{n}',
    squad_member: 'MEMBER',
    match_performance: 'MATCH PERFORMANCE',
    matches_logged: '{n} Matches Logged',
    no_matches_logged: 'No matches logged yet',
    no_match_selected: 'No Match Selected',
    turns_played_desc: '{n}/3 Turns Played',
    turns_played_badge: '{n}/3 TURNS',
    goals_count: '{n} GOALS',
    no_tournament_history: 'No tournament history yet',
    stamp_win: 'WIN',
    stamp_loss: 'LOSS',
    stamp_draw: 'DRAW',
    stamp_played: 'PLAYED',
    vs_match: 'vs {opp}',
    broadcast_hint: 'Official in-game announcements formatted for EA FC Mobile. Tip: Use the "+" Announcement (📢) button in League Chat to preserve line breaks and notify all members!',
    admin_panel_title: 'ADMIN RULES & CONTROLS',
    unlock_btn: 'UNLOCK',
    save_recalculate: 'SAVE & RECALCULATE SYSTEM',
    copy_msg_btn: 'COPY MESSAGE',
    copied_toast: 'COPIED! ✓',
    rule_max_misses: 'Max Consecutive Misses Before Kick',
    rule_min_turns: 'Mandatory Turns Per Tournament',
    rule_min_goals: 'Minimum Goals Target (3 Turns)',
    rule_horizon: 'Attendance Evaluation Horizon',
    b_posting_deadline: 'POSTING DEADLINE:',
    b_copy_ru_btn: 'COPY RUSSIAN [RU]',
    b_copy_en_btn: 'COPY ENGLISH [EN]',
    b_copy_combined_btn: 'COPY DUAL MESSAGE [RU + EN]',
    b_copied_toast: 'COPIED TO CLIPBOARD! ✓',
    b_title_live_warning: 'LIVE MATCH WARNING',
    b_badge_live_warning: 'LIVE URGENT',
    b_timing_live_warning: 'During Live Match Final Hours',
    b_title_rally: 'MATCH START RALLY',
    b_badge_rally: 'MATCH START',
    b_timing_rally: 'At Tournament Start (Hour 0–2)',
    b_title_last_review: 'LAST MATCH RECAP',
    b_badge_last_review: 'MATCH RECAP',
    b_timing_last_review: 'Immediately Following Tournament Conclusion',
    b_title_warnings: 'STRIKES & WARNINGS',
    b_badge_warnings: 'POST-MATCH NOTICE',
    b_timing_warnings: 'Immediately After Tournament Conclusion',
    b_title_rules: 'LEAGUE RULES',
    b_badge_rules: 'NOTICE / PERMANENT',
    b_timing_rules: 'Permanent League Announcement',
    rules_modal_title: 'Official League Rules',
    rules_modal_sub: 'Mandatory constitution & discipline policy',
    news_modal_title: 'League Updates & News Feed',
    news_modal_sub: 'Real-time tournament status and official feed',
    swipe_to_edit: 'Slide to unlock edit mode',
    edit_mode_active: 'Edit Mode Active (Unlocked)',
    rules_btn_title: 'League Rules',
    news_btn_title: 'League Updates'
  },
  ar: {
    dir: 'rtl',
    league_record: 'نظرة عامة',
    wins: 'فوز',
    draws: 'تعادل',
    losses: 'خسارة',
    recent_tournament: 'آخر مباراة',
    totw_spotlight: 'أفضل اللاعبين',
    top_performers: 'الهدافين',
    flagged_players: 'مراجعة الغياب',
    tournament_history: 'سجل المباريات',
    player: 'اللاعب',
    player_scores: 'أهداف اللاعبين',
    goals: 'أهداف',
    matches: 'م',
    avg_goals: 'معدل',
    avg_goals_m: 'معدل الأهداف',
    efficiency: 'نسبة المحاولات',
    search_placeholder: 'بحث عن لاعب...',
    no_players_found: 'لا يوجد لاعب بهذا الاسم',
    last_match: 'آخر مباراة',
    all_time: 'كل الأوقات',
    window_7d: '7 أيام',
    window_30d: '30 يوم',
    nav_dash: 'الرئيسية',
    nav_tournaments: 'المباريات',
    nav_roster: 'الأعضاء',
    nav_leaderboard: 'الترتيب',
    nav_rules: 'الإدارة',
    loading: 'جاري التحميل...',
    performance_chart: 'أداء 7 أيام',
    click_point_hint: '(انقر للتفاصيل)',
    turns_completed: 'محاولات',
    verdict_needs_work: 'ضعيف',
    verdict_acceptable: 'مقبول',
    verdict_good: 'جيد',
    verdict_perfect: 'مثالي',
    verdict_champion: 'بطل',
    verdict_legendary: 'أسطوري',
    verdict_absent: 'غائب',
    verdict_no_tournament: 'لا توجد بطولة',
    eligibility_ok: '✓ 0 فشل • مؤهل',
    eligibility_warn: '⚠️ تحذير ({n} فشل)',
    eligibility_flagged: '🚨 مراجعة ({n} فشل!)',
    full_view: 'عرض كامل',
    matches_played: 'المباريات',
    win_rate: 'نسبة الفوز',
    total_goals: 'إجمالي الأهداف',
    top_performer_spotlight: 'أفضل هداف',
    double_tap_exit: 'انقر مرتين أو اضغط ESC للعودة',
    rank_top_scorer: '👑 هداف الدوري #1',
    rank_runner_up: '🥈 وصيف الدوري #2',
    rank_podium: '🥉 المركز الثالث #3',
    rank_num: 'المركز #{n}',
    squad_member: 'عضو الفريق',
    match_performance: 'سجل أداء المباريات',
    matches_logged: '{n} مباريات مسجلة',
    no_matches_logged: 'لا توجد مباريات مسجلة بعد',
    no_match_selected: 'اختر مباراة للتفاصيل',
    turns_played_desc: '{n}/3 محاولات مكتملة',
    turns_played_badge: '{n}/3 محاولات',
    goals_count: '{n} أهداف',
    no_tournament_history: 'لا يوجد سجل مباريات بعد',
    stamp_win: 'فوز',
    stamp_loss: 'خسارة',
    stamp_draw: 'تعادل',
    stamp_played: 'لعب',
    vs_match: 'ضد {opp}',
    broadcast_hint: 'رسائل الشات الرسمية مهيأة لتناسب إعلانات EA FC Mobile. نصيحة: استخدم زر الإعلان "+" (📢) في شات الدوري للحفاظ على الأسطر المنظمة وتنبيه جميع الأعضاء!',
    admin_panel_title: 'لوحة تحكم القوانين للمشرفين',
    unlock_btn: 'فتح القفل',
    save_recalculate: 'حفظ وإعادة حساب النظام',
    copy_msg_btn: 'نسخ الرسالة',
    copied_toast: 'تم النسخ! ✓',
    rule_max_misses: 'الحد الأقصى للغياب المتتالي قبل الطرد',
    rule_min_turns: 'الأشواط الإلزامية في كل بطولة',
    rule_min_goals: 'الهدف الأدنى للأهداف المطلوبة',
    rule_horizon: 'فترة تقييم الحضور والأداء',
    b_posting_deadline: 'موعد النشر في الشات:',
    b_copy_ru_btn: 'نسخ النص بالروسية [RU]',
    b_copy_en_btn: 'نسخ النص بالإنجليزية [EN]',
    b_copied_toast: 'تم النسخ بنجاح! ✓',
    b_title_live_warning: 'LIVE MATCH WARNING',
    b_badge_live_warning: 'مباشر وعاجل',
    b_timing_live_warning: 'خلال الساعات الأخيرة من المباراة الجارية',
    b_title_rally: 'MATCH START RALLY',
    b_badge_rally: 'بداية البطولة',
    b_timing_rally: 'مع انطلاق البطولة (الساعة 0–2)',
    b_title_last_review: 'LAST MATCH RECAP',
    b_badge_last_review: 'ملخص المباراة',
    b_timing_last_review: 'مباشرة بعد نهاية البطولة الأخيرة',
    b_title_warnings: 'STRIKES & WARNINGS',
    b_badge_warnings: 'تنبيه بعد المباراة',
    b_timing_warnings: 'مباشرة بعد نهاية كل بطولة',
    b_title_rules: 'LEAGUE RULES',
    b_badge_rules: 'إعلان دائم',
    b_title_live_warning: 'إنذار المباراة الجارية',
    b_title_rally: 'نداء بدء المباراة',
    b_title_last_review: 'حصاد آخر مباراة',
    b_title_warnings: 'الإنذارات والعقوبات',
    b_title_rules: 'قوانين الدوري',
    b_timing_rules: 'إعلان دائم في الدوري',
    rules_modal_title: 'قوانين الدوري الرسمية',
    rules_modal_sub: 'الدستور الرسمي ولائحة الانضباط',
    news_modal_title: 'تحديثات وأخبار الدوري',
    news_modal_sub: 'حالة البطولة الجارية وآخر الأخبار',
    swipe_to_edit: 'اسحب لفتح التعديل',
    edit_mode_active: 'وضع التعديل مفعّل (مفتوح)',
    rules_btn_title: 'قوانين الدوري',
    news_btn_title: 'تحديثات الدوري'
  },
  ru: {
    dir: 'ltr',
    league_record: 'Обзор Лиги',
    wins: 'Победы',
    draws: 'Ничьи',
    losses: 'Поражения',
    recent_tournament: 'Последний матч',
    totw_spotlight: 'Лучшие',
    top_performers: 'Бомбардиры',
    flagged_players: 'Проверка активности',
    tournament_history: 'История матчей',
    player: 'Игрок',
    player_scores: 'Голы игроков',
    goals: 'Г',
    matches: 'М',
    avg_goals: 'Ср.',
    avg_goals_m: 'СР. ГОЛОВ',
    efficiency: 'АКТИВНОСТЬ',
    search_placeholder: 'Поиск игрока...',
    no_players_found: 'Игроки не найдены',
    last_match: 'Последний матч',
    all_time: 'Всё время',
    window_7d: '7 дней',
    window_30d: '30 дней',
    nav_dash: 'ДАШБОРД',
    nav_tournaments: 'МАТЧИ',
    nav_roster: 'УЧАСТНИКИ',
    nav_leaderboard: 'РАНГИ',
    nav_rules: 'АДМИН',
    loading: 'Загрузка...',
    performance_chart: 'Форма 7 дней',
    click_point_hint: '(Жми на точку)',
    turns_completed: 'ходов',
    verdict_needs_work: 'Слабо',
    verdict_acceptable: 'Приемлемо',
    verdict_good: 'Хорошо',
    verdict_perfect: 'Идеально',
    verdict_champion: 'Чемпион',
    verdict_legendary: 'Легенда',
    verdict_absent: 'Пропуск',
    verdict_no_tournament: 'Нет турнира',
    eligibility_ok: '✓ 0 ПРОПУСКОВ • ДОПУЩЕН',
    eligibility_warn: '⚠️ ВНИМАНИЕ ({n} ПРОП.)',
    eligibility_flagged: '🚨 БАН ({n} ПРОП.!)',
    full_view: 'ПОЛНЫЙ ЭКРАН',
    matches_played: 'МАТЧИ',
    win_rate: 'Процент побед',
    total_goals: 'ВСЕГО ГОЛОВ',
    top_performer_spotlight: 'Лучший бомбардир',
    double_tap_exit: 'ДВОЙНОЙ ТАП ИЛИ ESC ДЛЯ ВЫХОДА',
    rank_top_scorer: '👑 ТОП-1 БОМБАРДИР',
    rank_runner_up: '🥈 ТОП-2 ВИЦЕ-ЛИДЕР',
    rank_podium: '🥉 ТОП-3 ПОДИУМ',
    rank_num: 'РАНГ #{n}',
    squad_member: 'ИГРОК СОСТАВА',
    match_performance: 'ФОРМА И РЕЗУЛЬТАТЫ',
    matches_logged: 'Матчей в базе: {n}',
    no_matches_logged: 'Нет сыгранных матчей',
    no_match_selected: 'Выберите матч для деталей',
    turns_played_desc: '{n}/3 ходов сыграно',
    turns_played_badge: '{n}/3 ХОДОВ',
    goals_count: '{n} ГОЛОВ',
    no_tournament_history: 'История матчей отсутствует',
    stamp_win: 'ПОБЕДА',
    stamp_loss: 'ПОРАЖЕНИЕ',
    stamp_draw: 'НИЧЬЯ',
    stamp_played: 'СЫГРАНО',
    vs_match: 'против {opp}',
    broadcast_hint: 'Официальные сообщения для чата лиги. Совет: отправляйте через кнопку "+" (📢 Объявление) в чате лиги для сохранения строк и оповещения всех игроков!',
    admin_panel_title: 'ПАНЕЛЬ УПРАВЛЕНИЯ ПРАВИЛАМИ',
    unlock_btn: 'РАЗБЛОКИРОВАТЬ',
    save_recalculate: 'СОХРАНИТЬ И ПЕРЕСЧИТАТЬ СИСТЕМУ',
    copy_msg_btn: 'СКОПИРОВАТЬ',
    copied_toast: 'СКОПИРОВАНО! ✓',
    rule_max_misses: 'Макс. пропусков подряд до исключения',
    rule_min_turns: 'Обязательно ходов за турнир',
    rule_min_goals: 'Минимум голов за турнир',
    rule_horizon: 'Период оценки активности',
    b_posting_deadline: 'ВРЕМЯ ПУБЛИКАЦИИ В ЧАТЕ:',
    b_copy_ru_btn: 'СКОПИРОВАТЬ [RU]',
    b_copy_en_btn: 'СКОПИРОВАТЬ [EN]',
    b_copied_toast: 'СКОПИРОВАНО В БУФЕР! ✓',
    b_title_live_warning: 'LIVE MATCH WARNING',
    b_badge_live_warning: 'МАТЧ ИДЕТ / СРОЧНО',
    b_timing_live_warning: 'В финальные часы идущего турнира',
    b_title_rally: 'MATCH START RALLY',
    b_badge_rally: 'СТАРТ МАТЧА',
    b_timing_rally: 'На старте турнира (0–2 час)',
    b_title_last_review: 'LAST MATCH RECAP',
    b_badge_last_review: 'ОБЗОР МАТЧА',
    b_timing_last_review: 'Сразу после завершения турнира',
    b_title_warnings: 'STRIKES & WARNINGS',
    b_badge_warnings: 'ПОСЛЕ МАТЧА',
    b_timing_warnings: 'Сразу после завершения турнира',
    b_title_rules: 'LEAGUE RULES',
    b_badge_rules: 'ПОСТОЯННО',
    b_title_live_warning: 'ПРЕДУПРЕЖДЕНИЕ: МАТЧ ИДЕТ',
    b_title_rally: 'БОЕВОЙ КЛИЧ НА МАТЧ',
    b_title_last_review: 'ОБЗОР ПОСЛЕДНЕГО МАТЧА',
    b_title_warnings: 'ПРЕДУПРЕЖДЕНИЯ И СТРАЙКИ',
    b_title_rules: 'ПРАВИЛА ЛИГИ',
    b_timing_rules: 'Постоянные правила лиги',
    rules_modal_title: 'Официальные правила лиги',
    rules_modal_sub: 'Устав лиги и регламент дисциплины',
    news_modal_title: 'Новости и события лиги',
    news_modal_sub: 'Статус текущего матча и лента объявлений',
    swipe_to_edit: 'Проведите для разблокировки',
    edit_mode_active: 'Режим редактирования активен',
    rules_btn_title: 'Правила лиги',
    news_btn_title: 'Новости лиги'
  },
  es: {
    dir: 'ltr',
    league_record: 'Resumen',
    wins: 'Vic',
    draws: 'Emp',
    losses: 'Der',
    recent_tournament: 'Último Partido',
    totw_spotlight: 'Destacados',
    top_performers: 'Goleadores',
    flagged_players: 'En Revisión',
    tournament_history: 'Historial',
    player: 'Jugador',
    player_scores: 'Goles por Jugador',
    goals: 'Goles',
    matches: 'P',
    avg_goals: 'Prom',
    avg_goals_m: 'PROM. G/P',
    efficiency: 'EFICACIA',
    search_placeholder: 'Buscar jugador...',
    no_players_found: 'No se encontraron jugadores',
    last_match: 'Último Partido',
    all_time: 'Todo',
    window_7d: '7 Días',
    window_30d: '30 Días',
    nav_dash: 'PANEL',
    nav_tournaments: 'PARTIDOS',
    nav_roster: 'MIEMBROS',
    nav_leaderboard: 'RANGOS',
    nav_rules: 'ADMIN',
    loading: 'Cargando...',
    performance_chart: 'Rendimiento 7d',
    click_point_hint: '(Toca un punto)',
    turns_completed: 'turnos',
    verdict_needs_work: 'Bajo',
    verdict_acceptable: 'Aceptable',
    verdict_good: 'Bueno',
    verdict_perfect: 'Perfecto',
    verdict_champion: 'Campeón',
    verdict_legendary: 'Legendario',
    verdict_absent: 'Ausente',
    verdict_no_tournament: 'Sin torneo',
    eligibility_ok: '✓ 0 FALLOS • ELEGIBLE',
    eligibility_warn: '⚠️ AVISO ({n} FALLOS)',
    eligibility_flagged: '🚨 REVISIÓN ({n} FALLOS!)',
    full_view: 'PANTALLA COMPLETA',
    matches_played: 'PARTIDOS',
    win_rate: 'Tasa de Victoria',
    total_goals: 'GOLES TOTALES',
    top_performer_spotlight: 'Goleador Estrella',
    double_tap_exit: 'DOBLE TOQUE O ESC PARA SALIR',
    rank_top_scorer: '👑 #1 MÁXIMO GOLEADOR',
    rank_runner_up: '🥈 #2 SUBCAMPEÓN',
    rank_podium: '🥉 #3 PODIO',
    rank_num: 'RANGO #{n}',
    squad_member: 'MIEMBRO',
    match_performance: 'RENDIMIENTO POR PARTIDO',
    matches_logged: '{n} Partidos Registrados',
    no_matches_logged: 'Sin partidos registrados aún',
    no_match_selected: 'Selecciona un partido',
    turns_played_desc: '{n}/3 Turnos Jugados',
    turns_played_badge: '{n}/3 TURNOS',
    goals_count: '{n} GOLES',
    no_tournament_history: 'Sin historial de partidos aún',
    stamp_win: 'VICTORIA',
    stamp_loss: 'DERROTA',
    stamp_draw: 'EMPATE',
    stamp_played: 'JUGADO',
    vs_match: 'vs {opp}',
    broadcast_dispatch_title: 'Despacho de Mensajes para el Chat',
    broadcast_hint: 'Anuncios oficiales adaptados a EA FC Mobile. ¡Consejo: Usa el botón "+" (📢 Anuncio) en el chat de la liga para mantener los saltos de línea y notificar a todos!',
    admin_panel_title: 'PANEL DE CONTROL DE REGLAS',
    unlock_btn: 'DESBLOQUEAR',
    save_recalculate: 'GUARDAR Y RECALCULAR SISTEMA',
    copy_msg_btn: 'COPIAR MENSAJE',
    copied_toast: '¡COPIADO! ✓',
    rule_max_misses: 'Máx. torneos consecutivos perdidos antes de expulsión',
    rule_min_turns: 'Turnos obligatorios por torneo',
    rule_min_goals: 'Objetivo mínimo de goles',
    rule_horizon: 'Periodo de evaluación de asistencia',
    b_posting_deadline: 'MOMENTO DE PUBLICACIÓN:',
    b_copy_ru_btn: 'COPIAR RUSO [RU]',
    b_copy_en_btn: 'COPIAR INGLÉS [EN]',
    b_copied_toast: '¡COPIADO AL PORTAPAPELES! ✓',
    b_title_live_warning: 'LIVE MATCH WARNING',
    b_badge_live_warning: 'EN VIVO / URGENTE',
    b_timing_live_warning: 'Durante las últimas horas del partido en vivo',
    b_title_rally: 'MATCH START RALLY',
    b_badge_rally: 'INICIO DE PARTIDO',
    b_timing_rally: 'Al iniciar el torneo (hora 0–2)',
    b_title_last_review: 'LAST MATCH RECAP',
    b_badge_last_review: 'RESUMEN DE PARTIDO',
    b_timing_last_review: 'Inmediatamente después de finalizar el torneo',
    b_title_warnings: 'STRIKES & WARNINGS',
    b_badge_warnings: 'AVISO TRAS PARTIDO',
    b_timing_warnings: 'Inmediatamente después de finalizar el torneo',
    b_title_rules: 'LEAGUE RULES',
    b_badge_rules: 'AVISO PERMANENTE',
    b_title_live_warning: 'AVISO: PARTIDO EN VIVO',
    b_title_rally: 'INICIO DE PARTIDO',
    b_title_last_review: 'RESUMEN DEL ÚLTIMO PARTIDO',
    b_title_warnings: 'SANCIONES Y AVISOS',
    b_title_rules: 'REGLAS DE LA LIGA',
    b_timing_rules: 'Reglas oficiales permanentes',
    rules_modal_title: 'Reglas Oficiales de la Liga',
    rules_modal_sub: 'Constitución y política de disciplina',
    news_modal_title: 'Noticias y Actualizaciones',
    news_modal_sub: 'Estado del partido en vivo y anuncios',
    swipe_to_edit: 'Desliza para desbloquear edición',
    edit_mode_active: 'Modo edición activo (Desbloqueado)',
    rules_btn_title: 'Reglas de la Liga',
    news_btn_title: 'Noticias de la Liga'
  }
};

const DATA_PATHS = ['./league-data', '../league-data', 'league-data'];
let activePath = './league-data';

// --- Sound Manager (Web Audio API - Studio Grade UI Haptics) ---
const SoundManager = {
  ctx: null,
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },

  // Apple/Studio-grade crisp tactile click
  playClick() {
    if (!this.ctx) this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;

      // Crisp transient micro-tick
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.008);

      gain.gain.setValueAtTime(0.045, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.008);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.009);
    } catch (e) {}
  },

  // Premium studio tactile glass/haptic impulse for tabs (Muted, mature, luxury mechanical feel)
  playTabSlide() {
    if (!this.ctx) this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;

      // Layer 1: Subtle acoustic glass tap (high dampened transient)
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      osc1.frequency.exponentialRampToValueAtTime(320, now + 0.012);

      gain1.gain.setValueAtTime(0.04, now);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.012);

      osc1.connect(gain1);
      gain1.connect(this.ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.013);

      // Layer 2: Deep dampened sub-haptic bump (feels like physical hardware)
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(110, now);
      osc2.frequency.exponentialRampToValueAtTime(45, now + 0.018);

      gain2.gain.setValueAtTime(0.07, now);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);

      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);
      osc2.start(now);
      osc2.stop(now + 0.02);
    } catch (e) {}
  }
};

// --- Audio Manager (Background Music & Flag Flapping Ambiance) ---
const AudioManager = {
  bgMusic: null,
  flagSound: null,
  isMusicMuted: localStorage.getItem('fcm_music_muted') === 'true',
  targetMusicVol: 0.05,
  flagVol: 0.25,
  initialized: false,
  fadeInterval: null,
  inImmersive: false,

  init() {
    if (this.initialized) return;
    this.initialized = true;

    try {
      this.bgMusic = new Audio('assets/vaitsez-game-game-music-574073.mp3');
      this.bgMusic.loop = true;
      this.bgMusic.volume = this.isMusicMuted ? 0 : this.targetMusicVol;

      this.flagSound = new Audio('assets/Flag Flapping Sound Effect (128kbit_AAC).m4a');
      this.flagSound.loop = true;
      this.flagSound.volume = this.flagVol;

      // Flag sound always plays in the background
      this.flagSound.play().catch(() => {});

      // Play music if not muted
      if (!this.isMusicMuted) {
        this.bgMusic.play().catch(() => {});
      }
    } catch (e) {
      console.warn('Audio init error:', e);
    }
    this.updateUI();
  },

  fadeMusic(toVol, durationMs = 600) {
    if (!this.bgMusic) return;
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }

    if (toVol > 0) {
      this.bgMusic.play().catch(() => {});
    }

    const stepMs = 25;
    const steps = Math.max(1, durationMs / stepMs);
    const startVol = this.bgMusic.volume;
    const diff = toVol - startVol;
    const stepDelta = diff / steps;
    let stepCount = 0;

    this.fadeInterval = setInterval(() => {
      stepCount++;
      const nextVol = startVol + stepDelta * stepCount;
      if ((stepDelta > 0 && nextVol >= toVol) || (stepDelta < 0 && nextVol <= toVol) || stepCount >= steps) {
        this.bgMusic.volume = Math.max(0, Math.min(1, toVol));
        if (toVol === 0) {
          this.bgMusic.pause();
        }
        clearInterval(this.fadeInterval);
        this.fadeInterval = null;
      } else {
        this.bgMusic.volume = Math.max(0, Math.min(1, nextVol));
      }
    }, stepMs);
  },

  onEnterImmersive() {
    this.inImmersive = true;
    this.fadeMusic(0, 500); // Fade music out smoothly
    if (this.flagSound) {
      this.flagSound.volume = this.flagVol;
      this.flagSound.play().catch(() => {}); // User hears ONLY the flag flapping
    }
  },

  onExitImmersive() {
    this.inImmersive = false;
    if (!this.isMusicMuted) {
      this.fadeMusic(this.targetMusicVol, 600); // Fade music back in
    }
  },

  toggle() {
    if (!this.initialized) {
      this.init();
      return;
    }
    this.isMusicMuted = !this.isMusicMuted;
    localStorage.setItem('fcm_music_muted', this.isMusicMuted ? 'true' : 'false');

    if (this.isMusicMuted) {
      this.fadeMusic(0, 400);
    } else {
      if (!this.inImmersive) {
        this.fadeMusic(this.targetMusicVol, 400);
      }
    }
    this.updateUI();
  },

  updateUI() {
    const btn = document.getElementById('audio-toggle-btn');
    if (btn) {
      const soundOnSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
      const soundMutedSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>`;
      btn.innerHTML = this.isMusicMuted ? soundMutedSVG : soundOnSVG;
      btn.classList.toggle('muted', this.isMusicMuted);
    }
  }
};

// --- 3D Fabric Flag Animation with Three.js ---
const Flag3DManager = {
  // Background 3D Flag
  bgRenderer: null,
  bgScene: null,
  bgCamera: null,
  bgMesh: null,
  bgPosAttr: null,
  bgInitPos: null,
  bgGeometry: null,

  // Modal 3D Flag
  modalRenderer: null,
  modalScene: null,
  modalCamera: null,
  modalMesh: null,
  modalPosAttr: null,
  modalInitPos: null,
  modalGeometry: null,
  modalActive: false,

  // Mouse / Interaction tracking
  mouseX: 0,
  mouseY: 0,
  targetRotationX: 0,
  targetRotationY: 0,
  clock: null,
  texture: null,

  init() {
    if (typeof THREE === 'undefined') return;
    this.clock = new THREE.Clock();

    const textureLoader = new THREE.TextureLoader();
    textureLoader.load('assets/fc-bratva-logo.png', (tex) => {
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      this.texture = tex;

      this.initBgFlag();
      this.animate();
    });

    this.setupInteractions();
  },

  // Fullscreen Background 3D Flag
  initBgFlag() {
    const container = document.getElementById('bg-3d-canvas-container');
    if (!container || !this.texture) return;

    this.bgScene = new THREE.Scene();
    this.bgCamera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.bgCamera.position.set(0, 0, 7.5);

    this.bgRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.bgRenderer.setSize(window.innerWidth, window.innerHeight);
    this.bgRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.bgRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.bgRenderer.toneMappingExposure = 1.15;
    container.innerHTML = '';
    container.appendChild(this.bgRenderer.domElement);
    this.bgRenderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); }, false);

    // Natural Clean Studio Lighting (No color tinting)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    this.bgScene.add(ambientLight);
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.3);
    dirLight1.position.set(5, 5, 4);
    this.bgScene.add(dirLight1);
    const dirLight2 = new THREE.DirectionalLight(0xdce7ff, 0.7);
    dirLight2.position.set(-5, -3, 3);
    this.bgScene.add(dirLight2);

    // Geometry: width 4.2, height 4.2, segments 128
    const width = 4.2;
    const height = 4.2;
    const segments = 128;
    this.bgGeometry = new THREE.PlaneGeometry(width, height, segments, segments);
    this.bgPosAttr = this.bgGeometry.attributes.position;
    this.bgInitPos = this.bgPosAttr.array.slice();

    const material = new THREE.MeshStandardMaterial({
      map: this.texture,
      side: THREE.DoubleSide,
      roughness: 0.35,
      metalness: 0.1,
      transparent: true
    });

    this.bgMesh = new THREE.Mesh(this.bgGeometry, material);
    this.bgScene.add(this.bgMesh);
  },

  // Interactive 3D Modal
  openModal() {
    const modal = document.getElementById('flag-modal');
    const container = document.getElementById('flag-modal-canvas-container');
    if (!modal || !container || !this.texture) return;

    modal.style.display = 'flex';
    this.modalActive = true;

    if (!this.modalRenderer) {
      const width = container.clientWidth || 400;
      const height = container.clientHeight || 400;

      this.modalScene = new THREE.Scene();
      this.modalCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
      this.modalCamera.position.set(0, 0, 8);

      this.modalRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      this.modalRenderer.setSize(width, height);
      this.modalRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.modalRenderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.modalRenderer.toneMappingExposure = 1.1;
      container.innerHTML = '';
      container.appendChild(this.modalRenderer.domElement);

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
      this.modalScene.add(ambientLight);
      const dirLight1 = new THREE.DirectionalLight(0xffe8d6, 1.4);
      dirLight1.position.set(5, 5, 4);
      this.modalScene.add(dirLight1);
      const dirLight2 = new THREE.DirectionalLight(0x7a5cff, 0.8);
      dirLight2.position.set(-5, -3, 3);
      this.modalScene.add(dirLight2);

      const geoW = 4.2;
      const geoH = 4.2;
      const segments = 128;
      this.modalGeometry = new THREE.PlaneGeometry(geoW, geoH, segments, segments);
      this.modalPosAttr = this.modalGeometry.attributes.position;
      this.modalInitPos = this.modalPosAttr.array.slice();

      const material = new THREE.MeshStandardMaterial({
        map: this.texture,
        side: THREE.DoubleSide,
        roughness: 0.35,
        metalness: 0.1,
        transparent: true
      });

      this.modalMesh = new THREE.Mesh(this.modalGeometry, material);
      this.modalScene.add(this.modalMesh);
    } else {
      const width = container.clientWidth;
      const height = container.clientHeight;
      this.modalCamera.aspect = width / height;
      this.modalCamera.updateProjectionMatrix();
      this.modalRenderer.setSize(width, height);
    }
  },

  closeModal() {
    const modal = document.getElementById('flag-modal');
    if (modal) modal.style.display = 'none';
    this.modalActive = false;
  },

  setupInteractions() {
    // Global Mouse & Touch Interaction (Active ONLY during Immersive Mode)
    window.addEventListener('mousemove', (e) => {
      if (!document.body.classList.contains('immersive-mode')) {
        this.targetRotationY = 0;
        this.targetRotationX = 0;
        return;
      }
      this.mouseX = (e.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
      this.mouseY = (e.clientY - window.innerHeight / 2) / (window.innerHeight / 2);
      this.targetRotationY = this.mouseX * 0.75;
      this.targetRotationX = this.mouseY * 0.55;
    });

    window.addEventListener('touchmove', (e) => {
      if (!document.body.classList.contains('immersive-mode')) return;
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        this.mouseX = (touch.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
        this.mouseY = (touch.clientY - window.innerHeight / 2) / (window.innerHeight / 2);
        this.targetRotationY = this.mouseX * 0.75;
        this.targetRotationX = this.mouseY * 0.55;
        e.preventDefault();
      }
    }, { passive: false });

    // Drag & Drop image support
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          new THREE.TextureLoader().load(event.target.result, (tex) => {
            tex.generateMipmaps = true;
            tex.minFilter = THREE.LinearMipmapLinearFilter;
            tex.magFilter = THREE.LinearFilter;
            this.texture = tex;
            if (this.bgMesh) this.bgMesh.material.map = tex;
            if (this.headerMesh) this.headerMesh.material.map = tex;
            if (this.modalMesh) this.modalMesh.material.map = tex;
          });
        };
        reader.readAsDataURL(file);
      }
    });

    const brandLogo = document.querySelector('.brand-logo-img') || document.querySelector('.brand');
    if (brandLogo) {
      brandLogo.addEventListener('click', (e) => {
        e.stopPropagation();
        SoundManager.playClick();
        ImmersiveMode.start();
      });
    }

    const closeBtn = document.getElementById('flag-modal-close-x');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        SoundManager.playClick();
        this.closeModal();
      });
    }

    const modal = document.getElementById('flag-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          SoundManager.playClick();
          this.closeModal();
        }
      });
    }

    let lastWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
    let lastHeight = typeof window !== 'undefined' ? window.innerHeight : 0;

    window.addEventListener('resize', () => {
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;

      // On mobile devices, vertical scrolling collapses/expands the browser URL bar, triggering resize events.
      // Ignore vertical fluctuations unless width changed (orientation flip) or height change is drastic (> 150px).
      const widthChanged = Math.abs(newWidth - lastWidth) > 6;
      const heightDrastic = Math.abs(newHeight - lastHeight) > 150;

      if (!widthChanged && !heightDrastic) return;

      lastWidth = newWidth;
      lastHeight = newHeight;

      if (this.bgRenderer && this.bgCamera) {
        this.bgCamera.aspect = newWidth / newHeight;
        this.bgCamera.updateProjectionMatrix();
        this.bgRenderer.setSize(newWidth, newHeight);
      }
      if (this.modalActive && this.modalRenderer && this.modalCamera) {
        const container = document.getElementById('flag-modal-canvas-container');
        if (container) {
          const w = container.clientWidth;
          const h = container.clientHeight;
          this.modalCamera.aspect = w / h;
          this.modalCamera.updateProjectionMatrix();
          this.modalRenderer.setSize(w, h);
        }
      }
    });
  },

  // Exact Animation Loop with Harmonic Wave Equation & Mouse Tilting
  animate() {
    requestAnimationFrame(() => this.animate());
    const elapsedTime = this.clock ? this.clock.getElapsedTime() : 0;
    const width = 4.2;

    // 1. Animate Background 3D Flag
    if (this.bgMesh && this.bgPosAttr && this.bgInitPos) {
      if (CinematicDirector.active) {
        CinematicDirector.update(performance.now(), this.bgCamera, this.bgMesh);
      } else {
        this.bgMesh.rotation.y += (this.targetRotationY - this.bgMesh.rotation.y) * 0.05;
        this.bgMesh.rotation.x += (this.targetRotationX - this.bgMesh.rotation.x) * 0.05;
      }

      const positions = this.bgPosAttr.array;
      for (let i = 0; i < positions.length; i += 3) {
        const u = this.bgInitPos[i];
        const v = this.bgInitPos[i + 1];

        // Harmonic Wave equation with wind weight
        const wave1 = Math.sin(u * 2.2 + elapsedTime * 3.2) * 0.22;
        const wave2 = Math.cos(v * 1.8 + elapsedTime * 2.4) * 0.15;
        const microWave = Math.sin((u + v) * 4.5 + elapsedTime * 4.0) * 0.06;
        const windWeight = (u + width / 2) / width;
        positions[i + 2] = (wave1 + wave2 + microWave) * (0.4 + windWeight * 0.8);
      }
      this.bgPosAttr.needsUpdate = true;
      this.bgGeometry.computeVertexNormals();
      this.bgRenderer.render(this.bgScene, this.bgCamera);
    }

    // 2. Animate Modal 3D Flag
    if (this.modalActive && this.modalMesh && this.modalPosAttr && this.modalInitPos) {
      this.modalMesh.rotation.y += (this.targetRotationY - this.modalMesh.rotation.y) * 0.05;
      this.modalMesh.rotation.x += (this.targetRotationX - this.modalMesh.rotation.x) * 0.05;

      const positions = this.modalPosAttr.array;
      for (let i = 0; i < positions.length; i += 3) {
        const u = this.modalInitPos[i];
        const v = this.modalInitPos[i + 1];

        const wave1 = Math.sin(u * 2.2 + elapsedTime * 3.2) * 0.22;
        const wave2 = Math.cos(v * 1.8 + elapsedTime * 2.4) * 0.15;
        const microWave = Math.sin((u + v) * 4.5 + elapsedTime * 4.0) * 0.06;
        const windWeight = (u + width / 2) / width;
        positions[i + 2] = (wave1 + wave2 + microWave) * (0.4 + windWeight * 0.8);
      }
      this.modalPosAttr.needsUpdate = true;
      this.modalGeometry.computeVertexNormals();
      this.modalRenderer.render(this.modalScene, this.modalCamera);
    }
  }
};

// --- Immersive 3D Mode (Upper Bar Logo Click — Zero Blackout & Pure 3D Tilt) ---
const ImmersiveMode = {
  active: false,
  touchStartX: 0,
  touchStartY: 0,
  touchStartTime: 0,

  init() {
    // Tap anywhere to exit immersive mode
    window.addEventListener('click', (e) => {
      if (this.active) {
        if (Date.now() - this.touchStartTime > 250) {
          SoundManager.playClick();
          this.stop();
        }
      }
    });

    window.addEventListener('touchstart', (e) => {
      if (this.active && e.touches.length > 0) {
        this.touchStartX = e.touches[0].clientX;
        this.touchStartY = e.touches[0].clientY;
        this.touchStartTime = Date.now();
      }
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
      if (this.active) {
        const touchDuration = Date.now() - this.touchStartTime;
        if (touchDuration < 250 && e.changedTouches.length > 0) {
          const dx = Math.abs(e.changedTouches[0].clientX - this.touchStartX);
          const dy = Math.abs(e.changedTouches[0].clientY - this.touchStartY);
          if (dx < 12 && dy < 12) {
            SoundManager.playClick();
            this.stop();
          }
        }
      }
    }, { passive: true });

    window.addEventListener('keydown', (e) => {
      if (this.active && (e.key === 'Escape' || e.key === 'Esc')) {
        SoundManager.playClick();
        this.stop();
      }
    });
  },

  start() {
    if (this.active) return;
    this.active = true;
    this.touchStartTime = Date.now();
    document.body.classList.add('immersive-mode');
    AudioManager.onEnterImmersive();
  },

  stop() {
    if (!this.active) return;
    this.active = false;
    document.body.classList.remove('immersive-mode');
    AudioManager.onExitImmersive();
  }
};

// --- Cinematic 3D Full View Director (Smooth Grand Animation & Frameless Stats) ---
const CinematicDirector = {
  active: false,
  startTime: 0,
  lastTapTime: 0,
  targetCamPos: null,
  targetLookAt: null,
  currentLookAt: null,

  init() {
    if (typeof THREE !== 'undefined') {
      this.targetCamPos = new THREE.Vector3(0, 0, 7.5);
      this.targetLookAt = new THREE.Vector3(0, 0, 0);
      this.currentLookAt = new THREE.Vector3(0, 0, 0);
    }

    const playBtn = document.getElementById('watch-overview-btn');
    if (playBtn) {
      playBtn.addEventListener('click', () => {
        SoundManager.playClick();
        this.start();
      });
    }

    const overlay = document.getElementById('cinematic-overlay');
    if (overlay) {
      overlay.addEventListener('touchmove', (e) => { e.preventDefault(); }, { passive: false });
      overlay.addEventListener('wheel', (e) => { e.preventDefault(); }, { passive: false });

      // Double tap / double click detection to exit
      overlay.addEventListener('click', (e) => {
        const now = Date.now();
        if (now - this.lastTapTime < 350) {
          SoundManager.playClick();
          this.stop();
        }
        this.lastTapTime = now;
      });

      overlay.addEventListener('touchend', (e) => {
        const now = Date.now();
        if (now - this.lastTapTime < 350) {
          SoundManager.playClick();
          this.stop();
        }
        this.lastTapTime = now;
      });
    }

    window.addEventListener('keydown', (e) => {
      if (this.active && (e.key === 'Escape' || e.key === 'Esc')) {
        SoundManager.playClick();
        this.stop();
      }
    });
  },

  start() {
    if (this.active || !Flag3DManager.bgCamera) return;
    this.active = true;
    this.startTime = performance.now();
    if (this.currentLookAt) this.currentLookAt.set(0, 0, 0);

    AudioManager.onEnterImmersive();

    const overlay = document.getElementById('cinematic-overlay');
    const blackout = document.getElementById('cinematic-blackout');
    const hud = document.getElementById('cinematic-hud');
    const appEl = document.getElementById('app');

    // Populate Frameless HUD Data
    this.populateHUD();

    document.body.classList.add('cinematic-mode');
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    if (overlay) overlay.classList.add('active');
    if (blackout) blackout.classList.add('fade-in');
    if (hud) hud.classList.remove('visible');

    // Fade to black then unveil the single grand smooth camera movement
    setTimeout(() => {
      if (!this.active) return;
      if (appEl) appEl.style.opacity = '0';
      if (blackout) blackout.classList.remove('fade-in');
    }, 450);
  },

  stop() {
    if (!this.active) return;
    this.active = false;

    document.body.classList.remove('cinematic-mode');
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';

    AudioManager.onExitImmersive();

    const overlay = document.getElementById('cinematic-overlay');
    const blackout = document.getElementById('cinematic-blackout');
    const hud = document.getElementById('cinematic-hud');
    const appEl = document.getElementById('app');

    // Immediately start fading out HUD
    if (hud) hud.classList.remove('visible');

    // Fade to black smoothly
    if (blackout) blackout.classList.add('fade-in');

    setTimeout(() => {
      if (overlay) overlay.classList.remove('active');
      if (appEl) appEl.style.opacity = '1';

      if (Flag3DManager.bgCamera) {
        Flag3DManager.bgCamera.position.set(0, 0, 7.5);
        Flag3DManager.bgCamera.rotation.set(0, 0, 0);
        Flag3DManager.bgCamera.lookAt(0, 0, 0);
      }
      if (Flag3DManager.bgMesh) {
        Flag3DManager.bgMesh.position.set(0, 0, 0);
        Flag3DManager.bgMesh.rotation.set(0, 0, 0);
      }

      setTimeout(() => {
        if (blackout) blackout.classList.remove('fade-in');
      }, 60);
    }, 380);
  },

  populateHUD() {
    const completed = state.tournaments.filter(t => t.status === 'complete');
    const wins = completed.filter(t => t.result === 'win').length;
    const losses = completed.filter(t => t.result === 'loss').length;
    const draws = completed.filter(t => t.result === 'draw').length;
    const totalGoals = state.tournaments.reduce((sum, t) => sum + (t.our_total_goals || 0), 0);
    const winRate = completed.length > 0 ? ((wins / completed.length) * 100).toFixed(1) : '0.0';

    const matchesEl = document.getElementById('cine-total-matches');
    const winRateEl = document.getElementById('cine-win-rate');
    const goalsEl = document.getElementById('cine-total-goals');
    const recordEl = document.getElementById('cine-record');
    const mvpNameEl = document.getElementById('cine-mvp-name');
    const mvpStatsEl = document.getElementById('cine-mvp-stats');

    if (matchesEl) matchesEl.textContent = state.tournaments.length;
    if (winRateEl) winRateEl.textContent = `${winRate}%`;
    if (goalsEl) goalsEl.textContent = totalGoals;
    if (recordEl) recordEl.textContent = `${wins}W - ${draws}D - ${losses}L`;

    // Top Scorer
    const sorted = [...state.players].sort((a, b) => getPlayerGoals(b) - getPlayerGoals(a));
    if (sorted.length > 0) {
      const topP = sorted[0];
      const pGoals = getPlayerGoals(topP);
      const pMatches = topP.matches ? topP.matches.length : 0;
      const pAvg = pMatches > 0 ? (pGoals / pMatches).toFixed(1) : '0.0';

      if (mvpNameEl) mvpNameEl.textContent = topP.display_name;
      if (mvpStatsEl) mvpStatsEl.textContent = `${pGoals} ${t('goals')} • ${pAvg} ${t('avg_goals')}`;
    }
  },

  update(now, camera, mesh) {
    if (!this.active || !camera || !mesh) return;

    const elapsed = (now - this.startTime) / 1000; // in seconds

    // Single Grand Smooth Reveal (Logo elevates to upper half + stats reveal across entire screen)
    const animDuration = 2.0;
    const progress = Math.min(elapsed / animDuration, 1.0);
    const ease = this.easeInOutCubic(progress);

    camera.position.set(0, 0.45 * ease, 6.2 + ease * 1.8);
    if (this.targetLookAt) this.targetLookAt.set(0, 0.75 * ease, 0);
    mesh.position.set(0, 1.15 * ease, 0);
    mesh.rotation.z = Math.sin(elapsed * 0.8) * 0.02;

    if (progress >= 0.7) {
      const hud = document.getElementById('cinematic-hud');
      if (hud && !hud.classList.contains('visible')) {
        hud.classList.add('visible');
      }
    }

    // Smoothly interpolate current lookAt towards targetLookAt
    if (this.currentLookAt && this.targetLookAt) {
      this.currentLookAt.lerp(this.targetLookAt, 0.08);
      camera.lookAt(this.currentLookAt);
    }
  },

  easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  },

  easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
  }
};

// Unlock Web Audio & Background Music on first user interaction
const unlockAudio = () => {
  SoundManager.init();
  AudioManager.init();
};
document.addEventListener('click', unlockAudio, { once: true });
document.addEventListener('touchstart', unlockAudio, { once: true });

const state = {
  lang: 'en',
  playersIndex: {},
  tournamentsIndex: {},
  players: [],
  tournaments: [],
  activeTab: 'dashboard',
  searchQuery: '',
  leaderboardWindow: 'last'
};

const tabsOrder = ['dashboard', 'tournaments', 'players', 'leaderboard'];

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
  const initialLang = autoDetectLanguage();
  setLanguage(initialLang);
  
  // Update lang selector UI to match auto-detected lang
  document.querySelectorAll('.lang-opt').forEach(opt => {
    if(opt.dataset.lang === initialLang) opt.classList.add('active');
    else opt.classList.remove('active');
  });

  setupLanguageSelector();
  setupNavigation();
  setupSearch();
  setupFilterControls();

  // Audio Toggle Button
  const audioBtn = document.getElementById('audio-toggle-btn');
  if (audioBtn) {
    audioBtn.addEventListener('click', () => {
      SoundManager.playClick();
      AudioManager.toggle();
    });
    AudioManager.updateUI();
  }

  // Initialize 3D Waving Flag, Immersive Mode, Silk Badges & Full View Director
  Flag3DManager.init();
  SilkBadges3DManager.init();
  ImmersiveMode.init();
  CinematicDirector.init();

  // Initialize Rules & Broadcast Managers
  RulesManager.init();
  BroadcastGenerator.init();

  // Scroll transparency for nav-bar
  let scrollTimeout;
  const navBar = document.querySelector('.nav-bar');
  window.addEventListener('scroll', () => {
    if (navBar) {
      navBar.classList.add('scrolling');
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        navBar.classList.remove('scrolling');
      }, 250);
    }
  });

  await loadData();
  renderAll();

  // Handle URL query deep link: ?player=doxibero1 or ?tab=members
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const playerParam = urlParams.get('player');
    const tabParam = urlParams.get('tab');
    if (tabParam) {
      switchTab(tabParam);
    }
    if (playerParam && state.players) {
      const q = playerParam.trim().toLowerCase();
      const targetPlayer = state.players.find(p => 
        (p.player_id && p.player_id.toLowerCase() === q) || 
        (p.display_name && p.display_name.toLowerCase() === q)
      );
      if (targetPlayer) {
        switchTab('members');
        setTimeout(() => openPlayerModal(targetPlayer.player_id), 120);
      }
    }
  } catch (e) {
    console.warn('URL deep link error:', e);
  }
});

// --- Language Selector ---
function setupLanguageSelector() {
  const toggleBtn = document.getElementById('lang-toggle-btn');
  const menu = document.getElementById('lang-menu');

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('show');
  });

  document.addEventListener('click', () => menu.classList.remove('show'));

  const options = document.querySelectorAll('.lang-opt');
  options.forEach(opt => {
    opt.addEventListener('click', () => {
      options.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      setLanguage(opt.dataset.lang);
      menu.classList.remove('show');
    });
  });
}

function autoDetectLanguage() {
  const saved = localStorage.getItem('fcm_lang');
  if (saved && I18N[saved]) return saved;

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  // Morocco timezone overrides to English
  if (tz.includes('Casablanca') || tz.includes('El_Aaiun') || tz.includes('Morocco')) {
    return 'en';
  }

  const browserLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
  if (browserLang.startsWith('ar')) return 'ar';
  if (browserLang.startsWith('ru')) return 'ru';
  if (browserLang.startsWith('es')) return 'es';
  
  return 'en';
}

function setLanguage(langCode) {
  if (!I18N[langCode]) return;
  state.lang = langCode;
  state.currentLang = langCode;
  localStorage.setItem('fcm_lang', langCode);
  const dict = I18N[langCode];

  document.documentElement.setAttribute('dir', dict.dir);
  document.documentElement.setAttribute('lang', langCode);

  const langCodeEl = document.getElementById('current-lang-code');
  if (langCodeEl) langCodeEl.textContent = langCode.toUpperCase();

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (dict[key]) el.textContent = dict[key];
  });

  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const key = el.dataset.i18nPh;
    if (dict[key]) el.placeholder = dict[key];
  });

  renderAll();
  if (typeof LeagueRulesModal !== 'undefined' && LeagueRulesModal.isOpen) LeagueRulesModal.render();
  if (typeof LeagueNewsModal !== 'undefined' && LeagueNewsModal.isOpen) LeagueNewsModal.render();
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getMonogram(name) {
  if (!name) return 'FC';
  return name.trim().slice(0, 2).toUpperCase();
}

function getPlayerGoals(p) {
  if (!p) return 0;
  if (typeof p.total_goals === 'number') return p.total_goals;
  if (Array.isArray(p.matches)) {
    return p.matches.reduce((sum, m) => sum + (m.goals_for || 0), 0);
  }
  return 0;
}

function t(key, vars = {}) {
  const dict = I18N[state.lang] || I18N.en;
  let str = dict[key] || I18N.en[key] || key;
  Object.keys(vars).forEach(k => {
    str = str.replace(`{${k}}`, vars[k]);
  });
  return str;
}

// --- Data Fetching ---
async function loadData() {
  const cb = Date.now();
  for (const path of DATA_PATHS) {
    try {
      const res = await fetch(`${path}/index/players_index.json?v=${cb}`);
      if (res.ok) {
        activePath = path;
        state.playersIndex = await res.json();
        break;
      }
    } catch (e) {}
  }

  try {
    const tRes = await fetch(`${activePath}/index/tournaments_index.json?v=${cb}`);
    if (tRes.ok) state.tournamentsIndex = await tRes.json();
  } catch (e) {}

  const pIds = Object.keys(state.playersIndex);
  const pPromises = pIds.map(id => fetch(`${activePath}/players/${id}.json?v=${cb}`).then(r => r.ok ? r.json() : null).catch(() => null));

  const tIds = Object.keys(state.tournamentsIndex);
  const tPromises = tIds.map(id => fetch(`${activePath}/tournaments/${id}.json?v=${cb}`).then(r => r.ok ? r.json() : null).catch(() => null));

  const [pResults, tResults] = await Promise.all([Promise.all(pPromises), Promise.all(tPromises)]);

  state.players = pResults.filter(Boolean);
  state.tournaments = tResults.filter(Boolean);
  state.tournaments.sort((a, b) => new Date(b.date) - new Date(a.date));
}

// --- Web Audio Mouse Click Synthesizer ---
let audioCtx = null;
function playMouseClick() {
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const oscSnap = audioCtx.createOscillator();
    const gainSnap = audioCtx.createGain();
    oscSnap.type = 'sine';
    oscSnap.frequency.setValueAtTime(2600, now);
    oscSnap.frequency.exponentialRampToValueAtTime(450, now + 0.007);
    gainSnap.gain.setValueAtTime(0.5, now);
    gainSnap.gain.exponentialRampToValueAtTime(0.001, now + 0.007);
    oscSnap.connect(gainSnap);
    gainSnap.connect(audioCtx.destination);
    oscSnap.start(now);
    oscSnap.stop(now + 0.007);

    const oscBody = audioCtx.createOscillator();
    const gainBody = audioCtx.createGain();
    oscBody.type = 'triangle';
    oscBody.frequency.setValueAtTime(420, now);
    oscBody.frequency.exponentialRampToValueAtTime(110, now + 0.016);
    gainBody.gain.setValueAtTime(0.35, now);
    gainBody.gain.exponentialRampToValueAtTime(0.001, now + 0.016);
    oscBody.connect(gainBody);
    gainBody.connect(audioCtx.destination);
    oscBody.start(now);
    oscBody.stop(now + 0.016);
  } catch (e) {}
}

// --- Production 5-Tab Sharp Silk Cloth Canvas Engine ---
const TabClothEngine = {
  contexts: [],
  t: 0,
  init() {
    if (typeof document === 'undefined' || !document.querySelectorAll) return;
    const canvases = document.querySelectorAll('.tab-cloth-canvas');
    if (!canvases.length) return;
    this.contexts = Array.from(canvases).map(c => ({ cvs: c, ctx: c.getContext('2d') }));
    this.resize();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => this.resize());
      setTimeout(() => this.resize(), 50);
    }
    this.animate();
  },
  resize() {
    if (!this.contexts) return;
    this.contexts.forEach(({ cvs }) => {
      if (!cvs || !cvs.getBoundingClientRect) return;
      const r = cvs.getBoundingClientRect();
      if (r.width && r.height) { cvs.width = r.width * 2; cvs.height = r.height * 2; }
    });
  },
  animate() {
    this.t += 0.012;
    if (typeof document !== 'undefined' && document.querySelectorAll) {
      document.querySelectorAll('.tab-btn').forEach((btn, idx) => {
        if (!btn.classList.contains('active') || !this.contexts[idx]) return;
        const { cvs, ctx } = this.contexts[idx];
        if (!cvs || !ctx) return;
        const w = cvs.width, h = cvs.height;
        if (!w || !h) return;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = 'rgb(123, 56, 166)';
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 4; i++) {
          const p = ((Math.sin(this.t * 0.9 + i * 1.45) * 0.4 + 0.5) * (w + h)) - (h * 0.35);
          const bw = w * 0.55;
          const grad = ctx.createLinearGradient(p - bw, 0, p + bw, h);
          grad.addColorStop(0, 'rgba(123, 56, 166, 0)');
          grad.addColorStop(0.35, 'rgba(180, 105, 235, 0.16)');
          grad.addColorStop(0.5, 'rgba(215, 155, 255, 0.20)');
          grad.addColorStop(0.68, 'rgba(55, 18, 85, 0.38)');
          grad.addColorStop(1, 'rgba(123, 56, 166, 0)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, w, h);
        }
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
        ctx.lineWidth = 1;
        for (let x = -h; x < w + h; x += 7) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + h, h); ctx.stroke();
        }
      });
    }
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => this.animate());
    }
  }
};

const tabTargetMap = {
  'view-dash': 'dashboard',
  'view-matches': 'tournaments',
  'view-members': 'players',
  'view-ranks': 'leaderboard',
  'view-rules': 'rules',
  'view-updates': 'rules',
  'dashboard': 'dashboard',
  'tournaments': 'tournaments',
  'players': 'players',
  'leaderboard': 'leaderboard',
  'rules': 'rules',
  'updates': 'rules'
};

function setupNavigation() {
  const btns = document.querySelectorAll('.tab-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      playMouseClick();
      const targetName = tabTargetMap[btn.dataset.target] || btn.dataset.tab || 'dashboard';
      if (targetName === state.activeTab && btn.classList.contains('active')) return;
      
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      TabClothEngine.resize();
      switchTab(targetName);
    });
  });

  TabClothEngine.init();
}

function switchTab(newTabName) {
  const oldTabName = state.activeTab;
  const oldPage = document.getElementById(`tab-${oldTabName}`);
  const newPage = document.getElementById(`tab-${newTabName}`);

  state.activeTab = newTabName;
  
  if (typeof document !== 'undefined' && document.querySelectorAll) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      const t = tabTargetMap[btn.dataset.target] || btn.dataset.tab;
      btn.classList.toggle('active', t === newTabName);
    });
    TabClothEngine.resize();
  }

  if (!newPage) return;

  if (oldPage && oldPage !== newPage && oldPage.style.display !== 'none') {
    // Cinematic Mixed-Dissolve Crossfade Transition
    oldPage.classList.remove('active', 'fade-in-dissolve');
    oldPage.classList.add('fade-out-dissolve');

    newPage.classList.remove('fade-out-dissolve');
    newPage.classList.add('fade-in-dissolve');

    setTimeout(() => {
      oldPage.classList.remove('fade-out-dissolve');
      oldPage.style.display = 'none';

      newPage.classList.remove('fade-in-dissolve');
      newPage.classList.add('active');
      newPage.style.display = 'block';

      SilkBadges3DManager.mountAll();
    }, 200);
  } else {
    document.querySelectorAll('.tab-page').forEach(p => {
      p.classList.remove('active', 'fade-in-dissolve', 'fade-out-dissolve');
      p.style.display = 'none';
    });
    newPage.classList.add('active');
    newPage.style.display = 'block';
    SilkBadges3DManager.mountAll();
  }

  if (typeof window !== 'undefined' && window.scrollTo) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// --- Renderers ---
function renderAll() {
  renderDashboard();
  renderTournaments();
  renderRoster();
  renderLeaderboard();
  if (typeof BroadcastGenerator !== 'undefined') BroadcastGenerator.render();
        if (typeof LineupAdvisor !== 'undefined') LineupAdvisor.render();
  setTimeout(() => SilkBadges3DManager.mountAll(), 30);
}

/* ==========================================================================
   PODIUM 3D SILK ELEMENTS ENGINE (EXACT 1st GOLD, 2nd SILVER, 3rd BRONZE ARCHITECTURE)
   High-definition ACESFilmic Tone Mapping, Normal-Map Sheen, Micro-Flutter Waves
   ========================================================================== */
const SILK_TIERS = {
  gold: {
    num: "1",
    colorHex: 0xd4af37,
    roughness: 0.28,
    metalness: 0.58,
    lightColor: 0xfff2d6,
    ambientColor: 0xffedd0,
    rimColor: 0xcc8800
  },
  silver: {
    num: "2",
    colorHex: 0xcfd6df,
    roughness: 0.24,
    metalness: 0.62,
    lightColor: 0xf8fafc,
    ambientColor: 0xebf2f8,
    rimColor: 0x7c8ba1
  },
  bronze: {
    num: "3",
    colorHex: 0xb06535,
    roughness: 0.30,
    metalness: 0.54,
    lightColor: 0xffe2d0,
    ambientColor: 0xffdfd0,
    rimColor: 0x8a3809
  }
};

function createSilkTexture(cfg, renderer) {
  if (typeof document === 'undefined' || !document.createElement) return null;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const hex = cfg.colorHex;
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;

  // Solid color with ultra-subtle radial contrast
  const grad = ctx.createRadialGradient(512, 512, 50, 512, 512, 650);
  grad.addColorStop(0, `rgb(${Math.min(255, r + 15)}, ${Math.min(255, g + 15)}, ${Math.min(255, b + 15)})`);
  grad.addColorStop(0.8, `rgb(${r}, ${g}, ${b})`);
  grad.addColorStop(1, `rgb(${Math.max(0, r - 25)}, ${Math.max(0, g - 25)}, ${Math.max(0, b - 25)})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 1024);

  // Microscopic woven sheen
  ctx.strokeStyle = `rgba(255, 255, 255, 0.04)`;
  ctx.lineWidth = 2;
  for (let i = -1024; i < 2048; i += 16) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 1024, 1024);
    ctx.stroke();
  }

  // HIGH-CONTRAST BOLD BLACK VECTOR NUMERAL (1, 2, 3)
  if (cfg.num) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 680px "Times New Roman", Georgia, serif';

    // Deep vector black fill
    ctx.fillStyle = '#060606';
    ctx.fillText(cfg.num, 512, 512);

    // Razor-sharp vector stroke
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 6;
    ctx.strokeText(cfg.num, 512, 512);

    ctx.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  if (renderer && renderer.capabilities) {
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  }
  return texture;
}

function createSilkNormalMap() {
  if (typeof document === 'undefined' || !document.createElement) return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#8080ff';
  ctx.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 256; y += 2) {
    ctx.fillStyle = (y % 4 === 0) ? 'rgba(135, 135, 255, 0.25)' : 'rgba(120, 120, 255, 0.25)';
    ctx.fillRect(0, y, 256, 1);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 16);
  return tex;
}

const SilkBadges3DManager = {
  masters: {},
  activeViewports: [],
  clock: null,
  normalMap: null,
  animating: false,
  initialized: false,

  init() {
    if (typeof THREE === 'undefined') return;
    if (this.initialized) {
      this.mountAll();
      return;
    }
    this.initialized = true;
    if (!this.normalMap) this.normalMap = createSilkNormalMap();
    if (!this.clock) this.clock = new THREE.Clock();

    // Create EXACTLY 3 Master 3D WebGL simulation engines for the entire site
    ['gold', 'silver', 'bronze'].forEach(tierKey => {
      const cfg = SILK_TIERS[tierKey];
      if (!cfg) return;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
      camera.position.set(0, 0, 5.07);

      const masterCanvas = document.createElement('canvas');
      masterCanvas.width = 192;
      masterCanvas.height = 192;

      const renderer = new THREE.WebGLRenderer({
        canvas: masterCanvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      });
      renderer.setPixelRatio(1);
      renderer.setSize(192, 192, false);
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;

      masterCanvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
      }, false);

      // Studio Lighting
      scene.add(new THREE.AmbientLight(cfg.ambientColor, 0.6));
      const keyL = new THREE.DirectionalLight(cfg.lightColor, 1.4);
      keyL.position.set(3.5, 4.0, 3.5);
      scene.add(keyL);

      const rimL = new THREE.DirectionalLight(cfg.rimColor, 1.1);
      rimL.position.set(-4.0, -2.5, 2.5);
      scene.add(rimL);

      const geom = new THREE.PlaneGeometry(4.2, 4.2, 48, 48);
      const posAttr = geom.attributes.position;
      const basePos = posAttr.array.slice();

      const mat = new THREE.MeshStandardMaterial({
        map: createSilkTexture(cfg, renderer),
        side: THREE.DoubleSide,
        roughness: cfg.roughness,
        metalness: cfg.metalness,
        normalMap: this.normalMap,
        normalScale: new THREE.Vector2(0.05, 0.05)
      });

      const mesh = new THREE.Mesh(geom, mat);
      scene.add(mesh);

      this.masters[tierKey] = {
        scene,
        camera,
        renderer,
        masterCanvas,
        mesh,
        geom,
        posAttr,
        basePos
      };
    });

    this.mountAll();

    if (!this.animating) {
      this.animating = true;
      this.renderLoop();
    }
  },

  mountAll() {
    if (typeof THREE === 'undefined') return;
    if (!this.initialized) {
      this.init();
      return;
    }

    const viewports = document.querySelectorAll('.silk-viewport:not([data-mounted])');
    viewports.forEach(vp => {
      const tierKey = vp.dataset.tier;
      if (!this.masters[tierKey]) return;

      vp.setAttribute('data-mounted', 'true');
      vp.innerHTML = '';

      const targetCanvas = document.createElement('canvas');
      targetCanvas.width = 192;
      targetCanvas.height = 192;
      targetCanvas.style.width = '100%';
      targetCanvas.style.height = '100%';
      targetCanvas.style.display = 'block';
      vp.appendChild(targetCanvas);

      const ctx = targetCanvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
      }

      this.activeViewports.push({
        dom: vp,
        tierKey: tierKey,
        targetCanvas: targetCanvas,
        ctx: ctx
      });
    });
  },

  renderLoop() {
    requestAnimationFrame(() => this.renderLoop());

    if (!this.clock) return;
    const elapsed = this.clock.getElapsedTime();

    // 1. Update and render the 3 master 3D simulation engines
    ['gold', 'silver', 'bronze'].forEach(tierKey => {
      const m = this.masters[tierKey];
      if (!m) return;

      const pos = m.posAttr.array;
      for (let i = 0; i < pos.length; i += 3) {
        const u = m.basePos[i];
        const v = m.basePos[i + 1];

        const wave1 = Math.sin(u * 2.2 + elapsed * 3.4) * 0.22;
        const wave2 = Math.cos(v * 1.9 + elapsed * 2.5) * 0.16;
        const microFlutter = Math.sin((u + v) * 4.6 + elapsed * 4.2) * 0.06;

        const windWeight = (u + 2.1) / 4.2;
        pos[i + 2] = (wave1 + wave2 + microFlutter) * (0.35 + windWeight * 0.85);
      }

      m.posAttr.needsUpdate = true;
      m.geom.computeVertexNormals();

      m.renderer.render(m.scene, m.camera);
    });

    // 2. Filter out detached viewports
    this.activeViewports = this.activeViewports.filter(item => document.body.contains(item.dom));

    // 3. Fast 2D Blit to all visible viewports
    this.activeViewports.forEach(item => {
      const master = this.masters[item.tierKey];
      if (master && item.ctx) {
        item.ctx.clearRect(0, 0, item.targetCanvas.width, item.targetCanvas.height);
        item.ctx.drawImage(master.masterCanvas, 0, 0, item.targetCanvas.width, item.targetCanvas.height);
      }
    });
  }
};

function renderPlayerCard(p, rank, customGoals, customAvg) {
  const goals = customGoals !== undefined ? customGoals : getPlayerGoals(p);
  const matches = p.matches || [];
  const isFlagged = p.eligibility_streak?.flagged_for_review;

  let rankClass = '';
  let badgeHTML = '';

  if (rank === 1) {
    rankClass = 'fc-card-gold';
    badgeHTML = `<div class="silk-viewport" data-tier="gold" title="1st Place - Gold Champion"></div>`;
  } else if (rank === 2) {
    rankClass = 'fc-card-silver';
    badgeHTML = `<div class="silk-viewport" data-tier="silver" title="2nd Place - Silver Runner-up"></div>`;
  } else if (rank === 3) {
    rankClass = 'fc-card-bronze';
    badgeHTML = `<div class="silk-viewport" data-tier="bronze" title="3rd Place - Bronze Podium"></div>`;
  } else if (rank !== null && rank !== undefined) {
    // Ranks 4+: Lightweight static dark blue square with crisp pure white number (Zero Lag)
    badgeHTML = `<div class="fc-rank-badge-blue" title="Rank ${rank}">${rank}</div>`;
  } else {
    // In Roster: Clean squad initials monogram (NO rank number)
    const initials = (p.display_name || 'FC').trim().slice(0, 2).toUpperCase();
    badgeHTML = `<div class="fc-roster-avatar" title="${escapeHTML(p.display_name)}">${escapeHTML(initials)}</div>`;
  }

  const lastMatch = matches.length > 0 ? matches[matches.length - 1] : null;
  const lastTurns = lastMatch ? (lastMatch.turns_played !== undefined ? lastMatch.turns_played : (lastMatch.goals_for ? 3 : 0)) : 3;
  const avgVal = customAvg !== undefined ? customAvg : (matches.length > 0 ? (goals / matches.length).toFixed(1) : '0.0');

  return `
    <div class="fc-player-card ${rankClass}" onclick="openPlayerModal('${p.player_id}')">
      <div class="fc-card-left">
        ${badgeHTML}
        <div class="fc-player-info">
          <div class="fc-player-name">
            ${escapeHTML(p.display_name)}
            ${isFlagged ? '<span class="stamp stamp-loss" style="font-size:0.6rem; padding: 1px 4px;">FLAG</span>' : ''}
          </div>
          <div class="fc-tier-banner">${matches.length} ${t('matches')} • ${avgVal} ${t('avg_goals')}</div>
        </div>
      </div>
      <div class="fc-card-right">
        <div class="fc-turn-dots" title="${lastTurns}/3 turns completed">
          <span class="turn-dot ${lastTurns >= 1 ? 'done' : 'missed'}"></span>
          <span class="turn-dot ${lastTurns >= 2 ? 'done' : 'missed'}"></span>
          <span class="turn-dot ${lastTurns >= 3 ? 'done' : 'missed'}"></span>
        </div>
        <div class="fc-goal-stat">
          <div class="fc-goal-val">${goals}</div>
          <div class="fc-goal-lbl">${t('goals')}</div>
        </div>
      </div>
    </div>
  `;
}

function renderOpponentLeagueName(name) {
  const safeName = escapeHTML(name || '');
  if (safeName.length > 11) {
    return `
      <div class="ucl-team-name-wrap marquee-active" title="${safeName}">
        <div class="marquee-inner">
          <span>${safeName}</span>
          <span class="marquee-gap">&nbsp;&nbsp;✦&nbsp;&nbsp;</span>
          <span>${safeName}</span>
          <span class="marquee-gap">&nbsp;&nbsp;✦&nbsp;&nbsp;</span>
        </div>
      </div>
    `;
  }
  return `
    <div class="ucl-team-name-wrap" title="${safeName}">
      <span class="ucl-team-name-static">${safeName}</span>
    </div>
  `;
}

function renderDashboard() {
  const completed = state.tournaments.filter(t => t.status === 'complete');
  const wins = completed.filter(t => t.result === 'win').length;
  const losses = completed.filter(t => t.result === 'loss').length;
  const draws = completed.filter(t => t.result === 'draw').length;

  const winRate = completed.length > 0 ? ((wins / completed.length) * 100).toFixed(1) : '0.0';

  document.getElementById('hero-wins').textContent = wins;
  document.getElementById('hero-draws').textContent = draws;
  document.getElementById('hero-losses').textContent = losses;
  const winRateBadge = document.getElementById('hero-winrate-badge');
  if (winRateBadge) winRateBadge.textContent = `${winRate}% WR`;

  // Recent match
  const recentBox = document.getElementById('recent-match-container');
  if (state.tournaments.length === 0) {
    recentBox.innerHTML = `<div style="text-align:center; padding:16px;" class="hand-text">${t('loading')}</div>`;
  } else {
    const tItem = state.tournaments[0];
    const stampClass = tItem.result === 'win' ? 'stamp-win' : tItem.result === 'loss' ? 'stamp-loss' : 'stamp-draw';
    
    // Goal Gauge Percentages
    const totalGoals = (tItem.our_total_goals || 0) + (tItem.opponent_total_goals || 0);
    const ourPct = totalGoals > 0 ? ((tItem.our_total_goals / totalGoals) * 100).toFixed(1) : 50;
    const oppPct = totalGoals > 0 ? ((tItem.opponent_total_goals / totalGoals) * 100).toFixed(1) : 50;

    recentBox.innerHTML = `
      <div class="ucl-match-box" onclick="openTournamentModal('${tItem.tournament_id}')">
        <div class="ucl-match-header">
          <span class="stamp ${stampClass}">${tItem.result ? tItem.result.toUpperCase() : 'IN PROGRESS'}</span>
          <span class="hand-text" style="font-size: 0.8rem; font-weight: 600;">${tItem.date}</span>
        </div>
        <div class="ucl-match-teams">
          <div class="ucl-team home">
            <div class="ucl-team-name">Братва</div>
            <div class="ucl-team-score">${tItem.our_total_goals}</div>
          </div>
          <div class="ucl-vs-badge">VS</div>
          <div class="ucl-team away">
            ${renderOpponentLeagueName(tItem.opponent_league)}
            <div class="ucl-team-score">${tItem.opponent_total_goals}</div>
          </div>
        </div>
        <div class="gauge-wrap">
          <div class="gauge-fill" style="width: ${ourPct}%;"></div>
          <div class="gauge-fill-opp" style="width: ${oppPct}%;"></div>
        </div>
      </div>
    `;
  }

  // Top performers FC Cards
  const topContainer = document.getElementById('top-performers-container');
  const sortedPlayers = [...state.players].sort((a, b) => getPlayerGoals(b) - getPlayerGoals(a));
  const top3 = sortedPlayers.slice(0, 3);

  if (topContainer) {
    topContainer.innerHTML = top3.map((p, idx) => renderPlayerCard(p, idx + 1)).join('');
    setTimeout(() => SilkBadges3DManager.mountAll(), 30);
  }

  // Flagged Section
  const flaggedBox = document.getElementById('flagged-card-box');
  const flaggedList = document.getElementById('flagged-players-list');
  const flagged = state.players.filter(p => p.eligibility_streak?.flagged_for_review);

  if (flagged.length > 0) {
    flaggedBox.style.display = 'block';
    flaggedList.innerHTML = flagged.map(p => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background: rgba(255, 59, 92, 0.08); border: 1px solid rgba(255, 59, 92, 0.25); border-radius: 6px; margin-bottom: 6px; cursor:pointer;" onclick="openPlayerModal('${p.player_id}')">
        <span class="username">${escapeHTML(p.display_name)}</span>
        <span class="stamp stamp-loss">${p.eligibility_streak.current_fail_streak} FAILS</span>
      </div>
    `).join('');
  } else {
    flaggedBox.style.display = 'none';
  }
}

function renderTournaments() {
  const container = document.getElementById('tournaments-list-container');
  container.innerHTML = state.tournaments.map(tItem => {
    const stampClass = tItem.result === 'win' ? 'stamp-win' : tItem.result === 'loss' ? 'stamp-loss' : 'stamp-draw';
    return `
      <div class="ucl-match-box" style="margin-bottom: 10px;" onclick="openTournamentModal('${tItem.tournament_id}')">
        <div class="ucl-match-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="stamp ${stampClass}">${tItem.result ? tItem.result.toUpperCase() : 'IN PROGRESS'}</span>
            <span class="hand-text" style="font-size: 0.8rem; font-weight: 600;">${tItem.date}</span>
          </div>
          <span style="font-family: var(--font-main); font-weight: 700; font-size: 0.8rem; color: var(--ucl-slate);">${tItem.format || '32v32'}</span>
        </div>
        <div class="ucl-match-teams">
          <div class="ucl-team home">
            <div class="ucl-team-name">Братва</div>
            <div class="ucl-team-score">${tItem.our_total_goals}</div>
          </div>
          <div class="ucl-vs-badge">VS</div>
          <div class="ucl-team away">
            ${renderOpponentLeagueName(tItem.opponent_league)}
            <div class="ucl-team-score">${tItem.opponent_total_goals}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function setupSearch() {
  document.getElementById('roster-search-input').addEventListener('input', (e) => {
    state.searchQuery = e.target.value.toLowerCase().trim();
    renderRoster();
  });
}

function renderRoster() {
  const cardsContainer = document.getElementById('roster-cards-container');
  let list = [...state.players];

  if (state.searchQuery) {
    list = list.filter(p => p.display_name.toLowerCase().includes(state.searchQuery));
  }
  list.sort((a, b) => a.display_name.localeCompare(b.display_name));

  if (cardsContainer) {
    if (list.length === 0) {
      cardsContainer.innerHTML = `<div style="text-align:center; padding:24px; color:var(--ucl-slate); font-weight:600;">No players found</div>`;
    } else {
      // In Roster tab, NO tarttib (rank) numbers!
      cardsContainer.innerHTML = list.map(p => renderPlayerCard(p, null)).join('');
    }
  }
}

function setupFilterControls() {
  document.querySelectorAll('[data-window]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-window]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.leaderboardWindow = btn.dataset.window;
      renderLeaderboard();
    });
  });
}

function renderLeaderboard() {
  const cardsContainer = document.getElementById('leaderboard-cards-container');
  const windowDays = state.leaderboardWindow;

  let list = [];

  if (windowDays === 'last') {
    const latestTournament = state.tournaments[0];
    if (latestTournament && Array.isArray(latestTournament.matches)) {
      list = latestTournament.matches.map(m => {
        const p = state.players.find(pl => pl.player_id === m.player_id);
        const goals = m.goals_for || 0;
        return {
          player_id: m.player_id,
          display_name: m.player_display_name || p?.display_name || m.player_id,
          goals: goals,
          avg: `${goals} G (${m.turns_played || 0}/3 T)`,
          player: p
        };
      });
      list.sort((a, b) => b.goals - a.goals);
    }
  } else {
    list = state.players.map(p => {
      let matches = p.matches || [];
      if (windowDays !== 'all') {
        const days = parseInt(windowDays, 10);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        matches = matches.filter(m => {
          const tInfo = state.tournamentsIndex[m.tournament_id];
          return tInfo && new Date(tInfo.date) >= cutoff;
        });
      }
      if (windowDays !== 'all' && matches.length === 0) return null;
      const goals = matches.reduce((sum, m) => sum + (m.goals_for || 0), 0);
      const avg = matches.length > 0 ? (goals / matches.length).toFixed(1) : '0.0';
      return { player_id: p.player_id, display_name: p.display_name, goals, avg, player: p };
    }).filter(Boolean);

    list.sort((a, b) => b.goals - a.goals);
  }

  if (cardsContainer) {
    cardsContainer.innerHTML = list.map((item, idx) => {
      const p = item.player || state.players.find(pl => pl.player_id === item.player_id) || item;
      return renderPlayerCard(p, idx + 1, item.goals, item.avg);
    }).join('');
    setTimeout(() => SilkBadges3DManager.mountAll(), 30);
  }
}

function lockModalScroll() {
  if (typeof document !== 'undefined') {
    if (document.body && document.body.classList) document.body.classList.add('modal-open');
    if (document.documentElement && document.documentElement.classList) document.documentElement.classList.add('modal-open');
  }
}

function unlockModalScroll() {
  if (typeof document !== 'undefined') {
    if (document.body && document.body.classList) document.body.classList.remove('modal-open');
    if (document.documentElement && document.documentElement.classList) document.documentElement.classList.remove('modal-open');
  }
}

// --- Player Detail Modal ---
function openPlayerModal(playerId) {
  const player = state.players.find(p => p.player_id === playerId);
  if (!player) return;

  const overlay = document.getElementById('player-modal');
  const content = document.getElementById('modal-player-content');
  const page = document.getElementById('modal-page');

  SoundManager.playClick();
  lockModalScroll();

  document.getElementById('modal-close-x').onclick = () => {
    SoundManager.playClick();
    unlockModalScroll();
    overlay.style.display = 'none';
  };
  overlay.onclick = (e) => { 
    if (e.target === overlay) {
      SoundManager.playClick();
      unlockModalScroll();
      overlay.style.display = 'none';
    } 
  };

  // 1. Calculate overall player rank & metrics
  const sortedPlayers = [...state.players].sort((a, b) => getPlayerGoals(b) - getPlayerGoals(a));
  const playerRank = sortedPlayers.findIndex(p => p.player_id === player.player_id) + 1;
  const totalGoals = getPlayerGoals(player);
  const matches = [...(player.matches || [])];
  matches.sort((a, b) => a.tournament_id.slice(0, 10).localeCompare(b.tournament_id.slice(0, 10)));
  const matchesCount = matches.length;
  const avgGoals = matchesCount > 0 ? (totalGoals / matchesCount).toFixed(1) : '0.0';
  
  let turnsTaken = 0;
  let turnsTotal = matchesCount * 3;
  matches.forEach(m => {
    turnsTaken += (m.turns_played !== undefined ? m.turns_played : (m.goals_for > 0 ? 3 : 0));
  });
  const efficiency = turnsTotal > 0 ? Math.round((turnsTaken / turnsTotal) * 100) : 100;

  // 2. Rank Badge & Tag Pills (Top 3 gets 3D Silk Badges!)
  let badgeHTML = '';
  let rankPill = '';
  if (playerRank === 1) {
    badgeHTML = `<div class="silk-viewport modal-header-silk" data-tier="gold"></div>`;
    rankPill = `<span class="modal-tag-pill modal-tag-gold">${t('rank_top_scorer')}</span>`;
  } else if (playerRank === 2) {
    badgeHTML = `<div class="silk-viewport modal-header-silk" data-tier="silver"></div>`;
    rankPill = `<span class="modal-tag-pill modal-tag-silver">${t('rank_runner_up')}</span>`;
  } else if (playerRank === 3) {
    badgeHTML = `<div class="silk-viewport modal-header-silk" data-tier="bronze"></div>`;
    rankPill = `<span class="modal-tag-pill modal-tag-bronze">${t('rank_podium')}</span>`;
  } else if (playerRank >= 4) {
    badgeHTML = `<div class="fc-rank-badge-blue modal-header-blue">${playerRank}</div>`;
    rankPill = `<span class="modal-tag-pill modal-tag-blue">${t('rank_num', { n: playerRank })}</span>`;
  } else {
    badgeHTML = `<div class="fc-roster-avatar modal-header-blue">${getMonogram(player.display_name)}</div>`;
    rankPill = `<span class="modal-tag-pill modal-tag-blue">${t('squad_member')}</span>`;
  }

  // 3. Eligibility Tag Pill
  const streak = player.eligibility_streak?.current_fail_streak || 0;
  const isFlagged = player.eligibility_streak?.flagged_for_review;
  let eligPill = `<span class="modal-tag-pill modal-tag-green">${t('eligibility_ok')}</span>`;
  if (isFlagged) {
    eligPill = `<span class="modal-tag-pill modal-tag-red">${t('eligibility_flagged', { n: streak })}</span>`;
  } else if (streak > 0) {
    eligPill = `<span class="modal-tag-pill modal-tag-yellow">${t('eligibility_warn', { n: streak })}</span>`;
  }

  // 4. Form Columns Data
  const formData = matches.map((m, idx) => {
    const goals = m.goals_for || 0;
    const turns = m.turns_played !== undefined ? m.turns_played : (goals > 0 ? 3 : 0);
    const fillClass = turns === 0 ? 'missed' : (goals >= 20 ? 'win' : 'draw');
    const barHeightPercent = Math.max(Math.min(Math.round((goals / 42) * 100), 100), turns === 0 ? 10 : 15);
    const shortOpp = (m.opponent_display_name || 'Opp').slice(0, 6);
    return {
      index: idx,
      match: m,
      dateStr: m.tournament_id.slice(0, 10),
      opponent: m.opponent_display_name || 'Opponent',
      shortOpp,
      goals,
      turns,
      fillClass,
      barHeightPercent
    };
  });

  const latestMatch = formData.length > 0 ? formData[formData.length - 1] : null;

  content.innerHTML = `
    <!-- Clean Header -->
    <div class="modal-player-header">
      ${badgeHTML}
      <div class="modal-header-info">
        <div class="modal-player-name">${escapeHTML(player.display_name)}</div>
        <div class="modal-badge-pills">
          ${rankPill}
          ${eligPill}
        </div>
      </div>
    </div>

    <!-- 4-Box Pro KPI Strip -->
    <div class="modal-kpi-grid">
      <div class="modal-kpi-card">
        <div class="modal-kpi-val">${totalGoals}</div>
        <div class="modal-kpi-lbl">${t('total_goals')}</div>
      </div>
      <div class="modal-kpi-card">
        <div class="modal-kpi-val">${avgGoals}</div>
        <div class="modal-kpi-lbl">${t('avg_goals_m')}</div>
      </div>
      <div class="modal-kpi-card">
        <div class="modal-kpi-val">${matchesCount}</div>
        <div class="modal-kpi-lbl">${t('matches_played')}</div>
      </div>
      <div class="modal-kpi-card">
        <div class="modal-kpi-val">${efficiency}%</div>
        <div class="modal-kpi-lbl">${t('efficiency')}</div>
      </div>
    </div>

    <!-- Match Form Section (Zero Text Collision) -->
    <div class="modal-section-header">
      <div class="modal-section-title">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10"></path><path d="M12 20V4"></path><path d="M6 20v-6"></path></svg>
        <span>${t('match_performance')}</span>
      </div>
      <div class="modal-section-meta">${t('matches_logged', { n: matchesCount })}</div>
    </div>

    <!-- Pro Form Strip -->
    <div class="modal-form-strip">
      ${formData.length === 0 ? `<div style="padding:16px; color:var(--ucl-slate); font-size:0.85rem; width:100%; text-align:center;">${t('no_matches_logged')}</div>` : formData.map(d => `
        <div class="modal-form-col ${d === latestMatch ? 'active' : ''}" data-index="${d.index}" onclick="selectFormMatch(${d.index})">
          <span class="modal-form-score">${d.goals}</span>
          <div class="modal-bar-track">
            <div class="modal-bar-fill ${d.fillClass}" style="height: ${d.barHeightPercent}%;"></div>
          </div>
          <span class="modal-form-opp" title="${escapeHTML(d.opponent)}">${escapeHTML(d.shortOpp)}</span>
        </div>
      `).join('')}
    </div>

    <!-- Match Inspector Banner -->
    <div class="modal-inspector-banner" id="modal-inspector-banner">
      <div>
        <div style="font-family: var(--font-main); font-weight: 800; font-size: 0.95rem; color: #ffffff;" id="inspector-opp">
          ${latestMatch ? t('vs_match', { opp: escapeHTML(latestMatch.opponent) }) : t('no_match_selected')}
        </div>
        <div style="font-size: 0.75rem; color: var(--ucl-slate); margin-top: 2px;" id="inspector-date">
          ${latestMatch ? `${latestMatch.dateStr} • ${t('turns_played_desc', { n: latestMatch.turns })}` : '-'}
        </div>
      </div>
      <div style="font-family: var(--font-main); font-weight: 900; font-size: 1.15rem; color: var(--ucl-cyan);" id="inspector-score">
        ${latestMatch ? t('goals_count', { n: latestMatch.goals }) : ''}
      </div>
    </div>

    <!-- Tournament History Section -->
    <div class="modal-section-header">
      <div class="modal-section-title">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l7 4v6c0 5-3.5 9.5-7 10-3.5-.5-7-5-7-10V6l7-4z"></path></svg>
        <span>${t('tournament_history')}</span>
      </div>
    </div>

    <div class="modal-history-list">
      ${matches.length === 0 ? `<div style="padding:16px; color:var(--ucl-slate); text-align:center;">${t('no_tournament_history')}</div>` : matches.map(m => {
        const isMissed = m.turns_played === 0;
        const resultStamp = m.result === 'win' ? 'stamp-win' : (m.result === 'loss' ? 'stamp-loss' : 'stamp-draw');
        const stampText = m.result === 'win' ? t('stamp_win') : (m.result === 'loss' ? t('stamp_loss') : (m.result === 'draw' ? t('stamp_draw') : t('stamp_played')));
        return `
          <div class="modal-history-row" onclick="openTournamentModal('${m.tournament_id}')" style="cursor:pointer;">
            <div>
              <div style="font-family: var(--font-main); font-weight: 700; font-size: 0.9rem; color: #ffffff;">${t('vs_match', { opp: escapeHTML(m.opponent_display_name) })}</div>
              <div style="font-size: 0.75rem; color: var(--ucl-slate); margin-top: 1px;">${m.tournament_id.slice(0, 10)} • <span style="color: ${isMissed ? 'var(--ucl-loss)' : 'var(--ucl-win)'}; font-weight: 700;">${t('turns_played_badge', { n: m.turns_played !== undefined ? m.turns_played : (m.goals_for > 0 ? 3 : 0) })}</span></div>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="stamp ${resultStamp}">${stampText}</span>
              <span style="font-family: var(--font-main); font-weight: 900; color: var(--ucl-cyan); font-size: 1.05rem; min-width: 44px; text-align: right;">${m.goals_for} ${t('goals')}</span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  window.currentModalFormData = formData;

  overlay.style.display = 'flex';
  page.style.transform = 'none';

  setTimeout(() => SilkBadges3DManager.mountAll(), 40);
}

function selectFormMatch(idx) {
  SoundManager.playClick();
  const formData = window.currentModalFormData;
  if (!formData || !formData[idx]) return;

  document.querySelectorAll('.modal-form-col').forEach(col => col.classList.remove('active'));
  const activeCol = document.querySelector(`.modal-form-col[data-index="${idx}"]`);
  if (activeCol) activeCol.classList.add('active');

  const d = formData[idx];
  const oppEl = document.getElementById('inspector-opp');
  const dateEl = document.getElementById('inspector-date');
  const scoreEl = document.getElementById('inspector-score');

  if (oppEl) oppEl.textContent = t('vs_match', { opp: d.opponent });
  if (dateEl) dateEl.textContent = `${d.dateStr} • ${t('turns_played_desc', { n: d.turns })}`;
  if (scoreEl) scoreEl.textContent = t('goals_count', { n: d.goals });
}

function openTournamentModal(tId) {
  const tItem = state.tournaments.find(t => t.tournament_id === tId);
  if (!tItem) return;

  const overlay = document.getElementById('player-modal');
  const content = document.getElementById('modal-player-content');
  const page = document.getElementById('modal-page');
  
  SoundManager.playClick();
  lockModalScroll();

  document.getElementById('modal-close-x').onclick = () => {
    SoundManager.playClick();
    unlockModalScroll();
    overlay.style.display = 'none';
  };
  overlay.onclick = (e) => { 
    if (e.target === overlay) { 
      SoundManager.playClick(); 
      unlockModalScroll();
      overlay.style.display = 'none'; 
    } 
  };

  const matches = [...(tItem.matches || [])].sort((a, b) => b.goals_for - a.goals_for);

  content.innerHTML = `
    <div style="border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 12px; margin-bottom: 14px;">
      <div style="font-family: var(--font-main); font-size: 1.45rem; color: #ffffff; font-weight: 800;">${t('vs_match', { opp: escapeHTML(tItem.opponent_league) })}</div>
      <div style="color: var(--ucl-slate); font-size: 0.8rem; font-weight: 600; margin-top: 2px;">${tItem.date} • ${tItem.format || '32v32'}</div>
    </div>

    <div style="display: flex; justify-content: space-around; align-items: center; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 14px; margin-bottom: 16px;">
      <div style="text-align:center; flex: 1;">
        <div style="color: var(--ucl-cyan); font-weight: 800; font-size: 0.95rem;">Братва</div>
        <div style="font-size: 2rem; font-family: var(--font-main); font-weight: 900; color: #ffffff;">${tItem.our_total_goals}</div>
      </div>
      <div style="font-family: var(--font-main); font-weight: 800; color: var(--ucl-slate); font-size: 0.8rem; background: rgba(255,255,255,0.05); padding: 4px 10px; border-radius: 6px;">VS</div>
      <div style="text-align:center; flex: 1;">
        <div style="max-width:110px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin: 0 auto; color: var(--ucl-slate); font-weight: 700; font-size: 0.95rem;">${escapeHTML(tItem.opponent_league)}</div>
        <div style="font-size: 2rem; font-family: var(--font-main); font-weight: 900; color: #ffffff;">${tItem.opponent_total_goals}</div>
      </div>
    </div>

    <div class="modal-section-header">
      <div class="modal-section-title">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
        <span>${t('player_scores')}</span>
      </div>
    </div>

    <div class="modal-history-list">
      ${matches.map(m => `
        <div class="modal-history-row" style="cursor:pointer;" onclick="openPlayerModal('${m.player_id}')">
          <div>
            <div style="font-family: var(--font-main); font-weight: 700; font-size: 0.9rem; color: #ffffff;">${escapeHTML(m.player_display_name || m.player_id)}</div>
            <div style="font-size: 0.75rem; color: var(--ucl-slate); margin-top: 1px;">${t('turns_played_badge', { n: m.turns_played !== undefined ? m.turns_played : 3 })}</div>
          </div>
          <span style="font-family: var(--font-main); font-weight: 900; color: var(--ucl-cyan); font-size: 1.05rem;">${m.goals_for} ${t('goals')}</span>
        </div>
      `).join('')}
    </div>
  `;

  overlay.style.display = 'flex';
  page.style.transform = 'none';
}

/* ==========================================================================
   RULES & CRYPTOGRAPHICALLY SECURED ADMIN ENGINE
   ========================================================================== */
const RulesManager = {
  defaultRules: {
    maxMissesKick: 3,
    minTurnsPerTournament: 3,
    minGoalsPerTournament: 20,
    evaluationHorizon: 3,
    adminPinHash: "2c45dd42b74aea036849855c3380c5048f664c2b2324a0b452514bbf692594d6", // SHA-256('fc-bratva-security-2026:bratva2026')
    salt: "fc-bratva-security-2026"
  },

  currentRules: null,
  isUnlocked: false,

  recalculateSystem(shouldRender = true) {
    if (shouldRender) {
      if (typeof renderDashboard === 'function') renderDashboard();
      if (typeof renderTournaments === 'function') renderTournaments();
      if (typeof renderRoster === 'function') renderRoster();
      if (typeof renderLeaderboard === 'function') renderLeaderboard();
      if (typeof BroadcastGenerator !== 'undefined') BroadcastGenerator.render();
    }
  },

  render() {
    if (typeof document === 'undefined') return;
    const lockedView = document.getElementById('admin-locked-view');
    const unlockedView = document.getElementById('admin-unlocked-view');
    if (this.isUnlocked) {
      if (lockedView) lockedView.style.display = 'none';
      if (unlockedView) {
        unlockedView.style.display = 'block';
        if (typeof BroadcastGenerator !== 'undefined') BroadcastGenerator.render();
        if (typeof AdminSwipeLock !== 'undefined') AdminSwipeLock.init();
      }
      this.populateFormFields();
    } else {
      if (lockedView) lockedView.style.display = 'block';
      if (unlockedView) {
        unlockedView.style.display = 'none';
        if (typeof AdminSwipeLock !== 'undefined') AdminSwipeLock.lockEditing();
      }
    }
  },

  init() {
    this.loadRules();
    this.setupAdminListeners();
    this.recalculateSystem(false);
  },

  async loadRules() {
    try {
      const res = await fetch(`league-data/rules.json?v=${Date.now()}`);
      if (res.ok) {
        const json = await res.json();
        this.currentRules = { ...this.defaultRules, ...json };
        this.recalculateSystem(false);
        return;
      }
    } catch (e) {}

    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('fc_bratva_rules_v1');
      if (saved) {
        try {
          this.currentRules = { ...this.defaultRules, ...JSON.parse(saved) };
          return;
        } catch (e) {}
      }
    }
    this.currentRules = { ...this.defaultRules };
  },

  saveRules(newRules) {
    this.currentRules = { ...this.currentRules, ...newRules };
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('fc_bratva_rules_v1', JSON.stringify(this.currentRules));
    }
    this.recalculateSystem(true);
  },

  async verifyPasscode(input) {
    if (!input || !input.trim()) return false;
    const cleanPin = input.trim();
    const salted = `${this.currentRules.salt}:${cleanPin}`;

    if (typeof crypto !== 'undefined' && crypto.subtle) {
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(salted);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        const targetHash = this.currentRules.adminPinHash || this.defaultRules.adminPinHash;
        return hashHex === targetHash;
      } catch (e) {}
    }
    return cleanPin === 'bratva2026';
  },

  setupAdminListeners() {
    if (typeof document === 'undefined') return;

    const unlockBtn = document.getElementById('admin-unlock-btn');
    const pinInput = document.getElementById('admin-passcode-input');
    const lockNowBtn = document.getElementById('admin-lock-now-btn');
    const saveBtn = document.getElementById('admin-save-rules-btn');
    const resetBtn = document.getElementById('admin-reset-rules-btn');
    const errorEl = document.getElementById('admin-pin-error');
    const feedbackEl = document.getElementById('admin-save-feedback');

    if (unlockBtn && pinInput) {
      const tryUnlock = async () => {
        const pin = pinInput.value;
        const valid = await this.verifyPasscode(pin);
        if (valid) {
          SoundManager.playClick();
          this.isUnlocked = true;
          pinInput.value = '';
          if (errorEl) errorEl.textContent = '';
          this.render();
        } else {
          SoundManager.playClick();
          if (errorEl) errorEl.textContent = 'Invalid Passcode! Access Denied.';
        }
      };

      unlockBtn.addEventListener('click', tryUnlock);
      pinInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') tryUnlock();
      });
    }

    if (lockNowBtn) {
      lockNowBtn.addEventListener('click', () => {
        SoundManager.playClick();
        this.isUnlocked = false;
        this.render();
      });
    }

    const sMaxMisses = document.getElementById('input-max-misses');
    const sMinTurns = document.getElementById('input-min-turns');
    const sMinGoals = document.getElementById('input-min-goals');
    const sHorizon = document.getElementById('input-horizon');

    const vMaxMisses = document.getElementById('val-max-misses');
    const vMinTurns = document.getElementById('val-min-turns');
    const vMinGoals = document.getElementById('val-min-goals');
    const vHorizon = document.getElementById('val-horizon');

    if (sMaxMisses && vMaxMisses) {
      sMaxMisses.addEventListener('input', (e) => {
        vMaxMisses.textContent = `${e.target.value} Fails`;
      });
    }
    if (sMinTurns && vMinTurns) {
      sMinTurns.addEventListener('input', (e) => {
        vMinTurns.textContent = `${e.target.value} / 3 Turns`;
      });
    }
    if (sMinGoals && vMinGoals) {
      sMinGoals.addEventListener('input', (e) => {
        vMinGoals.textContent = `${e.target.value} Goals`;
      });
    }
    if (sHorizon && vHorizon) {
      sHorizon.addEventListener('input', (e) => {
        vHorizon.textContent = `Last ${e.target.value} Matches`;
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        SoundManager.playClick();
        const updated = {
          maxMissesKick: parseInt(sMaxMisses ? sMaxMisses.value : 3, 10),
          minTurnsPerTournament: parseInt(sMinTurns ? sMinTurns.value : 3, 10),
          minGoalsPerTournament: parseInt(sMinGoals ? sMinGoals.value : 20, 10),
          evaluationHorizon: parseInt(sHorizon ? sHorizon.value : 3, 10)
        };
        this.saveRules(updated);

        if (feedbackEl) {
          feedbackEl.textContent = 'SYSTEM RECALCULATED & RULES SAVED SUCCESSFULLY';
          setTimeout(() => { if (feedbackEl) feedbackEl.textContent = ''; }, 3000);
        }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        SoundManager.playClick();
        this.saveRules(this.defaultRules);
        this.populateFormFields();
        if (feedbackEl) {
          feedbackEl.textContent = 'Default Rules Restored & System Recalculated';
          setTimeout(() => { if (feedbackEl) feedbackEl.textContent = ''; }, 2500);
        }
      });
    }
  },

  populateFormFields() {
    if (typeof document === 'undefined') return;

    const sMaxMisses = document.getElementById('input-max-misses');
    const sMinTurns = document.getElementById('input-min-turns');
    const sMinGoals = document.getElementById('input-min-goals');
    const sHorizon = document.getElementById('input-horizon');

    const vMaxMisses = document.getElementById('val-max-misses');
    const vMinTurns = document.getElementById('val-min-turns');
    const vMinGoals = document.getElementById('val-min-goals');
    const vHorizon = document.getElementById('val-horizon');

    const rules = this.currentRules || this.defaultRules;

    if (sMaxMisses) sMaxMisses.value = rules.maxMissesKick;
    if (sMinTurns) sMinTurns.value = rules.minTurnsPerTournament;
    if (sMinGoals) sMinGoals.value = rules.minGoalsPerTournament;
    if (sHorizon) sHorizon.value = rules.evaluationHorizon;

    if (vMaxMisses) vMaxMisses.textContent = `${rules.maxMissesKick} Fails`;
    if (vMinTurns) vMinTurns.textContent = `${rules.minTurnsPerTournament} Turns`;
    if (vMinGoals) vMinGoals.textContent = `${rules.minGoalsPerTournament}+ Goals`;
    if (vHorizon) vHorizon.textContent = `${rules.evaluationHorizon} Matches`;
  }
};

// --- In-Game Chat Broadcast Dispatcher Engine (Compact RU & EN) ---
const BroadcastGenerator = {
  openAccordions: new Set(['live_warning']),
  init() { this.render(); },

  toggleAccordion(cardId) {
    SoundManager.playClick();
    if (this.openAccordions.has(cardId)) {
      this.openAccordions.delete(cardId);
    } else {
      this.openAccordions.add(cardId);
    }
    this.render();
  },

  generateCards() {
    const rules = RulesManager.currentRules || RulesManager.defaultRules;
    const completed = (state.tournaments || []).filter(t => t.status === 'complete');
    const latestT = (state.tournaments && state.tournaments[0]) ? state.tournaments[0] : {};
    const dDivider = '----------------------------\n----------------------------';

    // =========================================================================
    // 1. TOURNAMENT SQUAD CALL (Active Roster - Chosen Players on Top)
    // =========================================================================
    const activeParticipants = [];
    if (latestT && latestT.matches) {
      latestT.matches.forEach(m => {
        const pName = m.player_display_name || ((state.players || []).find(p => p.player_id === m.player_id)?.display_name || m.player_id);
        activeParticipants.push(`[ ⚽ | ${pName} | 3/3 ]`);
      });
    }

    const lineupList = activeParticipants.length > 0
      ? activeParticipants.join('\n')
      : `[ ⚽ | саня | 3/3 ]\n[ ⚽ | Abirsh07 | 3/3 ]\n[ ⚽ | DOXIBERO1 | 3/3 ]\n[ ⚽ | KOUSTAV_007 | 3/3 ]\n[ ⚽ | Omar | 3/3 ]\n[ ⚽ | Rogelio | 3/3 ]\n[ ⚽ | Mohamed_Osama | 3/3 ]\n[ ⚽ | Тима | 3/3 ]`;

    const rallyHeader = `⭐ СОСТАВ НА ТУРНИР / STARTING LINEUP ⭐\n${lineupList}`;
    const rallyRU = `⚔️ В БОЙ, БРАТВА! Состав выше — заходите и сыграйте 3/3!`;
    const rallyEN = `⚔️ LETS GO БРАТВА! Lineup above — enter & play your 3/3!`;

    const rallyCombined = `${rallyHeader}
${dDivider}
${rallyRU}
${dDivider}
${rallyEN}`;

    // =========================================================================
    // 2. LIVE MATCH WARNING (Active Countdown + Unplayed List)
    // =========================================================================
    const liveUnplayed = [];
    if (latestT && latestT.matches) {
      latestT.matches.forEach(m => {
        const turns = m.turns_played !== undefined ? m.turns_played : 0;
        if (turns < rules.minTurnsPerTournament) {
          const pName = m.player_display_name || ((state.players || []).find(p => p.player_id === m.player_id)?.display_name || m.player_id);
          liveUnplayed.push(`[ ⏳ | ${pName} | ${turns}/${rules.minTurnsPerTournament} ]`);
        }
      });
    }

    const liveListStr = liveUnplayed.length > 0
      ? liveUnplayed.join('\n')
      : `[ ⏳ | саня | 0/3 ]\n[ ⏳ | Omar | 0/3 ]\n[ ⏳ | Abirsh07 | 0/3 ]`;

    const liveHeader = `⛔ ВНИМАНИЕ / ATTENTION PLEASE ⛔\n${liveListStr}`;
    const liveRU = `⏳ До конца турнира мало времени! Сыграйте 3/3, чтобы избежать кика!`;
    const liveEN = `⏳ Match ending soon! Attack 3/3 ASAP to avoid kick!`;

    const liveCombined = `${liveHeader}
${dDivider}
${liveRU}
${dDivider}
${liveEN}`;

    // =========================================================================
    // 3. LAST MATCH RECAP (Energetic Squad Language + Boxed Ranks)
    // =========================================================================
    const lastT = completed[0] || {};
    const lastOpp = lastT.opponent_league || 'IRAN. gold';
    const lastOurScore = lastT.our_total_goals !== undefined ? lastT.our_total_goals : 277;
    const lastOppScore = lastT.opponent_total_goals !== undefined ? lastT.opponent_total_goals : 277;
    const isWin = lastT.result === 'win' || (lastOurScore > lastOppScore);
    const isDraw = lastT.result === 'draw' || (lastOurScore === lastOppScore);

    const matchPerformers = ((lastT.matches || []).slice()).sort((a, b) => (b.goals_for || 0) - (a.goals_for || 0));
    const mp1 = matchPerformers[0] ? ((state.players || []).find(p => p.player_id === matchPerformers[0].player_id)?.display_name || 'саня') : 'саня';
    const mp1Goals = matchPerformers[0] ? matchPerformers[0].goals_for : 34;
    const mp2 = matchPerformers[1] ? ((state.players || []).find(p => p.player_id === matchPerformers[1].player_id)?.display_name || 'Omar') : 'Omar';
    const mp2Goals = matchPerformers[1] ? matchPerformers[1].goals_for : 31;
    const mp3 = matchPerformers[2] ? ((state.players || []).find(p => p.player_id === matchPerformers[2].player_id)?.display_name || 'Abirsh07') : 'Abirsh07';
    const mp3Goals = matchPerformers[2] ? matchPerformers[2].goals_for : 28;

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

    const reviewRU = `${titleRU}
⚽ Счет: ${lastOurScore} - ${lastOppScore}
⭐ ЛУЧШИЕ ИГРОКИ:
[ 1 | ${mp1} | ${mp1Goals}G ]
[ 2 | ${mp2} | ${mp2Goals}G ]
[ 3 | ${mp3} | ${mp3Goals}G ]
${closingRU}`;

    const reviewEN = `${titleEN}
⚽ Score: ${lastOurScore} - ${lastOppScore}
⭐ TOP SCORERS:
[ 1 | ${mp1} | ${mp1Goals}G ]
[ 2 | ${mp2} | ${mp2Goals}G ]
[ 3 | ${mp3} | ${mp3Goals}G ]
${closingEN}`;

    const reviewCombined = `${reviewRU}
${dDivider}
${reviewEN}`;

    // =========================================================================
    // 4. STRIKES & WARNINGS (Ultra-Short: Debtors + Strike Notice + Instant Rule)
    // =========================================================================
    const missedPlayers = [];
    if (lastT.matches && state.players) {
      lastT.matches.forEach(m => {
        const turns = m.turns_played !== undefined ? m.turns_played : 0;
        if (turns < rules.minTurnsPerTournament) {
          const pName = m.player_display_name || ((state.players || []).find(p => p.player_id === m.player_id)?.display_name || m.player_id);
          missedPlayers.push(`[ ❌ | ${pName} | ${turns}/${rules.minTurnsPerTournament} ]`);
        }
      });
    }

    let warnRU = '';
    let warnEN = '';
    let warnCombined = '';
    if (missedPlayers.length > 0) {
      const pList = missedPlayers.join('\n');
      const strikesHeader = `⛔ ВНИМАНИЕ / ATTENTION PLEASE ⛔\n${pList}`;

      warnRU = `⛔ Страйк 1/${rules.maxMissesKick}! Обязательно 3/3 в след. матче, иначе кик!`;
      warnEN = `⛔ Strike 1/${rules.maxMissesKick}! Must play 3/3 in next match or get kicked!`;

      warnCombined = `${strikesHeader}
${dDivider}
${warnRU}
${dDivider}
${warnEN}`;
    } else {
      warnRU = `✅ 100% ДИСЦИПЛИНА! Все 3/3 сыграны!`;
      warnEN = `✅ 100% DISCIPLINE! All 3/3 played!`;

      warnCombined = `${warnRU}
${dDivider}
${warnEN}`;
    }

    // =========================================================================
    // 5. LEAGUE RULES (Permanent Constitution - Boxed Rules)
    // =========================================================================
    const rulesRU = `⚙️ ПРАВИЛА БРАТВА:
[ 1 ] Обязательно 3/3 в матче
[ 2 ] Пропуск ${rules.maxMissesKick} турниров = кик
[ 3 ] Планка: ${rules.minGoalsPerTournament}+ голов
[ 4 ] Оценка за ${rules.evaluationHorizon} турнира`;

    const rulesEN = `⚙️ БРАТВА RULES:
[ 1 ] Mandatory 3/3 every match
[ 2 ] Missing ${rules.maxMissesKick} tournaments = kick
[ 3 ] Scoring target: ${rules.minGoalsPerTournament}+ goals
[ 4 ] Evaluation: last ${rules.evaluationHorizon} matches`;

    const rulesCombined = `${rulesRU}
${dDivider}
${rulesEN}`;

    return [
      {
        id: 'rally',
        title: t('b_title_rally') || '1. STARTING LINEUP CALL',
        badge: t('b_badge_rally') || 'KICKOFF',
        timing: t('b_timing_rally'),
        is_combined: true,
        text_combined: rallyCombined,
        text_ru: rallyRU,
        text_en: rallyEN
      },
      {
        id: 'live_warning',
        title: t('b_title_live_warning'),
        badge: t('b_badge_live_warning'),
        timing: t('b_timing_live_warning'),
        is_combined: true,
        text_combined: liveCombined,
        text_ru: liveRU,
        text_en: liveEN
      },
      {
        id: 'last_review',
        title: t('b_title_last_review'),
        badge: t('b_badge_last_review'),
        timing: t('b_timing_last_review'),
        is_combined: true,
        text_combined: reviewCombined,
        text_ru: reviewRU,
        text_en: reviewEN
      },
      {
        id: 'warnings',
        title: t('b_title_warnings'),
        badge: t('b_badge_warnings'),
        timing: t('b_timing_warnings'),
        is_combined: true,
        text_combined: warnCombined,
        text_ru: warnRU,
        text_en: warnEN
      },
      {
        id: 'rules',
        title: t('b_title_rules'),
        badge: t('b_badge_rules'),
        timing: t('b_timing_rules'),
        is_combined: true,
        text_combined: rulesCombined,
        text_ru: rulesRU,
        text_en: rulesEN
      }
    ];
  },

  render() {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('broadcast-accordion-list');
    if (!container) return;

    const cards = this.generateCards();
    container.innerHTML = cards.map(c => {
      const isOpen = this.openAccordions.has(c.id);
      return `
        <div class="b-accordion-card ${isOpen ? 'open' : ''}" id="bcard-${c.id}">
          <div class="b-accordion-header" onclick="BroadcastGenerator.toggleAccordion('${c.id}')">
            <div class="b-accordion-title-wrap">
              <span class="b-accordion-title">${escapeHTML(c.title)}</span>
              <span class="b-accordion-badge">${escapeHTML(c.badge)}</span>
            </div>
            <span class="b-accordion-arrow" id="barr-${c.id}">▼</span>
          </div>

          <div class="b-accordion-body" id="bbody-${c.id}" style="display: ${isOpen ? 'flex' : 'none'};">
            <div class="b-timing-bar">
              <span class="b-timing-label">${t('b_posting_deadline') || 'POSTING DEADLINE:'}</span>
              <span class="b-timing-val">${escapeHTML(c.timing)}</span>
            </div>

            <!-- Unified Dual Language Block (RU + Double Line Divider + EN + Shared List) -->
            <div class="b-lang-block combined-block" style="width: 100%;">
              <div class="b-lang-header">
                <span class="b-lang-flag-title">🇷🇺 RU + 🇬🇧 EN (DUAL FORMAT)</span>
                <span class="b-lang-char-badge" style="background: rgba(0, 230, 118, 0.2); border-color: rgba(0, 230, 118, 0.4); color: #00e676;">${c.text_combined.length} CHARS</span>
              </div>
              <div class="b-chat-preview-box" id="bpreview-${c.id}-comb" style="min-height: 140px; line-height: 1.45;">${escapeHTML(c.text_combined)}</div>
              <button class="b-copy-single-btn combined-btn" style="background: linear-gradient(135deg, rgba(168, 85, 247, 0.35), rgba(56, 189, 248, 0.35)); border-color: rgba(168, 85, 247, 0.6);" onclick="BroadcastGenerator.copyCombinedMessage('${c.id}', this)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                <span style="font-weight: 800; letter-spacing: 0.5px;">${t('b_copy_combined_btn') || 'COPY DUAL MESSAGE [RU + EN]'}</span>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  copyCombinedMessage(cardId, btn) {
    const cards = this.generateCards();
    const item = cards.find(c => c.id === cardId);
    if (!item || !item.text_combined) return;

    SoundManager.playClick();
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(item.text_combined).then(() => {
        this.showCopiedFeedback(btn);
      }).catch(() => {
        this.fallbackCopy(item.text_combined, btn);
      });
    } else {
      this.fallbackCopy(item.text_combined, btn);
    }
  },

  copySingleMessage(cardId, lang, btn) {
    const cards = this.generateCards();
    const item = cards.find(c => c.id === cardId);
    if (!item) return;

    const textToCopy = lang === 'ru' ? item.text_ru : item.text_en;
    if (!textToCopy) return;

    SoundManager.playClick();

    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        this.showCopiedFeedback(btn);
      }).catch(() => {
        this.fallbackCopy(textToCopy, btn);
      });
    } else {
      this.fallbackCopy(textToCopy, btn);
    }
  },

  fallbackCopy(text, btn) {
    if (typeof document === 'undefined') return;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      this.showCopiedFeedback(btn);
    } catch (e) {
      console.error(e);
    }
    document.body.removeChild(ta);
  },

  showCopiedFeedback(btn) {
    if (!btn) return;
    const span = btn.querySelector('span');
    const origText = span ? span.textContent : 'COPY';
    btn.classList.add('copied');
    if (span) span.textContent = t('b_copied_toast') || 'COPIED TO CLIPBOARD! ✓';
    setTimeout(() => {
      btn.classList.remove('copied');
      if (span) span.textContent = origText;
    }, 2000);
  }
};


// --- Fullscreen Multilingual League Rules Modal Controller ---
const LeagueRulesModal = {
  isOpen: false,

  open() {
    SoundManager.playClick();
    this.isOpen = true;
    this.render();
    const modal = document.getElementById('league-rules-modal');
    if (modal) {
      modal.style.display = 'flex';
      modal.classList.add('active');
    }
    if (typeof lockModalScroll === 'function') lockModalScroll();
  },

  close() {
    SoundManager.playClick();
    this.isOpen = false;
    const modal = document.getElementById('league-rules-modal');
    if (modal) {
      modal.style.display = 'none';
      modal.classList.remove('active');
    }
    if (typeof unlockModalScroll === 'function') unlockModalScroll();
  },

  render() {
    const container = document.getElementById('league-rules-modal-content');
    if (!container) return;

    const rules = RulesManager.currentRules || RulesManager.defaultRules;
    const lang = state.lang || localStorage.getItem('fcm_lang') || 'en';

    const translations = {
      en: {
        title: 'OFFICIAL LEAGUE RULES',
        sub: 'Mandatory constitution & squad discipline standards',
        r1_t: '1) Mandatory Turns',
        r1_d: `Every player must complete all ${rules.minTurnsPerTournament}/3 attempts in every single tournament.`,
        r2_t: '2) Strict Strike Policy',
        r2_d: `Missing ${rules.maxMissesKick} consecutive tournaments leads to permanent expulsion without exception.`,
        r3_t: '3) Scoring Benchmark',
        r3_d: `Target benchmark of ${rules.minGoalsPerTournament}+ goals across 3 tournament attempts.`,
        r4_t: '4) Activity Horizon',
        r4_d: `Roster active reliability evaluated across the last ${rules.evaluationHorizon} tournaments.`,
        ethos_t: 'LEAGUE PHILOSOPHY',
        ethos_d: 'БРАТВА is built on mutual respect, 100% active discipline, and championship teamwork. We play for victory and leave zero turns unplayed.',
        owner_sig: 'League Creator: Саня'
      },
      ru: {
        title: 'ОФИЦИАЛЬНЫЕ ПРАВИЛА ЛИГИ',
        sub: 'Устав лиги и регламент командной дисциплины',
        r1_t: '1) Обязательные попытки',
        r1_d: `Каждый игрок обязан отыгрывать все ${rules.minTurnsPerTournament}/3 попытки в каждом турнире.`,
        r2_t: '2) Регламент исключения',
        r2_d: `Пропуск ${rules.maxMissesKick} турниров подряд = исключение из лиги без исключений.`,
        r3_t: '3) Планка результативности',
        r3_d: `Минимальная планка: ${rules.minGoalsPerTournament}+ голов за 3 сыгранные попытки.`,
        r4_t: '4) Период оценки активности',
        r4_d: `Активность и надежность оцениваются по последним ${rules.evaluationHorizon} турнирам.`,
        ethos_t: 'ФИЛОСОФИЯ ЛИГИ',
        ethos_d: 'Лига БРАТВА держится на железной дисциплине, взаимном уважении и командной игре. Мы играем только на победу!',
        owner_sig: 'Создатель Лиги: Саня'
      },
      ar: {
        title: 'قوانين الدوري الرسمية',
        sub: 'الدستور الرسمي ومعايير الانضباط الجماعي',
        r1_t: '1) الأشواط الإلزامية',
        r1_d: `إلزامي على كل لاعب لعب ${rules.minTurnsPerTournament}/3 محاولات في كل بطولة بدون استثناء.`,
        r2_t: '2) لائحة الطرد الصارمة',
        r2_d: `تفويت ${rules.maxMissesKick} بطولات متتالية = طرد نهائي ومباشر من الدوري.`,
        r3_t: '3) الحد الأدنى للأهداف',
        r3_d: `الهدف المطلوب تسجيل ${rules.minGoalsPerTournament}+ هدف في مجموع محاولات البطولة.`,
        r4_t: '4) فترة تقييم النشاط',
        r4_d: `يتم احتساب نشاط وموثوقية اللاعبين على مدار آخر ${rules.evaluationHorizon} بطولات.`,
        ethos_t: 'فلسفة دوري БРАТВА',
        ethos_d: 'دوري БРАТВА مبني على الانضباط الصارم، الاحترام المتبادل، والروح الجماعية. نلعب دائماً من أجل الفوز ولا نترك أي محاولة دون لعب.',
        owner_sig: 'مؤسس الدوري: Саня'
      },
      es: {
        title: 'REGLAS OFICIALES DE LA LIGA',
        sub: 'Constitución oficial y estándares de disciplina',
        r1_t: '1) Turnos obligatorios',
        r1_d: `Obligatorio jugar los ${rules.minTurnsPerTournament}/3 turnos en cada torneo sin excepción.`,
        r2_t: '2) Política de expulsión',
        r2_d: `Perder ${rules.maxMissesKick} torneos consecutivos = expulsión definitiva sin excepciones.`,
        r3_t: '3) Objetivo de goles',
        r3_d: `Objetivo mínimo recomendado de ${rules.minGoalsPerTournament}+ goles por torneo.`,
        r4_t: '4) Periodo de evaluación',
        r4_d: `La fiabilidad y estado activo se evalúan en base a los últimos ${rules.evaluationHorizon} torneos.`,
        ethos_t: 'FILOSOFÍA DE LA LIGA',
        ethos_d: 'БРАТВА se basa en la disciplina, el respeto y el trabajo en equipo. ¡Jugamos para ganar y no dejamos turnos sin jugar!',
        owner_sig: 'Creador de la Liga: Саня'
      }
    };

    const c = translations[lang] || translations.en;

    container.innerHTML = `
      <div class="rules-modal-header">
        <div class="rules-modal-badge">БРАТВА CONSTITUTION</div>
        <h2 class="rules-modal-title">${escapeHTML(c.title)}</h2>
        <p class="rules-modal-sub">${escapeHTML(c.sub)}</p>
      </div>

      <div class="rules-modal-grid">
        <div class="rules-modal-tile">
          <div class="rules-modal-tile-icon">⚽</div>
          <div class="rules-modal-tile-content">
            <h4>${escapeHTML(c.r1_t)}</h4>
            <p>${escapeHTML(c.r1_d)}</p>
          </div>
        </div>

        <div class="rules-modal-tile danger">
          <div class="rules-modal-tile-icon">⛔</div>
          <div class="rules-modal-tile-content">
            <h4>${escapeHTML(c.r2_t)}</h4>
            <p>${escapeHTML(c.r2_d)}</p>
          </div>
        </div>

        <div class="rules-modal-tile">
          <div class="rules-modal-tile-icon">⭐</div>
          <div class="rules-modal-tile-content">
            <h4>${escapeHTML(c.r3_t)}</h4>
            <p>${escapeHTML(c.r3_d)}</p>
          </div>
        </div>

        <div class="rules-modal-tile">
          <div class="rules-modal-tile-icon">⏱️</div>
          <div class="rules-modal-tile-content">
            <h4>${escapeHTML(c.r4_t)}</h4>
            <p>${escapeHTML(c.r4_d)}</p>
          </div>
        </div>
      </div>

      <div class="rules-modal-ethos">
        <div class="rules-modal-ethos-title">⚜️ ${escapeHTML(c.ethos_t)}</div>
        <div class="rules-modal-ethos-body">${escapeHTML(c.ethos_d)}</div>
        <div class="rules-modal-owner-badge">${escapeHTML(c.owner_sig)}</div>
        <div class="rules-modal-telegram-link">
          <a href="https://t.me/addlist/c2IRI0ZsvfEwYzU0" target="_blank" rel="noopener noreferrer" class="rules-tg-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.52 2.77-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>
            <span>Telegram Community (Channel + Chat)</span>
          </a>
          <a href="https://t.me/BratvaFCMBot" target="_blank" rel="noopener noreferrer" class="rules-tg-btn bot">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>
            <span>AI Bot @BratvaFCMBot</span>
          </a>
        </div>
      </div>
    `;
  }
};

// --- Fullscreen Multilingual League Updates & Live News Feed Modal ---
const LeagueNewsModal = {
  isOpen: false,

  open() {
    SoundManager.playClick();
    this.isOpen = true;
    this.render();
    const modal = document.getElementById('league-news-modal');
    if (modal) {
      modal.style.display = 'flex';
      modal.classList.add('active');
    }
    if (typeof lockModalScroll === 'function') lockModalScroll();
  },

  close() {
    SoundManager.playClick();
    this.isOpen = false;
    const modal = document.getElementById('league-news-modal');
    if (modal) {
      modal.style.display = 'none';
      modal.classList.remove('active');
    }
    if (typeof unlockModalScroll === 'function') unlockModalScroll();
  },

  render() {
    const container = document.getElementById('league-news-modal-content');
    if (!container) return;

    const lang = state.lang || localStorage.getItem('fcm_lang') || 'en';
    const rules = RulesManager.currentRules || RulesManager.defaultRules;

    const newsData = {
      en: {
        title: 'LEAGUE UPDATES & NEWS FEED',
        sub: 'Real-time tournament events, notices, and match intelligence',
        items: [
          {
            tag: 'LATEST MATCH',
            tagClass: 'badge-live',
            time: '19 Hours Ago',
            title: 'Hard-Fought Draw: БРАТВА 277 - 277 IRAN. gold',
            desc: 'Intense battle ending in a draw. Top scorers: саня (34G), Omar (31G), Abirsh07 (28G), KOUSTAV_007 (28G).'
          },
          {
            tag: 'RECENT VICTORY',
            tagClass: 'badge-win',
            time: '1 Day Ago',
            title: 'Win: БРАТВА 259 - 177 TH\'·TheDemon·\'FC',
            desc: 'Dominant 16v16 triumph. Top scorers: саня (31G), Abirsh07 (28G), KOUSTAV_007 (28G), Mohamed_Osama (27G).'
          },
          {
            tag: 'PRIOR VICTORIES',
            tagClass: 'badge-win',
            time: '3-4 Days Ago',
            title: 'Wins vs الافضل الرياضي26 (302-193) & Bayern 2 Monique (217-148)',
            desc: 'Consecutive strong victories keeping БРАТВА in strong championship form.'
          },
          {
            tag: 'SYSTEM REGULATION',
            tagClass: 'badge-rule',
            time: 'Active Rule Matrix',
            title: `Enforcement: ${rules.minTurnsPerTournament}/3 Turns Required | Strike Kick Threshold: ${rules.maxMissesKick}`,
            desc: `Automated tracking evaluates players across the last ${rules.evaluationHorizon} tournaments with a ${rules.minGoalsPerTournament}+ goal qualification target.`
          }
        ]
      },
      ru: {
        title: 'НОВОСТИ И СОБЫТИЯ ЛИГИ',
        sub: 'Лента событий, статус турнира и командные сводки',
        items: [
          {
            tag: 'ПОСЛЕДНИЙ МАТЧ',
            tagClass: 'badge-live',
            time: '19 часов назад',
            title: 'Боевая ничья: БРАТВА 277 - 277 IRAN. gold',
            desc: 'Напряженная борьба до последней секунды. Топ бомбардиры: саня (34G), Omar (31G), Abirsh07 (28G), KOUSTAV_007 (28G).'
          },
          {
            tag: 'ПОБЕДА В МАТЧЕ',
            tagClass: 'badge-win',
            time: '1 день назад',
            title: 'Победа: БРАТВА 259 - 177 TH\'·TheDemon·\'FC',
            desc: 'Уверенный разгром соперника 16 на 16. Топ игроки: саня (31G), Abirsh07 (28G), KOUSTAV_007 (28G).'
          },
          {
            tag: 'РЕГЛАМЕНТ',
            tagClass: 'badge-rule',
            time: 'Активная система',
            title: `Дисциплина: ${rules.minTurnsPerTournament}/3 ходов | Порог исключения: ${rules.maxMissesKick} пропусков`,
            desc: `Автоматическая система рассчитывает статус каждого игрока по последним ${rules.evaluationHorizon} турнирам с планкой ${rules.minGoalsPerTournament}+ голов.`
          }
        ]
      },
      ar: {
        title: 'تحديثات وأخبار دوري БРАТВА',
        sub: 'شريط الأحداث المباشرة، حالة المباراة، والقرارات الإدارية',
        items: [
          {
            tag: 'آخر مباراة',
            tagClass: 'badge-live',
            time: 'منذ 19 ساعة',
            title: 'تعادل ملحمي: БРАТВА 277 - 277 IRAN. gold',
            desc: 'مباراة قوية انتهت بالتعادل. الهدافون: саня (34 هدف)، Omar (31 هدف)، Abirsh07 (28 هدف)، KOUSTAV_007 (28 هدف).'
          },
          {
            tag: 'فوز مستحق',
            tagClass: 'badge-win',
            time: 'منذ يوم',
            title: 'انتصار: БРАТВА 259 - 177 TH\'·TheDemon·\'FC',
            desc: 'فوز عريض بنتيجة 259 - 177 في مواجهة 16 ضد 16.'
          },
          {
            tag: 'نظام الانضباط',
            tagClass: 'badge-rule',
            time: 'القوانين الفعالة',
            title: `الالتزام: ${rules.minTurnsPerTournament}/3 محاولات | حد الطرد: ${rules.maxMissesKick} غيابات متتالية`,
            desc: `النظام الذكي يقيّم أداء الأعضاء عبر آخر ${rules.evaluationHorizon} مباريات بهدف أدنى ${rules.minGoalsPerTournament}+ هدف.`
          }
        ]
      },
      es: {
        title: 'NOTICIAS Y ACTUALIZACIONES',
        sub: 'Estado del torneo en vivo, alertas y avisos oficiales',
        items: [
          {
            tag: 'ÚLTIMO PARTIDO',
            tagClass: 'badge-live',
            time: 'Hace 19 horas',
            title: 'Empate reñido: БРАТВА 277 - 277 IRAN. gold',
            desc: 'Gran partido que finalizó en tablas. Máximos goleadores: саня (34G), Omar (31G), Abirsh07 (28G).'
          },
          {
            tag: 'VICTORIA',
            tagClass: 'badge-win',
            time: 'Hace 1 día',
            title: 'Victoria: БРАТВА 259 - 177 TH\'·TheDemon·\'FC',
            desc: 'Triunfo claro por 259 a 177 en formato 16 contra 16.'
          },
          {
            tag: 'REGLAMENTO ACTIVO',
            tagClass: 'badge-rule',
            time: 'Control Automático',
            title: `Requisito: ${rules.minTurnsPerTournament}/3 turnos | Límite expulsión: ${rules.maxMissesKick} fallos`,
            desc: `Evaluación automática en base a los últimos ${rules.evaluationHorizon} torneos con objetivo de ${rules.minGoalsPerTournament}+ goles.`
          }
        ]
      }
    };
    const c = newsData[lang] || newsData.en;

    container.innerHTML = `
      <div class="news-modal-header">
        <div class="news-modal-badge">LIVE LEAGUE FEED</div>
        <h2 class="news-modal-title">${escapeHTML(c.title)}</h2>
        <p class="news-modal-sub">${escapeHTML(c.sub)}</p>
      </div>

      <div class="news-feed-list">
        ${c.items.map(item => `
          <div class="news-feed-card">
            <div class="news-feed-card-header">
              <span class="news-feed-tag ${item.tagClass}">${escapeHTML(item.tag)}</span>
              <span class="news-feed-time">${escapeHTML(item.time)}</span>
            </div>
            <h3 class="news-feed-item-title">${escapeHTML(item.title)}</h3>
            <p class="news-feed-item-desc">${escapeHTML(item.desc)}</p>
          </div>
        `).join('')}
      </div>
    `;
  }
};

// --- Admin Swipe-To-Edit Safety Lock Controller ---
const AdminSwipeLock = {
  isEditingUnlocked: false,
  startX: 0,
  currentX: 0,
  maxDrag: 0,
  isDragging: false,

  init() {
    const track = document.getElementById('admin-swipe-track');
    const thumb = document.getElementById('admin-swipe-thumb');
    if (!track || !thumb) return;

    this.isEditingUnlocked = false;
    this.updateUIState();

    const handleStart = (e) => {
      if (this.isEditingUnlocked) return;
      this.isDragging = true;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      this.startX = clientX;
      this.maxDrag = track.offsetWidth - thumb.offsetWidth - 8;
      thumb.style.transition = 'none';
    };

    const handleMove = (e) => {
      if (!this.isDragging || this.isEditingUnlocked) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      let deltaX = clientX - this.startX;
      if (deltaX < 0) deltaX = 0;
      if (deltaX > this.maxDrag) deltaX = this.maxDrag;
      this.currentX = deltaX;
      thumb.style.transform = `translateX(${deltaX}px)`;
      
      const progress = deltaX / (this.maxDrag || 1);
      if (progress > 0.85) {
        this.unlockEditing();
      }
    };

    const handleEnd = () => {
      if (!this.isDragging) return;
      this.isDragging = false;
      thumb.style.transition = 'transform 0.25s ease';
      if (!this.isEditingUnlocked) {
        thumb.style.transform = 'translateX(0px)';
      }
    };

    thumb.addEventListener('mousedown', handleStart);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);

    thumb.addEventListener('touchstart', handleStart, { passive: true });
    window.addEventListener('touchmove', handleMove, { passive: true });
    window.addEventListener('touchend', handleEnd);

    // Also allow tapping thumb when unlocked to re-lock
    thumb.addEventListener('click', () => {
      if (this.isEditingUnlocked) {
        this.lockEditing();
      }
    });
  },

  unlockEditing() {
    this.isEditingUnlocked = true;
    this.isDragging = false;
    SoundManager.playClick();
    const track = document.getElementById('admin-swipe-track');
    const thumb = document.getElementById('admin-swipe-thumb');
    const text = document.getElementById('admin-swipe-text');
    if (track) track.classList.add('unlocked');
    if (thumb) {
      thumb.style.transform = `translateX(${this.maxDrag || 180}px)`;
      thumb.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>`;
    }
    if (text) text.textContent = t('edit_mode_active') || 'Edit Mode Active (Unlocked)';
    this.updateUIState();
  },

  lockEditing() {
    this.isEditingUnlocked = false;
    SoundManager.playClick();
    const track = document.getElementById('admin-swipe-track');
    const thumb = document.getElementById('admin-swipe-thumb');
    const text = document.getElementById('admin-swipe-text');
    if (track) track.classList.remove('unlocked');
    if (thumb) {
      thumb.style.transform = 'translateX(0px)';
      thumb.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;
    }
    if (text) text.textContent = t('swipe_to_edit') || 'Slide to unlock edit mode';
    this.updateUIState();
  },

  updateUIState() {
    const formBody = document.getElementById('admin-rules-form-body');
    const saveBtn = document.getElementById('admin-save-rules-btn');
    const resetBtn = document.getElementById('admin-reset-rules-btn');

    if (formBody) {
      if (this.isEditingUnlocked) {
        formBody.classList.remove('disabled-edit');
        formBody.classList.add('enabled-edit');
      } else {
        formBody.classList.add('disabled-edit');
        formBody.classList.remove('enabled-edit');
      }
    }

    if (saveBtn) saveBtn.disabled = !this.isEditingUnlocked;
    if (resetBtn) resetBtn.disabled = !this.isEditingUnlocked;
  }
};

// Bind Top Header Buttons and Modal Close Handlers on Load
document.addEventListener('DOMContentLoaded', () => {
  const rulesBtn = document.getElementById('header-rules-btn');
  const newsBtn = document.getElementById('header-news-btn');

  if (rulesBtn) rulesBtn.addEventListener('click', () => LeagueRulesModal.open());
  if (newsBtn) newsBtn.addEventListener('click', () => LeagueNewsModal.open());

  const rulesCloseBtn = document.getElementById('league-rules-modal-close-x');
  const newsCloseBtn = document.getElementById('league-news-modal-close-x');

  if (rulesCloseBtn) rulesCloseBtn.addEventListener('click', () => LeagueRulesModal.close());
  if (newsCloseBtn) newsCloseBtn.addEventListener('click', () => LeagueNewsModal.close());

  const rulesModal = document.getElementById('league-rules-modal');
  const newsModal = document.getElementById('league-news-modal');

  if (rulesModal) {
    rulesModal.addEventListener('click', (e) => {
      if (e.target === rulesModal) LeagueRulesModal.close();
    });
  }
  if (newsModal) {
    newsModal.addEventListener('click', (e) => {
      if (e.target === newsModal) LeagueNewsModal.close();
    });
  }

  // Keyboard ESC support for both modals
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (LeagueRulesModal.isOpen) LeagueRulesModal.close();
      if (LeagueNewsModal.isOpen) LeagueNewsModal.close();
    }
  });

  // Re-render modals on language switch
  const originalSetLang = window.setLanguage;
  if (typeof originalSetLang === 'function') {
    window.setLanguage = function(lang) {
      originalSetLang(lang);
      if (LeagueRulesModal.isOpen) LeagueRulesModal.render();
      if (LeagueNewsModal.isOpen) LeagueNewsModal.render();
    };
  }
});

if (typeof window !== 'undefined') {
  window.setLanguage = setLanguage;
  window.state = state;
  window.BroadcastGenerator = BroadcastGenerator;
  window.RulesManager = RulesManager;
  window.LeagueRulesModal = LeagueRulesModal;
  window.LeagueNewsModal = LeagueNewsModal;
  window.AdminSwipeLock = AdminSwipeLock;
}


// --- Squad Lineup Advisor Engine (Best 8 / 16 / 32 Selection) ---
const LineupAdvisor = {
  currentSize: 8,

  init() {
    this.render();
  },

  setSize(size) {
    SoundManager.playClick();
    this.currentSize = size;
    ['8', '16', '32'].forEach(s => {
      const btn = document.getElementById('lineup-btn-' + s);
      if (btn) {
        if (parseInt(s, 10) === size) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      }
    });

    const copyBtnText = document.getElementById('lineup-copy-btn-text');
    if (copyBtnText) {
      copyBtnText.textContent = `COPY TOP ${size} SQUAD SELECTION [RU + EN]`;
    }

    this.render();
  },

  getRankedPlayers() {
    const players = (state.players || []).slice();
    const latestT = (state.tournaments && state.tournaments[0]) ? state.tournaments[0] : null;

    return players.map(p => {
      const lastMatch = latestT && latestT.matches ? latestT.matches.find(m => m.player_id === p.player_id) : null;
      const lastMatchGoals = lastMatch ? (lastMatch.goals_for || 0) : null;
      const lastMatchTurns = lastMatch ? (lastMatch.turns_played !== undefined ? lastMatch.turns_played : 0) : null;
      
      const totalMatches = p.matches ? p.matches.length : (p.total_matches || 0);
      const totalGoals = p.matches ? p.matches.reduce((sum, m) => sum + (m.goals_for || 0), 0) : (p.total_goals || 0);
      const avgGoals = totalMatches > 0 ? (totalGoals / totalMatches) : 0;
      const failStreak = p.eligibility_streak?.current_fail_streak || 0;

      // Power Score algorithm:
      // Weight 1: Latest Match Goals (high weight)
      // Weight 2: Average Goals (stability)
      // Penalty: Fail Streak (severe penalty if missing turns)
      let powerScore = 0;
      if (lastMatch && lastMatchTurns >= 3 && lastMatchGoals > 0) {
        powerScore += lastMatchGoals * 2.0;
      }
      powerScore += avgGoals * 1.5;
      if (failStreak > 0) {
        powerScore -= failStreak * 50; // heavily penalize debtor
      }
      if (lastMatchGoals === 0 && lastMatchTurns >= 3) {
        powerScore -= 30; // penalize 0-goal completion
      }

      return {
        player_id: p.player_id,
        display_name: p.display_name,
        ovr: p.ovr || (lastMatch ? lastMatch.ovr : 125),
        lastMatchGoals,
        lastMatchTurns,
        avgGoals: Math.round(avgGoals),
        totalGoals,
        totalMatches,
        failStreak,
        powerScore
      };
    }).sort((a, b) => b.powerScore - a.powerScore);
  },

  generateMessageText(size = this.currentSize) {
    const ranked = this.getRankedPlayers().slice(0, size);
    const dDivider = '----------------------------\n----------------------------';

    const pLines = ranked.map((p, idx) => {
      const gText = p.lastMatchGoals !== null ? `${p.lastMatchGoals}G` : `${p.avgGoals}G`;
      return `[ ${idx + 1} | ${p.display_name} | ${gText} ]`;
    }).join('\n');

    const ruHeader = `⭐ БРАТВА: СОСТАВ НА ТУРНИР (ТОП ${size}) ⭐\n${pLines}\n⚡ Заходим и забираем победу!`;
    const enHeader = `⭐ БРАТВА: TOURNAMENT ROSTER (TOP ${size}) ⭐\n${pLines}\n⚡ Jump in for the victory!`;

    return `${ruHeader}\n${dDivider}\n${enHeader}`;
  },

  render() {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('lineup-roster-container');
    if (!container) return;

    const ranked = this.getRankedPlayers().slice(0, this.currentSize);
    if (ranked.length === 0) {
      container.innerHTML = '<div style="color:var(--ucl-slate); padding:10px;">Loading player statistics...</div>';
      return;
    }

    container.innerHTML = ranked.map((p, idx) => {
      const isTop3 = idx < 3;
      const badgeClass = isTop3 ? 'top-3' : '';
      const recentGoalsStr = p.lastMatchGoals !== null ? `Last: ${p.lastMatchGoals}G` : 'No recent';
      const statusBadge = p.failStreak > 0
        ? '<span class="badge badge-loss" style="font-size:0.7rem;">DEBTOR</span>'
        : (isTop3
            ? '<span class="badge badge-gold" style="font-size:0.7rem;">MVP STARTER</span>'
            : (idx < 8
                ? '<span class="badge badge-win" style="font-size:0.7rem;">TOP 8 STARTER</span>'
                : '<span class="badge badge-live" style="font-size:0.7rem;">ROSTER</span>'));

      return `
        <div class="lineup-player-row">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="lineup-rank-badge ${badgeClass}">#${idx + 1}</div>
            <div>
              <div style="font-weight: 800; font-size: 0.95rem; color: #fff;">${escapeHTML(p.display_name)}</div>
              <div style="font-size: 0.75rem; color: var(--ucl-slate); margin-top: 1px;">
                OVR ${p.ovr} &bull; Avg ${p.avgGoals}G &bull; ${recentGoalsStr}
              </div>
            </div>
          </div>
          <div>${statusBadge}</div>
        </div>
      `;
    }).join('');
  },

  copyLineup(btn) {
    SoundManager.playClick();
    const text = this.generateMessageText();
    navigator.clipboard.writeText(text).then(() => {
      const oldHtml = btn.innerHTML;
      btn.innerHTML = `<span style="font-weight: 800; color: #00e676;">✓ COPIED TOP ${this.currentSize} ROSTER!</span>`;
      setTimeout(() => { btn.innerHTML = oldHtml; }, 2500);
    }).catch(() => {
      alert('Failed to copy to clipboard!');
    });
  }
};

if (typeof window !== "undefined") { window.LineupAdvisor = LineupAdvisor; }
