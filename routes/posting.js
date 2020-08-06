const express = require(`express`);

const {
  uploadPosting,
  getPostings,
  updatePosting,
  deletePosting,
} = require(`../controllers/posting.js`);

const router = express.Router();

router
  .route(`/`)
  .post(uploadPosting)
  .get(getPostings)
  .put(updatePosting)
  .delete(deletePosting);

module.exports = router;
