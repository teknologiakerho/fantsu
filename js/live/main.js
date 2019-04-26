import {config, globalConfig, configUrlParams} from "./global.js";
import * as carousel from "./carousel.js";

import {default as ranking} from "./info-pages/ranking.js";
import {default as timetable} from "./info-pages/timetable.js";

import {default as xscore} from "./overlays/xscore.js";

const components = {ranking, timetable, xscore}

function live(type, root, opt){
	const conf = {...globalConfig, ...opt};
	const $root = document.querySelector(root);
	return components[type]($root, conf);
}

Object.assign(live, {config, configUrlParams});
Object.assign(live, carousel);
Object.assign(live, components);

export default live;
