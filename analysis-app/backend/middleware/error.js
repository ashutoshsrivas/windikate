/* Central error handler — keeps stack traces off the wire in production. */
module.exports = function errorMiddleware(err, req, res, _next) {
    const status = err.status || err.statusCode || 500;
    const payload = {
        error: err.publicMessage || (status >= 500 ? 'Internal server error' : err.message)
    };
    if (process.env.NODE_ENV !== 'production') {
        payload.detail = err.message;
        payload.stack = err.stack;
    }
    if (status >= 500) console.error('[error]', err);
    res.status(status).json(payload);
};
