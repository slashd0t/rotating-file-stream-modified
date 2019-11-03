"use strict";

import { Stats, createWriteStream, readdir, stat, unlink } from "fs";
import { createStream } from "..";
import { sep } from "path";

function fillFiles(files: any, done: () => void): void {
	if(! files) return done();

	let empty = 0;
	let filled = 0;

	const end = (): void => (++filled === empty ? done() : null);

	Object.keys(files).map((file: string) => {
		++empty;
		createWriteStream(file, "utf8").end(files[file], "utf8", end);
	});

	if(empty === 0) done();
}

function recursiveRemove(path: string, done: () => any): any {
	const notRoot: boolean = path !== ".";

	stat(path, (err: Error, stats: Stats): any => {
		if(err) return process.stderr.write(`Error getting stats for '${path}': ${err.message}\n`, done);
		if(stats.isFile()) {
			return unlink(path, err => {
				if(err) return process.stderr.write(`Error deleting '${path}': ${err.message}\n`, done);
				done();
			});
		}
		if(! stats.isDirectory()) return process.stderr.write(`'${path}': Unknown file type`, done);

		readdir(path, (err, files) => {
			if(err) return process.stderr.write(`Error reading dir '${path}': ${err.message}\n`, done);

			let count = 0;
			let total = 0;

			const callback: () => void = () => (++count === total ? done() : null);

			files.map(file => {
				if(notRoot || file.match(/(gz|log|tmp|txt)$/)) {
					total++;
					recursiveRemove(path + sep + file, callback);
				}
			});

			if(total === 0) done();
		});
	});
}

export function test(opt: any, test: (rfs: any) => void): any {
	const { filename, files, options } = opt;
	const events: any = {};

	before(function(done): void {
		let did: boolean;

		const generator = filename ? filename : (time: Date, index?: number): string => (time ? index + "-test.log" : "test.log");
		const timeOut = setTimeout(() => {
			events.timedOut = true;
			done();
		}, this.timeout() - 500);

		const end = (): void => {
			clearTimeout(timeOut);
			if(did) return;
			did = true;
			done();
		};

		const create = (): void => {
			const rfs = createStream(generator, options);
			const inc: (name: string) => any = name => {
				if(! events[name]) events[name] = 0;
				events[name]++;
			};
			const push: (name: string, what: string) => any = (name, what) => {
				if(! events[name]) events[name] = [];
				events[name].push(what);
			};

			rfs.on("close", () => inc("close"));
			rfs.on("error", error => push("error", "code" in error ? error["code"] : error.message));
			rfs.on("finish", end);
			rfs.on("finish", () => inc("finish"));
			rfs.on("open", filename => push("open", filename));
			rfs.on("rotated", filename => push("rotated", filename));
			rfs.on("rotation", () => inc("rotation"));
			rfs.on("warning", err => push("warning", err.message));

			const oldw = rfs._write;
			const oldv = rfs._writev;

			rfs._write = (chunk: Buffer, encoding: string, callback: (error?: Error) => void): void => {
				inc("write");
				oldw.call(rfs, chunk, encoding, callback);
			};

			rfs._writev = (chunks: any, callback: (error?: Error) => void): void => {
				inc("writev");
				oldv.call(rfs, chunks, callback);
			};

			test(rfs);
		};

		recursiveRemove(".", () => fillFiles(files, create));
	});

	return events;
}
