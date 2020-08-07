const express = require("express");
const { joinOnUser, login, logout } = require("../controllers/user.js");
const auth = require("../middleware/auth.js");

const router = express.Router();

// /api/v1/photo_sns/user
router.route("/").post(joinOnUser).delete(auth, logout);
router.route("/login").post(login);

module.exports = router;
