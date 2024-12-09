const mongoose = require('mongoose');

const RestaurantSchema = new mongoose.Schema({
  fileName: { type: String },
  filePath: { type: String },
  data: { type: Array },
});

module.exports = mongoose.model('ModelRestaurant', RestaurantSchema);
