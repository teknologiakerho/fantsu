const tmi = require("tmi.js");
const {log, err} = require("../util/logging.js");

class TwitchClient {

	constructor(client, channel){
		this.client = client;
		this.channel = channel;
		this._setup_callbacks();
	}

	setBot(bot){
		this.bot = bot;
	}

	say(mes){
		this.client.say(this.channel, mes);
	}

	_setup_callbacks(){
		this.client.on("message", this._onMessage.bind(this));
		this.client.on("connected", this._onConnected.bind(this));
	}

	_onMessage(channel, userstate, mes, self){
		if(self)
			return;

		if(userstate["message-type"] !== "chat")
			return;

		const cmd = mes.split(/\s+/);
		self._tryHandleCmd(channel, userstate, cmd);
	}

	_onConnected(addr, port){
		log("twitch", `Connected to twitch on ${addr}:${port}`)
	}

	_tryHandleCmd(channel, userstate, cmd){
		if(cmd[0][0] !== "!")
			return;

		const {id, name} = this._getUserDetails(userstate);

		switch(cmd[0]){
			case "!bet":
				if(cmd.length === 3)
					this.bot.placeBet(id, name, +cmd[1], +cmd[2], this._reply(channel));
				else
					this.client.say(channel, `${name} -> Käyttö: !bet <joukkue> <määrä>`);
				break;

			case "!points":
				this.bot.getPoints(id, name, this._reply(channel));
				break;
		}
	}

	_getUserDetails(userstate){
		return {
			id: `twitch:${userstate["user-id"]}`,
			name: userstate["username"]
		}
	}

	_reply(channel){
		return mes => this.client.say(channel, mes);
	}

}

export default function(opt){
	const client = new tmi.client({
		identity: {
			username: opt.username,
			password: opt.oauth_token
		},
		channels: [
			opt.channel
		]
	});

	client.connect();

	return new TwitchClient(client, opt.channel);
}
