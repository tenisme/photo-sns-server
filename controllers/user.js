const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const chalk = require("chalk");
const validator = require("validator");

const connection = require("../db/mysql_connection.js");
const sendEmail = require("../utils/sendemail.js");

// @desc    회원 가입 api
// @route   POST /api/v1/photo_sns
// @req     loginId, email, passwd, device_id
// @res     success, message, token
exports.joinOnUser = async (req, res, next) => {
  console.log(chalk.bold("<<  회원 가입 api 실행됨  >>"));

  // body에서 id/email/passwd 가져오기
  let loginId = req.body.loginId;
  let email = req.body.email;
  let passwd = req.body.passwd;
  let device_id = req.body.device_id;

  if (!loginId || !email || !passwd || !device_id) {
    res.status(400).json({
      success: false,
      message: "아이디, 이메일, 패스워드, 로그인 기기 id 입력 필수",
    });
    return;
  }

  if (loginId.length > 20) {
    res
      .status(400)
      .json({ success: false, message: "아이디는 20자 이내로 입력해주세요" });
    return;
  }

  if (!validator.isEmail(email)) {
    // 이메일이 정상적인지 체크
    res.status(400).json({
      success: false,
      message: "정상적인 이메일 형식으로 입력해주세요",
    });
    return;
  } else if (email.length > 100) {
    res.status(400).json({
      success: false,
      message: "이메일은 100자 이내로 입력해주세요",
    });
    return;
  }

  const conn = await connection.getConnection();
  await conn.beginTransaction();

  const hashedPasswd = await bcrypt.hash(passwd, 8);

  let query = `insert into users (loginId, email, passwd) values ?`;
  let values = [loginId, email, hashedPasswd];
  let user_id;

  try {
    [result] = await conn.query(query, [[values]]);

    if (result.affectedRows == 0) {
      await conn.rollback();
      res.status(500).json({ success: false, message: `가입 실패` });
      return;
    }

    user_id = result.insertId;
  } catch (e) {
    if (e.errno == 1062) {
      await conn.rollback();
      res
        .status(400)
        .json({ success: false, message: `이미 존재하는 아이디입니다` });
      return;
    }

    await conn.rollback();
    res.status(500).json({ success: false, message: `DB ERROR 1`, error: e });
    return;
  }

  let token = await jwt.sign(
    { user_id: user_id },
    process.env.ACCESS_TOKEN_SECRET
  );

  query = `insert into user_token (user_id, token, device_id) values ?`;
  values = [user_id, token, device_id];

  try {
    [result] = await conn.query(query, [[values]]);

    if (result.affectedRows == 0) {
      await conn.rollback();
      res.status(500).json({ success: false, message: `토큰 저장 실패` });
      return;
    }

    await conn.commit();
    await conn.release();
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ success: false, message: `DB ERROR 2`, error: e });
    return;
  }

  const message = `환영합니다`;
  try {
    await sendEmail({
      email: email,
      subject: `회원가입 축하`,
      message: message,
    });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ success: false, message: "EMAIL ERROR", error: e });
    return;
  }

  res
    .status(200)
    .json({ success: true, message: `가입을 환영합니다`, token: token });
};

// @desc    로그인 api
// @route   POST /api/v1/photo_sns/login
// @req     user_id(auth), loginId or email, passwd
// @res     success, message, token
exports.login = async (req, res, next) => {
  console.log(chalk.bold("<<  로그인 api 실행됨  >>"));
};

// @desc    로그아웃 api
// @route   DELETE /api/v1/photo_sns
// @req     user_id(auth), token(auth)
// @res     success, message
exports.logout = async (req, res, next) => {
  console.log(chalk.bold("<<  로그아웃 api 실행됨  >>"));
};
