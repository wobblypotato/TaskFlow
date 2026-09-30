const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { deleteCommentSchema } = require('../schemas/task.schema');
const { deleteComment } = require('../controllers/task.controller');

const router = express.Router();

router.use(protect);
router.delete('/:commentId', validate(deleteCommentSchema), deleteComment);

module.exports = router;
