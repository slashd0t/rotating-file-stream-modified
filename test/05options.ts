"use strict";

import { deepStrictEqual as deq, strictEqual as eq } from "assert";
import { readFileSync } from "fs";
import { sep } from "path";
import { test } from "./helper";

describe("options", () => {
	describe("size KiloBytes", () => {
		let size: number;
		const events = test({ options: { size: "10K" } }, rfs => rfs.end("test\n", () => (size = rfs.options.size)));

		it("events", () => deq(events, { finish: 1, open: ["test.log"], write: 1 }));
		it("10K", () => eq(size, 10240));
	});

	describe("size MegaBytes", () => {
		let size: number;
		const events = test({ options: { size: "10M" } }, rfs => rfs.end("test\n", () => (size = rfs.options.size)));

		it("events", () => deq(events, { finish: 1, open: ["test.log"], write: 1 }));
		it("10M", () => eq(size, 10485760));
	});

	describe("size GigaBytes", () => {
		let size: number;
		const events = test({ options: { size: "10G" } }, rfs => rfs.end("test\n", () => (size = rfs.options.size)));

		it("events", () => deq(events, { finish: 1, open: ["test.log"], write: 1 }));
		it("10G", () => eq(size, 10737418240));
	});

	describe("interval minutes", () => {
		let interval: number;
		const events = test({ options: { interval: "3m" } }, rfs => rfs.end("test\n", () => (interval = rfs.options.interval)));

		it("events", () => deq(events, { finish: 1, open: ["test.log"], write: 1 }));
		it("3'", () => deq(interval, { num: 3, unit: "m" }));
	});

	describe("interval hours", () => {
		let interval: number, next: number, prev: number;
		const events = test({ options: { interval: "3h" } }, rfs =>
			rfs.end("test\n", () => {
				interval = rfs.options.interval;
				rfs.intervalBounds(new Date(2015, 2, 29, 1, 29, 23, 123));
				({ next, prev } = rfs);
			})
		);

		it("events", () => deq(events, { finish: 1, open: ["test.log"], write: 1 }));
		it("3h", () => deq(interval, { num: 3, unit: "h" }));
		it("hours daylight saving", () => eq(next - prev, 7200000));
	});

	describe("interval days", () => {
		let interval: number, next: number, prev: number;
		const events = test({ options: { interval: "3d" } }, rfs =>
			rfs.end("test\n", () => {
				interval = rfs.options.interval;
				rfs.intervalBounds(new Date(2015, 2, 29, 1, 29, 23, 123));
				({ next, prev } = rfs);
			})
		);

		it("events", () => deq(events, { finish: 1, open: ["test.log"], write: 1 }));
		it("3h", () => deq(interval, { num: 3, unit: "d" }));
		it("hours daylight saving", () => eq(next - prev, 255600000));
	});

	describe("path (ending)", () => {
		const filename = `log${sep}test.log`;
		const rotated = `log${sep}1-test.log`;
		const events = test({ options: { path: "log" + sep, size: "10B" } }, rfs => {
			rfs.write("test\n");
			rfs.write("test\n");
			rfs.end("test\n");
		});

		it("events", () => deq(events, { finish: 1, open: [filename, filename], rotated: [rotated], rotation: 1, write: 1, writev: 1 }));
		it("file content", () => eq(readFileSync(filename, "utf8"), "test\n"));
		it("rotated file content", () => eq(readFileSync(rotated, "utf8"), "test\ntest\n"));
	});

	describe("path (not ending)", () => {
		const filename = `log${sep}test.log`;
		const rotated = `log${sep}1-test.log`;
		const events = test({ options: { path: "log", size: "10B" } }, rfs => {
			rfs.write("test\n");
			rfs.write("test\n");
			rfs.end("test\n");
		});

		it("events", () => deq(events, { finish: 1, open: [filename, filename], rotated: [rotated], rotation: 1, write: 1, writev: 1 }));
		it("file content", () => eq(readFileSync(filename, "utf8"), "test\n"));
		it("rotated file content", () => eq(readFileSync(rotated, "utf8"), "test\ntest\n"));
	});

	describe("safe options object", () => {
		let options;
		const events = test({ options: { size: "10M", interval: "1d", rotate: 5 } }, rfs => {
			rfs.write("test\n");
			rfs.write("test\n");
			rfs.end("test\n");
			options = rfs.options;
		});

		it("options", () => deq(options, { interval: { num: 1, unit: "d" }, path: "", rotate: 5, size: 10485760 }));
		it("events", () => deq(events, { finish: 1, open: ["test.log"], write: 1, writev: 1 }));
		it("file content", () => eq(readFileSync("test.log", "utf8"), "test\ntest\ntest\n"));
	});

	/*
	describe("immutable", function() {
		before(function(done) {
			var self = this;
			exec(done, "rm -rf *log ; echo test > 1-test.log ; echo test > 2-test.log ; echo test >> 2-test.log", function() {
				self.rfs = rfs(done, { immutable: true, interval: "1d", size: "10B" });
				self.rfs.ev.op = [];
				self.rfs.on("open", function(filename) {
					self.rfs.ev.op.push(filename);
				});
				self.rfs.write("tes1\n");
				self.rfs.write("tes2\n");
				self.rfs.write("tes3\n");
				self.rfs.end("test\n");
			});
		});

		it("no error", function() {
			assert.ifError(this.rfs.ev.err);
		});

		it("2 rotation", function() {
			assert.equal(this.rfs.ev.rotation.length, 2);
		});

		it("2 rotated", function() {
			assert.equal(this.rfs.ev.rotated.length, 2);
			assert.equal(this.rfs.ev.rotated[0], "1-test.log");
			assert.equal(this.rfs.ev.rotated[1], "3-test.log");
		});

		it("3 open", function() {
			assert.equal(this.rfs.ev.op.length, 3);
			assert.equal(this.rfs.ev.op[0], "1-test.log");
			assert.equal(this.rfs.ev.op[1], "3-test.log");
			assert.equal(this.rfs.ev.op[2], "4-test.log");
		});

		it("1 single write", function() {
			assert.equal(this.rfs.ev.single, 1);
		});

		it("1 multi write", function() {
			assert.equal(this.rfs.ev.multi, 1);
		});

		it("1st file content", function() {
			assert.equal(fs.readFileSync("1-test.log"), "test\ntes1\n");
		});

		it("2nd file content", function() {
			assert.equal(fs.readFileSync("3-test.log"), "tes2\ntes3\n");
		});

		it("3rd file content", function() {
			assert.equal(fs.readFileSync("4-test.log"), "test\n");
		});
	});

	describe("immutable with time", function() {
		before(function(done) {
			var self = this;
			exec(done, "rm -rf *log", function() {
				self.rfs = rfs(done, { immutable: true, interval: "1d", size: "10B" }, utils.createGenerator("test.log"));
				self.rfs.now = function() {
					return new Date(1976, 0, 23, 13, 29, 23, 123).getTime();
				};
				self.rfs.ev.op = [];
				self.rfs.on("open", function(filename) {
					self.rfs.ev.op.push(filename);
				});
				self.rfs.write("test\n");
				self.rfs.write("test\n");
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
		});

		it("2 open", function() {
			assert.equal(this.rfs.ev.op.length, 2);
			assert.equal(this.rfs.ev.op[1], "19760123-1329-02-test.log");
		});

		it("1 single write", function() {
			assert.equal(this.rfs.ev.single, 1);
		});

		it("1 multi write", function() {
			assert.equal(this.rfs.ev.multi, 1);
		});

		it("1st file content", function() {
			assert.equal(fs.readFileSync(this.rfs.ev.op[0]), "test\ntest\n");
		});

		it("2nd file content", function() {
			assert.equal(fs.readFileSync("19760123-1329-02-test.log"), "test\n");
		});
	});
	*/
});
