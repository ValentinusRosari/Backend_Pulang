const express = require("express");
const router = express.Router();
const eventController = require("../controller/event.controller");

router.post("/", eventController.createEvent);
router.get("/", eventController.readEvent);
router.patch("/:id", eventController.updateEvent);
router.delete("/:id", eventController.deleteEvent);

module.exports = router;
