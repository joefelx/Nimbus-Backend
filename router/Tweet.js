const router = require("express").Router();
const User = require("../model/User");
const { TwitterApi } = require("twitter-api-v2");
const { makeThread } = require("../utils");

router.post("/thread", async (req, res) => {
  try {
    const { username, threadsList, scheduled, date } = req.body;
    const userdb = await User.findOne({ username: username });

    if (userdb) {
      const client = new TwitterApi(userdb.accessToken);
      /* Make a Thread */
      const thread = await makeThread(client, threadsList);
      res.status(201).json(thread);
    }

    res.status(404).json({
      data: {
        status: "Failed",
        response: "User not Found",
      },
    });
  } catch (error) {
    console.log(error);
  }
});

module.exports = router;
