const EventSource = require("eventsource");
const {log, err} = require("./util.js");

function on(es, name, listener){
	es.addEventListener(name, evt => {
		listener(JSON.parse(evt.data));
	});
}

export default function(stream, opt){
	const es = new EventSource(`${opt.address}/filter/${opt.filter}`);

	es.addEventListener("open", () => log("fantsu", `Connected to fantsu on ${opt.address}`));
	es.addEventListener("error", () => err("fantsu", "Lost connection to fantsu"));

	on(es, "judging:init", data => {
		stream.initEvent(data.event_id, data);
	});

	on(es, "judging:start", data => {
		stream.initEvent(data.event_id, data);
	});

	on(es, "judging:update", data => {
		stream.updateEvent(data.event_id, data);
	});

	on(es, "judging:end", data => {
		stream.endEvent(data.event_id);
	});

	return es;
}
