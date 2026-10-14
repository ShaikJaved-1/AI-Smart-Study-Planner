const path = require('path');
const express = require('express');
const env = require('./src/config/env');
const routes = require('./src/routes');
const { notFound, errorHandler } = require('./src/middleware/errorHandler');

const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', routes);
app.use('/api', notFound);
app.use(errorHandler);

if (require.main === module) {
  app.listen(env.port, () => console.log(`Smart Study Planner running at http://localhost:${env.port}`));
}
module.exports = app;
