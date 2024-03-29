const express = require("express");
const bodyParser = require("body-parser");
const { init, close } = require("./db/db");
const routes = require("./routes/routes");
const cors = require("cors");
const { config } = require("./config");

const app = express();
app.use(cors());
app.use(bodyParser.json({}));
app.use(routes);

init().then(() => {
    console.log(`Starting server on port ${config.server.port}...`);
    app.listen(config.server.port);
});

function haltOnTimedout(req, res, next) {
    if (!req.timedout) next();
}
