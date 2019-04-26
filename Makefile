ROLLUP = rollup
SASS = sassc
NODEMON = nodemon

JS = robostat/fantsu/static/fantsu.min.js dist/live.min.js
CSS = dist/live.min.css

default: $(JS) $(CSS)
js: $(JS)
css: $(CSS)

robostat/fantsu/static/fantsu.min.js: $(wildcard js/fantsu-plugin/*.js)
dist/live.min.js: $(wildcard js/live/*.js) $(wildcard js/live/**/*.js)
dist/live.min.css: css/live/main.scss $(wildcard css/live/*.scss)

$(JS):
	$(ROLLUP) -c

$(CSS):
	$(SASS) -t compressed $< > $@

watch:
	$(MAKE) -j2 watch-js watch-css

watch-js:
	$(ROLLUP) -c -w

watch-css:
	$(NODEMON) -w css -e scss -x "$(MAKE) -j1 css"

clean:
	rm -f $(JS) $(CSS)
