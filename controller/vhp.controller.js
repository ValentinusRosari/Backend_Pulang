const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const CombinedModel = require('../model/Filevhp');
const AggregatedModel = require('../model/AgregatedData');
const MergedDataModel = require('../model/MergedCombined');
const CompanyModel = require('../model/CompanyData');
const Event = require('../model/Event')

// Upload File
const uploadAndImport = async (req, res) => {
    try {
        const file = req.file;

        if (!file) {
            return res.status(400).send({ success: false, msg: 'No file uploaded.' });
        }

        const filePath = file.path;
        let scriptPath;
        let args;

        const sampleFilePath = path.resolve(__dirname, '../components/InHouse-Guest JAN.csv');

        if (file.originalname.includes('InHouse')) {
            scriptPath = path.resolve(__dirname, '../script/process_inhousefile.py');
            args = [scriptPath, sampleFilePath, filePath];
        } else if (file.originalname.includes('Extract')) {
            scriptPath = path.resolve(__dirname, '../script/process_extractguest.py');
            args = [scriptPath, filePath];
        } else {
            return res.status(400).send({ success: false, msg: 'Unknown file type.' });
        }

        const child = spawn('python', args);

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', async (code) => {
            if (code !== 0) {
                console.error(`Child process exited with code ${code}`);
                console.error(`stderr: ${stderr}`);
                return res.status(400).send({ success: false, msg: `Exec error: ${stderr}` });
            }

            try {
                const output = JSON.parse(stdout);

                if (output.error) {
                    console.error(`Processing error: ${output.error}`);
                    return res.status(400).send({ success: false, msg: `Processing error: ${output.error}` });
                }

                const combinedDocument = new CombinedModel({
                    file: {
                        fileName: file.originalname,
                        filePath: file.path,
                        file: file.filename
                    },
                    data: output
                });

                await combinedDocument.save();

                fs.unlink(file.path, (err) => {
                    if (err) {
                        console.error('Error removing file', err);
                    }
                });

                await mergeInHouseAndExtractFiles();
                await createAggregatedCollection();
                await createAggregatedCompany();

                res.send({ status: 200, success: true, msg: 'File uploaded and CSV data has been imported successfully!' });
            } catch (jsonError) {
                console.error('Error parsing JSON:', jsonError);
                res.status(500).send({ success: false, msg: 'Internal server error.' });
            }
        });
    } catch (error) {
        res.status(400).send({ success: false, msg: error.message });
    }
};

// Function to extract the month from the filename
const getMonthFromFileName = (fileName) => {
    const match = fileName.match(/(JAN 1-16|JAN 17-31|FEB 1-16|FEB 1-28|MAR 1-16|MAR 17-31|APR 1-16|APR 17-30|MAY 1-16|MAY 17-31|JUN 1-16|JUN 17-30|JUL 1-16|JUL 17-31|AUG 1-16|AUG 17-31|SEP 1-16|SEP 17-30|OCT 1-16|OCT 17-31|NOV 1-16|NOV 17-30|DEC 1-16|DEC 17-31)/i);
    return match ? match[0].toUpperCase() : null;
};

// Add Event Record
const fetchAndProcessEventData = async () => {
    const dynamicEventFields = [
        "guestId", "roomId", "checkInDate", "checkOutDate", "guestPurpose",
        "escorting", "voucherNumber", "guestPriority", "plateNumber"
    ];

    const ensureEventFields = (record) => {
        const result = {};

        Object.keys(record).forEach(field => {
            if (field === "roomId" && Array.isArray(record[field]) && record[field].length > 0) {
                result.roomNumber = record[field][0].roomNumber;
                result.Room_Type = record[field][0].roomType;
                result.roomFloor = record[field][0].roomFloor;
                result.roomCapacity = record[field][0].roomCapacity;
            } else if (field === "guestId" && Array.isArray(record[field]) && record[field].length > 0) {
                result.Name = record[field][0].guestName;
                result.waNumber = record[field][0].waNumber;
            } else if (field === "checkInDate") {
                result.Arrival = record[field] !== undefined ? record[field] : null;
            } else if (field === "checkOutDate") {
                result.Depart = record[field] !== undefined ? record[field] : null;
            } else if (dynamicEventFields.includes(field)) {
                result[field] = record[field] !== undefined ? record[field] : null;
            }
        });
        if (result.Arrival && result.Depart) {
            const arrivalDate = new Date(result.Arrival);
            const departDate = new Date(result.Depart);
            const timeDiff = Math.abs(departDate - arrivalDate);
            result.Night = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
        } else {
            result.Night = 0;
        }

        return result;
    };

    const events = await Event.find()
        .populate("guestId")
        .populate("roomId");

    const processedEvents = events.map(event => ensureEventFields(event.toObject()));

    return processedEvents;
};

// Merged at event record
const mergeDuplicateRecords = (records) => {
    const recordMap = {};

    records.forEach(record => {
        const key = `${record.Name}_${record.Arrival}_${record.Depart}`;
        if (!recordMap[key]) {
            recordMap[key] = { ...record };
        } else {
            Object.keys(record).forEach(field => {
                if (field !== 'Name' && field !== 'Arrival' && field !== 'Depart' && field !== 'Night') {
                    if (!recordMap[key][field] && record[field]) {
                        recordMap[key][field] = record[field];
                    }
                }
            });
        }
    });

    return Object.values(recordMap);
};

// Merged inhouse, extract, event
const mergeInHouseAndExtractFiles = async () => {
    try {
        const inHouseFiles = await CombinedModel.find({ 'file.fileName': /InHouse/ });
        const extractFiles = await CombinedModel.find({ 'file.fileName': /Extract/ });
        const eventData = await fetchAndProcessEventData();

        if (inHouseFiles.length === 0 && extractFiles.length === 0 && eventData.length === 0) {
            console.error('No InHouse, Extract files or Event data found.');
            await MergedDataModel.deleteMany({});
            return;
        }

        const inHouseFields = [
            "Name", "Room_Type", "Room_Number", "Arrangement",
            "Birth_Date", "Age", "Lodging", "Breakfast", "visitor_number", "visitor_category",
            "Company_TA", "SOB", "Arrival", "Depart", "Night", "Created",
            "CO_Time", "CI_Time", "Segment", "LocalRegion"
        ];

        const extractFields = [
            "Name", "Nationality", "LocalRegion", "MobilePhone", "Sex", "Occupation"
        ];

        const ensureAllFields = (record, fields) => {
            const result = {};
            fields.forEach(field => {
                if (field === "Night") {
                    result[field] = record[field] !== undefined && record[field] !== null ? record[field] : 0;
                } else {
                    result[field] = record[field] !== undefined ? record[field] : null;
                }
            });
            return result;
        };

        const mergedDataByMonth = {};

        for (const inHouseDoc of inHouseFiles) {
            const month = getMonthFromFileName(inHouseDoc.file.fileName);
            if (!month) continue;

            if (!mergedDataByMonth[month]) {
                mergedDataByMonth[month] = { inHouse: {}, extract: {} };
            }

            inHouseDoc.data.forEach(record => {
                const key = `${record.Name}_${record.Arrival}_${record.Depart}`;
                if (!mergedDataByMonth[month].inHouse[key]) {
                    mergedDataByMonth[month].inHouse[key] = ensureAllFields(record, inHouseFields);
                } else {
                    mergedDataByMonth[month].inHouse[key] = {
                        ...mergedDataByMonth[month].inHouse[key],
                        ...ensureAllFields(record, inHouseFields)
                    };
                }
            });
        }

        for (const extractDoc of extractFiles) {
            const month = getMonthFromFileName(extractDoc.file.fileName);
            if (!month) continue;

            if (!mergedDataByMonth[month]) {
                mergedDataByMonth[month] = { inHouse: {}, extract: {} };
            }

            extractDoc.data.forEach(record => {
                const name = record.Name;
                if (!mergedDataByMonth[month].extract[name]) {
                    mergedDataByMonth[month].extract[name] = ensureAllFields(record, extractFields);
                } else {
                    mergedDataByMonth[month].extract[name] = {
                        ...mergedDataByMonth[month].extract[name],
                        ...ensureAllFields(record, extractFields)
                    };
                }
            });
        }

        let finalMergedData = [];

        Object.keys(mergedDataByMonth).forEach(month => {
            const inHouseData = Object.values(mergedDataByMonth[month].inHouse);
            const extractData = mergedDataByMonth[month].extract;

            const nameToInHouseRecords = {};
            inHouseData.forEach(record => {
                const name = record.Name;
                if (!nameToInHouseRecords[name]) {
                    nameToInHouseRecords[name] = [];
                }
                nameToInHouseRecords[name].push(record);
            });

            for (const name in extractData) {
                const extractRecord = extractData[name];
                const inHouseRecords = nameToInHouseRecords[name] || [ensureAllFields({}, inHouseFields)];

                inHouseRecords.forEach(inHouseRecord => {
                    const mergedRecord = { ...inHouseRecord, ...extractRecord };
                    finalMergedData.push(mergedRecord);
                });
                delete nameToInHouseRecords[name];
            }

            Object.values(nameToInHouseRecords).forEach(records => {
                records.forEach(record => {
                    finalMergedData.push(record);
                });
            });

            console.log(`InHouse and Extract files for ${month} merged successfully into a single document!`);
        });

        finalMergedData = finalMergedData.concat(eventData);

        finalMergedData = mergeDuplicateRecords(finalMergedData);

        const nameCount = {};
        finalMergedData.forEach(record => {
            const name = record.Name;
            if (!nameCount[name]) {
                nameCount[name] = 0;
            }
            nameCount[name]++;
        });

        finalMergedData.forEach(record => {
            const name = record.Name;
            record.Repeater = nameCount[name];
        });

        const fileData = [];
        inHouseFiles.forEach(doc => fileData.push({ fileName: doc.file.fileName, data: doc.data }));
        extractFiles.forEach(doc => fileData.push({ fileName: doc.file.fileName, data: doc.data }));

        await MergedDataModel.deleteMany({ 'file.fileName': 'Merged-Data.json' });
        const mergedDocument = new MergedDataModel({
            file: {
                fileName: 'Merged-Data.json',
                filePath: '',
                file: ''
            },
            data: finalMergedData,
            fileData: fileData,
        });
        await mergedDocument.save();

        console.log('All data merged and saved successfully!');
    } catch (error) {
        console.error('Error merging InHouse, Extract, and Event files:', error);
    }
};

// Create collection data
const createAggregatedCollection = async () => {
    try {
        const mergedDocuments = await MergedDataModel.find();

        const aggregatedData = {};

        mergedDocuments.forEach(doc => {
            doc.data.forEach(record => {
                const name = record.Name;

                if (!aggregatedData[name]) {
                    aggregatedData[name] = {
                        Name: name,
                        Age: record.Age !== undefined ? record.Age : null,
                        Night: record.Night !== undefined ? record.Night : null,
                        Repeater: 1,
                        Sex: record.Sex !== undefined ? record.Sex : null,
                        Arrival: record.Arrival !== undefined ? new Date(record.Arrival) : null,
                        Depart: record.Depart !== undefined ? new Date(record.Depart) : null,
                        Occupation: record.Occupation !== undefined ? record.Occupation : null,
                        Nationality: record.Nationality !== undefined ? record.Nationality : null,
                        LocalRegion: record.LocalRegion !== undefined ? record.LocalRegion : null,
                        Segment: record.Segment !== undefined ? record.Segment : null,
                    };
                } else {
                    aggregatedData[name].Age = record.Age !== null && record.Age !== undefined ? record.Age : aggregatedData[name].Age;
                    aggregatedData[name].Night += record.Night !== null && record.Night !== undefined ? record.Night : 0;
                    aggregatedData[name].Repeater += 1;

                    if (aggregatedData[name].Sex === null && record.Sex !== undefined) {
                        aggregatedData[name].Sex = record.Sex;
                    }

                    if (record.Arrival !== undefined) {
                        const arrivalDate = new Date(record.Arrival);
                        if (aggregatedData[name].Arrival === null || arrivalDate < aggregatedData[name].Arrival) {
                            aggregatedData[name].Arrival = arrivalDate;
                        }
                    }

                    if (record.Depart !== undefined) {
                        const departDate = new Date(record.Depart);
                        if (aggregatedData[name].Depart === null || departDate > aggregatedData[name].Depart) {
                            aggregatedData[name].Depart = departDate;
                        }
                    }

                    if (aggregatedData[name].Occupation === null && record.Occupation !== undefined) {
                        aggregatedData[name].Occupation = record.Occupation;
                    }

                    if (aggregatedData[name].Nationality === null && record.Nationality !== undefined) {
                        aggregatedData[name].Nationality = record.Nationality;
                    }

                    if (aggregatedData[name].LocalRegion === null && record.LocalRegion !== undefined) {
                        aggregatedData[name].LocalRegion = record.LocalRegion;
                    }

                    if (aggregatedData[name].Segment === null && record.Segment !== undefined) {
                        aggregatedData[name].Segment = record.Segment;
                    }
                }
            });
        });

        const aggregatedArray = Object.values(aggregatedData);

        await AggregatedModel.deleteMany({});

        await AggregatedModel.create({ data: aggregatedArray });

        console.log('Aggregated data successfully created!');
    } catch (error) {
        console.error('Error creating aggregated data:', error);
    }
};

// Create collection by company
const createAggregatedCompany = async () => {
    try {
        const mergedDocuments = await MergedDataModel.find();

        const companySegmentData = {};

        mergedDocuments.forEach(doc => {
            doc.data.forEach(record => {
                const company = record.Company_TA;
                const segment = record.Segment;
                const key = `${company}_${segment}`;

                if (!companySegmentData[key]) {
                    companySegmentData[key] = {
                        Company_TA: company,
                        Segment: segment,
                        Repeater: 1,
                        Arrival: record.Arrival,
                        Depart: record.Depart
                    };
                } else {
                    companySegmentData[key].Repeater += 1;
                }
            });
        });

        const aggregatedArray = Object.values(companySegmentData);

        await CompanyModel.deleteMany({});
        await CompanyModel.create({ data: aggregatedArray });

        console.log('Aggregated data by company and segment successfully created!');
    } catch (error) {
        console.error('Error creating aggregated data by company and segment:', error);
    }
};

// Remove file so it can update
const removeFileDataFromMergedDocument = async (fileName) => {
    try {
        const mergedDoc = await MergedDataModel.findOne({ 'file.fileName': 'Merged-Data.json' });

        if (!mergedDoc) {
            console.error('No merged data document found.');
            return;
        }

        const fileNameRegex = new RegExp(fileName, 'i');

        const fileDataToDelete = mergedDoc.fileData.filter(file => fileNameRegex.test(file.fileName));

        if (fileDataToDelete.length > 0) {
            const dataToDelete = new Set();
            fileDataToDelete.forEach(file => {
                file.data.forEach(record => dataToDelete.add(JSON.stringify(record)));
            });

            mergedDoc.data = mergedDoc.data.filter(record => !dataToDelete.has(JSON.stringify(record)));
        }

        mergedDoc.fileData = mergedDoc.fileData.filter(file => !fileNameRegex.test(file.fileName));

        await mergedDoc.save();

        console.log(`Data for file ${fileName} removed and merged document updated successfully!`);
    } catch (error) {
        console.error('Error removing file data from merged document:', error);
    }
};

// Get All File
const home = async (req, res) => {
    try {
        const files = await CombinedModel.find({}, { file: 1 });
        res.status(200).json({ success: true, data: files });
    } catch (error) {
        console.error('Error fetching files:', error);
        res.status(500).json({ success: false, msg: 'Internal server error' });
    }
};

// Get View
const view = async (req, res) => {
    try {
        const filesData = await CombinedModel.find({}, 'file data').exec();
        res.status(200).send({ success: true, files: filesData });
    } catch (error) {
        console.error('Error fetching files data:', error);
        res.status(500).send({ success: false, msg: 'Internal server error.' });
    }
};

// Delete file
const deleteDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await CombinedModel.findByIdAndDelete(id);

        if (!result) {
            return res.status(404).json({ success: false, msg: 'Document not found' });
        }

        await removeFileDataFromMergedDocument(result.file.fileName);

        await mergeInHouseAndExtractFiles();
        await createAggregatedCollection();
        await createAggregatedCompany();

        res.status(200).json({ success: true, msg: 'Document deleted successfully' });
    } catch (error) {
        console.error('Error deleting document:', error);
        res.status(500).json({ success: false, msg: 'Internal server error' });
    }
};

// Get Age
const getAgeCounts = async (req, res) => {
    const { startdate, enddate } = req.query;

    try {
        const aggregatedDocs = await AggregatedModel.find();

        if (!aggregatedDocs || aggregatedDocs.length === 0) {
            return res.status(404).json({ success: false, msg: 'No aggregated data found' });
        }

        const allData = aggregatedDocs.flatMap(doc => doc.data);

        const filteredData = allData.filter(record => {
            const arrivalDate = new Date(record.Arrival).setUTCHours(0, 0, 0, 0);
            const isWithinDateRange = (!startdate || arrivalDate >= new Date(startdate).setUTCHours(0, 0, 0, 0)) &&
                                      (!enddate || arrivalDate <= new Date(enddate).setUTCHours(23, 59, 59, 999));
            const isAgeValid = record.Age !== null && record.Age !== undefined;

            return isWithinDateRange && isAgeValid;
        });

        const ageCounts = filteredData.reduce((acc, record) => {
            const age = record.Age;
            if (!acc[age]) {
                acc[age] = 0;
            }
            acc[age] += 1;
            return acc;
        }, {});

        const totalRecords = filteredData.length;

        res.status(200).json({ success: true, ageCounts, totalRecords });
    } catch (error) {
        console.error('Error getting age counts:', error);
        res.status(500).json({ success: false, msg: 'Internal server error' });
    }
};

// Get Sex
const getSexCounts = async (req, res) => {
    const { startdate, enddate } = req.query;

    try {
        const aggregatedDocs = await AggregatedModel.find();

        if (!aggregatedDocs || aggregatedDocs.length === 0) {
            return res.status(404).json({ success: false, msg: 'No aggregated data found' });
        }

        const allData = aggregatedDocs.flatMap(doc => doc.data);

        const filteredData = allData.filter(record => {
            const arrivalDate = new Date(record.Arrival);
            const isWithinDateRange = (!startdate || arrivalDate >= new Date(startdate)) &&
                                      (!enddate || arrivalDate <= new Date(enddate));
            const isSexValid = record.Sex !== null && record.Sex !== undefined;

            return isWithinDateRange && isSexValid;
        });

        const sexCounts = filteredData.reduce((acc, record) => {
            const sex = record.Sex;
            if (!acc[sex]) {
                acc[sex] = 0;
            }
            acc[sex] += 1;
            return acc;
        }, {});

        const totalRecords = filteredData.length;

        res.status(200).json({ success: true, sexCounts, totalRecords });
    } catch (error) {
        console.error('Error getting sex counts:', error);
        res.status(500).json({ success: false, msg: 'Internal server error' });
    }
};

// Get Occupation
const getOccupationCounts = async (req, res) => {
    const { startdate, enddate } = req.query;

    try {
        const aggregatedDocs = await MergedDataModel.find();

        if (!aggregatedDocs || aggregatedDocs.length === 0) {
            return res.status(404).json({ success: false, msg: 'No aggregated data found' });
        }

        const allData = aggregatedDocs.flatMap(doc => doc.data);

        const filteredData = allData.filter(record => {
            const arrivalDate = record.Arrival ? new Date(record.Arrival) : null;
            const isWithinDateRange = (!startdate || (arrivalDate && arrivalDate >= new Date(startdate))) &&
                                      (!enddate || (arrivalDate && arrivalDate <= new Date(enddate)));
            const isOccupationValid = record.Occupation !== null && record.Occupation !== undefined;

            return isWithinDateRange && isOccupationValid;
        });

        const occupationCounts = filteredData.reduce((acc, record) => {
            const { Night = 0 } = record;
            const { Occupation } = record;

            if (!acc[Occupation]) {
                acc[Occupation] = { count: 0, totalNight: 0 };
            }

            acc[Occupation].count += 1;
            acc[Occupation].totalNight += Night;

            return acc;
        }, {});

        const result = Object.entries(occupationCounts).map(([occupation, { count, totalNight }]) => ({
            occupation,
            count,
            totalNight
        }));

        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('Error getting occupation counts:', error);
        res.status(500).json({ success: false, msg: 'Internal server error' });
    }
};

// Get Escort
const getEscortingCounts = async (req, res) => {
    const { startdate, enddate } = req.query;

    try {
        const aggregatedDocs = await MergedDataModel.find();

        if (!aggregatedDocs || aggregatedDocs.length === 0) {
            return res.status(404).json({ success: false, msg: 'No aggregated data found' });
        }

        const allData = aggregatedDocs.flatMap(doc => doc.data);

        const filteredData = allData.filter(record => {
            const arrivalDate = record.Arrival ? new Date(record.Arrival) : null;
            const isWithinDateRange = (!startdate || (arrivalDate && arrivalDate >= new Date(startdate))) &&
                                      (!enddate || (arrivalDate && arrivalDate <= new Date(enddate)));
            const isEscortingValid = record.escorting !== null && record.escorting !== undefined;

            return isWithinDateRange && isEscortingValid;
        });

        const escortingCounts = filteredData.reduce((acc, record) => {
            const { Night = 0 } = record;
            const { escorting } = record;

            if (!acc[escorting]) {
                acc[escorting] = { count: 0, totalNight: 0 };
            }

            acc[escorting].count += 1;
            acc[escorting].totalNight += Night;

            return acc;
        }, {});

        const totalRecords = Object.values(escortingCounts).reduce((acc, { count }) => acc + count, 0);
        const totalNight = Object.values(escortingCounts).reduce((acc, { totalNight }) => acc + totalNight, 0);

        res.status(200).json({ success: true, escortingCounts, totalRecords, totalNight });
    } catch (error) {
        console.error('Error getting escorting counts:', error);
        res.status(500).json({ success: false, msg: 'Internal server error' });
    }
};

// get Guest Priority
const getGuestPriority = async (req, res) => {
    const { startdate, enddate } = req.query;

    try {
        const aggregatedDocs = await MergedDataModel.find();

        if (!aggregatedDocs || aggregatedDocs.length === 0) {
            return res.status(404).json({ success: false, msg: 'No aggregated data found' });
        }

        const allData = aggregatedDocs.flatMap(doc => doc.data);

        const filteredData = allData.filter(record => {
            const arrivalDate = record.Arrival ? new Date(record.Arrival) : null;
            const isWithinDateRange = (!startdate || (arrivalDate && arrivalDate >= new Date(startdate))) &&
                                      (!enddate || (arrivalDate && arrivalDate <= new Date(enddate)));
            const isGuestPriorityValid = record.guestPriority !== null && record.guestPriority !== undefined;

            return isWithinDateRange && isGuestPriorityValid;
        }).map(record => ({
            Name: record.Name,
            Arrival: record.Arrival,
            Depart: record.Depart,
            guestPriority: record.guestPriority
        }));

        res.status(200).json({ success: true, data: filteredData });
    } catch (error) {
        console.error('Error getting guest priority:', error);
        res.status(500).json({ success: false, msg: 'Internal server error' });
    }
};

module.exports = { getGuestPriority };


// Get Purpose
const getGuestPurposeCounts = async (req, res) => {
    const { startdate, enddate } = req.query;

    try {
        const aggregatedDocs = await MergedDataModel.find();

        if (!aggregatedDocs || aggregatedDocs.length === 0) {
            return res.status(404).json({ success: false, msg: 'No aggregated data found' });
        }

        const allData = aggregatedDocs.flatMap(doc => doc.data);

        const filteredData = allData.filter(record => {
            const arrivalDate = record.Arrival ? new Date(record.Arrival) : null;
            const isWithinDateRange = (!startdate || (arrivalDate && arrivalDate >= new Date(startdate))) &&
                                      (!enddate || (arrivalDate && arrivalDate <= new Date(enddate)));
            const isGuestPurposeValid = record.guestPurpose !== null && record.guestPurpose !== undefined;

            return isWithinDateRange && isGuestPurposeValid;
        });

        const guestPurposeCounts = filteredData.reduce((acc, record) => {
            const { Night = 0 } = record;
            const { guestPurpose } = record;

            if (!acc[guestPurpose]) {
                acc[guestPurpose] = { count: 0, totalNight: 0 };
            }

            acc[guestPurpose].count += 1;
            acc[guestPurpose].totalNight += Night;

            return acc;
        }, {});

        const totalRecords = Object.values(guestPurposeCounts).reduce((acc, { count }) => acc + count, 0);
        const totalNight = Object.values(guestPurposeCounts).reduce((acc, { totalNight }) => acc + totalNight, 0);

        res.status(200).json({ success: true, guestPurposeCounts, totalRecords, totalNight });
    } catch (error) {
        console.error('Error getting guest purpose counts:', error);
        res.status(500).json({ success: false, msg: 'Internal server error' });
    }
};

// Get City
const getCityCounts = async (req, res) => {
    const { startdate, enddate } = req.query;

    try {
        const aggregatedDocs = await MergedDataModel.find();

        if (!aggregatedDocs || aggregatedDocs.length === 0) {
            return res.status(404).json({ success: false, msg: 'No aggregated data found' });
        }

        const allData = aggregatedDocs.flatMap(doc => doc.data);

        const filteredData = allData.filter(record => {
            const arrivalDate = record.Arrival ? new Date(record.Arrival) : null;
            const isWithinDateRange = (!startdate || (arrivalDate && arrivalDate >= new Date(startdate))) &&
                                      (!enddate || (arrivalDate && arrivalDate <= new Date(enddate)));
            const isLocalRegionValid = record.LocalRegion !== null && record.LocalRegion !== undefined;

            return isWithinDateRange && isLocalRegionValid;
        });

        const localregionCounts = filteredData.reduce((acc, record) => {
            const { Night = 0 } = record;
            const { LocalRegion } = record;

            if (!acc[LocalRegion]) {
                acc[LocalRegion] = { count: 0, totalNight: 0 };
            }

            acc[LocalRegion].count += 1;
            acc[LocalRegion].totalNight += Night;

            return acc;
        }, {});

        const totalRecords = Object.values(localregionCounts).reduce((acc, { count }) => acc + count, 0);
        const totalNight = Object.values(localregionCounts).reduce((acc, { totalNight }) => acc + totalNight, 0);

        res.status(200).json({ success: true, localregionCounts, totalRecords, totalNight });
    } catch (error) {
        console.error('Error getting city counts:', error);
        res.status(500).json({ success: false, msg: 'Internal server error' });
    }
};

// Get Country
const getCountryCounts = async (req, res) => {
    const { startdate, enddate } = req.query;

    try {
        const aggregatedDocs = await MergedDataModel.find();

        if (!aggregatedDocs || aggregatedDocs.length === 0) {
            return res.status(404).json({ success: false, msg: 'No aggregated data found' });
        }

        const allData = aggregatedDocs.flatMap(doc => doc.data);

        const filteredData = allData.filter(record => {
            const arrivalDate = record.Arrival ? new Date(record.Arrival) : null;
            const isWithinDateRange = (!startdate || (arrivalDate && arrivalDate >= new Date(startdate))) &&
                                      (!enddate || (arrivalDate && arrivalDate <= new Date(enddate)));
            const isNationalityValid = record.Nationality !== null && record.Nationality !== undefined;

            return isWithinDateRange && isNationalityValid;
        });

        const nationalityCounts = filteredData.reduce((acc, record) => {
            const { Night = 0 } = record;
            const { Nationality } = record;

            if (!acc[Nationality]) {
                acc[Nationality] = { count: 0, totalNight: 0 };
            }

            acc[Nationality].count += 1;
            acc[Nationality].totalNight += Night;

            return acc;
        }, {});

        const totalRecords = Object.values(nationalityCounts).reduce((acc, { count }) => acc + count, 0);
        const totalNight = Object.values(nationalityCounts).reduce((acc, { totalNight }) => acc + totalNight, 0);

        res.status(200).json({ success: true, nationalityCounts, totalRecords, totalNight });
    } catch (error) {
        console.error('Error getting country counts:', error);
        res.status(500).json({ success: false, msg: 'Internal server error' });
    }
};

// Get Segment
const getSegmentCounts = async (req, res) => {
    const { startdate, enddate } = req.query;

    try {
        const aggregatedDocs = await MergedDataModel.find();

        if (!aggregatedDocs || aggregatedDocs.length === 0) {
            return res.status(404).json({ success: false, msg: 'No aggregated data found' });
        }

        const allData = aggregatedDocs.flatMap(doc => doc.data);

        const filteredData = allData.filter(record => {
            const arrivalDate = record.Arrival ? new Date(record.Arrival) : null;
            const isWithinDateRange = (!startdate || (arrivalDate && arrivalDate >= new Date(startdate))) &&
                                      (!enddate || (arrivalDate && arrivalDate <= new Date(enddate)));
            const isSegmentValid = record.Segment !== null && record.Segment !== undefined;

            return isWithinDateRange && isSegmentValid;
        });

        const segmentCounts = filteredData.reduce((acc, record) => {
            const { Night = 0 } = record;
            const { Segment } = record;

            if (!acc[Segment]) {
                acc[Segment] = { count: 0, totalNight: 0 };
            }

            acc[Segment].count += 1;
            acc[Segment].totalNight += Night;

            return acc;
        }, {});

        const totalRecords = Object.values(segmentCounts).reduce((acc, { count }) => acc + count, 0);
        const totalNight = Object.values(segmentCounts).reduce((acc, { totalNight }) => acc + totalNight, 0);

        res.status(200).json({ success: true, segmentCounts, totalRecords, totalNight });
    } catch (error) {
        console.error('Error getting segment counts:', error);
        res.status(500).json({ success: false, msg: 'Internal server error' });
    }
};

// Get Sorted Night
const getSortedByNight = async (req, res) => {
    const { startdate, enddate } = req.query;

    try {
        const aggregatedDocs = await MergedDataModel.find();

        if (!aggregatedDocs || aggregatedDocs.length === 0) {
            return res.status(404).json({ success: false, msg: 'No aggregated data found' });
        }

        const allData = aggregatedDocs.flatMap(doc => doc.data);

        const filteredData = allData.filter(record => {
            const arrivalDate = record.Arrival ? new Date(record.Arrival) : null;
            const isWithinDateRange = (!startdate || (arrivalDate && arrivalDate >= new Date(startdate))) &&
                                      (!enddate || (arrivalDate && arrivalDate <= new Date(enddate)));

            return isWithinDateRange;
        });

        const nightCounts = filteredData.reduce((acc, record) => {
            const { Name, Night = 0 } = record;

            if (!acc[Name]) {
                acc[Name] = { count: 0, totalNight: 0 };
            }

            acc[Name].count += 1;
            acc[Name].totalNight += Night;

            return acc;
        }, {});

        const sortedData = Object.entries(nightCounts)
            .map(([name, { totalNight }]) => ({ Name: name, Night: totalNight }))
            .sort((a, b) => b.Night - a.Night)
            .slice(0, 10);

        const totalRecords = Object.values(nightCounts).reduce((acc, { count }) => acc + count, 0);
        const totalNight = Object.values(nightCounts).reduce((acc, { totalNight }) => acc + totalNight, 0);

        res.status(200).json({ success: true, sortedData, totalRecords, totalNight });
    } catch (error) {
        console.error('Error getting sorted data by night:', error);
        res.status(500).json({ success: false, msg: 'Internal server error' });
    }
};

// Get Sorted Repeater
const getSortedByRepeater = async (req, res) => {
    const { startdate, enddate } = req.query;

    try {
        const aggregatedDocs = await MergedDataModel.find();

        if (!aggregatedDocs || aggregatedDocs.length === 0) {
            return res.status(404).json({ success: false, msg: 'No aggregated data found' });
        }

        const allData = aggregatedDocs.flatMap(doc => doc.data);

        const filteredData = allData.filter(record => {
            const arrivalDate = record.Arrival ? new Date(record.Arrival) : null;
            const isWithinDateRange = (!startdate || (arrivalDate && arrivalDate >= new Date(startdate))) &&
                                      (!enddate || (arrivalDate && arrivalDate <= new Date(enddate)));

            return isWithinDateRange;
        });

        const repeaterCounts = filteredData.reduce((acc, record) => {
            const { Name } = record;

            if (!acc[Name]) {
                acc[Name] = { count: 0 };
            }

            acc[Name].count += 1;

            return acc;
        }, {});

        const sortedData = Object.entries(repeaterCounts)
            .map(([name, { count }]) => ({ Name: name, Repeater: count }))
            .sort((a, b) => b.Repeater - a.Repeater)
            .slice(0, 10);

        const totalRecords = Object.values(repeaterCounts).reduce((acc, { count }) => acc + count, 0);

        res.status(200).json({ success: true, sortedData, totalRecords });
    } catch (error) {
        console.error('Error getting sorted data by Repeater:', error);
        res.status(500).json({ success: false, msg: 'Internal server error' });
    }
};

// Get Data Join
const getDataByColumn = async (req, res) => {
    try {
        const { column, value, min, max } = req.query;

        if (!column) {
            return res.status(400).json({ success: false, msg: 'Column query parameter is required' });
        }

        const validColumns = [
            "Name", "Room_Type", "Room_Number", "Arrangement",
            "Birth_Date", "Age", "Lodging", "Breakfast", "Adult", "Child",
            "Company_TA", "SOB", "Arrival", "Depart", "Night", "Created",
            "CO_Time", "CI_Time", "Segment", "Repeater", "Nationality", 
            "LocalRegion", "MobilePhone", "Sex", "Occupation"
        ];

        if (!validColumns.includes(column)) {
            return res.status(400).json({ success: false, msg: 'Invalid column name' });
        }

        const query = {};
        
        if (min !== undefined || max !== undefined) {
            query[column] = {};
            if (min !== undefined) query[column].$gte = new Date(min) || Number(min);
            if (max !== undefined) query[column].$lte = new Date(max) || Number(max);
        } else if (value !== undefined) {
            if (value === 'null') {
                query[column] = null;
            } else {
                query[column] = value;
            }
        } else {
            return res.status(400).json({ success: false, msg: 'Value or range query parameters are required' });
        }

        const mergedDoc = await MergedDataModel.findOne({ 'file.fileName': 'Merged-Data.json' });

        if (!mergedDoc) {
            return res.status(404).json({ success: false, msg: 'Merged data document not found' });
        }

        const records = mergedDoc.data.filter(record => {
            if (min !== undefined || max !== undefined) {
                const recordValue = new Date(record[column]) || Number(record[column]);
                return (!min || recordValue >= (new Date(min) || Number(min))) &&
                       (!max || recordValue <= (new Date(max) || Number(max)));
            } else {
                if (value === 'null') {
                    return record[column] === null;
                } else {
                    return record[column] === value;
                }
            }
        });

        const totalRecords = records.length;

        res.status(200).json({ success: true, data: records, totalRecords });
    } catch (error) {
        console.error('Error fetching data by column:', error);
        res.status(500).json({ success: false, msg: 'Internal server error' });
    }
};

// Get Aggregate Data
const getAggregatedByColumn = async (req, res) => {
    try {
        const { column, value, startdate, enddate } = req.query;

        if (!column || (!value && (!startdate || !enddate))) {
            return res.status(400).json({ success: false, msg: 'Column and value or both startdate and enddate query parameters are required' });
        }

        const validColumns = [
            "Name", "Age", "Night", "Sex", "Nationality", 
            "LocalRegion", "Occupation", "Segment", "visitor_number", "Arrival", 
            "visitor_category", "Repeater"
        ];

        if (!validColumns.includes(column)) {
            return res.status(400).json({ success: false, msg: 'Invalid column name' });
        }

        const query = {};

        if (column === "Arrival") {
            if (startdate && enddate) {
                const start = new Date(startdate).setUTCHours(0, 0, 0, 0);
                const end = new Date(enddate).setUTCHours(23, 59, 59, 999);
                query[`data.${column}`] = {
                    $gte: new Date(start),
                    $lte: new Date(end)
                };
            } else {
                const dateValue = new Date(value);
                if (isNaN(dateValue)) {
                    return res.status(400).json({ success: false, msg: 'Invalid date value' });
                }
                query[`data.${column}`] = {
                    $eq: new Date(dateValue.setUTCHours(0, 0, 0, 0))
                };
            }
        } else {
            query[`data.${column}`] = value;
        }

        const aggregatedDocs = await AggregatedModel.find(query);

        if (!aggregatedDocs || aggregatedDocs.length === 0) {
            return res.status(404).json({ success: false, msg: 'Aggregated data document not found' });
        }

        const records = [];
        aggregatedDocs.forEach(doc => {
            doc.data.forEach(record => {
                if (column === "Arrival") {
                    const recordDate = new Date(record[column]).setUTCHours(0, 0, 0, 0);
                    if ((value && recordDate === new Date(value).setUTCHours(0, 0, 0, 0)) ||
                        (startdate && enddate && recordDate >= new Date(startdate).setUTCHours(0, 0, 0, 0) && recordDate <= new Date(enddate).setUTCHours(23, 59, 59, 999))) {
                        records.push(record);
                    }
                } else if (record[column] === value) {
                    records.push(record);
                }
            });
        });

        const totalRecords = records.length;

        res.status(200).json({ success: true, data: records, totalRecords });
    } catch (error) {
        console.error('Error fetching data by column:', error);
        res.status(500).json({ success: false, msg: 'Internal server error' });
    }
};

// Get Category visitor
const getVisitorCategoryCounts = async (req, res) => {
    try {
        const mergedDocuments = await MergedDataModel.find();

        let totalRecords = 0;
        let totalNight = 0;

        const visitorCategoryCounts = mergedDocuments.reduce((acc, doc) => {
            doc.data.forEach(record => {
                const category = record.visitor_category || 'Unknown';
                const night = record.Night || 0;

                if (!acc[category]) {
                    acc[category] = { count: 0, totalNight: 0 };
                }

                acc[category].count += 1;
                acc[category].totalNight += night;
                totalRecords += 1;
                totalNight += night;
            });
            return acc;
        }, {});

        res.status(200).json({ success: true, data: visitorCategoryCounts, totalRecords, totalNight });
    } catch (error) {
        console.error('Error getting visitor category counts:', error);
        res.status(500).json({ success: false, msg: 'Internal server error' });
    }
};

// Get Room
const getRoomCounts = async (req, res) => {
    const { startdate, enddate } = req.query;

    try {
        const aggregatedDocs = await MergedDataModel.find();

        if (!aggregatedDocs || aggregatedDocs.length === 0) {
            return res.status(404).json({ success: false, msg: 'No aggregated data found' });
        }

        const allData = aggregatedDocs.flatMap(doc => doc.data);

        const filteredData = allData.filter(record => {
            const arrivalDate = record.Arrival ? new Date(record.Arrival) : null;
            const isWithinDateRange = (!startdate || (arrivalDate && arrivalDate >= new Date(startdate))) &&
                                      (!enddate || (arrivalDate && arrivalDate <= new Date(enddate)));
            const isRoom_TypeValid = record.Room_Type !== null && record.Room_Type !== undefined;

            return isWithinDateRange && isRoom_TypeValid;
        });

        const roomtypeCounts = filteredData.reduce((acc, record) => {
            const { Night = 0 } = record;
            const { Room_Type } = record;

            if (!acc[Room_Type]) {
                acc[Room_Type] = { count: 0, totalNight: 0 };
            }

            acc[Room_Type].count += 1;
            acc[Room_Type].totalNight += Night;

            return acc;
        }, {});

        const totalRecords = Object.values(roomtypeCounts).reduce((acc, { count }) => acc + count, 0);
        const totalNight = Object.values(roomtypeCounts).reduce((acc, { totalNight }) => acc + totalNight, 0);

        res.status(200).json({ success: true, roomtypeCounts, totalRecords, totalNight });
    } catch (error) {
        console.error('Error getting room counts:', error);
        res.status(500).json({ success: false, msg: 'Internal server error' });
    }
};

// Get Sorted Company
const getSortedCompanyByRepeater = async (req, res) => {
    const { startdate, enddate } = req.query;

    try {
        const aggregatedDocs = await CompanyModel.find();

        if (!aggregatedDocs || aggregatedDocs.length === 0) {
            return res.status(404).json({ success: false, msg: 'No aggregated data found' });
        }

        const validSegments = ['COR-FIT', 'COR-GROUP', 'GOV-FIT', 'GOV-GROUP'];

        const allData = aggregatedDocs.flatMap(doc => doc.data);

        const filteredData = allData.filter(record => {
            const arrivalDate = record.Arrival ? new Date(record.Arrival) : null;
            const isWithinDateRange = (!startdate || (arrivalDate && arrivalDate >= new Date(startdate))) &&
                                      (!enddate || (arrivalDate && arrivalDate <= new Date(enddate)));
            const isValidSegment = validSegments.includes(record.Segment);

            return isWithinDateRange && isValidSegment;
        });

        const repeaterCounts = filteredData.reduce((acc, record) => {
            const { Company_TA, Segment, Repeater = 0, Arrival, Depart } = record;

            if (!acc[Company_TA]) {
                acc[Company_TA] = {
                    totalRepeater: 0,
                    segments: record.Segment,
                    Arrival: record.Arrival,
                    Depart: record.Depart
                };
            }

            acc[Company_TA].totalRepeater += Repeater;

            return acc;
        }, {});

        const sortedData = Object.entries(repeaterCounts)
            .map(([company, { totalRepeater, segments, Arrival, Depart }]) => ({
                Company_TA: company,
                totalRepeater,
                segments,
                Arrival,
                Depart
            }))
            .sort((a, b) => b.totalRepeater - a.totalRepeater)
            .slice(0, 10);

        const totalRepeater = sortedData.reduce((sum, record) => sum + record.totalRepeater, 0);

        res.status(200).json({ success: true, totalRepeater, data: sortedData });
    } catch (error) {
        console.error('Error getting sorted data by company and segment:', error);
        res.status(500).json({ success: false, msg: 'Internal server error' });
    }
};

module.exports = {
    uploadAndImport,
    home,
    view,
    delete: deleteDocument,
    getAgeCounts,
    getDataByColumn,
    getSexCounts,
    getOccupationCounts,
    getCityCounts,
    getCountryCounts,
    getSegmentCounts,
    getSortedByNight,
    getSortedByRepeater,
    getSortedCompanyByRepeater,
    getVisitorCategoryCounts,
    getRoomCounts,
    getAggregatedByColumn,
    mergeInHouseAndExtractFiles,
    getEscortingCounts,
    getGuestPurposeCounts,
    getGuestPriority,
};
