'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSquare, createSquare, validateSquare, formatSquare, uniqueInOrder } = require('../src/square');
const { ALPHABETS } = require('../src/alphabets');
const { CipherError } = require('../src/errors');
const { createRandom, randomKeyword } = require('../testlib/helpers');

const rejects = (fn, pattern) => assert.throws(fn, (e) => e instanceof CipherError && pattern.test(e.message));

test('квадрат 6×6: 36 унікальних символів для обох мов', () => {
  for (const lang of ['uk', 'lat']) {
    const square = buildSquare(lang, lang === 'uk' ? 'ТЕСТ' : 'TEST');
    assert.equal(square.rows.length, 6);
    square.rows.forEach((row) => assert.equal(row.length, 6));
    assert.equal(square.symbols.length, 36);
    assert.equal(new Set(square.symbols).size, 36);
  }
});

test('повний вміст квадрата: ключ БЕЗПЕКА → унікальна частина БЕЗПКА + решта', () => {
  assert.equal(buildSquare('uk', 'БЕЗПЕКА').symbols.join(''), 'БЕЗПКА' + 'ВГҐДЄЖИІЇЙЛМНОРСТУФХЦЧШЩЬЮЯ' + '012');
});

test('повний вміст квадрата: ключ SECURITY', () => {
  assert.equal(buildSquare('lat', 'SECURITY').symbols.join(''), 'SECURITY' + 'ABDFGHJKLMNOPQVWXZ' + '0123456789');
});

test('повтори ключа вилучаються зі збереженням першої появи', () => {
  assert.equal(buildSquare('uk', 'ААББВ').symbols.slice(0, 6).join(''), 'АБВГҐД');
  assert.equal(buildSquare('uk', 'КРИПТОГРАФІЯ').symbols.slice(0, 11).join(''), 'КРИПТОГАФІЯ');
  assert.equal(buildSquare('lat', 'CRYPTOGRAPHY').symbols.slice(0, 9).join(''), 'CRYPTOGAH');
  assert.deepEqual(uniqueInOrder(Array.from('ЗААХХИ')), ['З', 'А', 'Х', 'И']);
});

test('ключове слово може містити цифри квадрата поряд із літерами', () => {
  const square = buildSquare('uk', 'К1');
  assert.equal(square.symbols[0], 'К');
  assert.equal(square.symbols[1], '1');
  assert.equal(new Set(square.symbols).size, 36);
});

test('ключове слово: нижній регістр і пробіли по краях нормалізуються', () => {
  assert.deepEqual(buildSquare('uk', ' безпека ').symbols, buildSquare('uk', 'БЕЗПЕКА').symbols);
  assert.deepEqual(buildSquare('lat', 'secUrity').symbols, buildSquare('lat', 'SECURITY').symbols);
});

test('ключове слово: NFC — розкладена Ї (І + U+0308) стає однією літерою', () => {
  const square = buildSquare('uk', 'І\u0308А');
  assert.equal(square.symbols[0], 'Ї');
  assert.equal(square.symbols[1], 'А');
});

test('ключове слово з усіх 36 символів у зворотному порядку дає саме цей квадрат', () => {
  const reversed = ALPHABETS.uk.squareBase.slice().reverse().join('');
  assert.equal(buildSquare('uk', reversed).symbols.join(''), reversed);
});

test('таблиці пошуку узгоджені: координата ↔ символ, 36 записів', () => {
  const square = buildSquare('uk', 'БЕЗПЕКА');
  assert.equal(square.toCoord.size, 36);
  assert.equal(square.fromCoord.size, 36);
  for (const [symbol, coord] of square.toCoord) assert.equal(square.fromCoord.get(coord), symbol);
});

test('formatSquare показує всі шість рядків і заголовок', () => {
  const text = formatSquare(buildSquare('lat', 'SECURITY'));
  assert.equal(text.split('\n').length, 7);
  assert.match(text, /S E C U R I/);
  assert.match(text, /4 5 6 7 8 9/);
});

test('негативні: порожнє ключове слово', () => {
  rejects(() => buildSquare('uk', ''), /порожнє/);
  rejects(() => buildSquare('uk', '   '), /порожнє/);
});

test('негативні: ключове слово лише з цифр не містить літери', () => {
  rejects(() => buildSquare('uk', '012'), /щонайменше одну літеру/);
  rejects(() => buildSquare('lat', '2026'), /щонайменше одну літеру/);
});

test('негативні: символи поза вибраним квадратом', () => {
  rejects(() => buildSquare('uk', 'БЕЗ3'), /U\+0033.*позиції 4/); // цифри 3–9 немає в українському квадраті
  rejects(() => buildSquare('uk', 'KEY'), /U\+004B/); // латиниця в українському
  rejects(() => buildSquare('lat', 'КЛЮЧ'), /U\+041A/); // кирилиця в латинському
  rejects(() => buildSquare('lat', 'KEY!'), /U\+0021/);
  rejects(() => buildSquare('uk', 'БЕ ЗПЕКА'), /U\+0020/); // внутрішній пробіл
});

test('негативні: ключове слово не рядок', () => {
  rejects(() => buildSquare('uk', 123), /має бути рядком/);
  rejects(() => buildSquare('uk', undefined), /має бути рядком/);
});

test('validateSquare: неправильна довжина, повтор, сторонній символ', () => {
  const good = ALPHABETS.uk.squareBase.join('');
  assert.equal(validateSquare(good, 'uk').length, 36);
  rejects(() => validateSquare(good.slice(1), 'uk'), /рівно 36 символів, а містить 35/);
  rejects(() => validateSquare(`Б${good.slice(1)}`, 'uk'), /повторюється/);
  rejects(() => validateSquare(`${good.slice(0, 35)}X`, 'uk'), /не належить базовому набору/);
  rejects(() => createSquare('uk', good + 'А'), /містить 37/);
});

test('властивість: для 300 випадкових ключових слів квадрат коректний (обидві мови)', () => {
  const random = createRandom(2001);
  for (const lang of ['uk', 'lat']) {
    for (let i = 0; i < 300; i += 1) {
      const keyword = randomKeyword(random, lang);
      const square = buildSquare(lang, keyword);
      assert.equal(new Set(square.symbols).size, 36);
      assert.deepEqual(new Set(square.symbols), new Set(ALPHABETS[lang].squareBase));
      const unique = uniqueInOrder(Array.from(keyword));
      assert.deepEqual(square.symbols.slice(0, unique.length), unique);
    }
  }
});
