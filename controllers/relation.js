const chalk = require(`chalk`);
const validator = require("validator");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");

const connection = require("../db/mysql_connection");
const sendEmail = require("../utils/sendemail.js");

// @desc    친구 신청 api
// @route   POST /api/v1/photo_sns/relation
// @req     user_id(auth), targeted_user_id
// @res     success, relation_id, message
exports.applyForFriends = async (req, res, next) => {
  console.log(chalk.bold("<<  친구 신청 api 실행됨  >>"));
  // todo : targeted_user_id에게 이메일로 친구 신청 알림 기능

  let user_id = req.user.user_id;
  let targeted_user_id = req.body.targeted_user_id;

  if (!user_id) {
    console.log("error : dosn't Authorization");
    res.status(401).json({ success: false, message: "잘못된 접근" });
    return;
  }

  if (!targeted_user_id) {
    console.log("error : isn't targeted_user_id");
    res.status(400).json({ success: false, message: "targeted_user_id 없음" });
    return;
  }

  let targetedUserIdIsNum = validator.isNumeric(String(targeted_user_id));

  if (!targetedUserIdIsNum) {
    console.log("error : targeted_user_id isn't number");
    res
      .status(400)
      .json({ success: false, message: "targeted_user_id는 숫자여야 함" });
    return;
  }

  let query = `insert into relation () values ?`;
};

// @desc    친구 수락 or 거절 api
// @route   PUT /api/v1/photo_sns/relation/permit
// @req     user_id(auth), relation_token, permit = 1 or 2
// @res     success, relation_id, message
exports.choiceOnRequest = async (req, res, next) => {
  console.log(chalk.bold("<<  친구 수락 or 거절 api 실행됨  >>"));

  // todo : targeted의 선택 내용을 request_user_id에게 이메일로 알림 기능
};

// @desc    친구 신청 취소 & 언팔로우 api
// @route   DELETE /api/v1/photo_sns/relation/cancel
// @req     user_id(auth), relation_id
// @res     success, message
exports.cancelFriend = async (req, res, next) => {
  console.log(chalk.bold("<<  친구 신청 취소 & 언팔로우 api 실행됨  >>"));
};

// @desc    특정 유저 차단 api
// @route   POST /api/v1/photo_sns/relation/block
// @req     user_id(auth), targeted_user_id, permit = 3 or 4
// @res     success, relation_id, message
exports.blockUser = async (req, res, next) => {
  console.log(chalk.bold("<<  특정 유저 차단 api 실행됨  >>"));
};
