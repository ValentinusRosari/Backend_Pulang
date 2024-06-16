const mongoose = require('mongoose');

const MergedCombinedSchema = new mongoose.Schema({
    file: {
        fileName: String,
        filePath: String,
        file: String
    },
    data: Array,
    fileData: [{
        fileName: String,
        data: Array
    }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('MergedCombined', MergedCombinedSchema);

