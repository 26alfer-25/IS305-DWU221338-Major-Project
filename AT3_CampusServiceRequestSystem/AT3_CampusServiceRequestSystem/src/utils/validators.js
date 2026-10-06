'use strict';

const { ValidationError } = require('./errors');

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidEmail(value) {
  return isNonEmptyString(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Returns the trimmed text or throws a clear ValidationError. */
function requireText(value, fieldName) {
  if (!isNonEmptyString(value)) {
    throw new ValidationError(`${fieldName} is required and cannot be empty.`);
  }
  return value.trim();
}

/** Returns the value if it is one of the allowed values, otherwise throws. */
function requireOneOf(value, allowed, fieldName) {
  if (!allowed.includes(value)) {
    throw new ValidationError(
      `${fieldName} "${value}" is not supported. Choose one of: ${allowed.join(', ')}.`
    );
  }
  return value;
}

module.exports = { isNonEmptyString, isValidEmail, requireText, requireOneOf };
