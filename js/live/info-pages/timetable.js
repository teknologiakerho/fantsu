import {encodeQuery, timestamp, hmm, createElement} from "../util.js";

const renderEvent = ({clazz, badge, teams, arena}) =>
	`<div class='live-timetable-event ${clazz||""}'>
		${badge ? (
			`<div class='live-timetable-event-badge'>
				${badge.icon ? (
					`<img class='live-dynamic-icon-1x' src='${badge.icon}' />`
				):""}
				${badge.text ? `<span>${badge.text}</span>` : ""}
			</div>`
		):""}
		<div class='live-timetable-event-main'>
			${teams.map(t =>
				`<span class=live-timetable-event-team-${teams.length}>
					${t.name}
				</span>`)
				/*.join("<span class='ct-vs'>vs</span>")*/
				.join("")
			}
		</div>
		<div class='live-timetable-event-arena'>
			<i class='fas fa-map-marker'></i>
			${arena}
		</div>
	</div>`;

const renderers = {
	default: event => renderEvent({teams: event.teams, arena: event.arena}),
	xsumo: event => renderEvent({
		clazz: "live-timetable-xsumo",
		badge: {text: "XSumo"},
		teams: event.teams,
		arena: event.arena
	}),
	rescue: event => renderEvent({
		clazz: "live-timetable-res",
		badge: {text: "Rescue"},
		teams: event.teams,
		arena: event.arena
	}),
	dance: event => renderEvent({
		clazz: "live-timetable-dance",
		badge: {text: "Tanssi"},
		teams: event.teams,
		arena: event.arena
	})
};

function groupByTs(data){
	const g = {};
	for(let ev of data){
		let ts = ev["ts_sched"];
		if(g[ts])
			g[ts].push(ev);
		else
			g[ts] = [ev];
	}

	const ret = [];
	for(let ts in g){
		ret.push([ts, g[ts]]);
	}

	ret.sort((a, b) => a[0] - b[0]);
	return ret;
}

function findRenderer(event, rules){
	let ret;

	for(let r of rules){
		let res = r(event);
		if(res){
			ret = res;
			break;
		}
	}

	if(typeof ret === "string")
		ret = renderers[ret];

	if(!ret)
		ret = renderers.default;

	return ret;
}

function createEventGroup(events, rules, collapse){
	const $ret = createElement("div", "live-timetable-event-group");
	let $container;

	for(let i=0;i<events.length;i++){
		if(i % collapse === 0){
			$container = createElement("div", "live-timetable-event-container");
			$ret.appendChild($container);
		}

		const e = events[i];
		let renderer = findRenderer(e, rules);
		$container.innerHTML += renderer(e);
	}

	return $ret;
}

class RotateGroup {

	constructor($root, $counter){
		this.$root = $root;
		this.$counter = $counter;
	}

	init(){
		for(let i=1;i<this.$root.children.length;i++)
			this.$root.children[i].classList.add("live-timetable-event-container-hide");
	}

	rotate(){
		const $visible = Array.prototype.find.call(
			this.$root.childNodes,
			$x => !$x.classList.contains("live-timetable-event-container-hide")
		);

		const $next = ($visible && $visible.nextSibling) || this.$root.firstChild;

		$visible.classList.add("live-timetable-event-container-hide");
		$next.classList.remove("live-timetable-event-container-hide");

		this._updateActiveCounter(Array.prototype.indexOf.call(this.$root.children, $next));
	}

	_updateActiveCounter(idx){
		this.$counter.innerHTML = (idx+1);
	}

}

class TimetableComponent {

	constructor($root, rules, collapse){
		this.$root = $root;
		this.rules = rules;
		this.collapse = collapse;
		this.rotateGroups = [];
	}

	createRow(ts, events){
		const $time = createElement("td", null,
			`<div class='live-timetable-time'>${hmm(new Date(ts*1000))}</div>`);

		const $group = createEventGroup(events, this.rules, this.collapse);

		if($group.children.length > 1){
			// vaihtele näitä vain jos on useampi
			const $counterSpan = createElement("span", null, "1");
			const $rotationCounter = createElement("div", "live-timetable-rotation-counter");
			$rotationCounter.appendChild($counterSpan);
			$rotationCounter.appendChild(document.createTextNode(`/${$group.children.length}`));
			$time.appendChild($rotationCounter);
			this.addRotateGroup(new RotateGroup($group, $counterSpan));
		}

		const $groupCell = createElement("td");
		$groupCell.appendChild($group);

		const $row = createElement("tr");
		$row.appendChild($time);
		$row.appendChild($groupCell);

		this.$root.appendChild($row);
	}

	addRotateGroup(rotateGroup){
		this.rotateGroups.push(rotateGroup);
	}

	startRotation(interval){
		this.stopRotation();

		if(this.rotateGroups.length > 0){
			for(let g of this.rotateGroups)
				g.init();

			this._rotateInterval = setInterval(() => {
				for(let g of this.rotateGroups)
					g.rotate();
			}, interval);
		}
	}

	stopRotation(){
		if(this._rotateInterval){
			clearInterval(this._rotateInterval);
			delete this._rotateInterval;
		}
	}

}

function createTimetable(rules, collapse, events){
	const $root = createElement("table", "live-timetable");
	const ret = new TimetableComponent($root, rules, collapse);

	for(let [ts, eventGroup] of groupByTs(events)){
		ret.createRow(ts, eventGroup);
	}

	return ret;
}

class Timetable {

	constructor($root, opt){
		this.$root = $root;
		this.opt = opt;
	}

	async start(){
		const events = await this._fetchEvents();
		this.table = createTimetable(this.opt.rules, this.opt.collapse||3, events);
		this.$root.innerHTML = "";
		this.$root.appendChild(this.table.$root);
		this.table.startRotation(this.opt.interval||5000);
	}

	async stop(){
		if(this.table){
			this.table.stopRotation();
			delete this.table;
		}
	}

	async _fetchEvents(){
		let from = this.opt.from || "now";
		if(from === "now")
			from = timestamp();

		const query = encodeQuery({
			b: this.opt.blocks,
			a: this.opt.arenas,
			limit: this.opt.limit || 100,
			sort: "ts",
			from
		});

		const resp = await fetch(`${this.opt.api}/events?${query}`);
		return await resp.json();
	}

}

function timetable($root, opt){
	return new Timetable($root, opt);
}

timetable.rules = {
	arena: (arenas, renderer) => {
		return event => {
			if(arenas.includes(event.arena))
				return renderer;
		};
	}
};

timetable.renderEvent = renderEvent;

export default timetable;
