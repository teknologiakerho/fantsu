const chalk = require("chalk");
const {log, err} = require("./util.js");

export class StreamController {

	constructor(client, computeView){
		this.client = client;
		this.computeView = computeView;
		this.events = {};
	}

	initEvent(id, info){
		log("stream", `${chalk.green("+++")} Init event ${id}`);
		this.events[id] = { info };
		this.scheduleUpdate();
	}

	updateEvent(id, info){
		Object.assign(this.events[id], info);
		this.scheduleUpdate();
	}

	endEvent(id){
		log("stream", `${chalk.red("---")} End event ${id}`);
		delete this.events[id];
		this.scheduleUpdate();
	}

	async update(){
		if(this._pendingUpdate){
			log("stream", "Tried to update() while another update is pending, rescheduling"
				+ " (but this should not happen)");
			this.scheduleUpdate();
			return;
		}

		this._pendingUpdate = (async () => {
			try {
				await this._update();
			} finally {
				delete this._pendingUpdate;
			}
		})();

		await this._pendingUpdate;
	}

	async _update(){
		const view = this.computeView(Object.values(this.events));

		if(view)
			await this.client.setView(view);
	}

	scheduleUpdate(){
		if(this._updateScheduled)
			return;

		const callback = () => {
			delete this._updateScheduled;
			this.update().catch(e => {
				err("stream", `Scheduled update failed: ${e}`);
				console.error(e);
			});
		};

		if(this._pendingUpdate)
			this._pendingUpdate.finally(callback);
		else
			process.nextTick(callback);

		this._updateScheduled = true;
	}

}
