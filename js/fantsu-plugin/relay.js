import {judge} from "./client.js";
import {InfoBox} from "./ui.js";

class Relay {

	constructor($root, opt){
		$root.className += "rssserv";
		$root.innerHTML = "";
		const $box = document.createElement("div");
		$root.appendChild($box);
		this.box = new InfoBox($box);
		this.createClient(opt);

		if(opt.connect){
			if(typeof opt.connect === "number"){
				this.box.setTimeoutToConnect(opt.connect,
					() => this.connect(),
					() => this.box.setClickToConnect(() => this.connect())
				);
			}else if(opt.connect === "confirm"){
				this.box.setClickToConnect(() => this.connect());
			}else if(opt.connect === true){
				this.connect();
			}
		}
	}

	createClient(opt){
		this.client = judge({
			server: opt.server,
			port: opt.port,
			event: opt.event,
			onOpen: () => this._handleOpen(),
			onClose: () => this._handleClose(),
			onError: () => this._handleError()
		});
	}

	connect(){
		this.box.setConnecting();
		this.client.connect();
	}

	disconnect(){
		this.client.disconnect();
	}

	send(data, save=false){
		if(this.client.isConnected()){
			//console.debug("[relay]", ">>>", data);
			this.client.send(data);
		}

		if(save)
			this._state = data;
	}

	sendJson(data, save=false){
		this.send(JSON.stringify(data), save);
	}

	_handleOpen(){
		this.box.setConnected(() => this.disconnect());
		if(this._state){
			console.debug("[relay]", "(Stored state) >>>", this._state);
			this.client.send(this._state);
		}
	}

	_handleClose(){
		this.client.disconnect();
		this.box.setClickToConnect(() => this.connect());
	}

	_handleError(){
		this.client.disconnect();
		this.box.setError();
	}

}

function initRelay(root, opt){
	const $root = document.querySelector(root);
	return new Relay($root, opt);
}

function relayEvent(event, callback){
	document.addEventListener(event, e => {
		console.debug("[relay]", event, e.detail);
		callback(e.detail);
	});
}

export function xsumo(root, opt){
	const relay = initRelay(root, opt);
	relayEvent("xsumo:update", data => relay.sendJson(data, true));
	// TODO xsumo:round event tähän, mieluummin kuin nykynen joka laittaa aina updaten
}

export function rescue(root, opt){
	const relay = initRelay(root, opt);
	relayEvent("res:update", data => relay.sendJson(data, true));
}
