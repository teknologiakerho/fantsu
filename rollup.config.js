import resolve from "rollup-plugin-node-resolve";
import buble from "rollup-plugin-buble";
import includePaths from "rollup-plugin-includepaths";
import {terser} from "rollup-plugin-terser";

export default [
	{
		input: "js/fantsu-plugin/main.js",
		output: {
			file: "robostat/fantsu/static/fantsu.min.js",
			format: "iife",
			name: "fantsu"
		},
		plugins: [
			resolve(),
			buble({
				transforms: {
					dangerousForOf: true
				}
			}),
			terser()
		]
	},
	{
		input: "js/live/main.js",
		output: {
			file: "dist/live.min.js",
			format: "iife",
			name: "live"
		},
		plugins: [
			includePaths({
				paths: ["./util"]
			}),
			terser()
		]
	}
];
