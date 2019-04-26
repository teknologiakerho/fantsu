export function listen(url, events){
	const ret = new EventSource(url);

	if(events){
		for(let name of Object.keys(events)){
			ret.addEventListener(name, evt => {
				const data = evt.data && JSON.parse(evt.data);
				events[name](data, evt.name);
			});
		}
	}

	return ret;
}
