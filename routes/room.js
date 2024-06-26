const express = require("express");
const router = express.Router();
const roomController = require("../controller/room.controller");

router.post("/", roomController.createRoom);
router.post("/bulkCreate", roomController.createRooms);
router.get("/", roomController.readRoom);
router.get("/bynumber", roomController.readRoomByNumber);
router.patch("/:id", roomController.updateRoom);
router.delete("/:id", roomController.deleteRoom);

module.exports = router;
