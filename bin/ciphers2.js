#!/usr/bin/env node
'use strict';

const { main } = require('../src/cli');

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    process.stderr.write(`Непередбачена помилка: ${error.message}\n`);
    process.exitCode = 70;
  }
);
