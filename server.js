require("dotenv").config();
const { TwitterApi } = require("twitter-api-v2");
const express = require("express");
const session = require("express-session");
const mongoose = require("mongoose");
const morgan = require("morgan");
const cors = require("cors");
const redis = require("redis");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const makeThread = require("./utils/makeThread");
const checkMimeType = require("./utils/checkMimeType");

const User = require("./model/User");

// Express server Initialised
const app = express();

// Middlewares
app.use("/images", express.static(path.join(__dirname, "public/images")));
app.use(express.json());
app.use(
  session({
    secret: "keyboard cat",
    resave: false,
    saveUninitialized: true,
  })
);
app.use(morgan("tiny"));
app.use(cors());

// Mongodb setup
mongoose.connect(
  process.env.MONGO_URL,
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  },
  () => {
    console.log("Mongodb is connected");
  }
);

mongoose.set("strictQuery", false);

// Constants and Values
let redisClient;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const callbackURL = "http://localhost:5000/auth/twitter/callback";

// Twitter Client Initialised
const twitterClient = new TwitterApi({
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET,
});

// Redis Cache
const createRedisClient = async () => {
  redisClient = redis.createClient();

  // redisClient.on("connect", console.log("Redis client connected"));

  await redisClient.connect();
  console.log("Redis connected");
};

createRedisClient();

// Storage Middleware
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/images");
  },
  filename: (req, file, cb) => {
    let filename = checkMimeType(file.mimetype);
    cb(null, filename);
  },
});

const upload = multer({ storage: storage });

// Routes
app.get("/", (req, res) => {
  const time = new Date(Date.UTC(2023, 1, 30, 13, 21));
  const t = new Date();
  let ms = new Date(t.valueOf());

  // const utcdate = Date.UTC(year, month, day, hours, minutes, seconds, millisec)

  // let timeInJson = time.toJSON();
  res.status(200).json({
    "target time": time,
    "current time": ms,
  });
});

app.get("/auth/twitter", (req, res) => {
  const { url, codeVerifier, state } = twitterClient.generateOAuth2AuthLink(
    callbackURL,
    { scope: ["tweet.read", "tweet.write", "users.read", "offline.access"] }
  );

  req.session.regenerate((err) => {
    if (err) {
      console.log(err);
    }

    req.session.codeVerifier = codeVerifier;
    req.session.state = state;

    req.session.save((err) => {
      if (err) console.log(err);
      res.redirect(url);
    });
  });
});

app.get("/auth/twitter/callback", (req, res) => {
  // Extract state and code from query string
  const { state, code } = req.query;
  // Get the saved codeVerifier from session
  const { codeVerifier, state: sessionState } = req.session;

  if (!codeVerifier || !state || !sessionState || !code) {
    return res.status(400).send("You denied the app or your session expired!");
  }
  if (state !== sessionState) {
    return res.status(400).send("Stored tokens didnt match!");
  }

  // Obtain access token
  const client = new TwitterApi({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
  });

  client
    .loginWithOAuth2({ code, codeVerifier, redirectUri: callbackURL })
    .then(
      async ({
        client: loggedClient,
        accessToken,
        refreshToken,
        expiresIn,
      }) => {
        try {
          const { data: userObject } = await loggedClient.v2.me();

          const foundUser = await User.findOne({
            username: userObject.username,
          });

          if (foundUser) {
            const user = await User.findByIdAndUpdate(foundUser.id, {
              $set: { accessToken, refreshToken, expiresIn },
            });

            res.redirect(`http://localhost:3000/${user.username}`);
            // res.status(200).json(user);

            console.log(user);
          } else {
            const user = await User({
              clientId: userObject.id,
              username: userObject.username,
              accessToken,
              refreshToken,
              expiresIn,
            });

            const savedUser = await user.save();

            res.status(200).json(savedUser);
          }
        } catch (err) {
          console.log(err);
        }
      }
    )
    .catch(() => res.status(403).send("Invalid verifier or access tokens!"));

  // res.redirect("/");
});

app.post("/thread", async (req, res) => {
  try {
    let userdb;
    const { username, threadsList, scheduled, date } = req.body;
    const user = await redisClient.get(`username=${username}`);
    console.log(user);
    if (user) {
      userdb = JSON.parse(user);
    } else {
      userdb = await User.findOne({ username: username });
      await redisClient.set(`username=${username}`, JSON.stringify(userdb));
    }
    const client = new TwitterApi(userdb.accessToken);

    if (scheduled) {
      const d = new Date();
      let ms = d.valueOf();

      if (ms == date) {
        const thread = await makeThread(client, threadsList);
        res.status(201).json(thread);
      }
    } else {
      /* Make a Thread */
      const thread = await makeThread(client, threadsList);
      res.status(201).json(thread);
    }
  } catch (error) {
    console.log(error);
  }
});

app.post("/profileimg", async (req, res) => {
  try {
    const user = await User.find({ username: req.body.username });
    const client = new TwitterApi(user.accessToken);

    const currentUser = await client.currentUser();

    // const originalProfileImage = TwitterApi.getProfileImageInSize(
    //   currentUser.profile_image_url_https,
    //   "original"
    // );

    const allBannerSizes = await client.v1.userProfileBannerSizes({
      user_id: currentUser.id_str,
    });

    res.status(200).json(allBannerSizes);
  } catch (error) {
    res.status(200).json(error);
  }
});

app.post("/storeimg", upload.single("image"), async (req, res) => {
  try {
    const user = await User.findOne({ username: req.query.username });

    const client = new TwitterApi(user.accessToken);
    // console.log(__dirname);
    const mediaFile = fs.readFileSync(
      path.join(`./public/images/${req.file.filename}`)
    );
    const base64image = Buffer.from(mediaFile).toString("base64");

    // console.log(base64image);

    const mediaId = await client.v1.uploadMedia(Buffer.from(mediaFile), {
      mimeType: req.file.mimetype,
    });
    console.log(mediaId);
    // const mediaIds = await Promise.all([
    // ]);
    res.status(200).json({
      data: user,
    });
  } catch (error) {
    res.status(500).json(error);
  }
});

app.post("/user", async (req, res) => {
  try {
    const userDB = await User.findOne({ username: req.body.username });
    const client = new TwitterApi(userDB.accessToken);
    const user = await client.currentUserV2();
    // const result = await client.v1.get("users/profile_banner.json", {
    //   screen_name: "joefelix_a",
    // });
    // console.log(result);
    res.status(200).json(userDB);
  } catch (error) {
    console.log(error);
  }
});

app.listen(5000, () => {
  console.log("Server started at PORT:5000");
});
