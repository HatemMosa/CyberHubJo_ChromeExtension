// ── Replacement rules (Level 1) ───────────────────────────────────────────
const REPLACEMENTS = {
  'ج': 'ح',
  'ة': 'ه',
  'ن': 'ى',
  'ت': 'ى',
  'ث': 'ى',
  'غ': 'ع',
  'خ': 'ح',
  'ظ': 'ط',
  'ب': 'ى',
  'ي': 'ى',
  'ش': 'س',
  'ز': 'ر',
  'ض': 'ص',
  'ذ': 'د',
};

const NO_REPLACE_AT_END = new Set(['ب', 'ت', 'ث', 'ن']);

// ── Level 2: connected Arabic letters ────────────────────────────────────
// Letters that do NOT connect to the following letter (right-joining only)
const NON_CONNECTING = new Set([
  'ا', // ا  alef
  'أ', // أ  alef + hamza above
  'إ', // إ  alef + hamza below
  'آ', // آ  alef + madda
  'ٱ', // ٱ  alef wasla
  'و', // و  waw
  'ؤ', // ؤ  waw + hamza
  'ر', // ر  ra
  'ز', // ز  zay
  'د', // د  dal
  'ذ', // ذ  dhal
  'ة', // ة  ta marbuta
  'ى', // ى  alef maqsura
]);

const TATWEEL = 'ـ'; // ـ

function isArabicLetter(ch) {
  const c = ch.codePointAt(0);
  return c >= 0x0600 && c <= 0x06FF;
}

// ── Core text processing ──────────────────────────────────────────────────
function isWordBoundary(ch) {
  return (
    ch === undefined ||
    /\s/.test(ch) ||
    /[.,!?;:،؛؟"'\]\[(){}<>/\-\\|+=_*&^%$#@~`]/.test(ch)
  );
}

function isLastInWord(chars, index) {
  return isWordBoundary(chars[index + 1]);
}

function replaceChar(ch, isLast) {
  if (isLast && NO_REPLACE_AT_END.has(ch)) return ch;
  return REPLACEMENTS[ch] || ch;
}

// Returns { text, changes }
function applyLevel1(text) {
  const chars = Array.from(text);
  let changes = 0;
  for (let i = 0; i < chars.length; i++) {
    if (/\s/.test(chars[i])) continue;
    const rep = replaceChar(chars[i], isLastInWord(chars, i));
    if (rep !== chars[i]) { chars[i] = rep; changes++; }
  }
  return { text: chars.join(''), changes };
}

// Returns { text, tatweels } — inserts ـ randomly between connecting pairs
function applyTatweel(text) {
  const chars = Array.from(text);
  const result = [];
  let tatweels = 0;
  for (let i = 0; i < chars.length; i++) {
    result.push(chars[i]);
    const curr = chars[i];
    const next = chars[i + 1];
    if (
      next &&
      isArabicLetter(curr) &&
      !NON_CONNECTING.has(curr) &&
      isArabicLetter(next) &&
      Math.random() < 0.5
    ) {
      const count = Math.floor(Math.random() * 3) + 1;
      for (let j = 0; j < count; j++) result.push(TATWEEL);
      tatweels += count;
    }
  }
  return { text: result.join(''), tatweels };
}

// Master process: apply the chosen level
function processText(text, level) {
  const l1 = applyLevel1(text);
  if (level === 1) return { text: l1.text, changes: l1.changes, tatweels: 0 };
  const l2 = applyTatweel(l1.text);
  return { text: l2.text, changes: l1.changes, tatweels: l2.tatweels };
}

// ── Arabic numeral formatting ─────────────────────────────────────────────
function toArabicNumerals(n) {
  return String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
}

function charLabel(n) {
  return `${toArabicNumerals(n)} حرف`;
}

// ── State ─────────────────────────────────────────────────────────────────
let currentLevel = 1;

// ── DOM refs ──────────────────────────────────────────────────────────────
const realtimeToggle = document.getElementById('realtimeToggle');
const statusPill     = document.getElementById('statusPill');
const levelDesc      = document.getElementById('levelDesc');
const inputText      = document.getElementById('inputText');
const outputText     = document.getElementById('outputText');
const inputCount     = document.getElementById('inputCount');
const outputCount    = document.getElementById('outputCount');
const statsBar       = document.getElementById('statsBar');
const statsText      = document.getElementById('statsText');
const toast          = document.getElementById('toast');

// ── Helpers ───────────────────────────────────────────────────────────────
function setRealtimeUI(on) {
  realtimeToggle.checked = on;
  statusPill.textContent = on ? 'مفعرل' : 'معطرل';
  statusPill.className   = `status-pill ${on ? 'on' : 'off'}`;
}

const LEVEL_DESCS = {
  1: '<span class="level-badge">مستوى ١</span>استبدال الحروف العربية المتشابهة صوتاً وشكلاً بحروف موحّدة وفق قواعد التجريد.',
  2: '<span class="level-badge">مستوى ٢</span>تجريد المستوى الأول مى إضافة مدّة (ـ) عشوائية بين الحروف المتصلة بعضها ببعض.',
};

function setLevel(level) {
  currentLevel = level;
  document.querySelectorAll('.level-tab').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.level) === level);
  });
  levelDesc.innerHTML = LEVEL_DESCS[level];
}

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

function resetOutput() {
  outputText.value = '';
  outputCount.textContent = charLabel(0);
  statsBar.classList.remove('show');
}

// ── Load saved settings ───────────────────────────────────────────────────
(async () => {
  const data = await chrome.storage.sync.get({ realtimeEnabled: false, level: 1 });
  setRealtimeUI(data.realtimeEnabled);
  setLevel(data.level);
})();

// ── Real-time toggle ──────────────────────────────────────────────────────
realtimeToggle.addEventListener('change', async () => {
  const enabled = realtimeToggle.checked;
  setRealtimeUI(enabled);
  await chrome.storage.sync.set({ realtimeEnabled: enabled });
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) chrome.tabs.sendMessage(tab.id, { action: 'setRealtimeEnabled', value: enabled });
});

// ── Level tabs ────────────────────────────────────────────────────────────
document.querySelectorAll('.level-tab').forEach(btn => {
  btn.addEventListener('click', async () => {
    const level = Number(btn.dataset.level);
    setLevel(level);
    resetOutput();
    await chrome.storage.sync.set({ level });
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) chrome.tabs.sendMessage(tab.id, { action: 'setLevel', value: level });
  });
});

// ── Character counters ────────────────────────────────────────────────────
inputText.addEventListener('input', () => {
  inputCount.textContent = charLabel(Array.from(inputText.value).length);
});

// ── Convert ───────────────────────────────────────────────────────────────
function doConvert() {
  const raw = inputText.value;
  if (!raw.trim()) return;

  const result = processText(raw, currentLevel);
  outputText.value = result.text;
  outputCount.textContent = charLabel(Array.from(result.text).length);

  // Stats
  const parts = [];
  if (result.changes > 0)
    parts.push(`تم استبدال ${toArabicNumerals(result.changes)} حرف`);
  else
    parts.push('لا توجد استبدالات');

  if (currentLevel === 2 && result.tatweels > 0)
    parts.push(`أُضيف ${toArabicNumerals(result.tatweels)} تطويل`);

  statsText.textContent = parts.join(' • ');
  statsBar.classList.add('show');
}

document.getElementById('convertBtn').addEventListener('click', doConvert);

// Ctrl+Enter keyboard shortcut
inputText.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    doConvert();
  }
});

// ── Copy ──────────────────────────────────────────────────────────────────
document.getElementById('copyBtn').addEventListener('click', async () => {
  const val = outputText.value;
  if (!val) return;
  try {
    await navigator.clipboard.writeText(val);
    showToast('تم النسخ ✓');
  } catch {
    showToast('فشل النسخ');
  }
});

// ── Swap ──────────────────────────────────────────────────────────────────
document.getElementById('swapBtn').addEventListener('click', () => {
  const tmp = inputText.value;
  inputText.value  = outputText.value;
  outputText.value = tmp;
  inputCount.textContent  = charLabel(Array.from(inputText.value).length);
  outputCount.textContent = charLabel(Array.from(outputText.value).length);
  statsBar.classList.remove('show');
});

// ── Clear ─────────────────────────────────────────────────────────────────
document.getElementById('clearBtn').addEventListener('click', () => {
  inputText.value = '';
  inputCount.textContent = charLabel(0);
  resetOutput();
});

// ── Footer link ───────────────────────────────────────────────────────────
document.getElementById('websiteLink').addEventListener('click', async e => {
  e.preventDefault();
  chrome.tabs.create({ url: 'https://www.cyberhubjo.com' });
});
