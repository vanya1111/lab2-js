'use strict';

const fs = require('node:fs');
const readline = require('node:readline/promises');
const { parseArgs } = require('node:util');
const { CipherError, UsageError } = require('./errors');
const { ALPHABETS } = require('./alphabets');
const { MODES, OPERATIONS, run } = require('./api');
const { buildSquare, formatSquare } = require('./square');
const { readUtf8File, writeUtf8File } = require('./fileio');
const { version } = require('../package.json');

const EXIT_OK = 0;
const EXIT_DATA_ERROR = 1;
const EXIT_USAGE_ERROR = 2;

const HELP = `Квадрат Полібія та шифр Гронсфельда (версія ${version})
Лише для навчання: не використовуйте для реального захисту даних.

Використання:
  ciphers2 encrypt     --mode <режим> --lang <uk|lat> --key <ключ> [джерело тексту] [--out файл]
  ciphers2 decrypt     --mode <режим> --lang <uk|lat> --key <ключ> [джерело тексту] [--out файл]
  ciphers2 square      --lang <uk|lat> --key <ключове слово>   показати активний квадрат 6×6
  ciphers2 rules       правила підготовки тексту
  ciphers2 interactive покроковий діалоговий режим
  ciphers2 --help      ця довідка

Режими (--mode):
  polybius-coordinates  квадрат Полібія, координати «рядок стовпець»; --key ключове слово
  polybius-row-shift    циклічний зсув за рядками квадрата; --key ключове слово
  gronsfeld             шифр Гронсфельда; --key рядок цифр (початкові нулі зберігаються)

Алфавіт (--lang) обирається явно: uk (український) або lat (латинський).

Джерело тексту (одне з):
  --text "текст"   текст з командного рядка
  --in файл        UTF-8 файл
  (нічого)         текст зі стандартного входу

Параметри:
  --out файл       записати результат у файл (UTF-8, атомарно)
  --strip-spaces   окрема операція: вилучити пробільні символи перед зашифруванням
                   у режимі polybius-coordinates (кількість буде показано)

Коди завершення: 0 — успіх, 1 — помилка ключа чи даних, 2 — помилка аргументів.
`;

const RULES = `Правила підготовки тексту
  Кодування:    UTF-8; обробка Unicode-рядків (кодові точки), а не байтів
  Нормалізація: NFC, потім верхній регістр, потім знову NFC
  Алфавіт:      обирається явно (uk або lat), автоматичного визначення мови немає
  Квадрати:     uk — 33 літери + цифри 0 1 2; lat — 26 літер + цифри 0–9; розмір 6×6
  Ключове слово: символи вибраного квадрата, щонайменше одна літера; повтори відкидаються
  coordinates:  strict — лише символи квадрата; токени «рядок стовпець» через один пробіл;
                пробіли вилучаються окремою операцією --strip-spaces
  row shift:    символ квадрата → символ наступного рядка того самого стовпця (циклічно);
                інші символи лишаються без змін
  Гронсфельд:   змінюються лише літери вибраного алфавіту; пробіли, цифри, розділові знаки
                не змінюються і не просувають цифровий ключ; ключ — рядок цифр, не лише нулі
  decrypt coordinates: з кінця введення прибирається один завершальний перенос рядка
`;

const OPTIONS = {
  mode: { type: 'string', short: 'm' },
  lang: { type: 'string', short: 'l' },
  key: { type: 'string', short: 'k' },
  text: { type: 'string', short: 't' },
  in: { type: 'string', short: 'i' },
  out: { type: 'string', short: 'o' },
  'strip-spaces': { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
};

function defaultIo() {
  return {
    stdout: (message) => process.stdout.write(message),
    stderr: (message) => process.stderr.write(message),
    readStdin: () => (process.stdin.isTTY ? null : fs.readFileSync(0, 'utf8')),
    input: process.stdin,
    output: process.stdout,
  };
}

function readInputText(values, io) {
  if (values.text !== undefined && values.in !== undefined) {
    throw new UsageError('Вкажіть лише одне джерело тексту: --text або --in.');
  }
  if (values.text !== undefined) return values.text;
  if (values.in !== undefined) return readUtf8File(values.in);
  const piped = io.readStdin();
  if (piped === null) {
    throw new UsageError('Не вказано текст: використайте --text, --in або передайте текст через стандартний вхід.');
  }
  return piped;
}

/** Файли й канали зазвичай завершуються переносом; для токенів Полібія знімаємо рівно один. */
const dropOneTrailingNewline = (text) => text.replace(/\r?\n$/, '');

function reportRemoved(result, io) {
  if (result.removed !== undefined) {
    io.stderr(`Вилучено пробільних символів: ${result.removed}.\n`);
  }
}

function runCommand(command, values, io) {
  if (!values.mode) throw new UsageError('Не вказано режим (--mode).');
  if (!Object.hasOwn(MODES, values.mode)) {
    throw new UsageError(`Невідомий режим «${values.mode}». Доступні: ${Object.keys(MODES).join(', ')}.`);
  }
  if (!values.lang) throw new UsageError('Не вказано алфавіт (--lang uk або --lang lat).');
  if (values['strip-spaces'] && !(values.mode === 'polybius-coordinates' && command === 'encrypt')) {
    throw new UsageError('--strip-spaces діє лише при зашифруванні в режимі polybius-coordinates.');
  }
  let text = readInputText(values, io);
  if (values.mode === 'polybius-coordinates' && command === 'decrypt') {
    text = dropOneTrailingNewline(text);
  }
  const result = run({
    mode: values.mode,
    operation: command,
    lang: values.lang,
    text,
    key: values.key,
    stripSpaces: Boolean(values['strip-spaces']),
  });
  if (values.out !== undefined) {
    writeUtf8File(values.out, result.text);
    io.stdout(`Результат записано у файл «${values.out}».\n`);
  } else {
    io.stdout(`${result.text}\n`);
  }
  reportRemoved(result, io);
}

function squareCommand(values, io) {
  if (!values.lang) throw new UsageError('Не вказано алфавіт (--lang uk або --lang lat).');
  if (values.key === undefined) throw new UsageError('Не вказано ключове слово (--key).');
  io.stdout(`Квадрат Полібія, алфавіт ${values.lang}, ключ ${values.key}\n${formatSquare(buildSquare(values.lang, values.key))}\n`);
}

async function interactive(io) {
  const rl = readline.createInterface({ input: io.input, output: io.input.isTTY ? io.output : undefined });
  const lines = rl[Symbol.asyncIterator]();
  const ask = async (question) => {
    io.stdout(`${question} `);
    const { value, done } = await lines.next();
    if (done) {
      io.stdout('\n');
      throw Object.assign(new Error('Введення завершено.'), { code: 'ERR_USE_AFTER_CLOSE' });
    }
    return value.trim();
  };
  try {
    io.stdout(`${RULES}\n`);
    const langs = Object.keys(ALPHABETS);
    const modes = Object.keys(MODES);
    let again = true;
    while (again) {
      try {
        langs.forEach((id, i) => io.stdout(`  ${i + 1}) ${id} — ${ALPHABETS[id].title}\n`));
        const lang = langs[Number(await ask('Оберіть алфавіт (номер):')) - 1];
        modes.forEach((id, i) => io.stdout(`  ${i + 1}) ${id} — ${MODES[id]}\n`));
        const mode = modes[Number(await ask('Оберіть режим (номер):')) - 1];
        const operation = OPERATIONS[Number(await ask('Операція: 1 — зашифрувати, 2 — розшифрувати:')) - 1];
        if (!lang || !mode || !operation) throw new CipherError('Некоректний вибір алфавіту, режиму чи операції.');
        const key = await ask(mode === 'gronsfeld' ? 'Цифровий ключ:' : 'Ключове слово:');
        if (mode !== 'gronsfeld') io.stdout(`${formatSquare(buildSquare(lang, key))}\n`);
        let stripSpaces = false;
        if (mode === 'polybius-coordinates' && operation === 'encrypt') {
          stripSpaces = (await ask('Вилучити пробіли перед зашифруванням? (т/н):')).toLowerCase().startsWith('т');
        }
        const raw = await ask('Текст (або @шлях/до/файлу.txt для UTF-8 файлу):');
        let text = raw.startsWith('@') ? readUtf8File(raw.slice(1)) : raw;
        if (mode === 'polybius-coordinates' && operation === 'decrypt') text = dropOneTrailingNewline(text);
        const result = run({ mode, operation, lang, text, key, stripSpaces });
        io.stdout(`Результат: ${result.text}\n`);
        reportRemoved(result, io);
      } catch (error) {
        if (!(error instanceof CipherError)) throw error;
        io.stderr(`Помилка: ${error.message}\n`);
      }
      io.stdout('\n');
      again = (await ask('Продовжити? (т/н):')).toLowerCase().startsWith('т');
    }
  } catch (error) {
    if (error.code !== 'ERR_USE_AFTER_CLOSE' && error.name !== 'AbortError') throw error;
  } finally {
    rl.close();
  }
}

/** Повертає код завершення; все виведення йде через io. */
async function main(argv, io = defaultIo()) {
  try {
    let parsed;
    try {
      parsed = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true });
    } catch (error) {
      throw new UsageError(error.message);
    }
    const { values, positionals } = parsed;

    if (values.help) {
      io.stdout(HELP);
      return EXIT_OK;
    }
    if (values.version) {
      io.stdout(`${version}\n`);
      return EXIT_OK;
    }
    const [command, ...extra] = positionals;
    if (!command) {
      io.stderr(`Не вказано команду.\n\n${HELP}`);
      return EXIT_USAGE_ERROR;
    }
    if (extra.length > 0) {
      throw new UsageError(`Зайвий аргумент «${extra[0]}». Тексти з пробілами беріть у лапки.`);
    }

    switch (command) {
      case 'encrypt':
      case 'decrypt':
        runCommand(command, values, io);
        return EXIT_OK;
      case 'square':
        squareCommand(values, io);
        return EXIT_OK;
      case 'rules':
        io.stdout(RULES);
        return EXIT_OK;
      case 'interactive':
        await interactive(io);
        return EXIT_OK;
      default:
        throw new UsageError(`Невідома команда «${command}». Доступні: encrypt, decrypt, square, rules, interactive.`);
    }
  } catch (error) {
    if (error instanceof UsageError) {
      io.stderr(`Помилка аргументів: ${error.message}\nДовідка: ciphers2 --help\n`);
      return EXIT_USAGE_ERROR;
    }
    if (error instanceof CipherError) {
      io.stderr(`Помилка: ${error.message}\n`);
      return EXIT_DATA_ERROR;
    }
    throw error;
  }
}

module.exports = { main, HELP, RULES };
