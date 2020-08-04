// npm 패키지
const express = require("express");
const dotenv = require("dotenv");
dotenv.config({ path: "./config/config.env" });
const morgan = require("morgan");

// routes 파일
const user = require("./routes/user.js");

// middleware 파일
const auth = require("./middleware/auth.js");

const app = express();
app.use(express.json());

// 접속 로그 찍기
app.use(morgan("dev"));

// routes 연결
app.use("/api/v1/user", user);

// auth가 필요한 routes 연결
// app.use(auth);

const PORT = process.env.PORT || 5700;

app.listen(PORT, () => {
  console.log(`App Listening on port ${PORT}`);
});
