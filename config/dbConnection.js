require("dotenv").config();
const url = process.env.DB_URI;
const mongoose = require("mongoose");

const connectToDb = async () => {
  try {
    const res = await mongoose.connect(url);
    if (res) {
      console.log("Connected to database");
    }
  } catch (error) {
    console.log("Failed to connect to databse", error.message);
  }
};
module.exports = connectToDb;
