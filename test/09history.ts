"use strict";

import { deepStrictEqual as deq, strictEqual as eq } from "assert";
import { readFileSync } from "fs";
import { test } from "./helper";

describe("history", () => {
	describe("maxFiles", () => {
		const events = test({ options: { maxFiles: 3, size: "10B" } }, rfs => {
			rfs.write("test\ntest\n");
			rfs.write("test\ntest\ntest\n");
			rfs.write("test\ntest\ntest\ntest\n");
			rfs.write("test\ntest\ntest\ntest\ntest\n");
			rfs.write("test\ntest\ntest\ntest\ntest\ntest\n");
			rfs.end("test\n");
		});

		it("events", () =>
			deq(events, {
				finish:   1,
				history:  5,
				open:     ["test.log", "test.log", "test.log", "test.log", "test.log", "test.log"],
				removedn: ["1-test.log", "2-test.log"],
				rotated:  ["1-test.log", "2-test.log", "3-test.log", "4-test.log", "1-test.log"],
				rotation: 5,
				write:    1,
				writev:   1
			}));
		it("file content", () => eq(readFileSync("test.log", "utf8"), "test\n"));
		it("first rotated file content", () => eq(readFileSync("3-test.log", "utf8"), "test\ntest\ntest\ntest\n"));
		it("second rotated file content", () => eq(readFileSync("4-test.log", "utf8"), "test\ntest\ntest\ntest\ntest\n"));
		it("third rotated file content", () => eq(readFileSync("1-test.log", "utf8"), "test\ntest\ntest\ntest\ntest\ntest\n"));
	});

	describe("maxSize", () => {
		const events = test({ options: { maxSize: "60B", size: "10B" } }, rfs => {
			rfs.write("test\ntest\n");
			rfs.write("test\ntest\ntest\n");
			rfs.write("test\ntest\ntest\ntest\n");
			rfs.write("test\ntest\ntest\ntest\ntest\n");
			rfs.write("test\ntest\ntest\ntest\ntest\ntest\n");
			rfs.end("test\n");
		});

		it("events", () =>
			deq(events, {
				finish:   1,
				history:  5,
				open:     ["test.log", "test.log", "test.log", "test.log", "test.log", "test.log"],
				removeds: ["1-test.log", "2-test.log", "3-test.log"],
				rotated:  ["1-test.log", "2-test.log", "3-test.log", "4-test.log", "1-test.log"],
				rotation: 5,
				write:    1,
				writev:   1
			}));
		it("file content", () => eq(readFileSync("test.log", "utf8"), "test\n"));
		it("first rotated file content", () => eq(readFileSync("4-test.log", "utf8"), "test\ntest\ntest\ntest\ntest\n"));
		it("second rotated file content", () => eq(readFileSync("1-test.log", "utf8"), "test\ntest\ntest\ntest\ntest\ntest\n"));
	});

	/*
	describe("error reading history file", function() {
		before(function(done) {
			var self = this;
			exec(done, "rm -rf *log *txt", function() {
				self.rfs = rfs(setTimeout.bind(null, done, 100), { size: "10B", maxFiles: 1, history: "test" });
				self.rfs.write("test\n");
				self.rfs.write("test\n");
				self.rfs.end("test\n");
			});
		});

		it("no error", function() {
			assert.ifError(this.rfs.ev.err);
		});

		it("warning", function() {
			assert.equal(this.rfs.ev.warn.code, "EISDIR");
		});
	});

	describe("error writing history file", function() {
		before(function(done) {
			var self = this;
			var pre = fs.writeFile;
			var end = doneN(done, 2);
			fs.writeFile = function(a, b, c, d) {
				d("TEST");
			};
			exec(done, "rm -rf *log *txt", function() {
				self.rfs = rfs(end, { size: "10B", maxFiles: 1 });
				self.rfs.on("removed", function(name) {
					self.removed = name;
				});
				self.rfs.write("test\n");
				self.rfs.write("test\n");
				self.rfs.end("test\n");
				self.rfs.once("warning", function() {
					fs.writeFile = pre;
					end();
				});
			});
		});

		it("no error", function() {
			assert.ifError(this.rfs.ev.err);
		});

		it("warning", function() {
			assert.equal(this.rfs.ev.warn, "TEST");
		});
	});

	describe("error removing file", function() {
		before(function(done) {
			var self = this;
			var pre = fs.unlink;
			var end = doneN(done, 2);
			fs.unlink = function(a, b) {
				fs.unlink = pre;
				b("TEST");
			};
			exec(done, "rm -rf *log *txt", function() {
				self.rfs = rfs(end, { size: "10B", maxFiles: 1 });
				self.rfs.on("removed", function(name) {
					self.removed = name;
				});
				self.rfs.write("test\n");
				self.rfs.write("test\n");
				self.rfs.once("warning", end);
				self.rfs.once("history", function() {
					self.rfs.write("test\n");
					self.rfs.write("test\n");
					self.rfs.once("history", function() {
						self.rfs.end("test\n");
					});
				});
			});
		});

		it("no error", function() {
			assert.ifError(this.rfs.ev.err);
		});

		it("warning", function() {
			assert.equal(this.rfs.ev.warn, "TEST");
		});
	});

	describe("error checking file", function() {
		before(function(done) {
			var self = this;
			var preR = fs.readFile;
			var preS = fs.stat;
			exec(done, "rm -rf *log *txt", function() {
				self.rfs = rfs(setTimeout.bind(null, done, 100), { size: "10B", maxFiles: 1 });
				self.rfs.on("removed", function(name) {
					self.removed = name;
				});
				self.rfs.on("warning", function() {
					self.rfs.end("test\n");
				});
				self.rfs.write("test\n");
				self.rfs.write("test\n");
				fs.readFile = function(a, b, c) {
					fs.stat = function(a, b) {
						fs.stat = preS;
						b("TEST");
					};
					fs.readFile = preR;
					fs.readFile(a, b, c);
				};
			});
		});

		it("no error", function() {
			assert.ifError(this.rfs.ev.err);
		});

		it("warning", function() {
			assert.equal(this.rfs.ev.warn, "TEST");
		});
	});
	*/

	describe("immutable", () => {
		let min = 0;
		const events = test({ filename: "test.log", options: { immutable: true, interval: "1d", maxFiles: 2, size: "10B" } }, rfs => {
			rfs.now = (): Date => new Date(2015, 0, 23, 1, ++min, 23, 123);
			rfs.write("test\ntest\n");
			rfs.write("test\ntest\ntest\n");
			rfs.write("test\ntest\ntest\ntest\n");
			rfs.write("test\ntest\ntest\ntest\ntest\n");
			rfs.end("test\n");
		});

		it("events", () =>
			deq(events, {
				finish:   1,
				history:  4,
				open:     ["20150123-0101-01-test.log", "20150123-0105-01-test.log", "20150123-0109-01-test.log", "20150123-0113-01-test.log", "20150123-0117-01-test.log"],
				removedn: ["20150123-0101-01-test.log", "20150123-0105-01-test.log"],
				rotated:  ["20150123-0101-01-test.log", "20150123-0105-01-test.log", "20150123-0109-01-test.log", "20150123-0113-01-test.log"],
				rotation: 4,
				write:    1,
				writev:   1
			}));
		it("file content", () => eq(readFileSync("20150123-0117-01-test.log", "utf8"), "test\n"));
		it("first rotated file content", () => eq(readFileSync("20150123-0109-01-test.log", "utf8"), "test\ntest\ntest\ntest\n"));
		it("second rotated file content", () => eq(readFileSync("20150123-0113-01-test.log", "utf8"), "test\ntest\ntest\ntest\ntest\n"));
	});
});
