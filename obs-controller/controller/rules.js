export function SetCurrentScene(name){
	return async ws => {
		await ws.send("SetCurrentScene", {"scene-name": name});
	};
}

export function arena(arenaId, action){
	return events => events.some(e => e.info.arena === arenaId) && action;
}

export function otherwise(action){
	return () => action;
}
