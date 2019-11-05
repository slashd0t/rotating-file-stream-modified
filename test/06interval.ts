"use strict";

import { deepStrictEqual as deq, strictEqual as eq } from "assert";
import { readFileSync } from "fs";
import { test } from "./helper";

describe("interval", () => {
	describe("initial rotation with interval", () => {
		const events = test({ filename: "test.log", files: { "test.log": "test\ntest\n" }, options: { size: "10B", interval: "1M" } }, rfs => {
			rfs.now = (): Date => new Date(2015, 2, 29, 1, 29, 23, 123);
			rfs.end("test\n");
		});

		it("events", () => deq(events, { finish: 1, open: ["test.log"], rotated: ["20150301-0000-01-test.log"], rotation: 1, write: 1 }));
		it("file content", () => eq(readFileSync("test.log", "utf8"), "test\n"));
		it("rotated file content", () => eq(readFileSync("20150301-0000-01-test.log", "utf8"), "test\ntest\n"));
	});

	describe("rotationTime option", () => {
		const events = test({ filename: "test.log", files: { "test.log": "test\n" }, options: { size: "10B", interval: "1d", rotationTime: true, initialRotation: true } }, rfs => {
			rfs.now = (): Date => new Date(2015, 2, 29, 1, 29, 23, 123);
			rfs.end("test\n");
		});

		it("events", () => deq(events, { finish: 1, open: ["test.log", "test.log"], rotated: ["20150329-0129-01-test.log"], rotation: 1, write: 1 }));
		it("file content", () => eq(readFileSync("test.log", "utf8"), ""));
		it("rotated file content", () => eq(readFileSync("20150329-0129-01-test.log", "utf8"), "test\ntest\n"));
	});

	describe("initialRotation option", () => {
		const events = test({ filename: "test.log", files: { "test.log": "test\n" }, options: { size: "10B", interval: "1d", initialRotation: true } }, rfs => {
			rfs.now = (): Date => new Date(2015, 2, 29, 1, 29, 23, 123);
			rfs.end("test\n");
		});

		it("events", () => deq(events, { finish: 1, open: ["test.log", "test.log"], rotated: ["20150329-0129-01-test.log"], rotation: 1, write: 1 }));
		it("file content", () => eq(readFileSync("test.log", "utf8"), "test\n"));
		it("rotated file content", () => eq(readFileSync("20150329-0129-01-test.log", "utf8"), "test\n"));
	});

	/*
	describe("initialRotation option", function() {
		before(function(done) {
			var self = this;
			exec(done, "rm -rf *log ; echo test > test.log ; touch -t 197601231500 test.log", function() {
				self.rfs = rfs(done, { interval: "1m", initialRotation: true }, utils.createGenerator("test.log"));
				self.rfs.end("test\n");
			});
		});

		it("no error", function() {
			assert.ifError(this.rfs.ev.err);
		});

		it("1 rotation", function() {
			assert.equal(this.rfs.ev.rotation.length, 1);
		});

		it("1 rotated", function() {
			assert.equal(this.rfs.ev.rotated.length, 1);
			assert.equal(this.rfs.ev.rotated[0], "19760123-1500-01-test.log");
		});

		it("1 single write", function() {
			assert.equal(this.rfs.ev.single, 1);
		});

		it("0 multi write", function() {
			assert.equal(this.rfs.ev.multi, 0);
		});

		it("file content", function() {
			assert.equal(fs.readFileSync("test.log"), "test\n");
		});

		it("rotated file content", function() {
			assert.equal(fs.readFileSync("19760123-1500-01-test.log"), "test\n");
		});
	});

	describe("initialRotation option but ok", function() {
		before(function(done) {
			var self = this;
			exec(done, "rm -rf *log ; echo test > test.log", function() {
				self.rfs = rfs(done, { interval: "1m", initialRotation: true }, utils.createGenerator("test.log"));
				self.rfs.end("test\n");
			});
		});

		it("no error", function() {
			assert.ifError(this.rfs.ev.err);
		});

		it("0 rotation", function() {
			assert.equal(this.rfs.ev.rotation.length, 0);
		});

		it("0 rotated", function() {
			assert.equal(this.rfs.ev.rotated.length, 0);
		});

		it("1 single write", function() {
			assert.equal(this.rfs.ev.single, 1);
		});

		it("0 multi write", function() {
			assert.equal(this.rfs.ev.multi, 0);
		});

		it("file content", function() {
			assert.equal(fs.readFileSync("test.log"), "test\ntest\n");
		});
	});

	describe("_write while rotation", function() {
		before(function(done) {
			var self = this;
			exec(done, "rm -rf *log ; echo test > test.log", function() {
				self.rfs = rfs(done, { interval: "1s" });
				self.rfs.once("rotation", self.rfs.end.bind(self.rfs, "test\n"));
			});
		});

		it("no error", function() {
			assert.ifError(this.rfs.ev.err);
		});

		it("1 rotation", function() {
			assert.equal(this.rfs.ev.rotation.length, 1);
		});

		it("1 rotated", function() {
			assert.equal(this.rfs.ev.rotated.length, 1);
			assert.equal(this.rfs.ev.rotated[0], "1-test.log");
		});

		it("1 single write", function() {
			assert.equal(this.rfs.ev.single, 1);
		});

		it("0 multi write", function() {
			assert.equal(this.rfs.ev.multi, 0);
		});

		it("file content", function() {
			var cnt = fs.readFileSync("test.log").toString();
			assert.equal(cnt, "test\n");
		});

		it("rotated file content", function() {
			var cnt = fs.readFileSync("1-test.log").toString();
			assert.equal(cnt, "test\n");
		});
	});

	describe("rotation while _write", function() {
		before(function(done) {
			var self = this;
			exec(done, "rm -rf *log ; echo test > test.log", function() {
				self.rfs = rfs(done, { interval: "1s" });
				self.rfs.once("open", function() {
					var stream = self.rfs.stream;
					var prev = stream._write;
					stream._write = function(chunk, encoding, callback) {
						self.rfs.once("rotation", prev.bind(stream, chunk, encoding, callback));
					};

					self.rfs.write("test\n");
					self.rfs.end("test\n");
				});
			});
		});

		it("no error", function() {
			assert.ifError(this.rfs.ev.err);
		});

		it("1 rotation", function() {
			assert.equal(this.rfs.ev.rotation.length, 1);
		});

		it("1 rotated", function() {
			assert.equal(this.rfs.ev.rotated.length, 1);
			assert.equal(this.rfs.ev.rotated[0], "1-test.log");
		});

		it("2 single write", function() {
			assert.equal(this.rfs.ev.single, 2);
		});

		it("0 multi write", function() {
			assert.equal(this.rfs.ev.multi, 0);
		});

		it("file content", function() {
			var cnt = fs.readFileSync("test.log").toString();
			assert.equal(cnt, "test\n");
		});

		it("rotated file content", function() {
			var cnt = fs.readFileSync("1-test.log").toString();
			assert.equal(cnt, "test\ntest\n");
		});
	});
	*/
});
