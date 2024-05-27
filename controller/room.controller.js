const Room = require("../model/Room");

const createRoom = async (req, res) => {
  try {
    const room = new Room({ ...req.body });

    await room.save();

    res.status(201).json({ succes: true, data: room });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const readRoom = async (req, res) => {
  try {
    const room = await Room.find();

    res.status(200).json({ succes: true, data: room });
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

    res.status(200).json({ succes: true, data: room });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const deleteRoom = async (req, res) => {
  try {
    const roomId = req.params.id;

    const room = await Room.findOneAndDelete({ _id: roomId });

    res.status(200).json({ success: true, data: "Room removed!" });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

module.exports = {
  createRoom,
  readRoom,
  updateRoom,
  deleteRoom,
};
