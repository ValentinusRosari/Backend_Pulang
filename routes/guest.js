const express = require("express");
const router = express.Router();
const guestController = require("../controller/guest.controller");

router.post("/", guestController.createGuest);
router.get("/", guestController.readGuest);
router.patch("/:id", guestController.updateGuest);
router.delete("/:id", guestController.deleteGuest);

module.exports = router;
