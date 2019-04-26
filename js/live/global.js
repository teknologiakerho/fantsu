export const globalConfig = {};

export function config(opt){
	Object.assign(globalConfig, opt);
}

export function configUrlParams(){
	for(let [k, v] of new URLSearchParams(window.location.search))
		globalConfig[k] = v;
}
