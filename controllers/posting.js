const chalk = require(`chalk`);
const path = require(`path`);
const connection = require("../db/mysql_connection");

// @desc    포스팅 생성
// @route   POST /api/v1/posting
// @req     user_id(auth), public_on, photo, comments, tags
// @res     success, message
exports.uploadPosting = async (req, res, next) => {
  console.log(chalk.bold("<<  포스팅 생성 api 실행됨  >>"));

  let user_id = req.user.user_id;
  const photo = req.files.photo;
  let public_on = req.body.public_on;
  let comments = req.body.comments;
  let tags = req.body.tags;

  // 유저 검증
  if (!user_id) {
    res.status(401).json({ success: false, message: `잘못된 접근` });
    return;
  }

  // 공개 여부 : default 0(전체 공개)
  if (!public_on) {
    public_on = 0;
  }

  // 코멘트가 없는 경우 : default ""
  if (!comments) {
    comments = "";
  }

  // 태그가 없는 경우 : default []
  if (!tags) {
    tags = [];
  }

  // 태그에 #이 포함되어있지 않거나 공백이 포함된 경우
  if (!tags.includes(`#`)) {
    res
      .status(400)
      .json({ success: false, message: `태그 앞에는 #이 붙어있어야 함` });
    return;
  } else if (tags.includes(` `)) {
    res
      .status(400)
      .json({ success: false, message: `태그에는 공백을 입력할 수 없음` });
    return;
  }

  // 첨부 파일이 있는지 체크
  if (!req.files) {
    res.status(400).json({ success: false, message: `가져올 파일 없음` });
    return;
  }

  // 이미지 파일을 첨부했는지 체크
  if (!photo.mimetype.startsWith(`image`)) {
    res.status(400).json({ success: false, message: `이미지 파일이 아님` });
    return;
  }

  // 첨부 파일이 제한 용량을 초과했는지 체크
  if (photo.size > process.env.MAX_FILE_SIZE) {
    res.status(400).json({
      success: false,
      message: `업로드 파일 용량 제한 - 1메가 이하`,
    });
    return;
  }

  // 이미지 파일명 변경
  let encodedName = encodeURI(photo.name);

  // 파일명 길이 초과 체크
  if (encodedName > 100) {
    res.status(400).json({
      success: false,
      message: `파일명 길이 초과 : 영문/숫자/문자(%제외)는 140자, 한글 최대 20자까지 입력 가능`,
    });
    return;
  }

  // 파일을 저장할 경로를 지정
  let fileUploadPath = `${process.env.FILE_UPLOAD_PATH}/${encodedName}`;

  // 파일을 지정한 경로에 저장
  photo.mv(fileUploadPath, async (err) => {
    if (err) {
      res.status(500).json({ error: err });
      return;
    }
  });

  // 파일명 유니크해야한가봄. 방안 찾아서 고쳐놓기.
  //   // posting 테이블의 photo_url 컬럼에 파일명 저장
  //   let query = `update posting set photo_url = ? where user_id = ?`;
  //   let values = [photo.name, user_id];

  // 1. 포스팅 업로드(insert)
  let query = `insert into posting (user_id, public_on, photo_url, comments) values (?, ?, ?, ?)`;
  let values = [user_id, public_on, encodedName, comments];
  let posting_id;

  try {
    [result] = await connection.query(query, values);

    if (result.affectedRows == 0) {
      res.status(500).json({ success: false, message: `포스팅 실패` });
      return;
    }

    posting_id = result.insertId;
  } catch (e) {
    res.status(500).json({ success: false, message: `DB ERROR`, error: e });
    return;
  }

  // 태그 쪼개기(#으로 분리)
  let tags_arr = tags.split(`#`);
  tags_arr.shift();

  // 쪼갠 태그가 태그 테이블의 데이터와 일치하는 내용이 없으면 태그 테이블에 태그를 새로 저장(insert)하고 tag_id_arr에 저장
  // 일치하는 문구가 있으면 tag_id_arr에 저장하고 tag_id_arr을 posting_id와 함께 posting_tag 테이블에 저장
  query = `select * from tag where tag_name = ?`;
  let tag_id;
  let tag_id_arr = [];

  for (let i = 0; i < tags_arr.length; i++) {
    values = [tags_arr[i]];
    try {
      [rows] = await connection.query(query, values);

      if (rows.length == 0) {
        query = `insert into tag (tag_name) values ?`;

        try {
          [result] = await connection.query(query, [[values]]);

          tag_id = result.insertId;
          tag_id_arr.push([tag_id]);
        } catch (e) {
          res
            .status(500)
            .json({ success: false, message: `DB ERROR1`, error: e });
          return;
        }
      } else {
        tag_id = rows[0].tag_id;
        tag_id_arr.push([tag_id]);
      }
    } catch (e) {
      res.status(500).json({ success: false, message: `DB ERROR2`, error: e });
      return;
    }
  }

  console.log(tag_id_arr);
};

// @desc    포스팅 조회 - 최신 글부터 25개
// @route   GET /api/v1/posting
// @req     user_id(auth)
// @res     success, cnt, items : [{posting_id, public_on, photo_url, comments, tag : []}]
exports.getPostings = async (req, res, next) => {
  console.log(chalk.bold("<<  포스팅 조회 api 실행됨  >>"));
};

// @desc    포스팅 수정
// @route   PUT /api/v1/posting
// @req     user_id(auth), posting_id, public_on, photo_url, comments, tag
// @res     success, message
exports.updatePosting = async (req, res, next) => {
  console.log(chalk.bold("<<  포스팅 수정 api 실행됨  >>"));
};

// @desc    포스팅 삭제
// @route   DELETE /api/v1/posting
// @req     user_id(auth), posting_id
// @res     success, message
exports.deletePosting = async (req, res, next) => {
  console.log(chalk.bold("<<  포스팅 삭제 api 실행됨  >>"));
};
