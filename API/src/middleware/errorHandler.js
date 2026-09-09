export function notFound(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
}

export function errorHandler(error, req, res, next) {
  const status = error.status || 500;
  const payload = {
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: status === 500 ? 'Internal server error' : error.message,
    },
  };
  if (error.details) payload.error.details = error.details;
  if (process.env.NODE_ENV !== 'production' && status === 500) console.error(error);
  res.status(status).json(payload);
}
