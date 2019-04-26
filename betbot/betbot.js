#!/usr/bin/env node
const chalk = require("chalk");
const Ws = require("reconnecting-websocket");

function log(mes){
	const timestamp = chalk.gray(`[${new Date().toLocaleString()}]`);
	console.log(timestamp, mes);
}

function err(mes){
	log(chalk.red(mes));
}
