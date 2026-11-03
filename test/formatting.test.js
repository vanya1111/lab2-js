'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSquare } = require('../src/square');
const polybius = require('../src/polybius');
const gronsfeld = require('../src/gronsfeld');

const UK = buildSquare('uk', 'БЕЗПЕКА');
const LAT = buildSquare('lat', 'SECURITY');
const nonLetterLayout = (text) => Array.from(text).map((ch, i) => (/[A-ZА-ЯҐЄІЇ]/u.test(ch) ? null : `${i}:${ch}`)).filter(Boolean);

test('Гронсфельд: пробіли, переноси \\n і \\r\\n, табуляції зберігаються на місцях', () => {
  const text = 'А\tБ\nВ\r\nГ  Д\n';
  const cipher = gronsfeld.encrypt(text, 'uk', '31415');
  assert.deepEqual(nonLetterLayout(cipher), nonLetterLayout(text));
  assert.equal(gronsfeld.decrypt(cipher, 'uk', '31415'), text);
});

test('Гронсфельд: цифри та розділові знаки не змінюються', () => {
  const text = 'А, Б! 2026 (В). «Г» — Д: Е;';
  const cipher = gronsfeld.encrypt(text, 'uk', '7');
  assert.deepEqual(nonLetterLayout(cipher), nonLetterLayout(text));
});

test('Гронсфельд: ключ однаково просувається незалежно від кількості пробілів', () => {
  const dense = gronsfeld.encrypt('ААААА', 'uk', '12');
  const spaced = gronsfeld.encrypt('А, А\nА  А 1 А', 'uk', '12');
  assert.equal(spaced.replace(/[^А-ЯҐЄІЇ]/gu, ''), dense);
});

test('Row shift: пробіли, переноси, розділові знаки на місцях; шифруються лише символи квадрата', () => {
  const text = 'СЛАВА,\nУКРАЇНІ! 2026';
  const cipher = polybius.encryptRowShift(text, UK);
  // СЛАВА → ЧТЖИЖ; УКРАЇНІ → ЩЄЦЖРФО; цифри: 2→А, 0→П, 2→А, а 6 поза українським квадратом і лишається
  assert.equal(cipher, 'ЧТЖИЖ,\nЩЄЦЖРФО! АПА6');
  assert.equal(polybius.decryptRowShift(cipher, UK), text);
});

test('Row shift: у латинському квадраті цифри 0–9 належать квадрату і зсуваються', () => {
  assert.equal(polybius.encryptRowShift('0', LAT), '6'); // (5,3) → (6,3)
  assert.equal(polybius.encryptRowShift('7', LAT), 'U'); // (6,4) → (1,4)
  // TEST → GYTG; 2→8, 0→6, 2→8, 6→C
  assert.equal(polybius.encryptRowShift('Test 2026', LAT), 'GYTG 868C');
  assert.equal(polybius.decryptRowShift('GYTG 868C', LAT), 'TEST 2026');
});

test('Координати: розділювач між токенами — один пробіл, нічого зайвого наприкінці', () => {
  const cipher = polybius.encryptCoordinates('СЛАВА', UK);
  assert.ok(!cipher.endsWith(' '));
  assert.ok(!cipher.includes('  '));
  assert.equal(cipher.split(' ').length, 5);
});

test('Координати: переноси рядків відхиляються в strict-режимі, а не мовчки губляться', () => {
  assert.throws(() => polybius.encryptCoordinates('А\nБ', UK), /U\+000A/);
});

test('Усі режими: регістр нормалізується, результат у верхньому регістрі', () => {
  assert.equal(polybius.encryptRowShift('слава', UK), polybius.encryptRowShift('СЛАВА', UK));
  assert.equal(gronsfeld.encrypt('hello', 'lat', '2718'), gronsfeld.encrypt('HELLO', 'lat', '2718'));
});
