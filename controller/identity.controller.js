const Identity = require("../model/Identity");
const { getAsync, setAsync, delAsync } = require('../config/redisClient');

const createIdentity = async (req, res) => {
  try {
    const identity = new Identity({ ...req.body });

    await identity.save();
    await delAsync('identities');

    res.status(201).json({ success: true, data: identity });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const readIdentity = async (req, res) => {
  const cacheKey = 'identities';

  try {
    const cachedData = await getAsync(cacheKey);
    if (cachedData) {
      console.log('Data found in cache');
      return res.status(200).json({ success: true, data: JSON.parse(cachedData) });
    }

    const identity = await Identity.find();

    await setAsync(cacheKey, JSON.stringify(identity), 'EX', 3600);

    res.status(200).json({ success: true, data: identity });
  } catch (error) {
    res.status500.send(error.message);
    console.error(error);
  }
};

const updateIdentity = async (req, res) => {
  try {
    const identityId = req.params.id;
    const updatedData = { ...req.body };

    const identity = await Identity.findOneAndUpdate(
      { _id: identityId },
      updatedData,
      {
        new: true,
      }
    );

    if (!identity) {
      return res.status(404).json({ message: "Identity record not found" });
    }

    await delAsync('identities');

    res.status(200).json({ success: true, data: identity });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const deleteIdentity = async (req, res) => {
  try {
    const identityId = req.params.id;

    const identity = await Identity.findOneAndDelete({ _id: identityId });

    if (!identity) {
      return res.status(404).json({ message: "Identity record not found" });
    }

    await delAsync('identities');

    res.status(200).json({ success: true, data: "Identity removed!" });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

module.exports = {
  createIdentity,
  readIdentity,
  updateIdentity,
  deleteIdentity,
};
