const makeButton = (clazz, text, callback) => {
	const $ret = document.createElement("button");
	$ret.className = clazz;
	$ret.innerHTML = text;
	$ret.addEventListener("click", callback, {once: true});
	return $ret;
};

export class InfoBox {

	constructor($root){
		this.$root = $root;
		$root.className = "rssserv-box";
	}

	setClickToConnect(callback){
		this.$root.innerHTML = "<span class='rssserv-label'>Live-pisteet:</span>";
		this.$root.appendChild(makeButton("rssserv-connect rssserv-button", "Aloita", callback));
	}

	setTimeoutToConnect(timeout, done, cancelled){
		this.$root.innerHTML = "";
		const $span = document.createElement("span");
		this.$root.appendChild($span);

		let left = timeout;
		let to;

		const countdown = () => {
			if(left === 0){
				done();
				return;
			}
			$span.innerHTML = `Live-pisteiden lähetys automaattisesti ${left} sekunnin päästä.`;
			to = setTimeout(countdown, 1000);
			left--;
		};

		countdown();

		this.$root.appendChild(makeButton("rssserv-disconnect rssserv-button", "Peruuta", () => {
			clearTimeout(to);
			cancelled();
		}));
	}

	setConnecting(){
		this.$root.innerHTML = "<div class='rssserv-loader rssserv-icon'></div> Yhdistetään...";
	}

	setConnected(disconnect){
		this.$root.innerHTML = "<div class='rssserv-live rssserv-icon'></div> Live";
		this.$root.appendChild(makeButton("rssserv-disconnect rssserv-button", "Lopeta",
			disconnect));
	}

	setError(){
		// näköjään tää ei anna mitään error stringiä
		// lol javascript
		this.$root.innerHTML = "<span style='color:red'>Pistepalvelimeen ei saatu yhteyttä</span>";
	}

}
