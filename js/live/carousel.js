import {show, hide} from "./util.js";

class Carousel {

	constructor(pages){
		this.pages = pages;
		this._busy = false;
	}

	page(){
		return (this.index !== undefined) && this.pages[this.index];
	}

	async show(index){
		if(this._busy)
			return;

		this._busy = true;
		await this._show(index);
		this._busy = false;
	}

	async _show(index){
		const page = this.pages[index];
		const cur = this.page();

		if(cur)
			cur.interrupt()

		await page.prepare();

		if(cur){
			await cur.teardown();
			cur.hide();
		}

		this.index = index;
		page.show(() => this.next());
	}

	async next(){
		return await this.show(((this.index||0) + 1) % this.pages.length);
	}

	async prev(){
		return await this.show(((this.index||0) + this.pages.length - 1) % this.pages.length);
	}

}

class Page {

	constructor($root, timeout, components){
		this.$root = $root;
		this.timeout = timeout;
		this.components = components;
	}

	async prepare(){
		console.debug("[page]", "Preparing", this.components);
		await Promise.all(this.components.map(c => c.start()));
		console.debug("[page]", "Ready to show", this.$root);
	}

	async teardown(){
		console.debug("[page]", "Closing", this.components);
		await Promise.all(this.components.map(c => c.stop()));
		console.debug("[page]", "Ready to hide", this.$root);
	}

	show(done){
		show(this.$root);
		this._timeout = setTimeout(done, this.timeout);
	}

	hide(){
		hide(this.$root);
	}

	interrupt(){
		clearTimeout(this._timeout);
	}

}

export function carousel(pages){
	const ret = new Carousel(pages);
	ret.show(0);
	return ret;
}

export function page(root, opt){
	const $root = document.querySelector(root);
	hide($root);
	return new Page($root, opt.timeout||30000, opt.components||[]);
}

export function keycontrol(carousel, root){
	const $root = root ? document.querySelector(root) : window;

	$root.addEventListener("keydown", e => {
		if(+e.key != NaN && e.key > 0 && e.key <= carousel.pages.length){
			carousel.show(e.key-1);
			return;
		}

		switch(e.key){
			case "ArrowRight":
				carousel.next();
				break;
			case "ArrowLeft":
				carousel.prev();
				break;
		}
	});
}
