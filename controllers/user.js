const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const chalk = require("chalk");
const validator = require("validator");

const connection = require("../db/mysql_connection.js");
const sendEmail = require("../utils/sendemail.js");

// @desc    회원 가입 api
// @route   POST /api/v1/photo_sns/user
// @req     loginId, email, passwd, device_id
// @res     success, message, token
exports.joinOnUser = async (req, res, next) => {
  console.log(chalk.bold(`<<  회원 가입 api 실행됨  >>`));

  // body에서 req : loginId, email, passwd, device_id
  let loginId = req.body.loginId;
  let email = req.body.email;
  let passwd = req.body.passwd;
  let device_id = req.body.device_id;

  // 미입력 오류 처리
  if (!loginId || !email || !passwd || !device_id) {
    res.status(400).json({
      success: false,
      message: "아이디, 이메일, 패스워드, 로그인 기기 id 입력 필수",
    });
    return;
  }

  // 아이디 글자수 제한 오류 처리
  if (loginId.length > 20) {
    res
      .status(400)
      .json({ success: false, message: "아이디는 20자 이내로 입력해주세요" });
    return;
  }

  // 이메일 양식 / 글자수 오류 처리
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

  // 트랜잭션 처리
  const conn = await connection.getConnection();
  await conn.beginTransaction();

  // 비밀번호 암호화
  const hashedPasswd = await bcrypt.hash(passwd, 8);

  // DB - insert users table
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

    // user_id 빼내기
    user_id = result.insertId;
  } catch (e) {
    // 중복값 오류 처리
    if (e.errno == 1062) {
      await conn.rollback();
      res
        .status(400)
        .json({ success: false, message: `이미 존재하는 아이디입니다` });
      return;
    }

    await conn.rollback();
    res.status(500).json({ success: false, message: `DB ERROR`, error: e });
    return;
  }

  // 토큰값 생성
  let token = await jwt.sign(
    { user_id: user_id },
    process.env.ACCESS_TOKEN_SECRET
  );

  // DB - insert user_token table
  query = `insert into user_token (user_id, token, device_id) values ?`;
  values = [user_id, token, device_id];

  try {
    [result] = await conn.query(query, [[values]]);

    if (result.affectedRows == 0) {
      await conn.rollback();
      res.status(500).json({ success: false, message: `토큰 저장 실패` });
      return;
    }
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ success: false, message: `DB ERROR`, error: e });
    return;
  }

  // 가입 환영 이메일 전송
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

  // 커밋, 릴리즈
  await conn.commit();
  await conn.release();

  console.log(
    chalk.yellowBright.bold("User join on") +
      chalk.cyanBright(` - user_id : ${user_id}, loginId : ${loginId}`)
  );

  // 정상 처리시 res
  res
    .status(200)
    .json({ success: true, message: `가입을 환영합니다`, token: token });
};

// @desc    로그인 api
// @route   POST /api/v1/photo_sns/user/login
// @req     id_or_email, passwd, device_id
// @res     success, message, token
exports.login = async (req, res, next) => {
  console.log(chalk.bold(`<<  로그인 api 실행됨  >>`));

  // id 혹은 email로 로그인 처리
  let id_or_email = req.body.id_or_email;
  let passwd = req.body.passwd;
  let device_id = req.body.device_id;

  // id 혹은 email 미입력 오류 처리
  if (!id_or_email) {
    res.status(400).json({ success: false, message: `ID 혹은 email 미입력` });
    return;
  }

  // 패스워드 미입력 처리
  if (!passwd) {
    res.status(400).json({ success: false, message: `비밀번호를 미입력` });
    return;
  }

  // id 혹은 email로 유저 조회
  let query = `select * from users where loginId = ? or email = ?`;
  let values = [id_or_email, id_or_email];
  let user_id;

  try {
    [rows] = await connection.query(query, values);

    if (rows.length == 0) {
      res
        .status(400)
        .json({ success: false, message: `존재하지 않는 ID 혹은 email` });
      return;
    }

    // 패스워드 일치 여부 판별
    let isMatch = await bcrypt.compare(passwd, rows[0].passwd);

    if (!isMatch) {
      res.status(400).json({ success: false, message: `비밀번호 불일치` });
      return;
    }

    // user_id값 빼내기
    user_id = rows[0].user_id;
  } catch (e) {
    res.status(500).json({ success: false, messgae: `DB ERROR 1`, error: e });
    return;
  }

  // 토큰값 생성
  let token = jwt.sign({ user_id: user_id }, process.env.ACCESS_TOKEN_SECRET);

  // insert user_token table
  query = `insert into user_token (user_id, device_id, token) values ?`;
  values = [user_id, device_id, token];

  try {
    [result] = await connection.query(query, [[values]]);

    if (result.affectedRows == 0) {
      res.status(500).json({ success: false, message: `토큰 저장 실패` });
      return;
    }

    console.log(
      chalk.yellowBright.bold("User login") +
        chalk.cyanBright(
          ` - user_id : ${user_id}, id_or_email : ${id_or_email}`
        )
    );

    // 정상 처리시 res
    res
      .status(200)
      .json({ success: true, message: `로그인 성공`, token: token });
  } catch (e) {
    res.status(500).json({ success: false, messgae: `DB ERROR 2`, error: e });
  }
};

// 내 정보 조회 api

// @desc    현재 기기 로그아웃 api
// @route   DELETE /api/v1/photo_sns/user
// @req     user_id(auth), token(auth)
// @res     success, message
exports.logout = async (req, res, next) => {
  console.log(chalk.bold(`<<  현재 기기 로그아웃 api 실행됨  >>`));

  let user_id = req.user.user_id;
  let token = req.user.token;

  if (!user_id || !token) {
    res.status(401).json({ success: false, message: `잘못된 접근` });
    return;
  }

  let query = `delete from user_token where user_id = ? and token = ?`;
  let values = [user_id, token];

  try {
    [result] = await connection.query(query, values);

    if (result.affectedRows == 0) {
      res.status(401).json({ success: false, message: `잘못된 접근` });
      return;
    }

    res.status(200).json({ success: true, message: `로그아웃 성공` });
  } catch (e) {
    res.status(500).json({ success: false, message: `DB ERROR`, error: e });
  }
};

// 모든 기기에서 로그아웃 api
// 회원 탈퇴 api
// 패스워드 변경 api
// 패스워드 분실/리셋 요청 api
// 패스워드 초기화 api
