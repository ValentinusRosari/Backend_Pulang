// models.js
const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  fileName: { type: String },
  filePath: { type: String },
  file: { type: String }
});

const dataSchema = new mongoose.Schema({
  Name: { type: String },
  Nationality: {type: String},
  LocalRegion: {type: String},
  MobilePhone: {type: String},
  Sex: {type: String},
  Occupation: { type: String },
  In_House_Date: { type: String },
  Room_Type: { type: String },
  Room_Number: { type: String },
  Arrangement: { type: String },
  Birth_Date: { type: String },
  Age: { type: String },
  Lodging: { type: String },
  Breakfast: { type: String },
  Adult: { type: String },
  Child: { type: String },
  Company_TA: { type: String },
  SOB: { type: String },
  Arrival: { type: String },
  Depart: { type: String },
  Night: { type: String },
  Created: { type: String },
  CO_Time: { type: String },
  CI_Time: { type: String },
  Segment: { type: String },
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
