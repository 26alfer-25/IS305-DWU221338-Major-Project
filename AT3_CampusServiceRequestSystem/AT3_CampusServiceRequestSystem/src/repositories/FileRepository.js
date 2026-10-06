'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { StorageError, DuplicateError, NotFoundError, ValidationError } = require('../utils/errors');

/** True when the value only contains data JSON can hold (no functions, no class instances). */
function isPlainJsonData(value) {
  if (value === null) return true;
  const type = typeof value;
  if (type === 'string' || type === 'boolean') return true;
  if (type === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isPlainJsonData);
  if (type === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.values(value).every(isPlainJsonData);
  }
  return false;
}

/**
 * Reads and writes one JSON file that holds an array of plain records.
 * It knows nothing about users or requests - only files and IDs - so the
 * domain classes and the console menu never touch the file system.
 */
class FileRepository {
  #filePath;
  #idField;
  #label;

  constructor(filePath, { idField, label }) {
    this.#filePath = filePath;
    this.#idField = idField;
    this.#label = label;
  }

  get filePath() { return this.#filePath; }
  get idField() { return this.#idField; }

  /** Reads every record. A missing or empty file gives an empty array (and the file is created). */
  async loadAll() {
    let text;
    try {
      text = await fs.readFile(this.#filePath, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        await this.saveAll([]);
        return [];
      }
      throw new StorageError(`Cannot read the ${this.#label} file "${this.#filePath}": ${error.message}`);
    }
    if (text.trim() === '') return [];
    let records;
    try {
      records = JSON.parse(text);
    } catch (error) {
      throw new StorageError(`The ${this.#label} file "${this.#filePath}" does not contain valid JSON: ${error.message}`);
    }
    if (!Array.isArray(records)) {
      throw new StorageError(`The ${this.#label} file "${this.#filePath}" must contain a JSON array.`);
    }
    return records;
  }

  /** Replaces the whole file. Incomplete, duplicate or non-JSON records are refused before anything is written. */
  async saveAll(records) {
    this.#assertSavable(records);
    const tempPath = `${this.#filePath}.tmp`;
    try {
      await fs.mkdir(path.dirname(this.#filePath), { recursive: true });
      await fs.writeFile(tempPath, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
      await fs.rename(tempPath, this.#filePath);       // the old file stays intact if writing fails
    } catch (error) {
      await fs.rm(tempPath, { force: true }).catch(() => {});
      throw new StorageError(`Cannot write the ${this.#label} file "${this.#filePath}": ${error.message}`);
    }
    return records;
  }

  async create(record) {
    const records = await this.loadAll();
    this.#assertSavable([record]);
    if (records.some((r) => r[this.#idField] === record[this.#idField])) {
      throw new DuplicateError(`A ${this.#label} record with ${this.#idField} "${record[this.#idField]}" already exists.`);
    }
    records.push(record);
    await this.saveAll(records);
    return record;
  }

  async findById(id) {
    const records = await this.loadAll();
    return records.find((r) => r[this.#idField] === id) ?? null;
  }

  async update(id, changes) {
    const records = await this.loadAll();
    const index = records.findIndex((r) => r[this.#idField] === id);
    if (index === -1) {
      throw new NotFoundError(`No ${this.#label} record with ${this.#idField} "${id}" was found.`);
    }
    records[index] = { ...records[index], ...changes, [this.#idField]: id };   // the ID never changes
    await this.saveAll(records);
    return records[index];
  }

  async filterBy(field, value) {
    const records = await this.loadAll();
    return records.filter((r) => r[field] === value);
  }

  #assertSavable(records) {
    if (!Array.isArray(records)) {
      throw new ValidationError(`The ${this.#label} data must be an array of records.`);
    }
    const seen = new Set();
    for (const record of records) {
      if (record === null || typeof record !== 'object' || !isPlainJsonData(record)) {
        throw new ValidationError(`A ${this.#label} record contains data that cannot be saved as JSON.`);
      }
      const id = record[this.#idField];
      if (typeof id !== 'string' || id.trim() === '') {
        throw new ValidationError(`A ${this.#label} record is missing its ${this.#idField}, so it was not saved.`);
      }
      if (seen.has(id)) {
        throw new DuplicateError(`Two ${this.#label} records share the ${this.#idField} "${id}", so nothing was saved.`);
      }
      seen.add(id);
    }
  }
}

module.exports = { FileRepository, isPlainJsonData };
