const mongoose = require('mongoose');

const dataSchema = new mongoose.Schema({
    Company_TA: String,
    Repeater: Number,
    Segment: String,
})

const companySchema = new mongoose.Schema({
    data: [dataSchema] 
});

const CompanyModel = mongoose.model('CompanyData', companySchema);

module.exports = CompanyModel;