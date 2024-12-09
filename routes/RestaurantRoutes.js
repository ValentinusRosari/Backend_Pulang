const express = require("express");
const multer = require("multer");
const path = require("path");
const { uploadRESTAURANT, deleteRESTAURANT } = require("../controller/restaurant.controller");

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

router.post("/uploadRestaurant", upload.single("file"), uploadRESTAURANT);
router.delete("/deleteRestaurant/:fileId", deleteRESTAURANT);

module.exports = router;
