'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSquare } = require('../src/square');
const polybius = require('../src/polybius');

const UK = buildSquare('uk', 'БЕЗПЕКА');
const LAT = buildSquare('lat', 'SECURITY');

test('зсув вниз: символ → символ наступного рядка того самого стовпця', () => {
  assert.equal(polybius.encryptRowShift('Б', UK), 'В'); // (1,1) → (2,1)
  assert.equal(polybius.encryptRowShift('В', UK), 'И'); // (2,1) → (3,1)
  assert.equal(polybius.encryptRowShift('Е', UK), 'Г'); // (1,2) → (2,2)
});

test('циклічність: шостий рядок переходить у перший', () => {
  assert.equal(polybius.encryptRowShift('Ь', UK), 'Б'); // (6,1) → (1,1)
  assert.equal(polybius.encryptRowShift('2', UK), 'А'); // (6,6) → (1,6)
  assert.equal(polybius.encryptRowShift('9', LAT), 'I'); // (6,6) → (1,6)
  assert.equal(polybius.encryptRowShift('4', LAT), 'S'); // (6,1) → (1,1)
});

test('розшифрування повертає символ назад: перший рядок ← шостий', () => {
  assert.equal(polybius.decryptRowShift('Б', UK), 'Ь');
  assert.equal(polybius.decryptRowShift('А', UK), '2');
  assert.equal(polybius.decryptRowShift('I', LAT), '9');
  assert.equal(polybius.decryptRowShift('S', LAT), '4');
  assert.equal(polybius.decryptRowShift('В', UK), 'Б');
});

test('шість послідовних зсувів повертають початковий символ', () => {
  for (const square of [UK, LAT]) {
    for (const symbol of square.symbols) {
      let current = symbol;
      for (let i = 0; i < 6; i += 1) current = polybius.encryptRowShift(current, square);
      assert.equal(current, symbol);
    }
  }
});

test('кожен символ квадрата переходить рівно в один інший (бієкція)', () => {
  for (const square of [UK, LAT]) {
    const images = square.symbols.map((s) => polybius.encryptRowShift(s, square));
    assert.equal(new Set(images).size, 36);
    images.forEach((image, i) => assert.notEqual(image, square.symbols[i]));
  }
});

test('символи поза квадратом зберігаються: пробіл, розділові знаки, чужі літери', () => {
  assert.equal(polybius.encryptRowShift('Б, В!', UK), 'В, И!');
  assert.equal(polybius.encryptRowShift('A Б', UK), 'A В'); // латинська A — поза українським квадратом
  assert.equal(polybius.encryptRowShift('Б 3', UK), 'В 3'); // цифри 3–9 поза українським квадратом
  assert.equal(polybius.encryptRowShift('H Б', LAT), 'O Б'); // кирилиця поза латинським квадратом
});

test('цифри квадрата зсуваються як і літери: 0, 1, 2 в українському', () => {
  assert.equal(polybius.encryptRowShift('012', UK), 'ПКА'); // (6,4)→(1,4) П, (6,5)→(1,5) К, (6,6)→(1,6) А
});

test('малі літери нормалізуються у верхній регістр', () => {
  assert.equal(polybius.encryptRowShift('слава', UK), 'ЧТЖИЖ');
});

test('порожній текст', () => {
  assert.equal(polybius.encryptRowShift('', UK), '');
  assert.equal(polybius.decryptRowShift('', LAT), '');
});
