const app = require("../backend/server");

module.exports = function handler(req, res) {
  req.url = req.url.replace(/^\/api(?=\/|$)/, "") || "/";
  return app(req, res);
};
