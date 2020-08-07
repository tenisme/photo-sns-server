const express = require(`express`);
const {
  uploadPosting,
  getPostings,
  updatePosting,
  deletePosting,
} = require(`../controllers/posting.js`);
const auth = require(`../middleware/auth.js`);

const router = express.Router();

// /api/v1/photo_sns/posting
router
  .route(`/`)
  .post(auth, uploadPosting)
  .get(auth, getPostings)
  .put(auth, updatePosting)
  .delete(auth, deletePosting);

module.exports = router;
