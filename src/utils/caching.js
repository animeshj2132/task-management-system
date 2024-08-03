import { createClient } from 'redis';

const REDIS_USERNAME = process.env.REDIS_USERNAME || 'default';
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || 'ertho80aVmFo6w7YdlL5abbhIL4DLU53';
const REDIS_HOST = process.env.REDIS_HOST || 'redis-12074.c330.asia-south1-1.gce.redns.redis-cloud.com';
const REDIS_PORT = process.env.REDIS_PORT || 12074;

const redisClient = createClient({
  url: `redis://${REDIS_USERNAME}:${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}`,
});

(async () => {
  try {
    await redisClient.connect();
    console.log('Connected to Redis');
  } catch (error) {
    console.error('Redis connection/authentication error:', error);
  }
})();

redisClient.on('error', (err) => {
  console.error('Redis error:', err);
});

export const GET_ASYNC = async (key) => {
  try {
    const value = await redisClient.get(key);
    return value;
  } catch (err) {
    console.error('Error getting value from Redis:', err);
    throw err;
  }
};

export const SET_ASYNC = async (key, value, expiry = 3600) => {
  try {
    const res = await redisClient.setEx(key, expiry, value);
    return res;
  } catch (err) {
    console.error('Error setting value in Redis:', err);
    throw err;
  }
};

export default redisClient;
