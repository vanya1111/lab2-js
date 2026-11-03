'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const { spawnSync } = require('node:child_process');
const { main } = require('../src/cli');

function makeIo(stdin = null) {
  const out = [];
  const err = [];
  return {
    io: { stdout: (m) => out.push(m), stderr: (m) => err.push(m), readStdin: () => stdin },
    stdout: () => out.join(''),
    stderr: () => err.join(''),
  };
}

async function exec(args, stdin) {
  const harness = makeIo(stdin);
  const code = await main(args, harness.io);
  return { code, stdout: harness.stdout(), stderr: harness.stderr() };
}

const UK_COORD = ['--mode', 'polybius-coordinates', '--lang', 'uk', '--key', 'БЕЗПЕКА'];

test('encrypt: Полібій coordinates (український)', async () => {
  const r = await exec(['encrypt', ...UK_COORD, '--text', 'Слава']);
  assert.equal(r.code, 0);
  assert.equal(r.stdout, '44 35 16 21 16\n');
});

test('decrypt: Полібій coordinates повертає текст', async () => {
  const r = await exec(['decrypt', ...UK_COORD, '--text', '44 35 16 21 16']);
  assert.equal(r.stdout, 'СЛАВА\n');
});

test('encrypt: Полібій row shift (латинський)', async () => {
  const r = await exec(['encrypt', '--mode', 'polybius-row-shift', '--lang', 'lat', '--key', 'SECURITY', '--text', 'Hello']);
  assert.equal(r.stdout, 'OYVVZ\n');
});

test('encrypt: Гронсфельд (український і латинський)', async () => {
  const uk = await exec(['encrypt', '--mode', 'gronsfeld', '--lang', 'uk', '--key', '31415', '--text', 'Слава Україні']);
  assert.equal(uk.stdout, 'ФМҐГД ЦЛФБНРЇ\n');
  const lat = await exec(['encrypt', '--mode', 'gronsfeld', '--lang', 'lat', '--key', '2718', '--text', 'Hello World']);
  assert.equal(lat.stdout, 'JLMTQ DPZNK\n');
});

test('Гронсфельд: початковий нуль у ключі з командного рядка зберігається', async () => {
  const a = await exec(['encrypt', '--mode', 'gronsfeld', '--lang', 'uk', '--key', '07', '--text', 'АА']);
  assert.equal(a.stdout, 'АЄ\n');
});

test('--strip-spaces: окрема видима операція, кількість — у stderr', async () => {
  const r = await exec(['encrypt', ...UK_COORD, '--strip-spaces', '--text', 'Слава Україні']);
  assert.equal(r.code, 0);
  assert.equal(r.stdout, '44 35 16 21 16 46 15 43 16 33 41 32\n');
  assert.match(r.stderr, /Вилучено пробільних символів: 1/);
});

test('без --strip-spaces пробіл у coordinates — помилка з підказкою', async () => {
  const r = await exec(['encrypt', ...UK_COORD, '--text', 'Слава Україні']);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /--strip-spaces/);
});

test('--strip-spaces поза coordinates + encrypt — помилка аргументів (код 2)', async () => {
  assert.equal((await exec(['encrypt', '--mode', 'gronsfeld', '--lang', 'uk', '--key', '1', '--strip-spaces', '--text', 'А'])).code, 2);
  assert.equal((await exec(['decrypt', ...UK_COORD, '--strip-spaces', '--text', '11'])).code, 2);
});

test('stdin: завершальний перенос при розшифруванні координат знімається, зворотність через канал', async () => {
  const enc = await exec(['encrypt', ...UK_COORD, '--text', 'Слава']);
  const dec = await exec(['decrypt', ...UK_COORD], enc.stdout); // enc.stdout закінчується '\n'
  assert.equal(dec.code, 0);
  assert.equal(dec.stdout, 'СЛАВА\n');
  const crlf = await exec(['decrypt', ...UK_COORD], '44 35\r\n');
  assert.equal(crlf.stdout, 'СЛ\n');
});

test('decrypt coordinates: зайвий пробіл лишається помилкою (знімається тільки перенос)', async () => {
  const r = await exec(['decrypt', ...UK_COORD], '44 35 \n');
  assert.equal(r.code, 1);
  assert.match(r.stderr, /порожній/);
});

test('помилки токенів: код 1, зрозуміле повідомлення, без виведення в stdout', async () => {
  for (const token of ['00', '17', '67']) {
    const r = await exec(['decrypt', ...UK_COORD, '--text', `11 ${token}`]);
    assert.equal(r.code, 1);
    assert.match(r.stderr, new RegExp(`Токен 2 «${token}»`));
    assert.equal(r.stdout, '');
  }
});

test('помилки ключів: код 1', async () => {
  assert.equal((await exec(['encrypt', '--mode', 'gronsfeld', '--lang', 'uk', '--key', '0000', '--text', 'А'])).code, 1);
  assert.equal((await exec(['encrypt', '--mode', 'gronsfeld', '--lang', 'uk', '--key', '', '--text', 'А'])).code, 1);
  assert.equal((await exec(['encrypt', '--mode', 'polybius-row-shift', '--lang', 'uk', '--key', '012', '--text', 'А'])).code, 1);
  assert.equal((await exec(['encrypt', '--mode', 'polybius-row-shift', '--lang', 'uk', '--key', 'KEY', '--text', 'А'])).code, 1);
});

test('алфавіт обирається явно: без --lang або з невідомим — код 2 / 1, мовчки не вгадується', async () => {
  const none = await exec(['encrypt', '--mode', 'gronsfeld', '--key', '31415', '--text', 'А']);
  assert.equal(none.code, 2);
  assert.match(none.stderr, /--lang/);
  const unknown = await exec(['encrypt', '--mode', 'gronsfeld', '--lang', 'en', '--key', '31415', '--text', 'А']);
  assert.equal(unknown.code, 1);
  assert.match(unknown.stderr, /«en»/);
});

test('помилки аргументів: код 2', async () => {
  assert.equal((await exec([])).code, 2);
  assert.equal((await exec(['encrypt', '--lang', 'uk', '--key', 'К', '--text', 'А'])).code, 2); // немає --mode
  assert.equal((await exec(['encrypt', '--mode', 'rot13', '--lang', 'uk', '--text', 'А'])).code, 2);
  assert.equal((await exec(['encrypt', ...UK_COORD, '--bogus'])).code, 2);
  assert.equal((await exec(['dance'])).code, 2);
  assert.equal((await exec(['encrypt', ...UK_COORD, '--text', 'А', '--in', 'x'])).code, 2);
  assert.equal((await exec(['encrypt', ...UK_COORD])).code, 2); // немає тексту
  assert.equal((await exec(['encrypt', ...UK_COORD, 'зайвий'])).code, 2);
});

test('square: показує активний квадрат 6×6', async () => {
  const r = await exec(['square', '--lang', 'uk', '--key', 'БЕЗПЕКА']);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /Б Е З П К А/);
  assert.match(r.stdout, /Ь Ю Я 0 1 2/);
  assert.equal((await exec(['square', '--lang', 'uk'])).code, 2);
  assert.equal((await exec(['square', '--key', 'К'])).code, 2);
  assert.equal((await exec(['square', '--lang', 'lat', '--key', ''])).code, 1);
});

test('--help, --version і rules повертають код 0', async () => {
  const help = await exec(['--help']);
  assert.equal(help.code, 0);
  assert.match(help.stdout, /polybius-coordinates/);
  assert.equal((await exec(['--version'])).code, 0);
  assert.match((await exec(['rules'])).stdout, /NFC/);
});

test('--in та --out: UTF-8 файли; при помилці частково записаного файлу немає', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lab2-cli-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const input = path.join(dir, 'in.txt');
  const output = path.join(dir, 'out.txt');
  fs.writeFileSync(input, 'Слава Україні\nГероям слава\n', 'utf8');

  const ok = await exec(['encrypt', '--mode', 'gronsfeld', '--lang', 'uk', '--key', '31415', '--in', input, '--out', output]);
  assert.equal(ok.code, 0);
  assert.ok(fs.existsSync(output));

  const failed = path.join(dir, 'failed.txt');
  const bad = await exec(['encrypt', ...UK_COORD, '--in', input, '--out', failed]); // пробіли й перенос → помилка
  assert.equal(bad.code, 1);
  assert.equal(fs.existsSync(failed), false);
  assert.deepEqual(fs.readdirSync(dir).filter((n) => n.endsWith('.tmp')), []);
});

test('файли: координатний цикл із --strip-spaces через --out і --in', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lab2-cli-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const input = path.join(dir, 'in.txt');
  const cipher = path.join(dir, 'c.txt');
  const back = path.join(dir, 'back.txt');
  fs.writeFileSync(input, 'Слава Україні', 'utf8');
  assert.equal((await exec(['encrypt', ...UK_COORD, '--strip-spaces', '--in', input, '--out', cipher])).code, 0);
  assert.equal((await exec(['decrypt', ...UK_COORD, '--in', cipher, '--out', back])).code, 0);
  assert.equal(fs.readFileSync(back, 'utf8'), 'СЛАВАУКРАЇНІ');
});

test('interactive: діалог, помилка не завершує сесію, квадрат показується', async () => {
  const answers = [
    '1', '1', '1', 'БЕЗПЕКА', 'н', 'слава', 'т', //   uk, coordinates, encrypt
    '2', '3', '1', '0000', 'А', 'т', //               lat, gronsfeld, encrypt, ключ лише з нулів → помилка
    '1', '3', '1', '31415', 'Слава Україні', 'н', //  uk, gronsfeld
  ];
  const harness = makeIo();
  const code = await main(['interactive'], { ...harness.io, input: Readable.from(answers.map((l) => `${l}\n`)), output: undefined });
  assert.equal(code, 0);
  assert.match(harness.stdout(), /Б Е З П К А/);
  assert.match(harness.stdout(), /Результат: 44 35 16 21 16/);
  assert.match(harness.stdout(), /Результат: ФМҐГД ЦЛФБНРЇ/);
  assert.match(harness.stderr(), /Помилка: Цифровий ключ не може складатися лише з нулів/);
});

test('interactive: обрив введення завершується без аварії', async () => {
  const harness = makeIo();
  const code = await main(['interactive'], { ...harness.io, input: Readable.from([]), output: undefined });
  assert.equal(code, 0);
});

test('справжній запуск процесу: код завершення і UTF-8 на виході', () => {
  const bin = path.join(__dirname, '..', 'bin', 'ciphers2.js');
  const ok = spawnSync(process.execPath, [bin, 'encrypt', ...UK_COORD, '--text', 'Слава'], { encoding: 'utf8' });
  assert.equal(ok.status, 0);
  assert.equal(ok.stdout, '44 35 16 21 16\n');
  const bad = spawnSync(process.execPath, [bin, 'decrypt', ...UK_COORD, '--text', '00'], { encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /Токен 1 «00»/);
});
