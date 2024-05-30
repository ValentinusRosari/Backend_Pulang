const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const combinedController = require('../controller/vhp.controller');

const uploadDir = path.resolve(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({ storage: storage });

router.post('/upload', upload.single('file'), combinedController.uploadAndImport);
router.get('/files', combinedController.home);
router.get('/view', combinedController.view);
router.delete('/delete/:id', combinedController.delete);

module.exports = router;
