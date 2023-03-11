require("dotenv").config();
const { TwitterApi } = require("twitter-api-v2");
const express = require("express");
const session = require("express-session");
const mongoose = require("mongoose");
const morgan = require("morgan");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { checkMimeType } = require("./utils");
const { authRouter, userRouter, tweetRouter } = require("./router");
const { createRedisClient } = require("./utils/RedisClient");
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

app.use("/auth", authRouter);
app.use("/user", userRouter);
app.use("/tweet", tweetRouter);

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

app.listen(5000, () => {
  console.log("Server started at PORT:5000");
});
