const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const CombinedModel = require('../model/Filevhp');
const AggregatedModel = require('../model/AgregatedData');
const MergedDataModel = require('../model/MergedCombined');
const CompanyModel = require('../model/CompanyData')

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
            scriptPath = path.resolve(__dirname, '../script/process_extractguess.py');
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

// Join inhouse's files and extractguest's files
const mergeInHouseAndExtractFiles = async () => {
    try {
        const inHouseFiles = await CombinedModel.find({ 'file.fileName': /InHouse/ });
        const extractFiles = await CombinedModel.find({ 'file.fileName': /Extract/ });

        if (inHouseFiles.length === 0 && extractFiles.length === 0) {
            console.error('No InHouse or Extract files found.');
            await MergedDataModel.deleteMany({});
            return;
        }

        const inHouseFields = [
            "Name", "In_House_Date", "Room_Type", "Room_Number", "Arrangement",
            "Birth_Date", "Age", "Lodging", "Breakfast", "visitor_number", "visitor_category",
            "Company_TA", "SOB", "Arrival", "Depart", "Night", "Created",
            "CO_Time", "CI_Time", "Segment", "LocalRegion", "Repeater"
        ];

        const extractFields = [
            "Name", "Nationality", "LocalRegion", "MobilePhone", "Sex", "Occupation"
        ];

        const allFields = [...new Set([...inHouseFields, ...extractFields])];

        const ensureAllFields = (record, fields) => {
            const result = {};
            fields.forEach(field => {
                result[field] = record[field] !== undefined ? record[field] : null;
            });
            return result;
        };

        const mergedData = [];

        for (const inHouseDoc of inHouseFiles) {
            inHouseDoc.data.forEach(record => {
                const mergedRecord = ensureAllFields(record, inHouseFields);
                mergedData.push(mergedRecord);
            });
        }

        for (const extractDoc of extractFiles) {
            extractDoc.data.forEach(record => {
                const existingRecordIndex = mergedData.findIndex(r => r.Name === record.Name);
                if (existingRecordIndex !== -1) {
                    const existingRecord = mergedData[existingRecordIndex];
                    const mergedRecord = { ...existingRecord, ...ensureAllFields(record, extractFields) };
                    mergedData[existingRecordIndex] = mergedRecord;
                } else {
                    const newRecord = ensureAllFields(record, allFields);
                    mergedData.push(newRecord);
                }
            });
        }

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
            data: mergedData,
            fileData: fileData,
        });
        await mergedDocument.save();

        console.log('InHouse and Extract files merged successfully into a single document!');
    } catch (error) {
        console.error('Error merging InHouse and Extract files:', error);
    }
};

// Create collection by name
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
                        Age: record.Age || 0,
                        Night: record.Night || 0,
                        Repeater: 1,
                        Sex: record.Sex || 'Unknown',
                        Occupation: record.Occupation || 'Unknown',
                        Nationality: record.Nationality || 'Unknown',
                        LocalRegion: record.LocalRegion || 'Unknown',
                        Segment: record.Segment || 'Unknown',
                    };
                } else {
                    aggregatedData[name].Age = Math.max(aggregatedData[name].Age, record.Age || 0);
                    aggregatedData[name].Night += record.Night || 0;
                    aggregatedData[name].Repeater += 1;
                    if (aggregatedData[name].Sex === 'Unknown' && record.Sex) {
                        aggregatedData[name].Sex = record.Sex;
                    }
                    if (aggregatedData[name].Occupation === 'Unknown' && record.Occupation) {
                        aggregatedData[name].Occupation = record.Occupation;
                    }
                    if (aggregatedData[name].Nationality === 'Unknown' && record.Nationality) {
                        aggregatedData[name].Nationality = record.Nationality;
                    }
                    if (aggregatedData[name].LocalRegion === 'Unknown' && record.LocalRegion) {
                        aggregatedData[name].LocalRegion = record.LocalRegion;
                    }
                    if (aggregatedData[name].Segment === 'Unknown' && record.Segment) {
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

        const companyData = {};

        mergedDocuments.forEach(doc => {
            doc.data.forEach(record => {
                const company = record.Company_TA;

                if (!companyData[company]) {
                    companyData[company] = {
                        Company_TA: company,
                        Night: record.Night || 0,
                        Repeater: 1,
                    };
                } else {
                    companyData[company].Night += record.Night || 0;
                    companyData[company].Repeater += 1;
                }
            });
        });

        const aggregatedArray = Object.values(companyData);

        await CompanyModel.deleteMany({});

        await CompanyModel.create({ data: aggregatedArray });

        console.log('Aggregated data successfully created!');
    } catch (error) {
        console.error('Error creating aggregated data:', error);
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
    try {
        const aggregatedDoc = await AggregatedModel.findOne();

        if (!aggregatedDoc) {
            return res.status(404).json({ success: false, msg: 'No aggregated data found' });
        }

        const ageCounts = aggregatedDoc.data.reduce((acc, record) => {
            const age = record.Age;
            if (age !== null && age !== undefined) {
                if (!acc[age]) {
                    acc[age] = 0;
                }
                acc[age] += 1;
            }
            return acc;
        }, {});

        const totalRecords = aggregatedDoc.data.length;

        res.status(200).json({ success: true, ageCounts, totalRecords });
    } catch (error) {
        console.error('Error getting age counts:', error);
        res.status(500).json({ success: false, msg: 'Internal server error' });
    }
};

// Get Sex
const getSexCounts = async (req, res) => {
    try {
        const aggregatedDoc = await AggregatedModel.findOne();

        if (!aggregatedDoc) {
            return res.status(404).json({ success: false, msg: 'No aggregated data found' });
        }

        const sexCounts = aggregatedDoc.data.reduce((acc, record) => {
            const { Sex, Night } = record;
            if (Sex && Night !== null && Night !== undefined) {
                if (!acc[Sex]) {
                    acc[Sex] = { count: 0, totalNight: 0 };
                }
                acc[Sex].count += 1;
                acc[Sex].totalNight += Night;
            }
            return acc;
        }, {});

        // Calculate total records and total nights
        const totalRecords = Object.values(sexCounts).reduce((acc, { count }) => acc + count, 0);
        const totalNight = Object.values(sexCounts).reduce((acc, { totalNight }) => acc + totalNight, 0);

        res.status(200).json({ success: true, sexCounts, totalRecords, totalNight });
    } catch (error) {
        console.error('Error getting sex counts:', error);
        res.status(500).json({ success: false, msg: 'Internal server error' });
    }
};

// Get Occupation
const getOccupationCounts = async (req, res) => {
    try {
        const aggregatedDoc = await AggregatedModel.findOne();

        if (!aggregatedDoc) {
            return res.status(404).json({ success: false, msg: 'No aggregated data found' });
        }

        const occupationCounts = aggregatedDoc.data.reduce((acc, record) => {
            const { Occupation, Night } = record;
            if (Occupation && Night !== null && Night !== undefined) {
                if (!acc[Occupation]) {
                    acc[Occupation] = { count: 0, totalNight: 0 };
                }
                acc[Occupation].count += 1;
                acc[Occupation].totalNight += Night;
            }
            return acc;
        }, {});

        // Calculate total records and total nights
        const totalRecords = Object.values(occupationCounts).reduce((acc, { count }) => acc + count, 0);
        const totalNight = Object.values(occupationCounts).reduce((acc, { totalNight }) => acc + totalNight, 0);

        res.status(200).json({ success: true, occupationCounts, totalRecords, totalNight });
    } catch (error) {
        console.error('Error getting occupation counts:', error);
        res.status(500).json({ success: false, msg: 'Internal server error' });
    }
};

// Get City
const getCityCounts = async (req, res) => {
    try {
        const aggregatedDoc = await AggregatedModel.findOne();

        if (!aggregatedDoc) {
            return res.status(404).json({ success: false, msg: 'No aggregated data found' });
        }

        const localregionCounts = aggregatedDoc.data.reduce((acc, record) => {
            const { LocalRegion, Night } = record;
            if (LocalRegion && Night !== null && Night !== undefined) {
                if (!acc[LocalRegion]) {
                    acc[LocalRegion] = { count: 0, totalNight: 0 };
                }
                acc[LocalRegion].count += 1;
                acc[LocalRegion].totalNight += Night;
            }
            return acc;
        }, {});

        // Calculate total records and total nights
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
    try {
        const aggregatedDoc = await AggregatedModel.findOne();

        if (!aggregatedDoc) {
            return res.status(404).json({ success: false, msg: 'No aggregated data found' });
        }

        const nationalityCounts = aggregatedDoc.data.reduce((acc, record) => {
            const { Nationality, Night } = record;
            if (Nationality && Night !== null && Night !== undefined) {
                if (!acc[Nationality]) {
                    acc[Nationality] = { count: 0, totalNight: 0 };
                }
                acc[Nationality].count += 1;
                acc[Nationality].totalNight += Night;
            }
            return acc;
        }, {});

        // Calculate total records and total nights
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
    try {
        const aggregatedDoc = await AggregatedModel.findOne();

        if (!aggregatedDoc) {
            return res.status(404).json({ success: false, msg: 'No aggregated data found' });
        }

        const segmentCounts = aggregatedDoc.data.reduce((acc, record) => {
            const { Segment, Night } = record;
            if (Segment && Night !== null && Night !== undefined) {
                if (!acc[Segment]) {
                    acc[Segment] = { count: 0, totalNight: 0 };
                }
                acc[Segment].count += 1;
                acc[Segment].totalNight += Night;
            }
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
    try {
        const aggregatedDoc = await AggregatedModel.findOne();

        if (!aggregatedDoc) {
            return res.status(404).json({ success: false, msg: 'No aggregated data found' });
        }

        const sortedData = aggregatedDoc.data.sort((a, b) => b.Night - a.Night);

        const result = sortedData.map(record => ({
            Name: record.Name,
            Night: record.Night
        }));

        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('Error getting sorted data by night:', error);
        res.status(500).json({ success: false, msg: 'Internal server error' });
    }
};

// Get Sorted Repeater
const getSortedByRepeater = async (req, res) => {
    try {
        const aggregatedDoc = await AggregatedModel.findOne();

        if (!aggregatedDoc) {
            return res.status(404).json({ success: false, msg: 'No aggregated data found' });
        }

        const sortedData = aggregatedDoc.data.sort((a, b) => b.Repeater - a.Repeater);

        const result = sortedData.map(record => ({
            Name: record.Name,
            Repeater: record.Repeater
        }));

        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('Error getting sorted data by Repeater:', error);
        res.status(500).json({ success: false, msg: 'Internal server error' });
    }
};

// Get Data Join
const getDataByColumn = async (req, res) => {
    try {
        const { column, value } = req.query;

        if (!column || !value) {
            return res.status(400).json({ success: false, msg: 'Column and value query parameters are required' });
        }

        // Validate column name to prevent injection attacks
        const validColumns = [
            "Name", "In_House_Date", "Room_Type", "Room_Number", "Arrangement",
            "Birth_Date", "Age", "Lodging", "Breakfast", "Adult", "Child",
            "Company_TA", "SOB", "Arrival", "Depart", "Night", "Created",
            "CO_Time", "CI_Time", "Segment", "Repeater", "Nationality", 
            "LocalRegion", "MobilePhone", "Sex", "Occupation"
        ];

        if (!validColumns.includes(column)) {
            return res.status(400).json({ success: false, msg: 'Invalid column name' });
        }

        const query = {};
        query[column] = value;

        // Find the merged document
        const mergedDoc = await MergedDataModel.findOne({ 'file.fileName': 'Merged-Data.json' });

        if (!mergedDoc) {
            return res.status(404).json({ success: false, msg: 'Merged data document not found' });
        }

        // Filter data based on query
        const records = mergedDoc.data.filter(record => record[column] === value);

        res.status(200).json({ success: true, data: records });
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
    try {
        const mergedDocuments = await MergedDataModel.find();

        let totalRecords = 0;
        let totalNight = 0;

        const roomCounts = mergedDocuments.reduce((acc, doc) => {
            doc.data.forEach(record => {
                const room = record.Room_Type || 'Unknown';
                const night = record.Night || 0;

                if (!acc[room]) {
                    acc[room] = { count: 0, totalNight: 0 };
                }

                acc[room].count += 1;
                acc[room].totalNight += night;
                totalRecords += 1;
                totalNight += night;
            });
            return acc;
        }, {});

        res.status(200).json({ success: true, data: roomCounts, totalRecords, totalNight });
    } catch (error) {
        console.error('Error getting visitor room counts:', error);
        res.status(500).json({ success: false, msg: 'Internal server error' });
    }
};

// Get Sorted Company
const getSortedCompanyByRepeater = async (req, res) => {
    try {
        const aggregatedDoc = await CompanyModel.findOne();

        if (!aggregatedDoc) {
            return res.status(404).json({ success: false, msg: 'No aggregated data found' });
        }

        const sortedData = aggregatedDoc.data.sort((a, b) => b.Repeater - a.Repeater);

        const result = sortedData.map(record => ({
            Company_TA: record.Company_TA,
            Repeater: record.Repeater
        }));

        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('Error getting sorted data by Repeater:', error);
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
};
