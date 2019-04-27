#!/usr/bin/env node
require = require("esm")(module);
global.WebSocket = require("ws");
const fs = require("fs");
const {log, err} = require("./controller/util.js");
const obs = require("./controller/obs.js").default;
const fantsu = require("./controller/fantsu.js").default;
const {StreamController} = require("./controller/stream.js");

console.debug = () => 0;

if(process.argv.length < 3){
	err("main", "Usage: controller.js <config.json>");
	return;
}

const config = require(fs.realpathSync(process.argv[2])).default;

const obsClient = obs(config.obs);
const stream = new StreamController(obsClient, config.computeView);
const fantsuClient = fantsu(stream, config.fantsu);

obsClient.connect();
stream.scheduleUpdate();
