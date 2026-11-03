'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { run } = require('../src/api');
const { CipherError } = require('../src/errors');
const { normalizeText } = require('../src/text');

const rejects = (fn, pattern) => assert.throws(fn, (e) => e instanceof CipherError && pattern.test(e.message));
const base = { lang: 'uk', text: 'СЛАВА', key: 'БЕЗПЕКА' };

test('невідомий режим і невідома операція', () => {
  rejects(() => run({ ...base, mode: 'polybius', operation: 'encrypt' }), /Невідомий режим «polybius»/);
  rejects(() => run({ ...base, mode: undefined, operation: 'encrypt' }), /Невідомий режим/);
  rejects(() => run({ ...base, mode: 'gronsfeld', operation: 'sign', key: '1' }), /Невідома операція «sign»/);
});

test('відсутній ключ у кожному режимі', () => {
  for (const mode of ['polybius-coordinates', 'polybius-row-shift', 'gronsfeld']) {
    rejects(() => run({ mode, operation: 'encrypt', lang: 'uk', text: 'А' }), /Ключ не задано/);
  }
});

test('вилучення пробілів дозволене лише для coordinates + encrypt', () => {
  rejects(() => run({ ...base, mode: 'gronsfeld', key: '1', operation: 'encrypt', stripSpaces: true }), /лише при зашифруванні в режимі polybius-coordinates/);
  rejects(() => run({ ...base, mode: 'polybius-row-shift', operation: 'encrypt', stripSpaces: true }), /лише при зашифруванні/);
  rejects(() => run({ ...base, mode: 'polybius-coordinates', operation: 'decrypt', text: '11', stripSpaces: true }), /лише при зашифруванні/);
});

test('вилучення пробілів: coordinates повертає кількість вилучених символів', () => {
  const result = run({ ...base, mode: 'polybius-coordinates', operation: 'encrypt', text: 'СЛАВА УКРАЇНІ', stripSpaces: true });
  assert.equal(result.removed, 1);
  assert.equal(result.text, '44 35 16 21 16 46 15 43 16 33 41 32');
  assert.equal(run({ ...base, mode: 'polybius-coordinates', operation: 'encrypt', text: 'СЛАВА' }).removed, undefined);
});

test('текст не рядок і некоректний Unicode (непарний сурогат)', () => {
  rejects(() => normalizeText(42), /має бути рядком/);
  rejects(() => run({ ...base, mode: 'polybius-row-shift', operation: 'encrypt', text: undefined }), /має бути рядком/);
  rejects(() => run({ ...base, mode: 'polybius-row-shift', operation: 'encrypt', text: 'А\uD800Б' }), /непарний сурогат/);
  rejects(() => run({ ...base, mode: 'gronsfeld', key: '1', operation: 'encrypt', text: '\uDC00' }), /непарний сурогат/);
});

test('помилка ключа раніше за помилку тексту (ключ перевіряється до початку обробки)', () => {
  rejects(() => run({ lang: 'uk', mode: 'polybius-coordinates', operation: 'encrypt', key: '', text: 'HELLO' }), /порожнє/);
  rejects(() => run({ lang: 'uk', mode: 'gronsfeld', operation: 'encrypt', key: '000', text: 'HELLO' }), /лише з нулів/);
});

test('розшифрування координат: текст не рядок', () => {
  rejects(() => run({ ...base, mode: 'polybius-coordinates', operation: 'decrypt', text: 1122 }), /Шифротекст має бути рядком/);
});

test('усі помилки є CipherError, а не аварійним винятком', () => {
  const bad = [
    { ...base, mode: 'x', operation: 'encrypt' },
    { ...base, mode: 'gronsfeld', operation: 'encrypt', key: '' },
    { ...base, mode: 'polybius-coordinates', operation: 'decrypt', text: '00' },
    { ...base, mode: 'polybius-coordinates', operation: 'encrypt', text: 'ПРИВІТ СВІТЕ' },
    { ...base, lang: 'de', mode: 'polybius-row-shift', operation: 'encrypt' },
  ];
  for (const args of bad) assert.throws(() => run(args), CipherError);
});
