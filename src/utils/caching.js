import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const { REDIS_USERNAME } = process.env;
const { REDIS_PASSWORD } = process.env;
const { REDIS_HOST } = process.env;
const { REDIS_PORT } = process.env;

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
