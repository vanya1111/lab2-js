#!/usr/bin/env node
'use strict';

/**
 * Відтворюваний експеримент: шифрує власні тексти з samples/ трьома режимами
 * для обох алфавітів, перевіряє розшифрування та пише результати в results/.
 * Запуск: node scripts/demo.js
 */

const path = require('node:path');
const { readUtf8File, writeUtf8File } = require('../src/fileio');
const { buildSquare, formatSquare } = require('../src/square');
const { normalizeText, stripWhitespace } = require('../src/text');
const { ALPHABETS } = require('../src/alphabets');
const polybius = require('../src/polybius');
const gronsfeld = require('../src/gronsfeld');
const { version } = require('../package.json');

const root = path.join(__dirname, '..');
const resultsDir = path.join(root, 'results');

const SETUPS = [
  { lang: 'uk', file: 'plain_uk.txt', keyword: 'КРИПТОГРАФІЯ', digitKey: '07319' },
  { lang: 'lat', file: 'plain_lat.txt', keyword: 'CRYPTOGRAPHY', digitKey: '90210' },
];

const lines = ['# Результати експерименту', '', `- Версія програми: ${version}`, `- Node.js: ${process.version}`, ''];
let allOk = true;
const summary = [];

for (const setup of SETUPS) {
  const { lang, keyword, digitKey } = setup;
  const raw = readUtf8File(path.join(root, 'samples', setup.file)).replace(/\r?\n$/, '');
  const prepared = normalizeText(raw);
  const letterCount = Array.from(prepared).filter((ch) => ALPHABETS[lang].letterIndex.has(ch)).length;
  const square = buildSquare(lang, keyword);
  const stripped = stripWhitespace(prepared); // окрема видима операція для coordinates

  lines.push(`## Алфавіт: ${ALPHABETS[lang].title} (${lang})`, '');
  lines.push(`- Вхідний файл: samples/${setup.file} (літер: ${letterCount}, символів: ${Array.from(prepared).length})`);
  lines.push(`- Ключове слово квадрата: ${keyword}`, `- Цифровий ключ Гронсфельда: ${digitKey}`, '');
  lines.push('Квадрат:', '', '```', formatSquare(square), '```', '');
  lines.push('Відкритий текст (NFC, верхній регістр):', '', '```', prepared, '```', '');

  const experiments = [
    {
      id: 'polybius-coordinates',
      title: `Полібій coordinates (вилучено пробілів: ${stripped.removed})`,
      expected: stripped.text,
      encrypt: () => polybius.encryptCoordinates(stripped.text, square),
      decrypt: (c) => polybius.decryptCoordinates(c, square),
    },
    {
      id: 'polybius-row-shift',
      title: 'Полібій row shift',
      expected: prepared,
      encrypt: () => polybius.encryptRowShift(prepared, square),
      decrypt: (c) => polybius.decryptRowShift(c, square),
    },
    {
      id: 'gronsfeld',
      title: 'Гронсфельд',
      expected: prepared,
      encrypt: () => gronsfeld.encrypt(prepared, lang, digitKey),
      decrypt: (c) => gronsfeld.decrypt(c, lang, digitKey),
    },
  ];

  for (const experiment of experiments) {
    const cipher = experiment.encrypt();
    const restored = experiment.decrypt(cipher);
    const ok = restored === experiment.expected;
    allOk = allOk && ok;
    writeUtf8File(path.join(resultsDir, `${lang}.${experiment.id}.cipher.txt`), cipher);
    writeUtf8File(path.join(resultsDir, `${lang}.${experiment.id}.decrypted.txt`), restored);
    summary.push({ lang, id: experiment.id, ok });
    lines.push(`### ${experiment.title}`, '', `- Розшифрування збігається з підготовленим текстом: ${ok ? 'так' : 'НІ'}`, '');
    lines.push('Шифротекст:', '', '```', cipher, '```', '');
  }
}

lines.push(`Підсумок: ${allOk ? 'усі шість розшифрувань відновили підготовлений текст' : 'ЗНАЙДЕНО РОЗБІЖНІСТЬ'}.`, '');
writeUtf8File(path.join(resultsDir, 'summary.md'), lines.join('\n'));
console.log(lines.join('\n'));
process.exitCode = allOk ? 0 : 1;
