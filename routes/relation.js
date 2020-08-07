const express = require("express");
const {
  applyForFriends,
  choiceOnRequest,
  cancelFriend,
  blockUser,
} = require("../controllers/relation.js");
const auth = require(`../middleware/auth.js`);

const router = express.Router();

// /api/v1/photo_sns/relation
router.route("/").post(auth, applyForFriends);
router.route("/permit").put(auth, choiceOnRequest);
router.route("/cancel").delete(auth, cancelFriend);
router.route("/block").post(auth, blockUser);

module.exports = router;
