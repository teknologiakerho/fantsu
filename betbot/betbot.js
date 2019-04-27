#!/usr/bin/env node
const chalk = require("chalk");
const EventSource = require("eventsource");
const fetch = require("node-fetch");

function log(mes){
	const timestamp = chalk.gray(`[${new Date().toLocaleString()}]`);
	console.log(timestamp, mes);
}

function err(mes){
	log(chalk.red(mes));
}
