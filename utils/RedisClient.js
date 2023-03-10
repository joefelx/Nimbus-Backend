const redis = require("redis");

// Constants and Values
// let redisClient;

class RedisClient {
  constructor() {
    this.createRedisClient();
  }

  static async createRedisClient() {
    this.name = redis.createClient();
    await this.connect();
    console.log("Redis connected");
  }
}

// Redis Cache
// const createRedisClient = async () => {
//   redisClient = redis.createClient();
//   await redisClient.connect();
//   console.log("Redis connected");
// };

module.exports = { RedisClient };
