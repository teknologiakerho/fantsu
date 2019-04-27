const {rules, anything, otherwise, SetCurrentScene} = require("./rules.js");

export default {
	obs: {
		address: "localhost:4444",
		password: "salasana"
	},

	fantsu: {
		address: "http://localhost:8080",
		filter: "stream"
	},

	computeView: rules([
		anything(SetCurrentScene("xsumo")),
		otherwise(SetCurrentScene("break"))
	])
}
