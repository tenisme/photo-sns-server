const chalk = require(`chalk`);
const path = require(`path`);
const connection = require("../db/mysql_connection");

// @desc    포스팅 생성
// @route   POST /api/v1/posting
// @req     user_id(auth), public_on, photo, comments, tags[]
// @res     success, posting_id, message
exports.uploadPosting = async (req, res, next) => {
  console.log(chalk.bold("<<  포스팅 생성 api 실행됨  >>"));

  let user_id = req.user.user_id;
  const photo = req.files.photo;
  let public_on = req.body.public_on;
  let comments = req.body.comments;
  let tags = req.body.tags;
  let query;
  let values;
  let tag_id_arr = [];

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

  // 트랜잭션 셋팅 / 시작
  const conn = await connection.getConnection();
  await conn.beginTransaction();

  // 태그가 없는 경우 : default []
  if (!tags) {
    tags = [];
  } else {
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

    // 태그 쪼개기(#으로 분리)
    let tags_arr = tags.split(`#`);
    tags_arr.shift();

    // 태그 조회/저장(select / insert)
    // 쪼갠 태그 중에서 태그 테이블의 데이터와 일치하는 내용이 없으면 태그 테이블에 태그를 새로 저장(insert)
    // 조회된 태그는 새로 저장된 태그와 함께 id를 따와서 tag_id_arr에 저장.
    // tag_id_arr은 posting_id와 함께 posting_tag 테이블에 저장
    for (let i = 0; i < tags_arr.length; i++) {
      query = `select * from tag where tag_name = "${tags_arr[i]}"`;
      try {
        [rows] = await conn.query(query);

        if (rows.length == 0) {
          query = `insert into tag (tag_name) values ("${tags_arr[i]}")`;

          try {
            [result] = await conn.query(query);

            if (result.affectedRows == 0) {
              await conn.rollback();
              res
                .status(500)
                .json({ success: false, message: `태그 추가 실패` });
              return;
            }

            let tag_id = result.insertId;
            tag_id_arr.push(tag_id);
          } catch (e) {
            await conn.rollback();
            res
              .status(500)
              .json({ success: false, message: `DB ERROR1`, error: e });
            return;
          }
        } else {
          let tag_id = rows[0].tag_id;
          tag_id_arr.push(tag_id);
        }
      } catch (e) {
        await conn.rollback();
        res
          .status(500)
          .json({ success: false, message: `DB ERROR2`, error: e });
        return;
      }
    }

    // console.log(tag_id_arr);
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

  // 이미지 파일명 변경 (user_id + currentTime)
  photo.name = `photo_${user_id}_${Date.now()}${path.parse(photo.name).ext}`;

  // 파일을 저장할 경로를 지정
  let fileUploadPath = `${process.env.FILE_UPLOAD_PATH}/${photo.name}`;

  // 파일을 지정한 경로에 저장
  photo.mv(fileUploadPath, async (err) => {
    if (err) {
      res.status(500).json({ error: err });
      return;
    }
  });

  // 포스팅 업로드(insert)
  query = `insert into posting (user_id, public_on, photo_url, comments) values (?, ?, ?, ?)`;
  values = [user_id, public_on, photo.name, comments];
  let posting_id;

  try {
    [result] = await conn.query(query, values);

    if (result.affectedRows == 0) {
      await conn.rollback();
      res.status(500).json({ success: false, message: `포스팅 실패` });
      return;
    }

    posting_id = result.insertId;
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ success: false, message: `DB ERROR`, error: e });
    return;
  }

  // 태그가 "있으면" posting_id와 tag_id_arr을 posting_tag 테이블에 insert
  if (tag_id_arr[0]) {
    query = `insert into posting_tag (posting_id, tag_id) values ?`;
    values = [];

    for (let i = 0; i < tag_id_arr.length; i++) {
      values.push([posting_id, tag_id_arr[i]]);
    }

    // console.log(values);

    try {
      [result] = await conn.query(query, [values]);

      if (result.affectedRows == 0) {
        res
          .status(500)
          .json({ success: false, message: `포스팅에 태그 추가 실패` });
        return;
      }
    } catch (e) {
      res.status(500).json({ success: false, message: `DB ERROR`, error: e });
      return;
    }
  }

  // 트랜잭션 저장 / 커넥션 반환
  await conn.commit();
  await conn.release();

  res
    .status(200)
    .json({ success: true, posting_id: posting_id, message: `포스팅 성공` });
};

// @desc    포스팅 조회 - 최신 글부터 25개
// @route   GET /api/v1/posting
// @req     user_id(auth), offset, limit
// @res     success, cnt, items : [{posting_id, public_on, photo_url, comments, tag : []}]
exports.getPostings = async (req, res, next) => {
  console.log(chalk.bold("<<  포스팅 조회 api 실행됨  >>"));

  let user_id = req.user.user_id;
  let offset = req.query.offset;
  let limit = req.query.limit;

  if (!user_id) {
    res.status(400).json({ success: false, message: "잘못된 접근" });
    return;
  }

  if (!offset) {
    offset = 0;
  }

  if (!limit) {
    limit = 25;
  }

  // 포스팅별 태그 빼내기
  let query = `select p.posting_id, p.public_on, p.photo_url, p.comments, p.created_at, t.tag_name
  from posting as p join posting_tag as pt on p.posting_id = pt.posting_id 
  left join tag as t on pt.tag_id = t.tag_id
  where p.user_id = ? order by p.created_at desc`;
  let values = [user_id, offset, limit];

  try {
    [rows] = await connection.query(query, values);

    if (rows.length == 0) {
      res
        .status(400)
        .json({ success: false, message: `id에 해당하는 포스팅이 없음` });
      return;
    }
  } catch (e) {
    res.status(500).json({ success: false, message: `DB ERROR`, error: e });
    return;
  }

  let items = [];
  let tag_arr = [];

  await rows.reduce(function (previousItem, currentItem, index, array) {
    // 반환된 결과는 다음번 콜백의 첫번째 파라메터로 다시 전달된다.

    if (index == 0) {
      tag_arr.push(`#` + currentItem.tag_name);
      return currentItem;
    }

    if (previousItem.posting_id != currentItem.posting_id) {
      previousItem.tag_name = tag_arr;
      items.push(previousItem);
      tag_arr = [];
    }

    tag_arr.push(`#` + currentItem.tag_name);

    if (index == rows.length - 1) {
      currentItem.tag_name = tag_arr;
      items.push(currentItem);
      tag_arr = [];
    }

    return currentItem;
  }, rows[0]);

  // console.log(items);
  offset = Number(offset);
  limit = Number(limit);

  console.log(offset, limit);

  let slice_items = items.slice(offset, limit);

  res
    .status(200)
    .json({ success: true, cnt: slice_items.length, items: slice_items });
};

// @desc    포스팅 수정
// @route   PUT /api/v1/posting
// @req     user_id(auth), posting_id, public_on, photo, comments, tags[]
// @res     success, message
exports.updatePosting = async (req, res, next) => {
  console.log(chalk.bold("<<  포스팅 수정 api 실행됨  >>"));

  let user_id = req.user.user_id;
  let posting_id = req.body.posting_id;
  let public_on = req.body.public_on;
  const photo = req.files.photo;
  let comments = req.body.comments;
  let tags = req.body.tags;
  let query;
  let values;
  let tag_id_arr = [];

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

  // 트랜잭션 셋팅 / 시작
  const conn = await connection.getConnection();
  await conn.beginTransaction();

  // 태그가 없는 경우 : default []
  if (!tags) {
    tags = [];
  } else {
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

    // 태그 쪼개기(#으로 분리)
    let tags_arr = tags.split(`#`);
    tags_arr.shift();

    // 2. 태그 조회/저장(select / insert)
    for (let i = 0; i < tags_arr.length; i++) {
      query = `select * from tag where tag_name = "${tags_arr[i]}"`;
      try {
        [rows] = await conn.query(query);

        if (rows.length == 0) {
          query = `insert into tag (tag_name) values ("${tags_arr[i]}")`;

          try {
            [result] = await conn.query(query);

            if (result.affectedRows == 0) {
              await conn.rollback();
              res
                .status(500)
                .json({ success: false, message: `태그 추가 실패` });
              return;
            }

            let tag_id = result.insertId;
            tag_id_arr.push(tag_id);
          } catch (e) {
            await conn.rollback();
            res
              .status(500)
              .json({ success: false, message: `DB ERROR1`, error: e });
            return;
          }
        } else {
          let tag_id = rows[0].tag_id;
          tag_id_arr.push(tag_id);
        }
      } catch (e) {
        await conn.rollback();
        res
          .status(500)
          .json({ success: false, message: `DB ERROR2`, error: e });
        return;
      }
    }

    // console.log(tag_id_arr);
  }

  // 첨부 파일이 없으면 기존 파일을 사용(photo_url을 update하지 않음), 있으면 else
  if (!req.files) {
    query = `update posting set public_on = ?, comments = ? where posting_id = ? and user_id = ?`;
    values = [public_on, comments, posting_id, user_id];
  } else {
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

    // 이미지 파일명 변경 (user_id + currentTime)
    photo.name = `photo_${user_id}_${Date.now()}${path.parse(photo.name).ext}`;

    // 파일을 저장할 경로를 지정
    let fileUploadPath = `${process.env.FILE_UPLOAD_PATH}/${photo.name}`;

    // 파일을 지정한 경로에 저장
    photo.mv(fileUploadPath, async (err) => {
      if (err) {
        res.status(500).json({ error: err });
        return;
      }
    });

    query = `update posting set public_on = ?, photo_url = ?, comments = ? where posting_id = ? and user_id = ?`;
    values = [public_on, photo.name, comments, posting_id, user_id];
  }

  // 포스팅 업데이트(update)
  try {
    [result] = await conn.query(query, values);

    if (result.affectedRows == 0) {
      await conn.rollback();
      res.status(500).json({ success: false, message: `포스팅 업데이트 실패` });
      return;
    }
  } catch (e) {
    res.status(500).json({ success: false, message: `DB ERROR2`, error: e });
    return;
  }

  // 태그 리셋 : 기존 posting_tag 테이블의 posting_id 정보를 삭제(delete)
  query = `delete from posting_tag where posting_id = ?`;
  values = [posting_id];

  try {
    [result] = await conn.query(query, values);
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ success: false, message: `DB ERROR`, error: e });
    return;
  }

  // 태그가 "있으면" posting_id와 tag_id_arr을 posting_tag 테이블에 insert
  if (tag_id_arr[0]) {
    query = `insert into posting_tag (posting_id, tag_id) values ?`;
    values = [];

    for (let i = 0; i < tag_id_arr.length; i++) {
      values.push([posting_id, tag_id_arr[i]]);
    }

    // console.log(values);

    try {
      [result] = await conn.query(query, [values]);

      if (result.affectedRows == 0) {
        res
          .status(500)
          .json({ success: false, message: `포스팅에 태그 추가 실패` });
        return;
      }
    } catch (e) {
      res.status(500).json({ success: false, message: `DB ERROR`, error: e });
      return;
    }
  }

  // 트랜잭션 저장 / 커넥션 반환
  await conn.commit();
  await conn.release();

  res.status(200).json({ success: true, message: `포스팅 업데이트 성공` });
};

// @desc    포스팅 삭제
// @route   DELETE /api/v1/posting
// @req     user_id(auth), posting_id
// @res     success, message
exports.deletePosting = async (req, res, next) => {
  console.log(chalk.bold("<<  포스팅 삭제 api 실행됨  >>"));
};
