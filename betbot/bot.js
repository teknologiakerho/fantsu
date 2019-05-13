const querystring = require("querystring");
const fetch = require("node-fetch");
const chalk = require("chalk");
const listen = require("../util/sse.js").default;
const {log, err} = require("../util/logging.js");

class Match {

	constructor(eid){
		this.eid = eid;
	}

}

class Api {

	constructor(opt){
		this.api = opt.api;
		this.fantsuApi = opt.fantsu.address;
		this.token = opt.fantsu.token;
	}

	async fetchEvent(id){
		const resp = await fetch(`${this.api}/events?id=${id}`);
		const json = await resp.json();
		return json[0];
	}

	async getBetbot(url, opt){
		return await this._requestBetbot(url, opt);
	}

	async postBetbot(url, opt){
		return await this._requestBetbot(url, {
			query: opt.query,
			fetch: {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify(opt.data)
			}
		});
	}

	async _requestBetbot(url, opt){
		const query = opt.query || {};
		query.token = this.token;

		const resp = await fetch(
			`${this.fantsuApi}${url}?${querystring.stringify(query)}`,
			opt.fetch||{}
		);

		if(!resp.ok){
			console.error("Betbot request failed with code", resp.status);
			console.error(await resp.text());
			throw resp.status;
		}

		return await resp.json();
	}

}

class BetBot {

	constructor(client, api){
		this.client = client;
		this.api = api;
	}

	async startCountdown(eid, countdown){
		log("bot", `${chalk.green("+++")} Countdown started for eid=${eid} (${countdown} secs)`);

		const match = new Match(eid);
		this.match = match;
		const event = await this.api.fetchEvent(eid);
		match.teams = event.teams.sort((a, b) => a.name<b.name?-1:1);

		let mes = `Ottelu alkaa: ${match.teams.map(t => t.name).join(" vs ")}!`;
		mes += ` Voit veikata voittajaa seuraavat ${Math.round(countdown)} sekuntia.`

		for(let i in match.teams)
			mes += ` | Veikkaa ${match.teams[i].name}: ${this.client.voteCommand(+i+1)}`;

		this.client.say(mes);
	}

	endCountdown(eid, bets){
		log("bot", `Countdown finished eid=${eid}`);

		if(!this.match || !this.match.teams)
			return;

		const totalBets = {};
		for(let b of bets)
			totalBets[b.target] = (totalBets[b.target] || 0) + b.amount;

		this.client.say(`Veikkausaika päättyi. Veikkaukset: ${this.match.teams.map(t =>
			`${t.name}: ${totalBets[t.id]||0}`).join(", ")}.`);
	}

	endEvent(eid, bets, winner){
		log("bot", `${chalk.red("---")} Event finished eid=${eid} winner=${winner}`);

		if(!this.match || !this.match.teams)
			return;

		if(winner){
			const winnerTeam = this.match.teams.find(t => t.id === winner);
			if(!winnerTeam)
				return;

			this.client.say(`Ottelu päättyi. Voittaja on ${winnerTeam.name}!`);
		}else{
			this.client.say("Ottelu päättyi tasapeliin.");
		}
	}

	async placeBet(uid, name, target, amount, reply){
		if(!this.match || !this.match.teams){
			reply(`${name} -> Ottelu ei ole käynnissä.`);
			return;
		}

		target--;
		const team = this.match.teams[target];

		if(!team){
			reply(`${name} -> Valitse 1-${this.match.teams.length}`);
			return;
		}

		log("bot", `Trying to place bet for ${uid} (${name}) on ${target}, ${amount} points`);

		const resp = await this.api.postBetbot("/betbot/place", {
			data: {
				id: uid,
				display_name: name,
				target: this.match.teams[target].id,
				amount: amount
			}
		});

		if(resp.status === "OK"){
			log("bot", "Betting OK!");
			return;
		}

		log("bot", "Failed to place bet");
		console.log(resp);

		if(resp.error)
			reply(`${name} -> Virhe: ${resp.error}`);
	}

	async getPoints(uid, name, reply){
		const resp = await this.api.getBetbot("/betting/user_points", {
			query: {
				id: uid,
				display_name: name
			}
		});

		if(resp.error){
			reply(`${name} -> Virhe: ${resp.error}`);
			return;
		}

		reply(`${name} -> Sinulla on ${resp.total} pistettä.`);
	}

}

export default function(client, opt){
	const bot = new BetBot(client, new Api(opt));

	listen(`${opt.fantsu.address}/betting/events`, {
		open: () => log("fantsu", `Connected to fantsu on ${opt.fantsu.address}`),
		error: () => err("fantsu", "Lost connection to fantsu"),

		"betting:countdown-start": ({event_id, countdown}) => {
			bot.startCountdown(event_id, countdown);
		},

		"betting:countdown-end": ({event_id, bets}) => {
			bot.endCountdown(event_id, bets);
		},

		"betting:end": ({event_id, bets, winner}) => {
			bot.endEvent(event_id, bets, winner);
		}
	});

	return bot;
}
