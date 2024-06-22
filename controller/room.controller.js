const Room = require("../model/Room");
const { getAsync, setAsync, delAsync } = require('../config/redisClient');

const createRoom = async (req, res) => {
  try {
    const room = new Room({ ...req.body });

    await room.save();
    await delAsync('rooms');

    res.status(201).json({ success: true, data: room });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const readRoom = async (req, res) => {
  const cacheKey = 'rooms';

  try {
    const cachedData = await getAsync(cacheKey);
    if (cachedData) {
      console.log('Data found in cache');
      return res.status(200).json({ success: true, data: JSON.parse(cachedData) });
    }

    const room = await Room.find();

    await setAsync(cacheKey, JSON.stringify(room), 'EX', 3600);

    res.status(200).json({ success: true, data: room });
  } catch (error) {
    res.status(500).send(error.message);
    console.error(error);
  }
};

const readRoomByNumber = async (req, res) => {
  try {
    const { roomNumber } = req.query;

    if (!roomNumber) {
      return res.status(400).json({ success: false, message: "Room number is required" });
    }

    const room = await Room.findOne({ roomNumber });

    if (!room) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }

    res.status(200).json({ success: true, data: room });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const updateRoom = async (req, res) => {
  try {
    const roomId = req.params.id;
    const updatedData = { ...req.body };

    const room = await Room.findOneAndUpdate({ _id: roomId }, updatedData, {
      new: true,
    });

    if (!room) {
      return res.status(404).json({ message: "Room record not found" });
    }

    await delAsync('rooms');

    res.status(200).json({ success: true, data: room });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const deleteRoom = async (req, res) => {
  try {
    const roomId = req.params.id;

    const room = await Room.findOneAndDelete({ _id: roomId });

    if (!room) {
      return res.status(404).json({ message: "Room record not found" });
    }

    await delAsync('rooms');

    res.status(200).json({ success: true, data: "Room removed!" });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

module.exports = {
  createRoom,
  readRoom,
  readRoomByNumber,
  updateRoom,
  deleteRoom,
};
