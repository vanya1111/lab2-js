'use strict';

const { CipherError } = require('./errors');

/** Людиночитне подання символу для повідомлень про помилки. */
function describeChar(ch) {
  const code = ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
  const invisible = /^[\p{C}\p{Z}]$/u.test(ch);
  return invisible ? `U+${code}` : `U+${code} «${ch}»`;
}

/** Показує керівні символи у вигляді escape-послідовностей. */
function quote(text) {
  return `«${String(text).replaceAll('\r', '\\r').replaceAll('\n', '\\n').replaceAll('\t', '\\t')}»`;
}

/** Перевіряє тип і коректність Unicode, далі NFC → верхній регістр → NFC. */
function normalizeText(text, subject = 'Текст') {
  if (typeof text !== 'string') {
    throw new CipherError(`${subject} має бути рядком.`);
  }
  if (typeof text.isWellFormed === 'function' && !text.isWellFormed()) {
    throw new CipherError(`${subject} містить некоректний Unicode (непарний сурогат).`);
  }
  return text.normalize('NFC').toUpperCase().normalize('NFC');
}

/** Окрема, видима операція підготовки: прибирає всі пробільні символи й повідомляє скільки. */
function stripWhitespace(text) {
  if (typeof text !== 'string') {
    throw new CipherError('Текст має бути рядком.');
  }
  const chars = Array.from(text);
  const kept = chars.filter((ch) => !/\s/u.test(ch));
  return { text: kept.join(''), removed: chars.length - kept.length };
}

module.exports = { describeChar, quote, normalizeText, stripWhitespace };
