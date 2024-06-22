const Request = require("../model/Request");
const { getAsync, setAsync, delAsync } = require('../config/redisClient');

const createRequest = async (req, res) => {
  try {
    const request = new Request({ ...req.body });

    await request.save();
    await delAsync('requests');

    res.status(201).json({ success: true, data: request });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const readRequest = async (req, res) => {
  const cacheKey = 'requests';

  try {
    const cachedData = await getAsync(cacheKey);
    if (cachedData) {
      console.log('Data found in cache');
      return res.status(200).json({ success: true, data: JSON.parse(cachedData) });
    }

    const request = await Request.find().populate("employeeId");

    await setAsync(cacheKey, JSON.stringify(request), 'EX', 3600);

    res.status(200).json({ success: true, data: request });
  } catch (error) {
    res.status(500).send(error.message);
    console.error(error);
  }
};

const updateRequest = async (req, res) => {
  try {
    const requestId = req.params.id;
    const updatedData = { ...req.body };

    const request = await Request.findOneAndUpdate(
      { _id: requestId },
      updatedData,
      {
        new: true,
      }
    );

    if (!request) {
      return res.status(404).json({ message: "Request record not found" });
    }

    await delAsync('requests');

    res.status(200).json({ success: true, data: request });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const deleteRequest = async (req, res) => {
  try {
    const requestId = req.params.id;

    const request = await Request.findOneAndDelete({ _id: requestId });

    if (!request) {
      return res.status(404).json({ message: "Request record not found" });
    }

    await delAsync('requests');

    res.status(200).json({ success: true, data: "Request removed!" });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

module.exports = {
  createRequest,
  readRequest,
  updateRequest,
  deleteRequest,
};
