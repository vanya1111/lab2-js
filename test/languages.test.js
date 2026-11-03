'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSquare } = require('../src/square');
const { getAlphabet } = require('../src/alphabets');
const polybius = require('../src/polybius');
const gronsfeld = require('../src/gronsfeld');
const { run } = require('../src/api');
const { CipherError } = require('../src/errors');

const rejects = (fn, pattern) => assert.throws(fn, (e) => e instanceof CipherError && pattern.test(e.message));

test('алфавіти: 33 + 26 літер; квадрати по 36 символів', () => {
  assert.equal(getAlphabet('uk').letters.length, 33);
  assert.equal(getAlphabet('lat').letters.length, 26);
  assert.equal(getAlphabet('uk').squareBase.length, 36);
  assert.equal(getAlphabet('lat').squareBase.length, 36);
});

test('українські Ґ, Є, І, Ї присутні в квадраті й проходять усі режими', () => {
  const square = buildSquare('uk', 'БЕЗПЕКА');
  for (const letter of ['Ґ', 'Є', 'І', 'Ї']) {
    assert.ok(square.toCoord.has(letter));
    assert.equal(polybius.decryptCoordinates(polybius.encryptCoordinates(letter, square), square), letter);
    assert.equal(polybius.decryptRowShift(polybius.encryptRowShift(letter, square), square), letter);
    assert.equal(gronsfeld.decrypt(gronsfeld.encrypt(letter, 'uk', '31415'), 'uk', '31415'), letter);
  }
});

test('латинські A і Z — перша й остання літери — проходять усі режими', () => {
  const square = buildSquare('lat', 'SECURITY');
  for (const letter of ['A', 'Z']) {
    assert.ok(square.toCoord.has(letter));
    assert.equal(polybius.decryptCoordinates(polybius.encryptCoordinates(letter, square), square), letter);
    assert.equal(polybius.decryptRowShift(polybius.encryptRowShift(letter, square), square), letter);
    assert.equal(gronsfeld.decrypt(gronsfeld.encrypt(letter, 'lat', '2718'), 'lat', '2718'), letter);
  }
});

test('вибір алфавіту не вгадується: латинський текст у українському режимі — помилка', () => {
  const uk = buildSquare('uk', 'БЕЗПЕКА');
  rejects(() => polybius.encryptCoordinates('HELLO', uk), /відсутній у квадраті \(uk\)/);
});

test('вибір алфавіту не вгадується: кирилиця в латинському режимі — помилка', () => {
  const lat = buildSquare('lat', 'SECURITY');
  rejects(() => polybius.encryptCoordinates('СЛАВА', lat), /відсутній у квадраті \(lat\)/);
});

test('той самий текст дає різні результати в різних алфавітах, а не «вгадується»', () => {
  // «А» — кирилична, «A» — латинська: у чужому алфавіті вони не змінюються
  assert.equal(gronsfeld.encrypt('А', 'lat', '5'), 'А');
  assert.equal(gronsfeld.encrypt('A', 'uk', '5'), 'A');
  assert.equal(gronsfeld.encrypt('А', 'uk', '5'), 'Д'); // індекс 0 + 5 = 5
  assert.equal(gronsfeld.encrypt('A', 'lat', '5'), 'F');
});

test('відсутній чи невідомий алфавіт відхиляється явно у всіх режимах', () => {
  rejects(() => getAlphabet(undefined), /не вказано.*Оберіть явно/);
  rejects(() => getAlphabet('en'), /«en»/);
  rejects(() => getAlphabet('UK'), /«UK»/); // регістр важливий
  rejects(() => buildSquare('de', 'KEY'), /«de»/);
  rejects(() => gronsfeld.encrypt('A', undefined, '5'), /Оберіть явно/);
  rejects(() => run({ mode: 'polybius-row-shift', operation: 'encrypt', text: 'A', key: 'KEY' }), /Оберіть явно/);
});

test('NFC: розкладена Ї в тексті зводиться до однієї літери в усіх режимах', () => {
  const square = buildSquare('uk', 'БЕЗПЕКА');
  const decomposed = 'І\u0308';
  assert.equal(polybius.encryptCoordinates(decomposed, square), polybius.encryptCoordinates('Ї', square));
  assert.equal(polybius.encryptRowShift(decomposed, square), polybius.encryptRowShift('Ї', square));
  assert.equal(gronsfeld.encrypt(decomposed, 'uk', '31415'), gronsfeld.encrypt('Ї', 'uk', '31415'));
});

test('результат не містить символа заміни U+FFFD', () => {
  const square = buildSquare('uk', 'БЕЗПЕКА');
  assert.ok(!polybius.encryptRowShift('ҐЄІЇґєії', square).includes('\uFFFD'));
  assert.ok(!gronsfeld.encrypt('ҐЄІЇґєії', 'uk', '987').includes('\uFFFD'));
});
