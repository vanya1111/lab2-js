'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSquare } = require('../src/square');
const polybius = require('../src/polybius');
const gronsfeld = require('../src/gronsfeld');

const UK = buildSquare('uk', 'БЕЗПЕКА');
const LAT = buildSquare('lat', 'SECURITY');

test('вектор 1: Полібій coordinates, український, БЕЗПЕКА', () => {
  const cipher = polybius.encryptCoordinates('СЛАВА', UK);
  assert.equal(cipher, '44 35 16 21 16');
  assert.equal(polybius.decryptCoordinates(cipher, UK), 'СЛАВА');
});

test('вектор 2: Полібій coordinates, латинський, SECURITY', () => {
  const cipher = polybius.encryptCoordinates('HELLO', LAT);
  assert.equal(cipher, '32 12 35 35 42');
  assert.equal(polybius.decryptCoordinates(cipher, LAT), 'HELLO');
});

test('вектор 3: Полібій row shift, український, БЕЗПЕКА', () => {
  const cipher = polybius.encryptRowShift('СЛАВА', UK);
  assert.equal(cipher, 'ЧТЖИЖ');
  assert.equal(polybius.decryptRowShift(cipher, UK), 'СЛАВА');
});

test('вектор 4: Полібій row shift, латинський, SECURITY', () => {
  const cipher = polybius.encryptRowShift('HELLO', LAT);
  assert.equal(cipher, 'OYVVZ');
  assert.equal(polybius.decryptRowShift(cipher, LAT), 'HELLO');
});

test('вектор 5: Гронсфельд, український, ключ 31415', () => {
  const cipher = gronsfeld.encrypt('СЛАВА УКРАЇНІ', 'uk', '31415');
  assert.equal(cipher, 'ФМҐГД ЦЛФБНРЇ');
  assert.equal(gronsfeld.decrypt(cipher, 'uk', '31415'), 'СЛАВА УКРАЇНІ');
});

test('вектор 6: Гронсфельд, латинський, ключ 2718', () => {
  const cipher = gronsfeld.encrypt('HELLO WORLD', 'lat', '2718');
  assert.equal(cipher, 'JLMTQ DPZNK');
  assert.equal(gronsfeld.decrypt(cipher, 'lat', '2718'), 'HELLO WORLD');
});

test('квадрат з методички для БЕЗПЕКА збігається рядок у рядок', () => {
  assert.deepEqual(UK.rows.map((row) => row.join('')), ['БЕЗПКА', 'ВГҐДЄЖ', 'ИІЇЙЛМ', 'НОРСТУ', 'ФХЦЧШЩ', 'ЬЮЯ012']);
});

test('квадрат з методички для SECURITY збігається рядок у рядок', () => {
  assert.deepEqual(LAT.rows.map((row) => row.join('')), ['SECURI', 'TYABDF', 'GHJKLM', 'NOPQVW', 'XZ0123', '456789']);
});
