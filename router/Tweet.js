const router = require("express").Router();
const User = require("../model/User");
const { TwitterApi } = require("twitter-api-v2");
const { makeThread } = require("../utils");
// const { redisClient, createRedisClient } = require("../utils/RedisClient");

const { RedisClient } = require("./utils/RedisClient");

// createRedisClient();

const redisClient = RedisClient();

router.post("/thread", async (req, res) => {
  try {
    let userdb;
    const { username, threadsList, scheduled, date } = req.body;
    const user = await redisClient.get(`username=${username}`);
    if (user) {
      userdb = JSON.parse(user);
    } else {
      userdb = await User.findOne({ username: username });
      await redisClient.set(`username=${username}`, JSON.stringify(userdb));
    }
    const client = new TwitterApi(userdb.accessToken);

    /* Make a Thread */
    const thread = await makeThread(client, threadsList);
    res.status(201).json(thread);
  } catch (error) {
    console.log(error);
  }
});

module.exports = router;
