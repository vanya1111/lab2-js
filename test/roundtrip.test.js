'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSquare } = require('../src/square');
const polybius = require('../src/polybius');
const gronsfeld = require('../src/gronsfeld');
const { normalizeText } = require('../src/text');
const { createRandom, randomKeyword, randomDigitKey, randomFreeText, randomStrictText, FREE_MESSAGES, STRICT_MESSAGES } = require('../testlib/helpers');

const KEYWORDS = { uk: 'БЕЗПЕКА', lat: 'SECURITY' };
const DIGIT_KEYS = { uk: '31415', lat: '2718' };

for (const lang of ['uk', 'lat']) {
  const square = buildSquare(lang, KEYWORDS[lang]);

  test(`зворотність: Полібій coordinates, ${lang}, 10 повідомлень`, () => {
    for (const message of STRICT_MESSAGES[lang]) {
      const cipher = polybius.encryptCoordinates(message, square);
      assert.equal(polybius.decryptCoordinates(cipher, square), normalizeText(message));
    }
  });

  test(`зворотність: Полібій row shift, ${lang}, 10 повідомлень`, () => {
    for (const message of FREE_MESSAGES[lang]) {
      const cipher = polybius.encryptRowShift(message, square);
      assert.equal(polybius.decryptRowShift(cipher, square), normalizeText(message));
    }
  });

  test(`зворотність: Гронсфельд, ${lang}, 10 повідомлень`, () => {
    for (const message of FREE_MESSAGES[lang]) {
      const cipher = gronsfeld.encrypt(message, lang, DIGIT_KEYS[lang]);
      assert.equal(gronsfeld.decrypt(cipher, lang, DIGIT_KEYS[lang]), normalizeText(message));
    }
  });
}

test('координатний шифротекст — токени по два символи, довжина = 3n − 1', () => {
  const square = buildSquare('uk', 'БЕЗПЕКА');
  for (const message of STRICT_MESSAGES.uk) {
    const cipher = polybius.encryptCoordinates(message, square);
    const n = Array.from(message).length;
    assert.equal(cipher.length, n === 0 ? 0 : 3 * n - 1);
  }
});

test('Гронсфельд і row shift не змінюють довжину тексту', () => {
  const square = buildSquare('lat', 'SECURITY');
  for (const message of FREE_MESSAGES.lat) {
    const n = Array.from(normalizeText(message)).length;
    assert.equal(Array.from(polybius.encryptRowShift(message, square)).length, n);
    assert.equal(Array.from(gronsfeld.encrypt(message, 'lat', '2718')).length, n);
  }
});

// Генеративні перевірки: фіксований seed робить прогін відтворюваним.
const CASES = 300;

for (const lang of ['uk', 'lat']) {
  test(`властивість: coordinates, ${lang}, ${CASES} випадкових ключових слів і текстів`, () => {
    const random = createRandom(lang === 'uk' ? 3001 : 3002);
    for (let i = 0; i < CASES; i += 1) {
      const square = buildSquare(lang, randomKeyword(random, lang));
      const text = randomStrictText(random, lang);
      assert.equal(polybius.decryptCoordinates(polybius.encryptCoordinates(text, square), square), normalizeText(text));
    }
  });

  test(`властивість: row shift, ${lang}, ${CASES} випадкових випадків`, () => {
    const random = createRandom(lang === 'uk' ? 3003 : 3004);
    for (let i = 0; i < CASES; i += 1) {
      const square = buildSquare(lang, randomKeyword(random, lang));
      const text = randomFreeText(random, lang);
      assert.equal(polybius.decryptRowShift(polybius.encryptRowShift(text, square), square), normalizeText(text));
    }
  });

  test(`властивість: Гронсфельд, ${lang}, ${CASES} випадкових ключів і текстів`, () => {
    const random = createRandom(lang === 'uk' ? 3005 : 3006);
    for (let i = 0; i < CASES; i += 1) {
      const key = randomDigitKey(random);
      const text = randomFreeText(random, lang);
      assert.equal(gronsfeld.decrypt(gronsfeld.encrypt(text, lang, key), lang, key), normalizeText(text));
    }
  });
}
