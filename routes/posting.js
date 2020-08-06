const express = require(`express`);
const auth = require(`../middleware/auth.js`);

const {
  uploadPosting,
  getPostings,
  updatePosting,
  deletePosting,
} = require(`../controllers/posting.js`);

const router = express.Router();

router
  .route(`/`)
  .post(auth, uploadPosting)
  .get(auth, getPostings)
  .put(auth, updatePosting)
  .delete(auth, deletePosting);

module.exports = router;
