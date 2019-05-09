const renderTeamInfo = team =>
	`<div class='live-ranking-team-info'>
		<div class='live-ranking-team-name'>${team.name}</div>
		<div class='live-ranking-team-school'>${team.school}</div>
	</div>`;

const mmss = time => {
	const min = time/60|0;
	const sec = time%60;

	return (""+min).padStart(2, "0") + ":" + (""+sec).padStart(2, "0");
};

const getResFuture = score => ({
	played: score.others.filter(x => !!x).length + (!!score.best)|0,
	total: 1 + score.others.length
});

const renderResFuture = score => {
	const {played, total} = getResFuture(score);
	return `${played}/${total}`;
};

const renderTime = time =>
	`<span>
		<i class='fas fa-clock'></i>
		${mmss(time)}
	</span>`;

const renderers = {
	default: ({rank, team, score}) =>
	`<tr class='live-ranking-row'>
		<td class='live-ranking-rank'>${rank}</td>
		<td class='live-ranking-team'>${renderTeamInfo(team)}</td>
		<td class='live-ranking-score'>${score.score}</td>
	</tr>`,

	xsumo: {
		row: ({rank, team, score}) =>
		`<tr class='live-ranking-row'>
			<td class='live-ranking-rank'>${rank}</td>
			<td class='live-ranking-team'>${team.name}</td>
			<td class='live-ranking-score'>${score.wins}</td>
			<td class='live-ranking-score'>${score.ties}</td>
			<td class='live-ranking-score'>${score.losses}</td>
			<td class='live-ranking-score live-ranking-future'>${score.unplayed}</td>
			<td class='live-ranking-score live-ranking-points'>${score.score}</td>
		</tr>`,

		header: () =>
		`<tr class='live-ranking-header'>
			<th>Sija</th>
			<th>Joukkue</th>
			<th class='live-ranking-score-header'>V</th>
			<th class='live-ranking-score-header'>T</th>
			<th class='live-ranking-score-header'>H</th>
			<th class='live-ranking-score-header'>E</th>
			<th></th>
		</tr>`,

		table: content => `<table class='live-ranking-table live-ranking-xsumo'>${content}</table>`
	},

	rescue: {
		row: ({rank, team, score}) =>
		`<tr class='live-ranking-row'>
			<td class='live-ranking-rank'>${rank}</td>
			<td class='live-ranking-team'>${team.name}</td>
			<td class='live-ranking-score live-ranking-points'>
				${score.best ? score.best.score : 0}
			</td>
			<td class='live-ranking-score live-ranking-res-time'>
				${score.best ? renderTime(score.best.time) : ""}
			</td>
			<td class='live-ranking-score live-ranking-future'>${renderResFuture(score)}</td>
		</tr>`,

		header: () =>
		`<tr class='live-ranking-header'>
			<th>Sija</th>
			<th>Joukkue</th>
			<th class='live-ranking-score-header'>Pisteet</th>
			<th class='live-ranking-score-header'>Aika</th>
			<th class='live-ranking-score-header'>Suor.</th>
		</tr>`,

		table: content => `<table class='live-ranking-table live-ranking-res'>${content}</table>`
	}
};

function getRenderer(renderer){
	renderer = renderer || "default";
	if(typeof renderer === "string")
		renderer = renderers[renderer];
	if(typeof renderer === "function")
		renderer = { row: renderer };
	return renderer;
}

function renderTable(data, renderer){
	renderer = getRenderer(renderer);

	let ret = data.map(renderer.row).join("");

	if(renderer.header)
		ret = renderer.header(data) + ret;

	if(renderer.table)
		ret = renderer.table(ret)
	else
		ret = `<table class='live-ranking-table'>${ret}</table>`;

	return ret;
}

class Ranking {

	constructor($root, opt){
		this.$root = $root;
		this.opt = opt;
	}

	async start(){
		await this._update();
		// TODO ton updaten vois laittaa johonki setIntervaliin
	}

	async stop(){

	}

	async _update(){
		const resp = await fetch(`${this.opt.api}/ranking/${this.opt.id}`);
		let data = await resp.json();
		if(this.opt.limit)
			data = data.slice(0, this.opt.limit);

		// TODO ton datan vois tallentaa ja diffata ja näyttää +-

		this.$root.innerHTML = renderTable(data, this.opt.renderer);
	}

}

export default function($root, opt){
	return new Ranking($root, opt);
}
