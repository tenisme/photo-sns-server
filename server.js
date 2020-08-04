const express = require("express");
const dotenv = require("dotenv");
dotenv.config({ path: "./config/config.env" });

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5700;

app.get("/", (req, res, next) => {
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log("App Listening on port 5700");
});
//
