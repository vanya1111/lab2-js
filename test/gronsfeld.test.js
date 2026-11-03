'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const gronsfeld = require('../src/gronsfeld');
const { CipherError } = require('../src/errors');

const rejects = (fn, pattern) => assert.throws(fn, (e) => e instanceof CipherError && pattern.test(e.message));

test('ключ із початковим нулем зберігається: «07» дає зсуви 0 і 7', () => {
  assert.equal(gronsfeld.encrypt('АА', 'uk', '07'), 'АЄ'); // 0 → А, 7 → Є
  assert.equal(gronsfeld.decrypt('АЄ', 'uk', '07'), 'АА');
  assert.notEqual(gronsfeld.encrypt('АА', 'uk', '07'), gronsfeld.encrypt('АА', 'uk', '7')); // 07 ≠ 7
});

test('ключ «9»: зсув на 9 із переходом через кінець алфавіту', () => {
  assert.equal(gronsfeld.encrypt('А', 'uk', '9'), 'З');
  assert.equal(gronsfeld.encrypt('Я', 'uk', '9'), 'Ж'); // 32 + 9 = 41 mod 33 = 8
  assert.equal(gronsfeld.encrypt('A', 'lat', '9'), 'J');
  assert.equal(gronsfeld.encrypt('Z', 'lat', '9'), 'I'); // 25 + 9 = 34 mod 26 = 8
});

test('довгий ключ (довший за текст): використовується лише початок', () => {
  assert.equal(gronsfeld.encrypt('АБВ', 'uk', '123456789'), 'БГД');
  assert.equal(gronsfeld.decrypt('БГД', 'uk', '123456789'), 'АБВ');
});

test('короткий ключ повторюється циклічно', () => {
  assert.equal(gronsfeld.encrypt('ААААА', 'uk', '12'), 'БВБВБ');
});

test('цифри, пробіли й розділові знаки не просувають ключ і не змінюються', () => {
  assert.equal(gronsfeld.encrypt('A 1 A B', 'lat', '12'), 'B 1 C C');
  assert.equal(gronsfeld.encrypt('А, А. А', 'uk', '12'), 'Б, В. Б');
  assert.equal(gronsfeld.encrypt('1234567890', 'lat', '5'), '1234567890');
});

test('літери іншого алфавіту — сторонні: не змінюються й не споживають цифру', () => {
  assert.equal(gronsfeld.encrypt('AБ', 'uk', '1'), 'AВ'); // латинська A лишається, Б → В
  assert.equal(gronsfeld.encrypt('AБ', 'lat', '5'), 'FБ'); // кирилична Б лишається
});

test('перехід через кінець: Я+1 → А, Z+1 → A і назад', () => {
  assert.equal(gronsfeld.encrypt('Я', 'uk', '1'), 'А');
  assert.equal(gronsfeld.decrypt('А', 'uk', '1'), 'Я');
  assert.equal(gronsfeld.encrypt('Z', 'lat', '1'), 'A');
  assert.equal(gronsfeld.decrypt('A', 'lat', '1'), 'Z');
});

test('розшифрування: від’ємний результат приводиться до 0..m-1 (А − 9)', () => {
  assert.equal(gronsfeld.decrypt('А', 'uk', '9'), 'Ф'); // 0 − 9 = −9 → 24
});

test('малі літери нормалізуються у верхній регістр; Ґ Є І Ї працюють', () => {
  assert.equal(gronsfeld.encrypt('слава', 'uk', '31415'), 'ФМҐГД');
  assert.equal(gronsfeld.decrypt(gronsfeld.encrypt('ҐЄІЇ', 'uk', '5'), 'uk', '5'), 'ҐЄІЇ');
});

test('негативні: порожній ключ', () => {
  rejects(() => gronsfeld.encrypt('А', 'uk', ''), /порожній/);
});

test('негативні: ключ лише з нулів', () => {
  rejects(() => gronsfeld.encrypt('А', 'uk', '0'), /лише з нулів/);
  rejects(() => gronsfeld.encrypt('А', 'uk', '0000'), /лише з нулів/);
});

test('негативні: нецифрові символи, пробіли, мінус, повнорозмірні цифри', () => {
  rejects(() => gronsfeld.encrypt('А', 'uk', '12a4'), /нецифровий символ U\+0061 «a» на позиції 3/);
  rejects(() => gronsfeld.encrypt('А', 'uk', '1 2'), /нецифровий/);
  rejects(() => gronsfeld.encrypt('А', 'uk', '-5'), /нецифровий/);
  rejects(() => gronsfeld.encrypt('А', 'uk', '１２'), /нецифровий/); // U+FF11 U+FF12
});

test('негативні: ключ-число відхиляється (втрачаються початкові нулі), відсутній ключ', () => {
  rejects(() => gronsfeld.encrypt('А', 'uk', 7), /рядком, а не числом/);
  rejects(() => gronsfeld.encrypt('А', 'uk', undefined), /не задано/);
});

test('ключ перевіряється до обробки тексту', () => {
  rejects(() => gronsfeld.encrypt(42, 'uk', ''), /порожній/);
});

test('ключ завдовжки 1 і різні цифри дають різні результати', () => {
  assert.notEqual(gronsfeld.encrypt('СЛАВА', 'uk', '1'), gronsfeld.encrypt('СЛАВА', 'uk', '2'));
});
