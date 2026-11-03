'use strict';

const { CipherError } = require('./errors');
const { describeChar, quote, normalizeText } = require('./text');

const TOKEN_PATTERN = /^[1-6]{2}$/;

/** Режим coordinates (strict): лише символи квадрата, токени «рядок стовпець» через пробіл. */
function encryptCoordinates(text, square) {
  const normalized = normalizeText(text);
  const tokens = [];
  let position = 0;
  for (const ch of normalized) {
    position += 1;
    const coord = square.toCoord.get(ch);
    if (coord === undefined) {
      throw new CipherError(
        `Символ ${describeChar(ch)} на позиції ${position} відсутній у квадраті (${square.lang}). ` +
          'Режим strict приймає лише символи квадрата; пробіли можна вилучити окремою операцією (--strip-spaces).'
      );
    }
    tokens.push(coord);
  }
  return tokens.join(' ');
}

/** Суворий розбір: токени розділені рівно одним пробілом, кожен — дві цифри 1..6. */
function parseCoordinateTokens(cipherText) {
  if (typeof cipherText !== 'string') {
    throw new CipherError('Шифротекст має бути рядком.');
  }
  if (cipherText === '') return [];
  const tokens = cipherText.split(' ');
  tokens.forEach((token, i) => {
    if (token === '') {
      throw new CipherError(`Токен ${i + 1} порожній: токени мають розділятися рівно одним пробілом, без зайвих пробілів на краях.`);
    }
    if (!TOKEN_PATTERN.test(token)) {
      throw new CipherError(`Токен ${i + 1} ${quote(token)} некоректний: потрібні дві цифри від 1 до 6 (рядок і стовпець).`);
    }
  });
  return tokens;
}

function decryptCoordinates(cipherText, square) {
  return parseCoordinateTokens(cipherText)
    .map((token) => square.fromCoord.get(token))
    .join('');
}

/** direction +1: у наступний рядок того самого стовпця, -1: у попередній. Інші символи лишаються. */
function shiftRows(text, square, direction) {
  const table = direction > 0 ? square.down : square.up;
  return Array.from(normalizeText(text))
    .map((ch) => table.get(ch) ?? ch)
    .join('');
}

const encryptRowShift = (text, square) => shiftRows(text, square, +1);
const decryptRowShift = (text, square) => shiftRows(text, square, -1);

module.exports = { parseCoordinateTokens, encryptCoordinates, decryptCoordinates, encryptRowShift, decryptRowShift };
