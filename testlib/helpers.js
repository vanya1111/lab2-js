'use strict';

const { ALPHABETS } = require('../src/alphabets');

/** Детермінований генератор (mulberry32): прогін відтворюваний за seed. */
function createRandom(seed) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (maxExclusive) => Math.floor(next() * maxExclusive);
  const pick = (items) => items[int(items.length)];
  return { next, int, pick };
}

const NEUTRAL = [' ', ' ', '\n', ',', '.', '!', '-', '3', '7', '9', "'", '—', ':', 'Ы', 'q'];

/** Ключове слово: 1..12 символів квадрата, обов'язково з літерою. */
function randomKeyword(random, lang) {
  const alphabet = ALPHABETS[lang];
  const length = 1 + random.int(12);
  const chars = [random.pick(alphabet.letters)];
  for (let i = 1; i < length; i += 1) chars.push(random.pick(alphabet.squareBase));
  return chars.join('');
}

/** Цифровий ключ: 1..12 цифр, принаймні одна ненульова. */
function randomDigitKey(random) {
  const length = 1 + random.int(12);
  const digits = Array.from({ length }, () => String(random.int(10)));
  digits[random.int(length)] = String(1 + random.int(9));
  return digits.join('');
}

/** Вільний текст: літери вибраного алфавіту та сторонні символи. */
function randomFreeText(random, lang, maxLength = 60) {
  const letters = ALPHABETS[lang].letters;
  const length = random.int(maxLength + 1);
  let out = '';
  for (let i = 0; i < length; i += 1) out += random.int(4) === 0 ? random.pick(NEUTRAL) : random.pick(letters);
  return out;
}

/** Суворий текст: лише символи квадрата (без пробілів). */
function randomStrictText(random, lang, maxLength = 60) {
  const base = ALPHABETS[lang].squareBase;
  const length = random.int(maxLength + 1);
  return Array.from({ length }, () => random.pick(base)).join('');
}

/** Десять повідомлень для режимів, що зберігають сторонні символи. */
const FREE_MESSAGES = {
  uk: [
    'СЛАВА УКРАЇНІ',
    'Привіт, світе!',
    'Ґанок, Єнот, Їжак, Іграшка',
    'Тест 1: 2026 рік; (дужки) і «лапки».',
    'А',
    'ЯЯЯЯЯЯЯЯЯЯ',
    'Рядок перший\nрядок другий\r\nрядок третій\n',
    "Солов'їна пісня, м’ята, ʼ",
    'Змішаний text with Latin, 0123456789 та Ы Э Ё',
    'абвгґдеєжзиіїйклмнопрстуфхцчшщьюя 012',
  ],
  lat: [
    'HELLO WORLD',
    'Hello, World!',
    'A Z a z',
    'Test 1: 2026 year; (brackets) and "quotes".',
    'Z',
    'AAAAAAAAAA',
    'First line\nsecond line\r\nthird line\n',
    "It's a cipher — not a secret.",
    'Mixed текст with Ґ Є І Ї, 0123456789',
    'abcdefghijklmnopqrstuvwxyz 0123456789',
  ],
};

/** Десять повідомлень для строгого координатного режиму (лише символи квадрата). */
const STRICT_MESSAGES = {
  uk: ['СЛАВА', 'Слава', 'ҐЄІЇ', 'А', 'Я', 'ЬЮЯ012', 'АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯ', '012', 'ґєії', 'ЯЯЯЯЯЯЯЯЯЯЯЯ'],
  lat: ['HELLO', 'hello', 'AZ', 'A', 'Z', 'XYZ0123456789', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '0123456789', 'a1b2c3', 'ZZZZZZZZZZZZ'],
};

module.exports = { createRandom, randomKeyword, randomDigitKey, randomFreeText, randomStrictText, FREE_MESSAGES, STRICT_MESSAGES };
