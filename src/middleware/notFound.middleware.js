export function notFoundHandler(req, res) {
  res.status(404).json({
    status: 'error',
    message: `Cannot ${req.method} ${req.originalUrl} - Route not found`,
  });
}
