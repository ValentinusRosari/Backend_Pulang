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

const createRooms = async (req, res) => {
  try {
    const rooms = req.body.rooms; // Expect an array of rooms in the request body
    const createdRooms = await Rooms.insertMany(rooms); // Insert multiple documents at once
    res.status(201).json({ success: true, data: createdRooms });
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

const readRoomByNumber = async (req, res) => {
  try {
    // Get the room number from the query parameters
    const { roomNumber } = req.query;

    // Check if roomNumber is provided
    if (!roomNumber) {
      return res
        .status(400)
        .json({ success: false, message: "Room number is required" });
    }

    // Find the room by its number
    const room = await Room.findOne({ roomNumber });

    // Check if the room exists
    if (!room) {
      return res
        .status(404)
        .json({ success: false, message: "Room not found" });
    }

    // Send the room data as response
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
  createRooms,
  readRoom,
  readRoomByNumber,
  updateRoom,
  deleteRoom,
};