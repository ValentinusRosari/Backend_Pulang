const express = require("express");
const router = express.Router();
const feedbackController = require("../controller/feedback.controller");

router.post("/", feedbackController.createFeedback);
router.get("/", feedbackController.readFeedback);
router.patch("/:id", feedbackController.updateFeedback);
router.delete("/:id", feedbackController.deleteFeedback);

module.exports = router;
