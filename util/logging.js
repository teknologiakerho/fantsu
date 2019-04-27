const chalk = require("chalk");

export function pad2(num){
	return (""+num).padStart(2, "0");
}

export function formatTimestamp(date){
	let ret = `${pad2(date.getDate())}.${pad2(date.getMonth()+1)}.${date.getFullYear()} `;
	ret += `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
	return ret;
}

export function log(who, mes){
	const timestamp = chalk.gray(`[${formatTimestamp(new Date())}]`);
	if(who)
		mes = `${chalk.cyan(who.padEnd(8))} ${mes}`;
	console.log(timestamp, mes);
}

export function err(who, mes){
	log(who, chalk.red(mes));
}
