const mongoose = require('mongoose');

const RoomServiceSchema = new mongoose.Schema({
  fileName: { type: String },
  filePath: { type: String },
  data: { type: Array },
});

module.exports = mongoose.model('ModelRoomService', RoomServiceSchema);