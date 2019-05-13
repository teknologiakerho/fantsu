import listen from "sse";
import {encodeQuery, createElement} from "../util.js";

class TeamInfo {

	constructor($name, $school, $score){
		this.$name = $name;
		this.$school = $school;
		this.$score = $score;
	}

	setName(name){
		this.$name.innerHTML = name;
	}

	setSchool(school){
		this.$school.innerHTML = school;
	}

	setScore(score){
		this.$score.innerHTML = score;
	}

}

class XScoreOverlay {

	constructor($root, $round, p1, p2) {
		this.$root = $root;
		this.$round = $round;
		this.p1 = p1;
		this.p2 = p2;
	}

	hide(){
		this.$root.style.visibility = "hidden";
	}

	show(){
		this.$root.style.visibility = "visible";
	}

	reset(){
		this.setTeams("", "");
		this.setScores(0, 0);
		this.setRound(1);
	}

	setTeams(t1, t2){
		this.p1.setName(t1.name);
		this.p1.setSchool(t1.school);
		this.p2.setName(t2.name);
		this.p2.setSchool(t2.school);
	}

	setScores(s1, s2){
		this.p1.setScore(s1);
		this.p2.setScore(s2);
	}

	setRound(round){
		this.$round.innerHTML = `Erä ${round}`;
	}

}

function createTeamInfo(p){
	const $root = createElement("div", `live-xscore-team-info live-xscore-p${p}`);
	const $name = createElement("div", "live-xscore-team-name");
	const $school = createElement("div", "live-xscore-team-school");

	$root.appendChild($name);
	$root.appendChild($school);

	return {$root, $name, $school};
}

function createMatchInfo(){
	const $root = createElement("div", "live-xscore-match-info");
	const $scores = createElement("div", "live-xscore-scores");
	const $p1score = createElement("span", "live-xscore-score live-xscore-p1");
	const $p2score = createElement("span", "live-xscore-score live-xscore-p2");
	const $round = createElement("div", "live-xscore-round");

	//$root.appendChild(createElement("div", "live-xscore-match-info-mask"));

	$scores.appendChild($p1score);
	$scores.appendChild(document.createTextNode(" - "));
	$scores.appendChild($p2score);

	$root.appendChild($scores);
	$root.appendChild($round);

	return {$root, $p1score, $p2score, $round};
}

function createOverlay($root){
	const p1info = createTeamInfo("1");
	const p2info = createTeamInfo("2");
	const matchInfo = createMatchInfo();

	$root.classList.add("live-xscore");
	$root.innerHTML = "";

	$root.appendChild(createElement("div", "live-xscore-border-left"));
	$root.appendChild(p1info.$root);
	$root.appendChild(matchInfo.$root);
	$root.appendChild(p2info.$root);
	$root.appendChild(createElement("div", "live-xscore-border-right"));

	return new XScoreOverlay(
		$root,
		matchInfo.$round,
		new TeamInfo(p1info.$name, p1info.$school, matchInfo.$p1score),
		new TeamInfo(p2info.$name, p2info.$school, matchInfo.$p2score)
	);
}

export default function($root, opt){
	const overlay = createOverlay($root);
	overlay.reset();
	overlay.hide();

	let teamData;

	listen(`${opt.fantsu}/filter/${opt.filter}`, {

		"judging:init": data => {
			console.log("judging:init", data);
			const teams = {
				[data.teams[0].id]: data.teams[0],
				[data.teams[1].id]: data.teams[1]
			};
			overlay.setTeams(teams[data.state.state.team1], teams[data.state.state.team2]);
			overlay.setScores(data.state.score1, data.state.score2);
			overlay.setRound(data.state.state.rounds.length);
			overlay.show();
		},

		"judging:start": data => {
			// Tuomarointi alkoi mutta ei vielä yhtään päivitystä
			// joukkueiden järjestys tulee vasta updatessa joten tallennetaan vain tiedot
			overlay.reset();
			teamData = {
				[data.teams[0].id]: data.teams[0],
				[data.teams[1].id]: data.teams[1]
			};
		},

		"judging:update": data => {
			if(teamData){
				// eka update startin jälkeen
				overlay.setTeams(
					teamData[data.state.state.team1],
					teamData[data.state.state.team2]
				);
				teamData = null;
				overlay.show();
			}

			overlay.setScores(data.state.score1, data.state.score2);
			overlay.setRound(data.state.state.rounds.length);
		},

		"judging:end": () => {
			overlay.hide();
		},

		"error": () => {
			overlay.hide();
		}

	});
}
