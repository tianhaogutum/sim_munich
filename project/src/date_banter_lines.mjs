// Ambient dialogue only: never advances the story or replaces its main dialogue.
// All times (context.now and history values) are in seconds on the same clock.
// pickLine is pure; callers record accepted lines in history by BOTH id and text.
// A Map or a plain object can be used as history. Missing entries mean never said.
export const REPEAT_WINDOW = 10 * 60;

const line = (id, text, options = {}) => Object.freeze({
  id, text, who: 'companion', weight: 1, priority: 1,
  cooldown: REPEAT_WINDOW, ...options,
});
const pool = (prefix, texts, options) => Object.freeze(texts.map((text, i) =>
  line(`${prefix}.${i}`, text, options)));

// 80 short lines, including eight optional player replies.
export const BANTER_POOLS = Object.freeze({
  idle: Object.freeze([
    line('idle.0', '在想什么呀？', { weight: 2, reply: 'idle_reply' }),
    line('idle.1', '慕尼黑的风好温柔。'),
    line('idle.2', '樱花落到肩上啦。', { reply: 'idle_reply' }),
    line('idle.3', '今天不用赶去上课。', { reply: 'idle_reply' }),
    line('idle.4', '想把这一刻多留一会。'),
    line('idle.5', '午后的主楼像幅画。', { period: 'afternoon' }),
    line('idle.6', '等会去食堂看看？', { reply: 'idle_reply' }),
    line('idle.7', '和你发呆也很开心。'),
  ]),
  morning: pool('morning', ['早安，今天也一起走。', '早课之前，先见到你。']),
  afternoon: pool('afternoon', ['下午好，阳光刚刚好。', '下午的约会开始啦。']),
  evening: pool('evening', ['傍晚好，陪我慢慢走。', '晚风吹过大学广场。']),
  running: pool('running', ['等等我！', '今天没有课要赶啦。', '跑慢点，樱花要掉啦。', '约会也算体育课吗？']),
  fountain: pool('fountain', ['喷泉替我们伴奏呢。', '水花像细小的星星。', '听，水声把钟声藏住了。', '下课后来这里坐坐吧。'], { reply: 'fountain_reply' }),
  white_rose: pool('white_rose', ['这里，我们轻声一点。', '记得朔尔兄妹的勇气。', '自由值得被认真守护。', '这些名字，不该被遗忘。']),
  road: pool('road', ['路德维希大街好热闹。', '靠里走，我陪着你。', '过街之前看好车哦。']),
  benches: pool('benches', ['长椅给我们留了位置。', '课间能这样坐着真好。', '坐一会，再去找樱花。'], { reply: 'benches_reply' }),
  facade: pool('facade', ['抬头，主楼在发光呢。', '这排廊柱好像电影里。', '以后还在这扇门前见。', '考试周也想和你来。']),
  separated: pool('separated', ['你走到哪里啦？', '回头，我在这里呀。', '别把约会对象落下啦。']),
  stage_meet: pool('stage_meet', ['你来啦，我刚好在等你。', '今天，从这扇门开始。'], { priority: 3 }),
  stage_fountain_talk: pool('stage_fountain_talk', ['一起去听喷泉吧。', '今天有好多话想说。'], { priority: 3 }),
  stage_find_memento: pool('stage_find_memento', ['我的樱花发夹不见了。', '刚刚还别在头发上的。'], { priority: 3 }),
  stage_photos: pool('stage_photos', ['接下来，存一点回忆。', '让照片记住今天吧。'], { priority: 3 }),
  stage_postcard: pool('stage_postcard', ['回我们的广场吧。', '还有一张心意想给你。'], { priority: 3 }),
  stage_done: pool('stage_done', ['下一次，也在这里见。', '今天这页，想一直留着。'], { priority: 3 }),
  photo_facade: pool('photo_facade', ['主楼也成了我们的背景。', '这张像校园电影海报。', '廊柱和阳光都拍到了。'], { priority: 4 }),
  photo_fountain: pool('photo_fountain', ['水花刚好停在半空。', '这张好像听得见水声。', '把喷泉的闪光收好了。'], { priority: 4 }),
  photo_couple: pool('photo_couple', ['我们同框啦！', '这张要放在最前面。', '你笑起来比樱花好看。'], { priority: 4 }),
  collected: pool('collected', ['找到了，谢谢你呀。', '樱花发夹回家啦。', '这次一定好好收着。'], { priority: 4 }),
  choice_0: pool('choice_0', ['那就约好，慢慢来。', '和你散步最自在了。', '普通的一天也很珍贵。'], { priority: 3 }),
  choice_1: pool('choice_1', ['被你这样说，有点心动。', '这句话我会记住哦。', '那今天就多靠近一点。'], { priority: 3 }),
  choice_2: pool('choice_2', ['好啦，被你逗笑了。', '你总有奇怪的小主意。', '有你在就不会无聊。'], { priority: 3 }),
  idle_reply: pool('idle_reply', ['在想等会和你去哪。', '今天的课题是陪你。', '那就再待一会吧。', '和你一起就很好。'], { who: 'player' }),
  fountain_reply: pool('fountain_reply', ['下次也留这个位置吧。', '水声和你都很好听。'], { who: 'player' }),
  benches_reply: pool('benches_reply', ['好，今天不用着急。', '笔记晚一点再看吧。'], { who: 'player' }),
});

function lastSaid(history, key) {
  if (!history || key == null) return -Infinity;
  const value = history instanceof Map ? history.get(key) : history[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : -Infinity;
}

function eligible(entry, context, history, now) {
  if (!entry || typeof entry.text !== 'string' || !entry.text.trim()) return false;
  if (!(Number.isFinite(entry.weight ?? 1) && (entry.weight ?? 1) > 0)) return false;
  if (entry.period && entry.period !== context.period) return false;
  if (entry.stage && entry.stage !== context.stage) return false;
  const cooldown = Math.max(REPEAT_WINDOW, Number.isFinite(entry.cooldown) ? entry.cooldown : 0);
  return now - Math.max(lastSaid(history, entry.id), lastSaid(history, entry.text)) >= cooldown;
}

/** Highest eligible priority first, then a weighted draw. Never mutates arguments.
 * context = { now: seconds, period?: 'morning'|'afternoon'|'evening', stage?: string }.
 * Returns the original line object, or null when every line is cooling down.
 * A cooldown never bypasses the ten-minute text/id deduplication floor.
 */
export function pickLine(lines, context = {}, history = new Map(), rng = Math.random) {
  if (!Array.isArray(lines) || !lines.length) return null;
  const now = Number.isFinite(context.now) ? context.now : 0;
  let best = -Infinity, weight = 0;
  for (const entry of lines) {
    if (!eligible(entry, context, history, now)) continue;
    const priority = Number.isFinite(entry.priority) ? entry.priority : 0;
    if (priority > best) { best = priority; weight = 0; }
    if (priority === best) weight += entry.weight ?? 1;
  }
  if (!(weight > 0)) return null;
  const draw = rng();
  let remaining = Math.max(0, Math.min(1 - Number.EPSILON, Number.isFinite(draw) ? draw : 0)) * weight;
  let last = null;
  for (const entry of lines) {
    const priority = Number.isFinite(entry?.priority) ? entry.priority : 0;
    if (priority !== best || !eligible(entry, context, history, now)) continue;
    last = entry;
    remaining -= entry.weight ?? 1;
    if (remaining < 0) return entry;
  }
  return last;
}
