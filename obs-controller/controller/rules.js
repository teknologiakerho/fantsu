export function rules(rs){
	return event => {
		for(let r of rs){
			const v = r(event);
			if(v)
				return v;
		}
	};
}

export function SetCurrentScene(name){
	return async ws => {
		await ws.send("SetCurrentScene", {"scene-name": name});
	};
}

export function arena(arenaId, action){
	return events => events.some(e => e.arena === arenaId) && action;
}

export function anything(action){
	return events => events.length && action;
}

export function otherwise(action){
	return () => action;
}
