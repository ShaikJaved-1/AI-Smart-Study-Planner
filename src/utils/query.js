// Keeps only plain string query parameters (drops arrays/objects such as ?status[]=x) so they are safe to bind.
module.exports = (query) => Object.fromEntries(Object.entries(query || {}).filter(([, v]) => typeof v === 'string'));
