'use strict';

const { CipherError } = require('./errors');

const UK_LETTERS = 'АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯ'; // 33
const LAT_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; // 26

function define(id, title, letters, extraSymbols) {
  const letterList = Array.from(letters);
  const squareBase = letterList.concat(Array.from(extraSymbols)); // 36 символів
  return Object.freeze({
    id,
    title,
    letters: letterList,
    letterIndex: new Map(letterList.map((letter, i) => [letter, i])),
    squareBase,
    squareBaseSet: new Set(squareBase),
  });
}

const ALPHABETS = Object.freeze({
  uk: define('uk', 'український', UK_LETTERS, '012'),
  lat: define('lat', 'латинський', LAT_LETTERS, '0123456789'),
});

/** Алфавіт обирається явно; автоматичного визначення мови немає. */
function getAlphabet(lang) {
  if (typeof lang !== 'string' || !Object.hasOwn(ALPHABETS, lang)) {
    const shown = lang === undefined || lang === null ? 'не вказано' : `«${lang}»`;
    throw new CipherError(
      `Алфавіт ${shown}. Оберіть явно: ${Object.keys(ALPHABETS).join(' або ')} (автоматичне визначення мови не допускається).`
    );
  }
  return ALPHABETS[lang];
}

module.exports = { ALPHABETS, UK_LETTERS, LAT_LETTERS, getAlphabet };
