#!/usr/bin/env node
require = require("esm")(module);
global.EventSource = require("eventsource");
const fs = require("fs");
const {log, err} = require("../util/logging.js");
const obs = require("./obs.js").default;
const fantsu = require("./fantsu.js").default;
const {StreamController} = require("./stream.js");

console.debug = () => 0;

if(process.argv.length < 3){
	err("main", "Usage: controller.js <config.js>");
	return;
}

const config = require(fs.realpathSync(process.argv[2])).default;

const obsClient = obs(config.obs);
const stream = new StreamController(obsClient, config.computeView);
const fantsuClient = fantsu(stream, config.fantsu);

obsClient.connect();
stream.scheduleUpdate();
