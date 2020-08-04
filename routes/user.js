const express = require("express");
const auth = require("../middleware/auth.js");

const { joinOnUser, login, logout } = require("../controllers/user.js");

const router = express.Router();

router.route("/").post(joinOnUser).delete(auth, logout);
router.route("/login").post(login);

module.exports = router;
