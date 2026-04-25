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

// ── Level 2: tatweel between connected pairs ──────────────────────────────
const NON_CONNECTING = new Set([
  'ا', 'أ', 'إ', 'آ', 'ٱ',
  'و', 'ؤ',
  'ر', 'ز',
  'د', 'ذ',
  'ة', 'ى',
]);

const TATWEEL = 'ـ';

function isArabicLetter(ch) {
  const c = ch.codePointAt(0);
  return c >= 0x0600 && c <= 0x06FF;
}

// ── State ─────────────────────────────────────────────────────────────────
let realtimeEnabled = false;
let currentLevel    = 1;

const TRIGGER_KEYS = new Set([
  ' ', 'Enter',
  '.', ',', '?', '!', ';', ':',
  '،', '؟', '؛',
]);

// ── Core helpers ──────────────────────────────────────────────────────────
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

function applyLevel1(text) {
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i++) {
    if (/\s/.test(chars[i])) continue;
    chars[i] = replaceChar(chars[i], isLastInWord(chars, i));
  }
  return chars.join('');
}

// Inserts ـ randomly between connecting Arabic letter pairs
function applyTatweel(text) {
  const chars = Array.from(text);
  const result = [];
  for (let i = 0; i < chars.length; i++) {
    result.push(chars[i]);
    const next = chars[i + 1];
    if (
      next &&
      isArabicLetter(chars[i]) &&
      !NON_CONNECTING.has(chars[i]) &&
      isArabicLetter(next) &&
      Math.random() < 0.5
    ) {
      const count = Math.floor(Math.random() * 3) + 1;
      for (let j = 0; j < count; j++) result.push(TATWEEL);
    }
  }
  return result.join('');
}

function processWord(word) {
  let out = applyLevel1(word);
  if (currentLevel === 2) out = applyTatweel(out);
  return out;
}

// ── Editable element detection ────────────────────────────────────────────
function isEditableElement(el) {
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName?.toLowerCase();
  if (tag === 'textarea') return true;
  if (tag === 'input') {
    const allowed = ['text', 'search', 'email', 'url', 'tel', 'password'];
    return allowed.includes((el.type || 'text').toLowerCase());
  }
  return false;
}

// ── Replace in <textarea> / <input> ──────────────────────────────────────
function replacePreviousWordInTextField(el) {
  const start = el.selectionStart;
  const end   = el.selectionEnd;
  if (start == null || end == null || start !== end) return;

  const value = el.value;
  const caret = start;
  if (caret === 0) return;

  let i = caret - 1;
  if (isWordBoundary(value[i])) return;
  while (i >= 0 && !isWordBoundary(value[i])) i--;
  const wordStart = i + 1;
  const wordEnd   = caret;

  const word = value.slice(wordStart, wordEnd);
  if (!word) return;

  const replaced = processWord(word);
  if (replaced === word) return;

  const caretShift = replaced.length - word.length;
  el.value = value.slice(0, wordStart) + replaced + value.slice(wordEnd);
  el.selectionStart = caret + caretShift;
  el.selectionEnd   = caret + caretShift;

  el.dispatchEvent(new Event('input', { bubbles: true }));
}

// ── Replace in contenteditable ────────────────────────────────────────────
function replacePreviousWordInContentEditable() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  const range = sel.getRangeAt(0);
  if (!range.collapsed) return;

  const node = range.startContainer;
  if (!node || node.nodeType !== Node.TEXT_NODE) return;

  const text  = node.nodeValue || '';
  const caret = range.startOffset;
  if (caret === 0) return;

  let i = caret - 1;
  if (isWordBoundary(text[i])) return;
  while (i >= 0 && !isWordBoundary(text[i])) i--;
  const wordStart = i + 1;
  const wordEnd   = caret;

  const word = text.slice(wordStart, wordEnd);
  if (!word) return;

  const replaced = processWord(word);
  if (replaced === word) return;

  const caretShift = replaced.length - word.length;
  node.nodeValue = text.slice(0, wordStart) + replaced + text.slice(wordEnd);

  const newRange = document.createRange();
  newRange.setStart(node, caret + caretShift);
  newRange.collapse(true);
  sel.removeAllRanges();
  sel.addRange(newRange);
}

// ── Keydown handler ───────────────────────────────────────────────────────
function onKeyDown(e) {
  if (!realtimeEnabled) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.isComposing) return;
  if (!TRIGGER_KEYS.has(e.key)) return;

  const el = document.activeElement;
  if (!isEditableElement(el)) return;

  try {
    if (el.isContentEditable) {
      replacePreviousWordInContentEditable();
    } else {
      replacePreviousWordInTextField(el);
    }
  } catch {
    // Never break user typing
  }
}

// ── Init ──────────────────────────────────────────────────────────────────
(async () => {
  const data = await chrome.storage.sync.get({ realtimeEnabled: false, level: 1 });
  realtimeEnabled = data.realtimeEnabled;
  currentLevel    = data.level;
})();

// ── Message listener (from popup) ─────────────────────────────────────────
chrome.runtime.onMessage.addListener(msg => {
  if (msg?.action === 'setRealtimeEnabled') realtimeEnabled = !!msg.value;
  if (msg?.action === 'setLevel')           currentLevel    = msg.value || 1;
});

document.addEventListener('keydown', onKeyDown, true);
