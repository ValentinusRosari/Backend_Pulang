const express = require("express");
const router = express.Router();
const roomController = require("../controller/room.controller");

router.post("/", roomController.createRoom);
router.get("/", roomController.readRoom);
router.patch("/:id", roomController.updateRoom);
router.delete("/:id", roomController.deleteRoom);

module.exports = router;
