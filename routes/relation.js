const express = require("express");

const {
  applyForFriends,
  choiceOnRequest,
  cancelFriend,
  blockUser,
} = require("../controllers/relation.js");

const router = express.Router();

router.route("/").post(applyForFriends);
router.route("/permit").put(choiceOnRequest);
router.route("/cancel").delete(cancelFriend);
router.route("/block").post(blockUser);

module.exports = router;
