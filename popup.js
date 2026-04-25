// ---------- Rules ----------
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
  let changes = 0;

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (/\s/.test(ch)) continue;

    const rep = replaceChar(ch, isLastInWord(chars, i));
    if (rep !== ch) changes++;
    chars[i] = rep;
  }

  return { text: chars.join(''), changes };
}

// ---------- UI ----------
const inputText = document.getElementById('inputText');
const outputText = document.getElementById('outputText');
const changesLabel = document.getElementById('changesLabel');
const copyStatus = document.getElementById('copyStatus');

const toggleRealtime = document.getElementById('toggleRealtime');
const statusText = document.getElementById('statusText');
const statusDot = document.getElementById('statusDot');

function setRealtimeUI(isOn) {
  statusText.textContent = `Real-time: ${isOn ? 'ON' : 'OFF'}`;
  statusDot.classList.toggle('on', isOn);
  statusDot.classList.toggle('off', !isOn);
  toggleRealtime.checked = isOn;
}

async function getEnabled() {
  const { realtimeEnabled } = await chrome.storage.sync.get({ realtimeEnabled: false });
  return realtimeEnabled;
}

async function setEnabled(value) {
  await chrome.storage.sync.set({ realtimeEnabled: value });
}

async function notifyActiveTab(value) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  chrome.tabs.sendMessage(tab.id, { action: 'setRealtimeEnabled', value });
}

// Load saved state
(async () => {
  setRealtimeUI(await getEnabled());
})();

toggleRealtime.addEventListener('change', async () => {
  const enabled = toggleRealtime.checked;
  setRealtimeUI(enabled);
  await setEnabled(enabled);
  await notifyActiveTab(enabled);
});

// Convert
document.getElementById('convertBtn').addEventListener('click', () => {
  const result = replaceArabicLetters(inputText.value);
  outputText.value = result.text;
  changesLabel.textContent = `Changes: ${result.changes}`;
  copyStatus.textContent = '';
});

// Copy output
document.getElementById('copyBtn').addEventListener('click', async () => {
  copyStatus.textContent = '';
  try {
    await navigator.clipboard.writeText(outputText.value || '');
    copyStatus.textContent = 'Copied ✓';
  } catch {
    copyStatus.textContent = 'Copy failed';
  }
});

// Swap
document.getElementById('swapBtn').addEventListener('click', () => {
  const a = inputText.value;
  inputText.value = outputText.value;
  outputText.value = a;
  changesLabel.textContent = 'Changes: 0';
  copyStatus.textContent = '';
});

// Clear
document.getElementById('clearBtn').addEventListener('click', () => {
  inputText.value = '';
  outputText.value = '';
  changesLabel.textContent = 'Changes: 0';
  copyStatus.textContent = '';
});

// Open site (don’t hard-navigate popup; open new tab)
document.getElementById('openSite').addEventListener('click', async (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'https://www.cyberhubjo.com' });
});