// models.js
const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  fileName: { type: String },
  filePath: { type: String },
  file: { type: String }
});

const dataSchema = new mongoose.Schema({
  Name: { type: String },
  Occupation: { type: String },
  In_House_Date: { type: String },
  Guest_No: { type: String },
  Birth_Date: { type: String },
  Mobile_Phone: { type: String },
  Bill_Number: { type: String },
  Pay_Article: { type: String },
  Res_No: { type: String },
  Local_Region: { type: String },
  CO_Time: { type: String },
  CI_Time: { type: String },
  Arrangement: { type: String },
  Age: { type: String },
  Email: { type: String },
  Lodging: { type: String },
  Adult: { type: String },
  Child: { type: String },
  Compliment: { type: String },
  Nat: { type: String },
  SOB: { type: String },
  Arrival: { type: String },
  Depart: { type: String },
  Night: { type: String },
  Segment: { type: String },
  Created: { type: String },
  By: { type: String },
  Company_TA: { type: String },
});

const combinedSchema = new mongoose.Schema({
  file: fileSchema,
  data: [dataSchema]  // Array of data objects
}, {
  timestamps: {
    options: { timeZone: 'Asia/Kolkata' }
  }
});

const CombinedModel = mongoose.model('CombinedModel', combinedSchema);

module.exports = CombinedModel;
