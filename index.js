require("dotenv").config();
const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
const connectToDB = require("./config/dbConnection");

app.use(express.json());

app.use("/event", require("./routes/event"));
app.use("/feedback", require("./routes/feedback"));
app.use("/guest", require("./routes/guest"));
app.use("/identity", require("./routes/identity"));
app.use("/request", require("./routes/request"));
app.use("/room", require("./routes/room"));

connectToDB().then(() => {
  app.listen(port, () => {
    console.log(`listening for request on port: ${port}`);
  });
});
