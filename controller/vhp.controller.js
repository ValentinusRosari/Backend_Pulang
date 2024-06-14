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
            "Name", "Room_Type", "Room_Number", "Arrangement",
            "Birth_Date", "Age", "Lodging", "Breakfast", "visitor_number", "visitor_category",
            "Company_TA", "SOB", "Arrival", "Depart", "Night", "Created",
            "CO_Time", "CI_Time", "Segment", "LocalRegion"
        ];

        const extractFields = [
            "Name", "Nationality", "LocalRegion", "MobilePhone", "Sex", "Occupation"
        ];

        const allFields = [...new Set([...inHouseFields, ...extractFields, "Repeater"])];

        const ensureAllFields = (record, fields) => {
            const result = {};
            fields.forEach(field => {
                result[field] = record[field] !== undefined ? record[field] : null;
            });
            return result;
        };

        const mergedInHouseData = {};

        // Merge InHouse files based on Name, Arrival, and Depart
        for (const inHouseDoc of inHouseFiles) {
            inHouseDoc.data.forEach(record => {
                const key = `${record.Name}_${record.Arrival}_${record.Depart}`;
                if (!mergedInHouseData[key]) {
                    mergedInHouseData[key] = ensureAllFields(record, inHouseFields);
                } else {
                    mergedInHouseData[key] = { ...mergedInHouseData[key], ...ensureAllFields(record, inHouseFields) };
                }
            });
        }

        // Flatten mergedInHouseData to a list
        const flattenedInHouseData = Object.values(mergedInHouseData);

        const mergedExtractData = {};

        // Merge Extract files based on Name
        for (const extractDoc of extractFiles) {
            extractDoc.data.forEach(record => {
                const name = record.Name;
                if (!mergedExtractData[name]) {
                    mergedExtractData[name] = ensureAllFields(record, extractFields);
                } else {
                    mergedExtractData[name] = { ...mergedExtractData[name], ...ensureAllFields(record, extractFields) };
                }
            });
        }

        const finalMergedData = [];

        // Create a map of names to their corresponding merged InHouse records
        const nameToInHouseRecords = {};
        flattenedInHouseData.forEach(record => {
            const name = record.Name;
            if (!nameToInHouseRecords[name]) {
                nameToInHouseRecords[name] = [];
            }
            nameToInHouseRecords[name].push(record);
        });

        // Perform outer join between InHouse and Extract data
        for (const name in mergedExtractData) {
            const extractRecord = mergedExtractData[name];
            const inHouseRecords = nameToInHouseRecords[name] || [ensureAllFields({}, inHouseFields)];

            inHouseRecords.forEach(inHouseRecord => {
                const mergedRecord = { ...inHouseRecord, ...extractRecord };
                finalMergedData.push(mergedRecord);
            });

            // Remove the entry from the map to track names processed
            delete nameToInHouseRecords[name];
        }

        // Add any remaining InHouse records that didn't have matching Extract records
        Object.values(nameToInHouseRecords).forEach(records => {
            records.forEach(record => {
                finalMergedData.push(record);
            });
        });

        // Calculate the Repeater count based on finalMergedData
        const nameCount = {};
        finalMergedData.forEach(record => {
            const name = record.Name;
            if (!nameCount[name]) {
                nameCount[name] = 0;
            }
            nameCount[name]++;
        });

        // Update the Repeater field in finalMergedData
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
                        Age: record.Age || null,
                        Night: record.Night || null,
                        Repeater: 1,
                        Sex: record.Sex !== undefined ? record.Sex : null,
                        Occupation: record.Occupation !== undefined ? record.Occupation : null,
                        Nationality: record.Nationality !== undefined ? record.Nationality : null,
                        LocalRegion: record.LocalRegion !== undefined ? record.LocalRegion : null,
                        Segment: record.Segment !== undefined ? record.Segment : null,
                    };
                } else {
                    aggregatedData[name].Age = Math.max(aggregatedData[name].Age, record.Age || null);
                    aggregatedData[name].Night += record.Night || null;
                    aggregatedData[name].Repeater += 1;
                    if (aggregatedData[name].Sex === null && record.Sex !== undefined) {
                        aggregatedData[name].Sex = record.Sex;
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
                        Repeater: 1
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
            const sex = record.Sex;
            if (sex !== null && sex !== undefined) {
                if (!acc[sex]) {
                    acc[sex] = 0;
                }
                acc[sex] += 1;
            }
            return acc;
        }, {});

        const totalRecords = aggregatedDoc.data.length;

        res.status(200).json({ success: true, sexCounts, totalRecords });
    } catch (error) {
        console.error('Error getting sex counts:', error);
        res.status(500).json({ success: false, msg: 'Internal server error' });
    }
};

// Get Occupation
const getOccupationCounts = async (req, res) => {
    try {
        const aggregatedDoc = await MergedDataModel.findOne();

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
        const aggregatedDoc = await MergedDataModel.findOne();

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
        const aggregatedDoc = await MergedDataModel.findOne();

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
        const aggregatedDoc = await MergedDataModel.findOne();

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

        const totalNight = sortedData.reduce((sum, record) => sum + (record.Night || 0), 0);

        res.status(200).json({ 
            success: true, 
            totalNight, 
            data: result 
        });
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
        query[column] = value;

        const mergedDoc = await MergedDataModel.findOne({ 'file.fileName': 'Merged-Data.json' });

        if (!mergedDoc) {
            return res.status(404).json({ success: false, msg: 'Merged data document not found' });
        }

        const records = mergedDoc.data.filter(record => record[column] === value);

        res.status(200).json({ success: true, data: records });
    } catch (error) {
        console.error('Error fetching data by column:', error);
        res.status(500).json({ success: false, msg: 'Internal server error' });
    }
};
const getAggregatedByColumn = async (req, res) => {
    try {
        const { column, value } = req.query;

        if (!column || !value) {
            return res.status(400).json({ success: false, msg: 'Column and value query parameters are required' });
        }

        const validColumns = [
            "Name", "Age", "Night", "Sex", "Nationality", 
            "LocalRegion", "Occupation", "Segment", "visitor_number", 
            "visitor_category", "Repeater"
        ];

        if (!validColumns.includes(column)) {
            return res.status(400).json({ success: false, msg: 'Invalid column name' });
        }

        const query = {};
        query[`data.${column}`] = value;

        const aggregatedDocs = await AggregatedModel.find(query);

        if (!aggregatedDocs || aggregatedDocs.length === 0) {
            return res.status(404).json({ success: false, msg: 'Aggregated data document not found' });
        }

        // Flatten the data from the aggregated documents
        const records = [];
        aggregatedDocs.forEach(doc => {
            doc.data.forEach(record => {
                if (record[column] === value) {
                    records.push(record);
                }
            });
        });

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

        const validSegments = ['COR-FIT', 'COR-GROUP', 'GOV-FIT', 'GOV-GROUP'];

        const filteredData = aggregatedDoc.data.filter(record => validSegments.includes(record.Segment));
        const sortedData = filteredData.sort((a, b) => b.Repeater - a.Repeater);

        const result = sortedData.map(record => ({
            Company_TA: record.Company_TA,
            Segment: record.Segment,
            Repeater: record.Repeater,
        }));

        const totalRepeater = sortedData.reduce((sum, record) => sum + (record.Repeater || 0), 0);

        res.status(200).json({ success: true, totalRepeater, data: result });
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
};
