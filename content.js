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

let realtimeEnabled = false;

/**
 * Trigger keys: Space, Enter, and punctuation.
 * We use e.key (not keyCode) for modern browsers.
 */
const TRIGGER_KEYS = new Set([
  ' ', 'Enter',
  '.', ',', '?', '!', ';', ':',
  '،', '؟', '؛'
]);

function isWordBoundary(ch) {
  return (
    ch === undefined ||
    /\s/.test(ch) ||
    /[.,!?;:،؛؟"'\]\[(){}<>/\-\\|+=_*&^%$#@~`]/.test(ch)
  );
}

function isLastInWord(chars, index) {
  const nextChar = chars[index + 1];
  return isWordBoundary(nextChar);
}

function replaceChar(ch, isLast) {
  if (isLast && NO_REPLACE_AT_END.has(ch)) return ch;
  return REPLACEMENTS[ch] || ch;
}

function replaceArabicLetters(text) {
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (/\s/.test(ch)) continue;
    chars[i] = replaceChar(ch, isLastInWord(chars, i));
  }
  return chars.join('');
}

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

/**
 * Replace the word immediately BEFORE the caret in a text field.
 * This runs on keydown BEFORE the trigger char is inserted (space/punct/enter).
 */
function replacePreviousWordInTextField(el) {
  const start = el.selectionStart;
  const end = el.selectionEnd;

  // Only when caret is collapsed
  if (start == null || end == null || start !== end) return;

  const value = el.value;
  const caret = start;
  if (caret === 0) return;

  let i = caret - 1;

  // If previous character is already a boundary, do nothing
  if (isWordBoundary(value[i])) return;

  // Move left to find start of word
  while (i >= 0 && !isWordBoundary(value[i])) i--;
  const wordStart = i + 1;
  const wordEnd = caret; // exclusive

  const word = value.slice(wordStart, wordEnd);
  if (!word) return;

  const replaced = replaceArabicLetters(word);
  if (replaced === word) return;

  el.value = value.slice(0, wordStart) + replaced + value.slice(wordEnd);

  // Caret stays same index (replacements are 1 char -> 1 char)
  el.selectionStart = caret;
  el.selectionEnd = caret;

  el.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Contenteditable: handle the common case where caret is in a TEXT_NODE.
 * Works in many editors, but not all complex ones (e.g. Google Docs).
 */
function replacePreviousWordInContentEditable() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  const range = sel.getRangeAt(0);
  if (!range.collapsed) return;

  const node = range.startContainer;
  if (!node || node.nodeType !== Node.TEXT_NODE) return;

  const text = node.nodeValue || '';
  const caret = range.startOffset;
  if (caret === 0) return;

  let i = caret - 1;
  if (isWordBoundary(text[i])) return;

  while (i >= 0 && !isWordBoundary(text[i])) i--;
  const wordStart = i + 1;
  const wordEnd = caret;

  const word = text.slice(wordStart, wordEnd);
  if (!word) return;

  const replaced = replaceArabicLetters(word);
  if (replaced === word) return;

  node.nodeValue = text.slice(0, wordStart) + replaced + text.slice(wordEnd);

  // Restore caret
  const newRange = document.createRange();
  newRange.setStart(node, caret);
  newRange.collapse(true);
  sel.removeAllRanges();
  sel.addRange(newRange);
}

function onKeyDown(e) {
  if (!realtimeEnabled) return;

  // Don’t interfere with shortcuts or special combos
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  // Avoid IME composition issues
  if (e.isComposing) return;

  // Only trigger on our defined keys
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
    // Never break typing
  }
}

// Initial load
(async () => {
  const { realtimeEnabled: enabled } = await chrome.storage.sync.get({ realtimeEnabled: false });
  realtimeEnabled = enabled;
})();

// Toggle sync from popup
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.action === 'setRealtimeEnabled') {
    realtimeEnabled = !!msg.value;
  }
});

// Capture phase so we act early
document.addEventListener('keydown', onKeyDown, true);