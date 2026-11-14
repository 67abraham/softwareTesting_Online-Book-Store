// Error helpers and the global error handler.
// Every error response has the shape:
//   { "error": { "code": "...", "message": "...", "fields": { ... } } }

class AppError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

const GENERIC_ERROR = 'Something went wrong. Please try again.';
const VALIDATION_SUMMARY = 'Please correct the highlighted fields.';

// Throws a 400 VALIDATION_ERROR if the fields object has any entries.
function throwIfInvalid(fields) {
  if (Object.keys(fields).length > 0) {
    throw new AppError(400, 'VALIDATION_ERROR', VALIDATION_SUMMARY, fields);
  }
}

function notFoundRoute(req, res, next) {
  next(new AppError(404, 'NOT_FOUND', 'Route not found.'));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Malformed JSON body sent by the client
  if (err.type === 'entity.parse.failed') {
    err = new AppError(400, 'BAD_REQUEST', 'Request body must be valid JSON.');
  }

  if (err instanceof AppError) {
    const body = { error: { code: err.code, message: err.message } };
    if (err.fields) body.error.fields = err.fields;
    return res.status(err.status).json(body);
  }

  // Unexpected error: log details on the server only.
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err);
  res.status(500).json({ error: { code: 'SERVER_ERROR', message: GENERIC_ERROR } });
}

module.exports = { AppError, throwIfInvalid, notFoundRoute, errorHandler, GENERIC_ERROR };
