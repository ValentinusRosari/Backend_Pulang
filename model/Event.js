const mongoose = require("mongoose");
const moment = require("moment-timezone");

const eventSchema = new mongoose.Schema(
  {
    checkInDate: {
      type: Date,
      default: Date.now,
    },
    checkOutDate: {
      type: Date,
    },
    arrangement: {
      type: String,
      required: true,
    },
    guestCategory: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

eventSchema.methods.toJSON = function () {
  const obj = this.toObject();
  obj.checkInDate = moment(obj.checkInDate).tz("Asia/Bangkok").format();
  obj.checkOutDate = obj.checkOutDate
    ? moment(obj.checkOutDate).tz("Asia/Bangkok").format()
    : null;
  obj.createdAt = moment(obj.createdAt).tz("Asia/Bangkok").format();
  obj.updatedAt = moment(obj.updatedAt).tz("Asia/Bangkok").format();
  return obj;
};

module.exports = mongoose.model("Event", eventSchema);
