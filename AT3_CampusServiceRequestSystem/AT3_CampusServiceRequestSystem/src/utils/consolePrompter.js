'use strict';

const readline = require('node:readline');

/**
 * Small wrapper around readline that hands out one line per question.
 * Lines typed (or piped in) before a question is asked are buffered, so
 * scripted input such as `node src/CampusServiceApp.js < input.txt` works.
 * ask() resolves to null when the input has finished.
 */
function createConsolePrompter(input = process.stdin, output = process.stdout) {
  const rl = readline.createInterface({ input, output });
  const buffered = [];
  const waiting = [];
  let closed = false;

  rl.on('line', (line) => {
    if (waiting.length > 0) waiting.shift()(line);
    else buffered.push(line);
  });
  rl.on('close', () => {
    closed = true;
    while (waiting.length > 0) waiting.shift()(null);
  });

  function ask(question) {
    rl.setPrompt(question);
    if (buffered.length > 0) {
      const line = buffered.shift();
      output.write(`${question}${line}\n`);
      return Promise.resolve(line);
    }
    if (closed) return Promise.resolve(null);
    rl.prompt();
    return new Promise((resolve) => waiting.push(resolve));
  }

  return { ask, close: () => rl.close() };
}

module.exports = { createConsolePrompter };
