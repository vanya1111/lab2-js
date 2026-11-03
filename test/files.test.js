'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readUtf8File, writeUtf8File } = require('../src/fileio');
const { CipherError } = require('../src/errors');
const gronsfeld = require('../src/gronsfeld');
const polybius = require('../src/polybius');
const { buildSquare } = require('../src/square');

function makeTempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lab1-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('запис і читання UTF-8: кілька рядків та завершальний перенос', (t) => {
  const file = path.join(makeTempDir(t), 'a.txt');
  const content = 'Перший рядок\nДругий рядок із Ґ, Є, І, Ї\nТретій\n';
  writeUtf8File(file, content);
  assert.equal(readUtf8File(file), content);
});

test('запис не додає BOM, а читання знімає BOM', (t) => {
  const dir = makeTempDir(t);
  const plain = path.join(dir, 'plain.txt');
  writeUtf8File(plain, 'А');
  assert.deepEqual([...fs.readFileSync(plain)], [0xd0, 0x90]); // «А» у UTF-8 без BOM

  const withBom = path.join(dir, 'bom.txt');
  fs.writeFileSync(withBom, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('Б', 'utf8')]));
  assert.equal(readUtf8File(withBom), 'Б');
});

test('переноси рядків \\r\\n зберігаються при читанні та записі', (t) => {
  const file = path.join(makeTempDir(t), 'crlf.txt');
  writeUtf8File(file, 'А\r\nБ\r\n');
  assert.equal(readUtf8File(file), 'А\r\nБ\r\n');
});

test('некоректний UTF-8 дає зрозумілу помилку', (t) => {
  const file = path.join(makeTempDir(t), 'bad.bin');
  fs.writeFileSync(file, Buffer.from([0xff, 0xfe, 0x41]));
  assert.throws(() => readUtf8File(file), (e) => e instanceof CipherError && /не є коректним UTF-8/.test(e.message));
});

test('відсутній файл дає зрозумілу помилку', (t) => {
  const file = path.join(makeTempDir(t), 'missing.txt');
  assert.throws(() => readUtf8File(file), (e) => e instanceof CipherError && /Не вдалося прочитати/.test(e.message));
});

test('невдалий запис не лишає тимчасових файлів і не псує цільовий файл', (t) => {
  const dir = makeTempDir(t);
  const file = path.join(dir, 'result.txt');
  writeUtf8File(file, 'старе');
  const blocked = path.join(dir, 'нема-теки', 'result.txt');
  assert.throws(() => writeUtf8File(blocked, 'нове'), CipherError);
  assert.equal(readUtf8File(file), 'старе');
  assert.deepEqual(fs.readdirSync(dir).filter((name) => name.endsWith('.tmp')), []);
});

test('повний цикл: файл → зашифрування Гронсфельда → файл → розшифрування', (t) => {
  const dir = makeTempDir(t);
  const input = path.join(dir, 'in.txt');
  const cipherFile = path.join(dir, 'cipher.txt');
  const original = 'Слава Україні!\nГероям слава.\n';
  writeUtf8File(input, original);
  writeUtf8File(cipherFile, gronsfeld.encrypt(readUtf8File(input), 'uk', '31415'));
  assert.equal(gronsfeld.decrypt(readUtf8File(cipherFile), 'uk', '31415'), original.toUpperCase());
});

test('повний цикл: координатний шифротекст у файлі з кількома рядками (токени по рядках)', (t) => {
  const file = path.join(makeTempDir(t), 'coords.txt');
  const square = buildSquare('uk', 'БЕЗПЕКА');
  const lines = ['СЛАВА', 'УКРАЇНІ'].map((line) => polybius.encryptCoordinates(line, square));
  writeUtf8File(file, `${lines.join('\n')}\n`);
  const read = readUtf8File(file).split('\n');
  assert.equal(read.at(-1), ''); // завершальний перенос збережено
  assert.deepEqual(read.slice(0, 2).map((line) => polybius.decryptCoordinates(line, square)), ['СЛАВА', 'УКРАЇНІ']);
});
