const redis = require("redis");

// Redis Cache
const createRedisClient = async () => {
  let redisClient = await redis.createClient().connect();
  console.log("Redis connected");
  return redisClient;
};

module.exports = { createRedisClient };
