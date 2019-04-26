/** XXX: Tästä voi ottaa ei-tuomarointi jutut pois koska käytetään eventsourcea niihin? */

class WsClient {

	constructor(url, opt, WebSocket){
		this.WebSocket = WebSocket
			|| (typeof window !== "undefined" && window.WebSocket)
			|| (typeof global !== "undefined" && global.WebSocket);
		this.url = url;
		this.opt = opt;
	}

	isConnected(){
		return this.ws !== undefined;
	}

	connect(){
		if(this.isConnected())
			return;

		delete this._disconnected;

		if(this._reconnectTimeout){
			clearTimeout(this._reconnectTimeout);
			delete this._reconnectTimeout;
		}

		console.debug("[wsclient]", "Connecting to", this.url);
		this.ws = new this.WebSocket(this.url);

		this.ws.onmessage = ({data}) => this.dispatch(JSON.parse(data));
		this.ws.onopen = () => this._handleOpen();
		this.ws.onclose = () => this._handleClosed();
		this.ws.onerror = () => this._handleError();
	}

	disconnect(){
		if(this._reconnectTimeout){
			clearTimeout(this._reconnectTimeout);
			delete this._reconnectTimeout;
		}

		if(!this.isConnected())
			return;

		this.ws.close();
		this._disconnected = true;
	}

	send(data){
		if(!this.isConnected()){
			if(!this._sendBuffer)
				this._sendBuffer = [];
			this._sendBuffer.push(data);
			console.debug("[wsclient]", "Buffered send", data);
			return;
		}

		console.debug("[wsclient]", ">>>", data);
		this.ws.send(data);
	}

	dispatch(data){
		const handler = this.opt[mes(data.event)];
		console.debug("[wsclient]", "<<<", data);
		if(handler)
			handler.call(this.opt, data);
	}

	_handleOpen(){
		if(this._sendBuffer){
			console.debug("[wsclient]", "Sending buffer", this._sendBuffer);
			for(let mes of this._sendBuffer)
				this.ws.send(mes);
			delete this._sendBuffer;
		}

		if(this.opt.onOpen)
			this.opt.onOpen();

		delete this._retryDelay;
	}

	_handleClosed(){
		delete this.ws;

		if(!this._disconnected){
			const retryDelay = (this._retryDelay || this.opt.initRetryDelay || 500)
				* (this.opt.backoff || 2);
			this._retryDelay = retryDelay;

			console.debug("[wsclient]", "Websocket closed unexpectedly, retrying in",
				retryDelay/1000, "seconds");

			this._reconnectTimeout = setTimeout(() => this.connect(), retryDelay);
		}

		if(this.opt.onClose)
			this.opt.onClose();
	}

	_handleError(){
		if(this.opt.onError)
			this.opt.onError();
	}

}

/*
export function listen(opt, WebSocket){
	const ret = new WsClient(`ws://${opt.server}:${opt.port}/listen?${opt.filter||""}`,
		opt, WebSocket);

	if(opt.autoconnect)
		ret.connect();

	return ret;
}
*/

export function judge(opt, WebSocket){
	const ret = new WsClient(`ws://${opt.server}:${opt.port}/judging/${opt.event}`,
		opt, WebSocket);

	if(opt.autoconnect)
		ret.connect();

	return ret;
}

export function mes(event){
	return `__mes_${event}__`;
}
