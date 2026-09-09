export function notFound(req, res) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  });
}

export function errorHandler(error, req, res, next) {
  let status = Number(error.status || error.statusCode || 500);
  let code = error.code || 'INTERNAL_ERROR';
  let message = error.message || 'Internal server error';

  if (error.code === 'LIMIT_FILE_SIZE') {
    status = 422;
    code = 'FILE_TOO_LARGE';
    message = 'Uploaded file is too large';
  } else if (typeof error.code === 'string' && error.code.startsWith('LIMIT_')) {
    status = 422;
    code = 'INVALID_FILE_UPLOAD';
    message = 'Invalid file upload request';
  }

  if (error.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'Request body contains invalid JSON';
  }
  if (error.type === 'entity.too.large') {
    status = 413;
    code = 'REQUEST_TOO_LARGE';
    message = 'Request body is too large';
  }

  if (error.code === 'ER_DUP_ENTRY') {
    status = 409;
    code = 'DUPLICATE_VALUE';
    message = 'A unique value is already in use';
  }
  if (error.code === 'ER_NO_REFERENCED_ROW_2') {
    status = 422;
    code = 'INVALID_REFERENCE';
    message = 'A referenced entity does not exist';
  }
  if (error.code === 'ER_ROW_IS_REFERENCED_2') {
    status = 409;
    code = 'ENTITY_IN_USE';
    message = 'The entity is still referenced by other data';
  }
  if (error.code === 'ER_DATA_TOO_LONG') {
    status = 422;
    code = 'VALUE_TOO_LONG';
    message = 'One or more values exceed the allowed length';
  }

  if (status >= 500) {
    message = 'Internal server error';
    if (process.env.NODE_ENV !== 'production') console.error(error);
  }

  const payload = {
    error: {
      code,
      message,
    },
  };
  if (error.details) payload.error.details = error.details;
  res.status(status).json(payload);
}
