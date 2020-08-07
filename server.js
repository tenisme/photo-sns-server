// npm 패키지
const express = require(`express`);
const dotenv = require(`dotenv`);
dotenv.config({ path: `./config/config.env` });
const morgan = require(`morgan`);
const fileupload = require(`express-fileupload`);
const path = require(`path`);

// routes 파일
const user = require(`./routes/user.js`);
const posting = require(`./routes/posting.js`);
const relation = require(`./routes/relation.js`);

const app = express();
app.use(express.json());

// 파일 업로드 사용 설정
app.use(fileupload());
// 파일 경로 설정 : 이미지를 불러올 수 있게 됨
app.use(express.static(path.join(__dirname, `public`)));

// 접속 로그 찍기
app.use(morgan(`dev`));

// routes 연결
app.use(`/api/v1/photo_sns/user`, user);
app.use(`/api/v1/photo_sns/posting`, posting);
app.use(`/api/v1/photo_sns/relation`, relation);

const PORT = process.env.PORT || 5700;

app.listen(PORT, () => {
  console.log(`서버 가동`);
});
