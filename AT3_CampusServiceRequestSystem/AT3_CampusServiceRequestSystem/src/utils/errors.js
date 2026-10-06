'use strict';

/** Base class for every error the application throws on purpose. */
class AppError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}

class ValidationError extends AppError {}   // bad or missing input
class DuplicateError extends AppError {}    // an ID already exists
class NotFoundError extends AppError {}     // a user or request does not exist
class PermissionError extends AppError {}   // the person is not allowed to do this
class WorkflowError extends AppError {}     // the request is in the wrong state
class StorageError extends AppError {}      // a JSON file cannot be read or written
class NotImplementedError extends AppError {} // a subclass forgot to implement a required method

module.exports = {
  AppError,
  ValidationError,
  DuplicateError,
  NotFoundError,
  PermissionError,
  WorkflowError,
  StorageError,
  NotImplementedError,
};
