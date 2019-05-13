const readline = require("readline");

class TestClient {

	setBot(bot){
		this.bot = bot;
	}

	say(mes){
		console.log("(betbot) >>>", mes);
	}

	_reply(){
		return mes => this.say(mes);
	}

	voteCommand(i){
		return `!bet ${i} <määrä>`;
	}

	onCommand(line){
		const cmd = line.split(/\s+/);
		const uid = "test:console";
		const name = "Test Dude";

		switch(cmd[0]){
			case "!bet":
				if(cmd.length == 3)
					this.bot.placeBet(uid, name, +cmd[1], +cmd[2], this._reply());
				break;

			case "!points":
				this.bot.getPoints(uid, name, this._reply());
				break;
		}
	}

}

export default function(){
	const client = new TestClient();

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});

	rl.on("line", l => client.onCommand(l));

	return client;
}
