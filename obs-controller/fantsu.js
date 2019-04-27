const listen = require("../util/sse.js").default;
const {log, err} = require("../util/logging.js");

export default function(stream, opt){
	listen(`${opt.address}/filter/${opt.filter}`, {
		open: () => log("fantsu", `Connected to fantsu on ${opt.address}`),
		error: () => err("fantsu", "Lost connection to fantsu"),

		"judging:init": data => stream.initEvent(data.event_id, data),
		"judging:start": data => stream.initEvent(data.event_id, data),
		"judging:update": data => stream.updateEvent(data.event_id, data),
		"judging:end": data => stream.endEvent(data.event_id)
	});
}
