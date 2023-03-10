const router = require("express").Router();
const { TwitterApi } = require("twitter-api-v2");
const User = require("../model/User");

router.post("/", async (req, res) => {
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

router.post("/profileimg", async (req, res) => {
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

module.exports = router;
