const express = require("express");
const app = express();
const path = require("path");

// app.use(
//   "/public",
//   express.static(path.join(__dirname, "public"), {
//     etag: false,
//     lastModified: false,
//     setHeaders: (res, path) => {
//       //打印接收到请求的时间
//       console.log("接收到请求的时间:", new Date());
//       res.setHeader("Cache-Control", "max-age=10");
//     },
//   })
// );

app.use(
  "/public",
  express.static(path.join(__dirname, "public"), {
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
      //打印接收到请求的时间
      console.log("接收到请求的时间:", new Date());
    },
  })
);

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
