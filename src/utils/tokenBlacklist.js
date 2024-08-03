import Redis from 'ioredis';
import jwt from 'jsonwebtoken';

const redis = new Redis();

export const addToBlacklist = async (token) => {
  const decoded = jwt.decode(token);
  const expiresAt = decoded.exp - Math.floor(Date.now() / 1000);

  if (expiresAt > 0) {
    await redis.set(token, 'blacklisted', 'EX', expiresAt);
  } else {
    // Token is already expired, so you can choose to set a short expiry time or handle it differently
    await redis.set(token, 'blacklisted', 'EX', 10); // Sets a default 1-minute expiration
  }
};

export const isBlacklisted = async (token) => {
  const result = await redis.get(token);
  return result === 'blacklisted';
};
