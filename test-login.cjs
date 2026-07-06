const http = require("http");
const body = JSON.stringify({ code: "EY1123", password: "gzyMpFcphn" });
const req = http.request(
  { host: "localhost", port: 4010, path: "/api/result/auth/login", method: "POST",
    headers: { "content-type": "application/json", "content-length": Buffer.byteLength(body) } },
  (res) => {
    let d = "";
    res.on("data", (c) => (d += c));
    res.on("end", () => console.log("STATUS", res.statusCode, "\n", d));
  },
);
req.on("error", (e) => console.log("ERR", e.message));
req.write(body);
req.end();
