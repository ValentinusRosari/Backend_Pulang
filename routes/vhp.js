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
function checkFileType(file, cb) {
    const filetypes = /csv|xlsx|xls/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb('Error: Only CSV and Excel files are allowed!');
    }
}

const upload = multer({ 
    storage: storage,
    fileFilter: function (req, file, cb) {
        checkFileType(file, cb);
    }
});

router.post('/upload', upload.single('file'), combinedController.uploadAndImport);
router.get('/files', combinedController.home);
router.delete('/delete/:id', combinedController.delete);
router.get('/getAgeCounts', combinedController.getAgeCounts);
router.get('/getSexCounts', combinedController.getSexCounts);
router.get('/getOccupationCounts', combinedController.getOccupationCounts);
router.get('/getCountryCounts', combinedController.getCountryCounts);
router.get('/getCityCounts', combinedController.getCityCounts);
router.get('/getSegmentCounts', combinedController.getSegmentCounts);
router.get('/getSortedByNight', combinedController.getSortedByNight);
router.get('/getSortedByRepeater', combinedController.getSortedByRepeater);
router.get('/getVisitorCategoryCounts', combinedController.getVisitorCategoryCounts);
router.get('/getRoomCounts', combinedController.getRoomCounts);
router.get('/getSortedCompanyByRepeater', combinedController.getSortedCompanyByRepeater);
router.get('/getEscortingCounts', combinedController.getEscortingCounts);
router.get('/getGuestPurposeCounts', combinedController.getGuestPurposeCounts);
router.get('/getGuestPriority', combinedController.getGuestPriority);
// router.get('/view', combinedController.view);
// router.get('/getAggregatedByColumn', combinedController.getAggregatedByColumn);
// router.get('/data', combinedController.getDataByColumn);

module.exports = router;
