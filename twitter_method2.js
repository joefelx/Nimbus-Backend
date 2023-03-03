const Twitter = require("twitter");
const express = require("express");

const app = express();

var client = new Twitter({
  consumer_key: process.env.CLIENT_ID,
  consumer_secret: process.env.CLIENT_SECRET,
});

app.get("/tweet", async (req, res) => {
  await client.post(
    "statuses/update",
    { status: "Hello fellow" },
    (err, tweet, res) => {
      if (!err) {
        console.log(tweet);
      }
    }
  );
  res.json("hello");
});

app.listen(6000, () => console.log("server started at 6000"));
