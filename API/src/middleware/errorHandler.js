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
  }
  if (error.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'Request body contains invalid JSON';
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
