/* Tää on tehty näin siks että ei tarviis laittaa erikseen css tiedostoa
 * vaan riittää pelkkä rssserv.min.js
 * TODO: tän vois pistää css tiedostoks ja injektoida buildatessa */

/* XXX XXX XXX tää pois, nykynen fantsu voi injektoida cssää */

const css = `
.rssserv {
	padding: 8px;
	border: 1px solid #bbb;
	background: #e5e5e5;
}

.rssserv-box {
	display: inline-flex;
	align-items: center;
	font-size: 0.8em;
	font-weight: bold;
}

.rssserv-button {
	padding: 8px;
	margin: 0 8px;
	font-weight: bold;
	font-size: 0.9em;
	border: 1px solid #eee;
	cursor: pointer;
}

.rssserv-connect {
	background-color: #388E3C;
	color: #fff;
}

.rssserv-disconnect {
	background-color: #B71C1C;
	color: #fff;
}

.rssserv-icon {
	width: 1.0em;
	height: 1.0em;
	margin-right: 8px;
}

@keyframes rssserv-loader-spin {
	0% { transform: rotate(0deg); }
	100% { transform: rotate(360deg); }
}

.rssserv-loader {
	border-radius: 100%;
	border-width: 4px;
	border-style: solid;
	border-color: #333 transparent;
	animation: 1s rssserv-loader-spin infinite linear;
}

@keyframes rssserv-live-pulse {
	0% { box-shadow: 0 0 2px 0 #B71C1C; }
	100% { box-shadow: 0 0 4px 10px #FFEBEE; }
}

.rssserv-live {
	background: #D32F2F;
	border-radius: 100%;
	animation: 1s rssserv-live-pulse infinite;
}
`;

const style = document.createElement("style");
style.type = "text/css";
style.innerHTML = css;
document.head.appendChild(style);
