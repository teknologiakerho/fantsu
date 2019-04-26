const OBSWebSocket = require("obs-websocket-js");
const {log, err} = require("./util.js");

class ObsClient {

	constructor(address, password){
		this.address = address;
		this.password = password;
		this.connected = false;
		this._initWs();
	}

	async connect(){
		try {
			await this.ws.connect({address: this.address, password: this.password})
		} catch(e) {
			err("obs", "Failed to connect");
			console.error(e);
			throw e;
		}
	}

	async setView(view){
		if(view === this._view)
			return;

		this._view = view;
		if(this.connected){
			log("obs", "Updating view");
			await view(this.ws);
		}
	}

	_initWs(){
		this.ws = new OBSWebSocket();
		this.ws.on("AuthenticationSuccess", () => this._handleOpen());
		this.ws.on("error", e => log("obs", `Ws error: ${e}`));
		// tää event tulee aina errorin jälkeen
		this.ws.on("ConnectionClosed", () => this._handleClosed());
	}

	_handleOpen(){
		this.connected = true;
		log("obs", `Connected to OBS on ${this.address}`);
		if(this._view){
			log("obs", "View set before connection, updating now.");
			this._view(this.ws).catch(e => {
				err("obs", `Init view failed: ${e}`);
				console.error(e);
			});
		}
	}

	_handleClosed(){
		this.connected = false;
		err("obs", "Lost connection to OBS, retrying in 5 secs");
		setTimeout(() => this.connect().catch(() => {}), 5000);
	}

}

export default function(opt){
	return new ObsClient(
		opt.address,
		opt.password
	);
} 
