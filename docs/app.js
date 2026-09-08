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

  // Initialize Dynamic Rules Manager (synced with Telegram Bot)
  RulesManager.init();

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
   RULES ENGINE (Synced Live with Telegram Bot /setrules via rules.json)
   ========================================================================== */
const RulesManager = {
  defaultRules: {
    maxMissesKick: 3,
    minTurnsPerTournament: 3,
    minGoalsPerTournament: 20,
    evaluationHorizon: 3
  },

  currentRules: null,

  recalculateSystem(shouldRender = true) {
    if (shouldRender) {
      if (typeof renderDashboard === 'function') renderDashboard();
      if (typeof renderTournaments === 'function') renderTournaments();
      if (typeof renderRoster === 'function') renderRoster();
      if (typeof renderLeaderboard === 'function') renderLeaderboard();
    }
  },

  render() {},

  init() {
    this.loadRules();
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

    this.currentRules = { ...this.defaultRules };
  }
};


if (typeof window !== 'undefined') {
  window.setLanguage = setLanguage;
  window.state = state;
  window.RulesManager = RulesManager;
}
