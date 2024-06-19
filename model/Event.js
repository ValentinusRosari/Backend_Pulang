const mongoose = require("mongoose");
const moment = require("moment-timezone");

const eventSchema = new mongoose.Schema(
  {
    guestId: { type: mongoose.Schema.Types.ObjectId, ref: "Guest" },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
    checkInDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    checkOutDate: {
      type: Date,
    },
    guestPurpose: {
      type: String,
      required: true,
    },
    escorting: {
      type: String,
      required: true,
    },
    voucherNumber: {
      type: String,
    },
    guestPriority: {
      type: String,
    },
    plateNumber: {
      type: String,
    },
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: "Request" },
    feedbackId: { type: mongoose.Schema.Types.ObjectId, ref: "Feedback" },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
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
