const mongoose = require('mongoose');

const dataSchema = new mongoose.Schema({
    Name: String,
    Age: Number,
    Night: Number,
    Sex: String,
    Arrival: Date,
    Depart: Date,
    Nationality: String,
    LocalRegion: String,
    Occupation: String,
    Segment: String,
    visitor_number: Number,
    visitor_category: String,
    Repeater: Number
})

const aggregatedSchema = new mongoose.Schema({
    data: [dataSchema] 
});

const AggregatedModel = mongoose.model('AggregatedData', aggregatedSchema);

module.exports = AggregatedModel;

