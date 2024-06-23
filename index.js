const express = require("express");
const dotenv = require("dotenv");
const cookieparser = require("cookie-parser");
const cors = require("cors");
const connectToDB = require("./config/dbConnection");

dotenv.config();
const PORT = process.env.PORT || 3000;
const app = express();

app.use(cookieparser());
app.use(express.json());
app.use(
  cors({
    credentials: true,
    origin: "http://192.168.1.141:4000",
  })
);

app.use("/event", require("./routes/event"));
app.use("/feedback", require("./routes/feedback"));
app.use("/guest", require("./routes/guest"));
app.use("/identity", require("./routes/identity"));
app.use("/request", require("./routes/request"));
app.use("/room", require("./routes/room"));
app.use("/employee", require("./routes/employee"));
app.use("/vhp", require("./routes/vhp"));
app.use("/api/auth", require("./routes/Auth"));
app.use("/api/admin", require("./routes/AdminRoutes"));

connectToDB().then(() => {
  app.listen(PORT, () => {
    console.log(`listening for request on port: ${PORT}`);
  });
});
