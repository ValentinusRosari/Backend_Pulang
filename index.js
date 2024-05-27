require("dotenv").config();
const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
const connectToDB = require("./config/dbConnection");

app.use(express.json());

app.use("/event", require("./routes/event"));

connectToDB().then(() => {
  app.listen(port, () => {
    console.log(`listening for request on port: ${port}`);
  });
});
