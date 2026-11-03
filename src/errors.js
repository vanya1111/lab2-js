'use strict';

/** Передбачувана помилка ключа чи даних: CLI повертає код 1. */
class CipherError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CipherError';
  }
}

/** Помилка аргументів командного рядка: CLI повертає код 2. */
class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UsageError';
  }
}

module.exports = { CipherError, UsageError };
