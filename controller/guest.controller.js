const Guest = require("../model/Guest");
const { getAsync, setAsync, delAsync } = require('../config/redisClient');

const createGuest = async (req, res) => {
  try {
    const guest = new Guest({ ...req.body });

    await guest.save();
    await delAsync('guests');

    res.status(201).json({ success: true, data: guest });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const readGuest = async (req, res) => {
  const cacheKey = 'guests';

  try {
    const cachedData = await getAsync(cacheKey);
    if (cachedData) {
      console.log('Data found in cache');
      return res.status(200).json({ success: true, data: JSON.parse(cachedData) });
    }

    const guest = await Guest.find();

    await setAsync(cacheKey, JSON.stringify(guest), 'EX', 3600);

    res.status(200).json({ success: true, data: guest });
  } catch (error) {
    res.status(500).send(error.message);
    console.error(error);
  }
};

const updateGuest = async (req, res) => {
  try {
    const guestId = req.params.id;
    const updatedData = { ...req.body };

    const guest = await Guest.findOneAndUpdate({ _id: guestId }, updatedData, {
      new: true,
    });

    if (!guest) {
      return res.status(404).json({ message: "Guest record not found" });
    }

    await delAsync('guests');

    res.status(200).json({ success: true, data: guest });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const deleteGuest = async (req, res) => {
  try {
    const guestId = req.params.id;

    const guest = await Guest.findOneAndDelete({ _id: guestId });

    if (!guest) {
      return res.status(404).json({ message: "Guest record not found" });
    }

    await delAsync('guests');

    res.status(200).json({ success: true, data: "Guest removed!" });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

module.exports = {
  createGuest,
  readGuest,
  updateGuest,
  deleteGuest,
};
