'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSquare } = require('../src/square');
const polybius = require('../src/polybius');
const { stripWhitespace } = require('../src/text');
const { CipherError } = require('../src/errors');

const UK = buildSquare('uk', 'БЕЗПЕКА');
const LAT = buildSquare('lat', 'SECURITY');
const rejects = (fn, pattern) => assert.throws(fn, (e) => e instanceof CipherError && pattern.test(e.message));

test('перший рядок квадрата кодується 11…16, останній — 61…66', () => {
  assert.equal(polybius.encryptCoordinates('БЕЗПКА', UK), '11 12 13 14 15 16');
  assert.equal(polybius.encryptCoordinates('ЬЮЯ012', UK), '61 62 63 64 65 66');
  assert.equal(polybius.encryptCoordinates('SECURI', LAT), '11 12 13 14 15 16');
  assert.equal(polybius.encryptCoordinates('456789', LAT), '61 62 63 64 65 66');
});

test('крайні координати 11 і 66 декодуються в перший і останній символ квадрата', () => {
  assert.equal(polybius.decryptCoordinates('11', UK), 'Б');
  assert.equal(polybius.decryptCoordinates('66', UK), '2');
  assert.equal(polybius.decryptCoordinates('11', LAT), 'S');
  assert.equal(polybius.decryptCoordinates('66', LAT), '9');
});

test('координата 61 коректна (рядок 6, стовпець 1): Ь в українському, 4 в латинському', () => {
  assert.equal(polybius.decryptCoordinates('61', UK), 'Ь');
  assert.equal(polybius.decryptCoordinates('61', LAT), '4');
});

test('порядок «рядок, потім стовпець»: 16 ≠ 61', () => {
  assert.equal(polybius.encryptCoordinates('А', UK), '16'); // рядок 1, стовпець 6
  assert.equal(polybius.encryptCoordinates('Ь', UK), '61'); // рядок 6, стовпець 1
});

test('малі літери нормалізуються у верхній регістр перед кодуванням', () => {
  assert.equal(polybius.encryptCoordinates('слава', UK), '44 35 16 21 16');
  assert.equal(polybius.encryptCoordinates('hello', LAT), '32 12 35 35 42');
});

test('порожній текст ↔ порожній шифротекст', () => {
  assert.equal(polybius.encryptCoordinates('', UK), '');
  assert.equal(polybius.decryptCoordinates('', UK), '');
});

test('некоректні токени: 00, 17, 67, 71 відхиляються з номером токена', () => {
  for (const token of ['00', '17', '67', '71']) {
    rejects(() => polybius.decryptCoordinates(`11 ${token} 12`, UK), new RegExp(`Токен 2 «${token}» некоректний`));
  }
});

test('некоректні токени: одна цифра, три цифри, текст, повнорозмірні цифри', () => {
  rejects(() => polybius.decryptCoordinates('1', UK), /Токен 1 «1»/);
  rejects(() => polybius.decryptCoordinates('111', UK), /Токен 1 «111»/);
  rejects(() => polybius.decryptCoordinates('11 AB', UK), /Токен 2 «AB»/);
  rejects(() => polybius.decryptCoordinates('привіт', UK), /Токен 1/);
  rejects(() => polybius.decryptCoordinates('１１', UK), /Токен 1/); // U+FF11 — не ASCII-цифри
});

test('роздільник — рівно один пробіл: зайві пробіли, переноси й табуляції відхиляються', () => {
  rejects(() => polybius.decryptCoordinates('11  12', UK), /Токен 2 порожній/);
  rejects(() => polybius.decryptCoordinates(' 11', UK), /Токен 1 порожній/);
  rejects(() => polybius.decryptCoordinates('11 ', UK), /Токен 2 порожній/);
  rejects(() => polybius.decryptCoordinates('11\n12', UK), /Токен 1 «11\\n12»/);
  rejects(() => polybius.decryptCoordinates('11\t12', UK), /Токен 1/);
});

test('некоректний токен не пропускається мовчки: жодного часткового результату', () => {
  assert.throws(() => polybius.decryptCoordinates('44 35 17 21', UK), CipherError);
});

test('зашифрування: пробіл, кома, цифра поза квадратом і чужа мова відхиляються', () => {
  rejects(() => polybius.encryptCoordinates('СЛАВА УКРАЇНІ', UK), /U\+0020 на позиції 6/);
  rejects(() => polybius.encryptCoordinates('А,Б', UK), /U\+002C «,» на позиції 2/);
  rejects(() => polybius.encryptCoordinates('А3', UK), /U\+0033 «3»/); // цифр 3–9 немає в українському квадраті
  rejects(() => polybius.encryptCoordinates('HELLO', UK), /U\+0048 «H» на позиції 1/);
  rejects(() => polybius.encryptCoordinates('ПРИВІТ', LAT), /U\+041F/);
  rejects(() => polybius.encryptCoordinates('Aб', LAT), /U\+0431|U\+0411/);
});

test('цифри 3–9 допустимі у латинському квадраті, але 0–2 — і в українському', () => {
  assert.equal(polybius.encryptCoordinates('9', LAT), '66');
  assert.equal(polybius.encryptCoordinates('2', UK), '66');
});

test('окрема видима операція: stripWhitespace рахує вилучені символи', () => {
  assert.deepEqual(stripWhitespace('А Б\nВ\t'), { text: 'АБВ', removed: 3 });
  assert.deepEqual(stripWhitespace('АБВ'), { text: 'АБВ', removed: 0 });
  assert.deepEqual(stripWhitespace(' \n '), { text: '', removed: 3 });
});

test('після stripWhitespace фраза зі пробілом шифрується в координатному режимі', () => {
  const { text, removed } = stripWhitespace('СЛАВА УКРАЇНІ');
  assert.equal(removed, 1);
  const cipher = polybius.encryptCoordinates(text, UK);
  // У(4,6) К(1,5) Р(4,3) А(1,6) Ї(3,3) Н(4,1) І(3,2)
  assert.equal(cipher, '44 35 16 21 16 46 15 43 16 33 41 32');
  assert.equal(polybius.decryptCoordinates(cipher, UK), 'СЛАВАУКРАЇНІ');
});
