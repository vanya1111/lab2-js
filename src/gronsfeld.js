'use strict';

const { CipherError } = require('./errors');
const { getAlphabet } = require('./alphabets');
const { describeChar, normalizeText } = require('./text');

const mod = (value, m) => ((value % m) + m) % m;

/**
 * Ключ — рядок цифр: так зберігаються початкові нулі (число 007 стало б 7).
 * Повертає масив цифр.
 */
function validateKey(key) {
  if (typeof key === 'number') {
    throw new CipherError('Цифровий ключ має бути рядком, а не числом: початкові нулі інакше втрачаються.');
  }
  if (typeof key !== 'string') {
    throw new CipherError('Цифровий ключ не задано.');
  }
  if (key.length === 0) {
    throw new CipherError('Цифровий ключ порожній.');
  }
  Array.from(key).forEach((ch, i) => {
    if (ch < '0' || ch > '9') {
      throw new CipherError(`Цифровий ключ містить нецифровий символ ${describeChar(ch)} на позиції ${i + 1}.`);
    }
  });
  const digits = Array.from(key, Number);
  if (digits.every((d) => d === 0)) {
    throw new CipherError('Цифровий ключ не може складатися лише з нулів.');
  }
  return digits;
}

/** direction: +1 — зашифрування, -1 — розшифрування. Ключ просувається лише на літерах алфавіту. */
function shiftText(text, lang, key, direction) {
  const alphabet = getAlphabet(lang);
  const digits = validateKey(key);
  const normalized = normalizeText(text);
  const m = alphabet.letters.length;
  let keyPosition = 0;
  return Array.from(normalized)
    .map((ch) => {
      const index = alphabet.letterIndex.get(ch);
      if (index === undefined) return ch; // сторонні символи не змінюються й не споживають цифру
      const digit = digits[keyPosition % digits.length];
      keyPosition += 1;
      return alphabet.letters[mod(index + direction * digit, m)];
    })
    .join('');
}

const encrypt = (text, lang, key) => shiftText(text, lang, key, +1);
const decrypt = (text, lang, key) => shiftText(text, lang, key, -1);

module.exports = { validateKey, encrypt, decrypt, mod };
