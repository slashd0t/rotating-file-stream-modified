"use strict";

import { deepStrictEqual as deq, strictEqual as eq } from "assert";
import { gunzipSync } from "zlib";
import { readFileSync } from "fs";
import { sep } from "path";
import { test } from "./helper";

describe("classical", function() {
	describe("initial rotation with interval", () => {
		const events = test(
			{ files: { "test.log": "test\ntest\n" }, filename: (index?: number): string => (index ? `${index}.test.log` : "test.log"), options: { interval: "1d", rotate: 2, size: "10B" } },
			rfs => {
				rfs.write("test\n");
				rfs.end("test\n");
			}
		);

		it("events", () => deq(events, { finish: 1, open: ["test.log", "test.log"], rotated: ["1.test.log", "2.test.log"], rotation: 2, write: 2 }));
		it("file content", () => eq(readFileSync("test.log", "utf8"), ""));
		it("first rotated file content", () => eq(readFileSync("1.test.log", "utf8"), "test\ntest\n"));
		it("second rotated file content", () => eq(readFileSync("2.test.log", "utf8"), "test\ntest\n"));
	});

	describe("rotation overflow", () => {
		const events = test({ filename: (index?: number): string => (index ? `${index}.test.log` : "test.log"), options: { rotate: 2, size: "10B" } }, rfs => {
			rfs.write("test\ntest\ntest\ntest\n");
			rfs.write("test\ntest\ntest\n");
			rfs.write("test\ntest\n");
			rfs.end("test\n");
		});

		it("events", () => deq(events, { finish: 1, open: ["test.log", "test.log", "test.log", "test.log"], rotated: ["1.test.log", "2.test.log", "2.test.log"], rotation: 3, write: 1, writev: 1 }));
		it("file content", () => eq(readFileSync("test.log", "utf8"), "test\n"));
		it("first rotated file content", () => eq(readFileSync("1.test.log", "utf8"), "test\ntest\n"));
		it("second rotated file content", () => eq(readFileSync("2.test.log", "utf8"), "test\ntest\ntest\n"));
	});

	describe("missing directory", () => {
		const events = test({ filename: (index?: number): string => (index ? `log${sep}${index}.test.log` : "test.log"), options: { rotate: 2, size: "10B" } }, rfs => {
			rfs.write("test\ntest\n");
			rfs.end("test\n");
		});

		it("events", () => deq(events, { finish: 1, open: ["test.log", "test.log"], rotated: ["log/1.test.log"], rotation: 1, write: 2 }));
		it("file content", () => eq(readFileSync("test.log", "utf8"), "test\n"));
		it("rotated file content", () => eq(readFileSync("log/1.test.log", "utf8"), "test\ntest\n"));
	});

	describe("compression", () => {
		const events = test({ filename: (index?: number): string => (index ? `${index}.test.log` : "test.log"), options: { compress: "gzip", rotate: 2, size: "10B" } }, rfs => {
			rfs.write("test\ntest\ntest\n");
			rfs.write("test\ntest\n");
			rfs.end("test\n");
		});

		it("events", () => deq(events, { finish: 1, open: ["test.log", "test.log", "test.log"], rotated: ["1.test.log", "2.test.log"], rotation: 2, write: 1, writev: 1 }));
		it("file content", () => eq(readFileSync("test.log", "utf8"), "test\n"));
		it("first rotated file content", () => eq(gunzipSync(readFileSync("1.test.log")).toString(), "test\ntest\n"));
		it("second rotated file content", () => eq(gunzipSync(readFileSync("2.test.log")).toString(), "test\ntest\ntest\n"));
	});

	describe("rotating on directory which is file", () => {
		const events = test({ files: { txt: "test\n" }, filename: (index?: number): string => (index ? "txt/test.log" : "test.log"), options: { rotate: 2, size: "10B" } }, rfs => {
			rfs.write("test\ntest\n");
			rfs.end("test\n");
		});

		it("events", () => deq(events, { close: 1, error: ["ENOTDIR"], finish: 1, open: ["test.log"], rotation: 1, write: 1 }));
		it("file content", () => eq(readFileSync("test.log", "utf8"), "test\ntest\n"));
	});

	describe("wrong name generator (rotation)", () => {
		const events = test(
			{
				filename: (index?: number): string => {
					if(index) throw new Error("test");
					return "test.log";
				},
				options: { rotate: 2, size: "10B" }
			},
			rfs => {
				rfs.write("test\ntest\n");
				rfs.end("test\n");
			}
		);

		it("events", () => deq(events, { close: 1, error: ["test"], finish: 1, open: ["test.log"], rotation: 1, write: 1 }));
		it("file content", () => eq(readFileSync("test.log", "utf8"), "test\ntest\n"));
	});

	/*
	describe("exhausted (rotation)", function() {
		before(function(done) {
			var self = this;
			exec(done, "rm -rf *log", function() {
				self.rfs = rfs(done, { compress: "gzip", rotate: 2, size: "5B" }, "test.log");
				var pre = self.rfs.findName;
				self.rfs.findName = function(a, b, c) {
					if(b) return c(Error("test"));
					pre.apply(self, arguments);
				};
				self.rfs.write("test\n");
				self.rfs.end("test\n");
			});
		});

		it("Error", function() {
			assert.equal(this.rfs.err.message, "test");
		});

		it("1 rotation", function() {
			assert.equal(this.rfs.ev.rotation.length, 1);
		});

		it("0 rotated", function() {
			assert.equal(this.rfs.ev.rotated.length, 0);
		});

		it("2 single write", function() {
			assert.equal(this.rfs.ev.single, 2);
		});

		it("0 multi write", function() {
			assert.equal(this.rfs.ev.multi, 0);
		});
	});
	*/

	/*
	describe("first rename error", function() {
		var pre;

		before(function(done) {
			var self = this;
			exec(done, "rm -rf *log", function() {
				self.rfs = rfs(done, { rotate: 2, size: "5B" }, "test.log");
				pre = fs.rename;
				fs.rename = function(a, b, c) {
					if(a === "test.log" && b === "test.log.1") return c(Error("test"));
					pre.apply(fs, arguments);
				};
				self.rfs.write("test\n");
				self.rfs.end("test\n");
			});
		});

		after(function() {
			fs.rename = pre;
		});

		it("Error", function() {
			assert.equal(this.rfs.err.message, "test");
		});

		it("1 rotation", function() {
			assert.equal(this.rfs.ev.rotation.length, 1);
		});

		it("0 rotated", function() {
			assert.equal(this.rfs.ev.rotated.length, 0);
		});

		it("2 single write", function() {
			assert.equal(this.rfs.ev.single, 2);
		});

		it("0 multi write", function() {
			assert.equal(this.rfs.ev.multi, 0);
		});
	});

	describe("makePath", function() {
		var pre;

		before(function(done) {
			var self = this;
			exec(done, "rm -rf *log", function() {
				self.rfs = rfs(done, { rotate: 2, size: "5B" }, function(count) {
					if(count) return "test2.log/test.log";
					return "test.log";
				});
				pre = utils.makePath;
				utils.makePath = function(a, c) {
					c(Error("test"));
				};
				self.rfs.write("test\n");
				self.rfs.end("test\n");
			});
		});

		after(function() {
			utils.makePath = pre;
		});

		it("Error", function() {
			assert.equal(this.rfs.err.message, "test");
		});

		it("1 rotation", function() {
			assert.equal(this.rfs.ev.rotation.length, 1);
		});

		it("0 rotated", function() {
			assert.equal(this.rfs.ev.rotated.length, 0);
		});

		it("2 single write", function() {
			assert.equal(this.rfs.ev.single, 2);
		});

		it("0 multi write", function() {
			assert.equal(this.rfs.ev.multi, 0);
		});
	});

	describe("second rename error", function() {
		var pre;

		before(function(done) {
			var self = this;
			var count = 0;
			exec(done, "rm -rf *log", function() {
				self.rfs = rfs(done, { rotate: 2, size: "5B" }, function(count) {
					if(count) return "test2.log/test.log";
					return "test.log";
				});
				pre = fs.rename;
				fs.rename = function(a, b, c) {
					if(a === "test.log" && b === "test2.log/test.log" && ++count === 2) return c(Error("test"));
					pre.apply(fs, arguments);
				};
				self.rfs.write("test\n");
				self.rfs.end("test\n");
			});
		});

		after(function() {
			fs.rename = pre;
		});

		it("Error", function() {
			assert.equal(this.rfs.err.message, "test");
		});

		it("1 rotation", function() {
			assert.equal(this.rfs.ev.rotation.length, 1);
		});

		it("0 rotated", function() {
			assert.equal(this.rfs.ev.rotated.length, 0);
		});

		it("2 single write", function() {
			assert.equal(this.rfs.ev.single, 2);
		});

		it("0 multi write", function() {
			assert.equal(this.rfs.ev.multi, 0);
		});
	});
	*/
});
