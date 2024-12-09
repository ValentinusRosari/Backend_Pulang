const express = require("express");
const multer = require("multer");
const path = require("path");
const { uploadROOMSERVICE, deleteROOMSERVICE } = require("../controller/roomservice.controller");

const router = express.Router();

const uploadDir = path.resolve(__dirname, "../airflow-docker/UPLOAD_DIR/uploads");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /csv/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed."));
    }
  },
});

router.post("/uploadRoomservice", upload.single("file"), uploadROOMSERVICE);
router.delete("/deleteRoomservice/:fileId", deleteROOMSERVICE);

module.exports = router;
