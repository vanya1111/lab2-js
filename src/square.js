'use strict';

const { CipherError } = require('./errors');
const { getAlphabet } = require('./alphabets');
const { describeChar, normalizeText } = require('./text');

const SIZE = 6;
const CELLS = SIZE * SIZE;

/** Повтори вилучаються зі збереженням першої появи. */
function uniqueInOrder(symbols) {
  const seen = new Set();
  const result = [];
  for (const symbol of symbols) {
    if (!seen.has(symbol)) {
      seen.add(symbol);
      result.push(symbol);
    }
  }
  return result;
}

/** Нормалізує й перевіряє ключове слово за вибраним набором. */
function prepareKeyword(keyword, alphabet) {
  const normalized = normalizeText(keyword, 'Ключове слово').trim();
  if (normalized.length === 0) {
    throw new CipherError('Ключове слово порожнє.');
  }
  const chars = Array.from(normalized);
  chars.forEach((ch, i) => {
    if (!alphabet.squareBaseSet.has(ch)) {
      throw new CipherError(
        `Ключове слово містить символ ${describeChar(ch)} на позиції ${i + 1}, якого немає в квадраті (${alphabet.id}).`
      );
    }
  });
  if (!chars.some((ch) => alphabet.letterIndex.has(ch))) {
    throw new CipherError('Ключове слово має містити щонайменше одну літеру.');
  }
  return chars;
}

/** Квадрат: рівно 36 унікальних символів базового набору. */
function validateSquare(sequence, lang) {
  const alphabet = getAlphabet(lang);
  const symbols = Array.from(sequence);
  if (symbols.length !== CELLS) {
    throw new CipherError(`Квадрат має містити рівно ${CELLS} символів, а містить ${symbols.length}.`);
  }
  const seen = new Set();
  symbols.forEach((symbol, i) => {
    if (!alphabet.squareBaseSet.has(symbol)) {
      throw new CipherError(`Символ ${describeChar(symbol)} (позиція ${i + 1}) не належить базовому набору (${alphabet.id}).`);
    }
    if (seen.has(symbol)) {
      throw new CipherError(`Символ «${symbol}» повторюється в квадраті (позиція ${i + 1}).`);
    }
    seen.add(symbol);
  });
  return symbols;
}

/** Будує квадрат і одразу готує всі таблиці пошуку (один раз). */
function createSquare(lang, sequence) {
  const symbols = validateSquare(sequence, lang);
  const toCoord = new Map(); // символ → «рядок+стовпець», напр. «44»
  const fromCoord = new Map(); // «44» → символ
  const down = new Map(); // символ → символ із наступного рядка (циклічно)
  const up = new Map(); // символ → символ із попереднього рядка (циклічно)
  symbols.forEach((symbol, i) => {
    const coord = `${Math.floor(i / SIZE) + 1}${(i % SIZE) + 1}`;
    toCoord.set(symbol, coord);
    fromCoord.set(coord, symbol);
    down.set(symbol, symbols[(i + SIZE) % CELLS]);
    up.set(symbol, symbols[(i + CELLS - SIZE) % CELLS]);
  });
  const rows = Array.from({ length: SIZE }, (_, r) => symbols.slice(r * SIZE, (r + 1) * SIZE));
  return Object.freeze({ lang, symbols, rows, toCoord, fromCoord, down, up });
}

/** Ключове слово → унікальні символи ключа + решта базового набору. */
function buildSquare(lang, keyword) {
  const alphabet = getAlphabet(lang);
  const keyChars = uniqueInOrder(prepareKeyword(keyword, alphabet));
  const used = new Set(keyChars);
  const rest = alphabet.squareBase.filter((symbol) => !used.has(symbol));
  return createSquare(lang, keyChars.concat(rest));
}

/** Текстове подання квадрата для виведення в консоль. */
function formatSquare(square) {
  const header = ['Рядок\\Стовпець', ...Array.from({ length: SIZE }, (_, i) => String(i + 1))].join(' ');
  const lines = square.rows.map((row, r) => `${String(r + 1).padEnd(14)}${row.join(' ')}`);
  return [header, ...lines].join('\n');
}

module.exports = { SIZE, CELLS, buildSquare, createSquare, validateSquare, formatSquare, uniqueInOrder };
