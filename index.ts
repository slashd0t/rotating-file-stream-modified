"use strict";

import { Stats, createWriteStream, mkdir, rename, stat } from "fs";
import { parse, sep } from "path";
import { TextDecoder } from "util";
import { Writable } from "stream";

class RFSError extends Error {
	public attempts: any;
	public code: string;
}

export interface RFSOptions {
	compress?: boolean | string | ((source: string, dest: string) => string);
	encoding?: string;
	history?: string;
	immutable?: boolean;
	initialRotation?: boolean;
	interval?: string;
	maxFiles?: number;
	maxSize?: string;
	mode?: number;
	path?: string;
	rotate?: number;
	rotationTime?: boolean;
	size?: string;
}

export type Generator = (time: number | Date, index?: number) => string;

interface Options {
	compress?: string | ((source: string, dest: string) => string);
	encoding?: string;
	history?: string;
	immutable?: boolean;
	initialRotation?: boolean;
	interval?: { num: number; unit: string };
	maxFiles?: number;
	maxSize?: string;
	mode?: number;
	path?: string;
	rotate?: number;
	rotationTime?: boolean;
	size?: number;
}

type Callback = (error?: Error) => void;

interface Chunk {
	chunk: Buffer;
	encoding: string;
	next: Chunk;
}

export class RFS extends Writable {
	private createWriteStream: (path: string, options: { flags?: string; mode?: number }) => Writable;
	private destroyer: () => void;
	private error: Error;
	private filename: string;
	private finished: boolean;
	private generator: Generator;
	private maxTimeout: number;
	private mkdir: (path: string, callback: Callback) => void;
	private next: number;
	private opened: () => void;
	private options: Options;
	private prev: number;
	private ready: boolean;
	private rename: (oldPath: string, newPath: string, callback: (err: NodeJS.ErrnoException) => void) => void;
	private rotation: Date;
	private size: number;
	private stat: (path: string, callback: (err: NodeJS.ErrnoException, stats: Stats) => void) => void;
	private stream: Writable;
	private timer: NodeJS.Timeout;
	private writing: boolean;

	constructor(generator: Generator, options: Options) {
		const { encoding, path } = options;

		super({ decodeStrings: true, defaultEncoding: encoding });

		this.createWriteStream = createWriteStream;
		this.filename = path + generator(null);
		this.generator = generator;
		this.maxTimeout = 2147483640;
		this.mkdir = mkdir;
		this.options = options;
		this.rename = rename;
		this.stat = stat;

		this.on("close", () => (this.finished ? null : this.emit("finish")));
		this.on("finish", () => (this.finished = true));

		process.nextTick(() => this.init(error => (this.error = error)));
	}

	_destroy(error: Error, callback: Callback): void {
		if(this.ready && ! this.writing) return callback(error);
		this.destroyer = (): void => callback(error);
	}

	_final(callback: Callback): void {
		if(this.stream) return this.stream.end(callback);
		callback();
	}

	_write(chunk: Buffer, encoding: string, callback: Callback): void {
		const begin: () => void = (): void => this.rewrite({ chunk, encoding, next: null }, callback);

		if(this.ready) return begin();
		this.opened = begin;
	}

	_writev(chunks: Chunk[], callback: Callback): void {
		this.rewrite(chunks[0], callback);
	}

	private rewrite(chunk: Chunk, callback: Callback): void {
		const destroy = (error: Error): void => {
			this.writing = false;
			if(! this.destroyed) this.destroy();

			return callback(error);
		};

		if(this.error) return destroy(this.error);

		const done: Callback = (error?: Error): void => {
			if(error) return destroy(error);
			if(chunk.next) return this.rewrite(chunk.next, callback);
			this.writing = false;
			if(this.destroyed) process.nextTick(this.destroyer);
			callback();
		};

		this.writing = true;
		this.size += chunk.chunk.length;
		this.stream.write(chunk.chunk, chunk.encoding, (error: Error): void => {
			if(error) return done(error);
			if(this.options.size && this.size >= this.options.size) return this.rotate(done);
			done();
		});
	}

	private init(callback: Callback): void {
		const done = (error: Error): void => {
			this.ready = true;

			if(this.opened) {
				const opened: () => void = this.opened;

				this.opened = null;
				process.nextTick(opened);
			}

			if(this.destroyer) process.nextTick(this.destroyer);

			callback(error);
		};

		this.stat(this.filename, (error, stats) => {
			const { initialRotation, interval, size } = this.options;
			if(error) return error.code === "ENOENT" ? this.open(this.filename, false, 0, done) : done(error);

			if(! stats.isFile()) return done(new Error(`Can't write on: ${this.filename} (it is not a file)`));

			if(initialRotation) {
				this.intervalBounds(this.now());
				const prev = this.prev;
				this.intervalBounds(new Date(stats.mtime.getTime()));

				if(prev !== this.prev) return this.rotate(done);
			}

			this.size = stats.size;

			if(! size || stats.size < size) return this.open(this.filename, false, stats.size, done);

			if(interval) this.intervalBounds(this.now());

			this.rotate(done);
		});
	}

	private makePath(name: string, callback: Callback): void {
		const dir = parse(name).dir;

		this.mkdir(dir, (error: NodeJS.ErrnoException): void => {
			if(error) {
				if(error.code === "ENOENT") return this.makePath(dir, (error: Error): void => (error ? callback(error) : this.makePath(name, callback)));
				if(error.code !== "EEXIST") return callback(error);
			}

			callback();
		});
	}

	private open(filename: string, retry: boolean, size: number, callback: Callback): void {
		const options: any = { flags: "a" };

		if("mode" in this.options) options.mode = this.options.mode;

		let called: boolean;
		const end: Callback = (error?: Error): void => {
			if(called) {
				if(error) this.error = error;
				return;
			}
			called = true;
			callback(error);
		};

		this.stream = this.createWriteStream(filename, options);

		this.stream.once("open", () => {
			this.size = size;
			end();
			this.emit("open", filename);
			this.interval();
		});

		this.stream.once("error", (error: NodeJS.ErrnoException) =>
			error.code !== "ENOENT" || retry ? end(error) : this.makePath(filename, (error: Error): void => (error ? callback(error) : this.open(filename, true, size, end)))
		);
	}

	private close(callback: Callback): void {
		if(! this.stream) return callback();

		this.stream.on("finish", callback);
		this.stream.end();
		this.stream = null;
	}

	private now(): Date {
		return new Date();
	}

	private rotate(callback: Callback): void {
		this.size = 0;
		this.rotation = this.now();

		this.emit("rotation");
		this.clear();
		this.close(() => this.move(false, callback));
		//this._close(this.options.rotate ? this.classical.bind(this, this.options.rotate) : this.options.immutable ? this.immutate.bind(this) : this.move.bind(this));
	}

	private exhausted(attempts: any): Error {
		let err = new RFSError("Too many destination file attempts");
		err.code = "RFS-TOO-MANY";

		if(attempts) err.attempts = attempts;

		return err;
	}

	private findName(attempts: any, tmp: boolean, callback: (error: Error, filename?: string) => void): void {
		const { interval, path, rotate, rotationTime } = this.options;
		let count = 1;
		let filename = `${this.filename}.${count}.rfs.tmp`;

		for(const i in attempts) count += attempts[i];

		if(count >= 1000) return callback(this.exhausted(attempts));

		if(! tmp) {
			try {
				filename = path + (rotate ? this.generator(count) : this.generator(interval && ! rotationTime ? new Date(this.prev) : this.rotation, count));
			} catch(e) {
				return callback(e);
			}
		}

		if(filename in attempts) {
			attempts[filename]++;

			return this.findName(attempts, tmp, callback);
		}

		this.stat(filename, err => {
			if(! err || err.code !== "ENOENT") {
				attempts[filename] = 1;

				return this.findName(attempts, tmp, callback);
			}

			callback(null, filename);
		});
	}

	private move(retry: boolean, callback: Callback): void {
		let filename: string;

		const open = (error?: Error): void => {
			if(error) return callback(error);

			this.open(this.filename, false, 0, callback);
			this.emit("rotated", filename);
		};

		const done = (error?: Error): void => {
			if(error) return callback(error);

			open();
			/*
			//this.open();

			if(this.options.compress) this.compress(name);
			else {
				this.emit("rotated", filename);
				this.interval();
			}
			*/
		};

		this.findName({}, (this.options.compress as unknown) as boolean, (error, found) => {
			if(error) return callback(error);

			filename = found;

			this.rename(this.filename, filename, error => {
				if(error && error.code !== "ENOENT" && ! retry) return callback(error);

				if(! error) return done();

				this.makePath(filename, (error: Error): void => (error ? callback(error) : this.move(true, callback)));
			});
		});
	}

	private clear(): void {
		if(this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
	}

	private intervalBoundsBig(now: Date): void {
		let year = now.getFullYear();
		let month = now.getMonth();
		let day = now.getDate();
		let hours = now.getHours();
		const { num, unit } = this.options.interval;

		if(unit === "M") {
			day = 1;
			hours = 0;
		} else if(unit === "d") hours = 0;
		else hours = parseInt(((hours / num) as unknown) as string, 10) * num;

		this.prev = new Date(year, month, day, hours, 0, 0, 0).getTime();

		if(unit === "M") month += num;
		else if(unit === "d") day += num;
		else hours += num;

		this.next = new Date(year, month, day, hours, 0, 0, 0).getTime();
	}

	private intervalBounds(now: Date): Date {
		const unit = this.options.interval.unit;

		if(unit === "M" || unit === "d" || unit === "h") this.intervalBoundsBig(now);
		else {
			let period = 1000 * this.options.interval.num;

			if(unit === "m") period *= 60;

			this.prev = parseInt(((now.getTime() / period) as unknown) as string, 10) * period;
			this.next = this.prev + period;
		}

		return new Date(this.prev);
	}

	private interval(): void {
		if(! this.options.interval) return;

		this.intervalBounds(this.now());

		const set = (): void => {
			const time = this.next - this.now().getTime();

			this.timer = time > this.maxTimeout ? setTimeout(set, this.maxTimeout) : setTimeout(() => this.rotate(error => (this.error = error)), time);
			this.timer.unref();
		};

		set();
	}
}

function buildNumberCheck(field: string): (type: string, options: RFSOptions, value: string) => void {
	return (type: string, options: RFSOptions, value: string): void => {
		const converted: number = parseInt(value, 10);

		if(type !== "number" || (converted as unknown) !== value || converted <= 0) throw new Error(`'${field}' option must be a positive integer number`);
	};
}

function buildStringCheck(field: string, check: (value: string) => any) {
	return (type: string, options: RFSOptions, value: string): void => {
		if(type !== "string") throw new Error(`Don't know how to handle 'options.${field}' type: ${type}`);

		options[field] = check(value);
	};
}

function checkMeasure(value: string, what: string, units: any): any {
	const ret: any = {};

	ret.num = parseInt(value, 10);

	if(isNaN(ret.num)) throw new Error(`Unknown 'options.${what}' format: ${value}`);
	if(ret.num <= 0) throw new Error(`A positive integer number is expected for 'options.${what}'`);

	ret.unit = value.replace(/^[ 0]*/g, "").substr((ret.num + "").length, 1);

	if(ret.unit.length === 0) throw new Error(`Missing unit for 'options.${what}'`);
	if(! units[ret.unit]) throw new Error(`Unknown 'options.${what}' unit: ${ret.unit}`);

	return ret;
}

const intervalUnits: any = {
	M: true,
	d: true,
	h: true,
	m: true,
	s: true
};

function checkIntervalUnit(ret: any, unit: string, amount: number): void {
	if(parseInt(((amount / ret.num) as unknown) as string, 10) * ret.num !== amount) throw new Error(`An integer divider of ${amount} is expected as ${unit} for 'options.interval'`);
}

function checkInterval(value: string): any {
	const ret = checkMeasure(value, "interval", intervalUnits);

	switch(ret.unit) {
	case "h":
		checkIntervalUnit(ret, "hours", 24);
		break;

	case "m":
		checkIntervalUnit(ret, "minutes", 60);
		break;

	case "s":
		checkIntervalUnit(ret, "seconds", 60);
		break;
	}

	return ret;
}

const sizeUnits: any = {
	B: true,
	G: true,
	K: true,
	M: true
};

function checkSize(value: string): any {
	const ret = checkMeasure(value, "size", sizeUnits);

	if(ret.unit === "K") return ret.num * 1024;
	if(ret.unit === "M") return ret.num * 1048576;
	if(ret.unit === "G") return ret.num * 1073741824;

	return ret.num;
}

const checks: any = {
	compress: (type: string, options: Options, value: boolean | string | ((source: string, dest: string) => string)): any => {
		if(! value) throw new Error("A value for 'options.compress' must be specified");
		if(type === "boolean") return (options.compress = (source: string, dest: string): string => `cat ${source} | gzip -c9 > ${dest}`);
		if(type === "function") return;
		if(type !== "string") throw new Error(`Don't know how to handle 'options.compress' type: ${type}`);
		// if(value != "bzip" && value != "gzip")
		if(((value as unknown) as string) !== "gzip") throw new Error(`Don't know how to handle compression method: ${value}`);
	},

	encoding: (type: string, options: Options, value: string): any => new TextDecoder(value),

	history: (type: string): void => {
		if(type !== "string") throw new Error(`Don't know how to handle 'options.history' type: ${type}`);
	},

	immutable: (): void => {},

	initialRotation: (): void => {},

	interval: buildStringCheck("interval", checkInterval),

	maxFiles: buildNumberCheck("maxFiles"),

	maxSize: buildStringCheck("maxSize", checkSize),

	mode: (): void => {},

	path: (type: string, options: Options, value: string): void => {
		if(type !== "string") throw new Error(`Don't know how to handle 'options.path' type: ${type}`);
		if(value[value.length - 1] !== sep) options.path = value + sep;
	},

	rotate: buildNumberCheck("rotate"),

	rotationTime: (): void => {},

	size: buildStringCheck("size", checkSize)
};

function checkOptions(options: RFSOptions): Options {
	const ret: Options = {};

	for(const opt in options) {
		const value = options[opt];
		const type = typeof value;

		if(! (opt in checks)) throw new Error(`Unknown option: ${opt}`);

		ret[opt] = options[opt];
		checks[opt](type, ret, value);
	}

	if(! ret.path) ret.path = "";

	if(! ret.interval) {
		delete ret.immutable;
		delete ret.initialRotation;
		delete ret.rotationTime;
	}

	if(ret.rotate) {
		delete ret.history;
		delete ret.immutable;
		delete ret.maxFiles;
		delete ret.maxSize;
		delete ret.rotationTime;
	}

	if(ret.immutable) delete ret.compress;

	if(ret.rotationTime) delete ret.initialRotation;

	return ret;
}

function createGenerator(filename: string): Generator {
	const pad = (num: number): string => (num > 9 ? "" : "0") + num;

	return (time: Date, index?: number): string => {
		if(! time) return (filename as unknown) as string;

		const month = time.getFullYear() + "" + pad(time.getMonth() + 1);
		const day = pad(time.getDate());
		const hour = pad(time.getHours());
		const minute = pad(time.getMinutes());

		return month + day + "-" + hour + minute + "-" + pad(index) + "-" + filename;
	};
}

export function createStream(filename: string | Generator, options?: RFSOptions): RFS {
	if(typeof options === "undefined") options = {};
	else if(typeof options !== "object") throw new Error(`The "options" argument must be of type object. Received type ${typeof options}`);

	const opts = checkOptions(options);

	let generator: Generator;

	if(typeof filename === "string") generator = createGenerator(filename);
	else if(typeof filename === "function") generator = filename;
	else throw new Error(`The "filename" argument must be one of type string or function. Received type ${typeof filename}`);

	return new RFS(generator, opts);
}
