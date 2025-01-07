const mongoose = require('mongoose');

const RestaurantSchema = new mongoose.Schema(
  {
    fileName: { type: String },
    filePath: { type: String },
    data: { type: Array },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ModelRestaurant', RestaurantSchema);
