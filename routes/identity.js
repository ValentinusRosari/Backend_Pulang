const express = require("express");
const router = express.Router();
const identityController = require("../controller/identity.controller");

router.post("/", identityController.createIdentity);
router.get("/", identityController.readIdentity);
router.patch("/:id", identityController.updateIdentity);
router.delete("/:id", identityController.deleteIdentity);

module.exports = router;
