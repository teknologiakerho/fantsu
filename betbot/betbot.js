#!/usr/bin/env node
require = require("esm")(module);
global.EventSource = require("eventsource");
const fs = require("fs");
const {log, err} = require("../util/logging.js");
const betbot = require("./bot.js").default;

if(process.argv.length < 3){
	err("main", "Usage: betbot.js <config.js>");
	return;
}

const config = require(fs.realpathSync(process.argv[2])).default;

let client;

if(config.test)
	client = require("./testclient.js").default();
else if(config.twitch)
	client = require("./twitch.js").default(config.twitch);

const bot = betbot(client, config);
client.setBot(bot);
