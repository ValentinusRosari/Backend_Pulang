const express = require("express");
const dotenv = require("dotenv");
const cookieparser = require("cookie-parser");
const cors = require("cors");
const connectToDB = require("./config/dbConnection");
const frRoutes = require("./routes/FrRoutes");
const ihRoutes = require("./routes/IhRoutes");
const escortRoutes = require("./routes/EscortRoutes")
const commentRoutes = require("./routes/CommentRoutes")
const requestRoutes = require("./routes/RequestRoutes")
const banquetRoutes = require("./routes/BanquetRoutes")
const restaurantRoutes = require("./routes/RestaurantRoutes")
const roomserviceRoutes = require("./routes/RoomserviceRoutes")
const obtRoutes = require("./routes/ObtRoutes")
const path = require("path");

dotenv.config();
const PORT = process.env.PORT || 3000;
const app = express();

app.use(cookieparser());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));
// app.use(
//   cors({
//     credentials: true,
//     origin: "http://192.168.1.141:4000",
//   })
// );

app.use(
  cors({
    credentials: true,
    origin: "http://localhost:5173",
  })
);

app.use("/api/files", obtRoutes);
app.use("/api/files", frRoutes);
app.use("/api/files", ihRoutes);
app.use("/api/files", escortRoutes);
app.use("/api/files", commentRoutes);
app.use("/api/files", requestRoutes);
app.use("/api/files", banquetRoutes);
app.use("/api/files", restaurantRoutes);
app.use("/api/files", roomserviceRoutes);
// app.use("/event", require("./routes/event"));
// app.use("/feedback", require("./routes/feedback"));
// app.use("/guest", require("./routes/guest"));
// app.use("/identity", require("./routes/identity"));
// app.use("/request", require("./routes/request"));
// app.use("/room", require("./routes/room"));
// app.use("/employee", require("./routes/employee"));
// app.use("/vhp", require("./routes/vhp"));
app.use("/api/auth", require("./routes/Auth"));
app.use("/api/admin", require("./routes/AdminRoutes"));

connectToDB().then(() => {
  app.listen(PORT, () => {
    console.log(`listening for request on port: ${PORT}`);
  });
});
