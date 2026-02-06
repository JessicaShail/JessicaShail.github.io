const { Client } = require('pg');

function withSslMode(url) {
  if (!url) return url;
  if (url.includes('sslmode=')) return url;
  try {
    const u = new URL(url);
    if (!u.searchParams.has('sslmode')) {
      u.searchParams.set('sslmode', 'verify-full');
    }
    return u.toString();
  } catch (e) {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}sslmode=verify-full`;
  }
}

function getConnectionString() {
  return withSslMode(process.env.NETLIFY_DATABASE_URL);
}

function createDbClient(options = {}) {
  return new Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false },
    ...options
  });
}

module.exports = {
  createDbClient,
  getConnectionString,
  withSslMode
};
