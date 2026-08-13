const NodeCache = require('node-cache');

// Centralized In-Memory Cache Engine (Zero-Redis Architecture)
// Standard default TTL: 2 minutes (120 seconds), check period: 60 seconds
const cache = new NodeCache({
  stdTTL: 120,
  checkperiod: 60,
  useClones: false
});

/**
 * Get value from cache
 * @param {string} key 
 */
const getCache = (key) => {
  try {
    return cache.get(key);
  } catch (err) {
    console.warn(`[Cache Error] Failed to get key "${key}":`, err.message);
    return null;
  }
};

/**
 * Set value in cache
 * @param {string} key 
 * @param {any} value 
 * @param {number} [ttl] - Optional TTL in seconds
 */
const setCache = (key, value, ttl) => {
  try {
    if (ttl) {
      return cache.set(key, value, ttl);
    }
    return cache.set(key, value);
  } catch (err) {
    console.warn(`[Cache Error] Failed to set key "${key}":`, err.message);
    return false;
  }
};

/**
 * Delete key(s) from cache
 * @param {string|string[]} keys 
 */
const delCache = (keys) => {
  try {
    if (typeof keys === 'string') {
      // Invalidate all keys starting with prefix
      const allKeys = cache.keys();
      const matchingKeys = allKeys.filter(k => k.startsWith(keys));
      if (matchingKeys.length > 0) {
        return cache.del(matchingKeys);
      }
      return cache.del(keys);
    }
    return cache.del(keys);
  } catch (err) {
    console.warn(`[Cache Error] Failed to delete keys:`, err.message);
    return 0;
  }
};

/**
 * Clear all cache entries
 */
const flushAllCache = () => {
  try {
    cache.flushAll();
    console.log('🧹 In-memory cache cleared successfully');
  } catch (err) {
    console.warn('[Cache Error] Failed to flush cache:', err.message);
  }
};

module.exports = {
  cache,
  getCache,
  setCache,
  delCache,
  flushAllCache
};
