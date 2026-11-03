'use strict';

const { CipherError } = require('./errors');
const { buildSquare } = require('./square');
const { stripWhitespace } = require('./text');
const polybius = require('./polybius');
const gronsfeld = require('./gronsfeld');

const MODES = Object.freeze({
  'polybius-coordinates': 'квадрат Полібія, координати (coordinates)',
  'polybius-row-shift': 'квадрат Полібія, циклічний зсув за рядками (row shift)',
  gronsfeld: 'шифр Гронсфельда',
});
const OPERATIONS = Object.freeze(['encrypt', 'decrypt']);

function requireKey(key) {
  if (key === undefined || key === null) {
    throw new CipherError('Ключ не задано.');
  }
  return key;
}

/**
 * Єдина точка входу для CLI та інтерактивного режиму.
 * Повертає { text, removed? }; removed є лише коли застосовано stripSpaces.
 */
function run({ mode, operation, lang, text, key, stripSpaces = false }) {
  if (!Object.hasOwn(MODES, mode)) {
    throw new CipherError(`Невідомий режим «${mode}». Доступні: ${Object.keys(MODES).join(', ')}.`);
  }
  if (!OPERATIONS.includes(operation)) {
    throw new CipherError(`Невідома операція «${operation}». Доступні: ${OPERATIONS.join(', ')}.`);
  }
  const encrypting = operation === 'encrypt';
  if (stripSpaces && !(mode === 'polybius-coordinates' && encrypting)) {
    throw new CipherError('Вилучення пробілів діє лише при зашифруванні в режимі polybius-coordinates.');
  }

  if (mode === 'gronsfeld') {
    return { text: encrypting ? gronsfeld.encrypt(text, lang, requireKey(key)) : gronsfeld.decrypt(text, lang, requireKey(key)) };
  }

  const square = buildSquare(lang, requireKey(key)); // ключ і мова — до обробки тексту
  if (mode === 'polybius-row-shift') {
    return { text: encrypting ? polybius.encryptRowShift(text, square) : polybius.decryptRowShift(text, square) };
  }
  if (!encrypting) {
    return { text: polybius.decryptCoordinates(text, square) };
  }
  if (!stripSpaces) {
    return { text: polybius.encryptCoordinates(text, square) };
  }
  const stripped = stripWhitespace(text);
  return { text: polybius.encryptCoordinates(stripped.text, square), removed: stripped.removed };
}

module.exports = { MODES, OPERATIONS, run };
