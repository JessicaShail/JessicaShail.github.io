const { Client } = require('pg');

function withSslMode(url) {
  if (!url) return url;
  try {
    const u = new URL(url);
    // Always enforce verify-full to avoid pg warning about weaker modes
    u.searchParams.set('sslmode', 'verify-full');
    return u.toString();
  } catch (e) {
    const base = url.replace(/([?&])sslmode=[^&]+(&?)/i, (m, p1, p2) => (p2 ? p1 : ''));
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}sslmode=verify-full`;
  }
}

function getConnectionString() {
  return withSslMode(process.env.NETLIFY_DATABASE_URL);
}

function createDbClient(options = {}) {
  return new Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: true },
    ...options
  });
}

module.exports = {
  createDbClient,
  getConnectionString,
  withSslMode
};
