'use strict';

const fs = require('node:fs');
const { CipherError } = require('./errors');

/** Читає файл як UTF-8; BOM прибирається, некоректні байти — помилка. */
function readUtf8File(file) {
  let buffer;
  try {
    buffer = fs.readFileSync(file);
  } catch (error) {
    throw new CipherError(`Не вдалося прочитати файл «${file}»: ${error.code ?? error.message}.`);
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer); // BOM знімається
  } catch {
    throw new CipherError(`Файл «${file}» не є коректним UTF-8.`);
  }
}

/** Атомарний запис: спершу тимчасовий файл, потім перейменування. Без BOM. */
function writeUtf8File(file, content) {
  const temp = `${file}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temp, content, 'utf8');
    fs.renameSync(temp, file);
  } catch (error) {
    try {
      fs.unlinkSync(temp);
    } catch {
      /* тимчасового файлу може не бути */
    }
    throw new CipherError(`Не вдалося записати файл «${file}»: ${error.code ?? error.message}.`);
  }
}

module.exports = { readUtf8File, writeUtf8File };
