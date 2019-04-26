export function encodeQuery(params){
	const ret = [];

	for(let p in params){
		const val = params[p];
		if(val === false || val === undefined)
			continue;

		if(Array.isArray(val)){
			for(let v of val)
				ret.push(`${p}=${encodeURIComponent(v)}`);
		}else{
			ret.push(`${p}=${encodeURIComponent(val)}`);
		}
	}

	return ret.join("&");
}

// https://stackoverflow.com/questions/494143/
export function createNodes(html){
	const $template = document.createElement("template");
	$template.innerHTML = html;
	return $template.content.childNodes;
}

export function createElement(elem, clazz, html){
	const $ret = document.createElement(elem);
	if(clazz)
		$ret.className = clazz;
	if(html)
		$ret.innerHTML = html;
	return $ret;
}

export function hide($node){
	if($node.style.display)
		$node.dataset.__old_display__ = $node.style.display;
	$node.style.display = "none";
}

export function show($node){
	if($node.dataset.__old_display__){
		$node.style.display = $node.dataset.__old_display__;
		delete $node.dataset.__old_display__;
	}else{
		$node.style.display = "";
	}
}

export function timestamp(){
	return (+new Date())/1000 | 0;
}

export function hmm(date){
	return `${date.getHours()}:${(""+date.getMinutes()).padStart(2, "0")}`;
}
