const express = require("express");
const router = express.Router();
const requestController = require("../controller/request.controller");

router.post("/", requestController.createRequest);
router.get("/", requestController.readRequest);
router.get("/:id", requestController.readRequestById);
router.patch("/:id", requestController.updateRequest);
router.delete("/:id", requestController.deleteRequest);
router.post("/updateReturnDate", requestController.updateReturnDate);

module.exports = router;
