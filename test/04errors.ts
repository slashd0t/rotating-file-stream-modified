"use strict";

import { createStream } from "..";
import { deepStrictEqual as deq, strictEqual as eq, throws as ex } from "assert";
import { readFileSync } from "fs";
import { test } from "./helper";

describe("errors", () => {
	describe("wrong name generator (first time)", () => {
		it("wrong filename type", () =>
			ex(
				() =>
					createStream(() => {
						throw new Error("test");
					}),
				Error("test")
			));
	});

	describe("wrong name generator (rotation)", () => {
		const events = test(
			{
				filename: (time: Date) => {
					if(time) throw new Error("test");
					return "test.log";
				},
				options: { size: "15B" }
			},
			rfs => {
				[0, 0, 0, 0].map(() => rfs.write("test\n"));
				rfs.end("test\n");
			}
		);

		it("events", () => deq(events, { close: 1, error: ["test"], finish: 1, open: ["test.log"], rotation: 1, write: 1, writev: 1 }));
		it("file content", () => eq(readFileSync("test.log", "utf8"), "test\ntest\ntest\n"));
	});

	xdescribe("wrong name generator (immutable)", () => {
		const events = test(
			{
				filename: (time: Date) => {
					if(time) throw new Error("test");
					return "test.log";
				},
				options: { size: "15B" }
			},
			rfs => {
				[0, 0, 0, 0].map(() => rfs.write("test\n"));
				rfs.end("test\n");
			}
		);

		it("events", () => deq(events, { error: ["test"], finish: 1, open: ["test.log"], rotation: 1, write: 1, writev: 1 }));
		it("file content", () => eq(readFileSync("test.log", "utf8"), "test\ntest\ntest\n"));
	});

	/*
	describe("wrong name generator (immutable)", function() {
		before(function(done) {
			var self = this;
			var first = true;
			exec(done, "rm -rf *log", function() {
				self.rfs = rfs(done, { immutable: true, interval: "1d", size: "5B" }, function(time) {
					if(! first) throw new Error("test");
					first = false;
					return "test.log";
				});
				self.rfs.write("test\n");
				self.rfs.end("test\n");
			});
		});

		it("Error", function() {
			assert.equal(this.rfs.err.message, "test");
		});

		it("0 rotation", function() {
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

		it("file content", function() {
			assert.equal(fs.readFileSync("test.log"), "test\n");
		});
	});
	*/

	describe("logging on directory", () => {
		const events = test({ filename: "test", options: { size: "5B" } }, rfs => rfs.write("test\n"));

		it("events", () => deq(events, { close: 1, error: ["Can't write on: test (it is not a file)"], finish: 1, write: 1 }));
	});

	xdescribe("logging on directory (immutable)", () => {
		const events = test({ filename: "test", options: { size: "5B" } }, rfs => rfs.write("test\n"));

		it("events", () => deq(events, { close: 1, error: ["Can't write on: test (it is not a file)"], finish: 1, write: 1 }));
	});

	/*
	describe("logging on directory (immutable)", function() {
		before(function(done) {
			var self = this;
			exec(done, "rm -rf *log", function() {
				self.rfs = rfs(done, { immutable: true, interval: "1d", size: "5B" }, function() {
					return "test";
				});
			});
		});

		it("Error", function() {
			assert.equal(this.rfs.err.message, "Can't write on: test (it is not a file)");
		});

		it("0 rotation", function() {
			assert.equal(this.rfs.ev.rotation.length, 0);
		});

		it("0 rotated", function() {
			assert.equal(this.rfs.ev.rotated.length, 0);
		});

		it("0 single write", function() {
			assert.equal(this.rfs.ev.single, 0);
		});

		it("0 multi write", function() {
			assert.equal(this.rfs.ev.multi, 0);
		});
	});
	*/

	describe("using file as directory", () => {
		const events = test({ filename: "index.ts/test.log", options: { size: "5B" } }, rfs => rfs.write("test\n"));

		it("events", () => deq(events, { close: 1, error: ["ENOTDIR"], finish: 1, write: 1 }));
	});

	/*
	describe("using file as directory", function() {
		before(function(done) {
			var self = this;
			exec(done, "rm -rf *log", function() {
				self.rfs = rfs(done, { size: "5B" }, "index.js/test.log");
			});
		});

		it("Error", function() {
			assert.equal(this.rfs.err.code, "ENOTDIR");
		});

		it("0 rotation", function() {
			assert.equal(this.rfs.ev.rotation.length, 0);
		});

		it("0 rotated", function() {
			assert.equal(this.rfs.ev.rotated.length, 0);
		});

		it("0 single write", function() {
			assert.equal(this.rfs.ev.single, 0);
		});

		it("0 multi write", function() {
			assert.equal(this.rfs.ev.multi, 0);
		});
	});

	describe("no rotated file available", function() {
		before(function(done) {
			var self = this;
			exec(done, "rm -rf *log", function() {
				self.rfs = rfs(done, { size: "5B" }, function(time, index) {
					return "test.log";
				});
				self.rfs.end("test\n");
			});
		});

		it("Error", function() {
			assert.equal(this.rfs.err.message, "Too many destination file attempts");
			assert.equal(this.rfs.err.attempts["test.log"], 1000);
		});

		it("1 rotation", function() {
			assert.equal(this.rfs.ev.rotation.length, 1);
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
			assert.equal(fs.readFileSync("test.log"), "test\n");
		});
	});

	describe("no rotated file available (initial rotation)", function() {
		before(function(done) {
			var self = this;
			exec(done, "rm -rf *log ; echo test > test.log", function() {
				self.rfs = rfs(done, { size: "5B" }, function(time, index) {
					return "test.log";
				});
			});
		});

		it("Error", function() {
			assert.equal(this.rfs.err.message, "Too many destination file attempts");
			assert.equal(this.rfs.err.attempts["test.log"], 1000);
		});

		it("1 rotation", function() {
			assert.equal(this.rfs.ev.rotation.length, 1);
		});

		it("0 rotated", function() {
			assert.equal(this.rfs.ev.rotated.length, 0);
		});

		it("0 single write", function() {
			assert.equal(this.rfs.ev.single, 0);
		});

		it("0 multi write", function() {
			assert.equal(this.rfs.ev.multi, 0);
		});

		it("file content", function() {
			assert.equal(fs.readFileSync("test.log"), "test\n");
		});
	});

	describe("error while write", function() {
		before(function(done) {
			var self = this;
			exec(done, "rm -rf *log", function() {
				self.rfs = rfs(done, { interval: "10d" });
				self.rfs.once("open", function() {
					self.rfs.stream.write = function(buffer, callback) {
						process.nextTick(callback.bind(null, new Error("Test error")));
					};
					self.rfs.end("test\n");
				});
			});
		});

		it("Error", function() {
			assert.equal(this.rfs.err.message, "Test error");
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
			assert.equal(fs.readFileSync("test.log"), "");
		});
	});

	describe("error while rename", function() {
		before(function(done) {
			var self = this;
			var oldR = fs.rename;
			fs.rename = function(a, b, callback) {
				process.nextTick(callback.bind(null, new Error("Test error")));
			};
			exec(done, "rm -rf *log", function() {
				self.rfs = rfs(
					function() {
						fs.rename = oldR;
						done();
					},
					{ size: "5B" }
				);
				self.rfs.end("test\n");
			});
		});

		it("Error", function() {
			assert.equal(this.rfs.err.message, "Test error");
		});

		it("1 rotation", function() {
			assert.equal(this.rfs.ev.rotation.length, 1);
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
			assert.equal(fs.readFileSync("test.log"), "test\n");
		});
	});

	describe("missing path creation", function() {
		before(function(done) {
			var self = this;
			exec(done, "rm -rf *log", function() {
				self.rfs = rfs(done, { size: "10B" }, function(time) {
					if(time) return "log/t/rot/test.log";
					return "log/t/test.log";
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
			assert.equal(this.rfs.ev.rotated[0], "log/t/rot/test.log");
		});

		it("1 single write", function() {
			assert.equal(this.rfs.ev.single, 1);
		});

		it("1 multi write", function() {
			assert.equal(this.rfs.ev.multi, 1);
		});

		it("file content", function() {
			assert.equal(fs.readFileSync("log/t/test.log"), "test\n");
		});

		it("rotated file content", function() {
			assert.equal(fs.readFileSync("log/t/rot/test.log"), "test\ntest\n");
		});
	});

	describe("error creating missing path in first open", function() {
		before(function(done) {
			var self = this;
			exec(done, "rm -rf *log", function() {
				var mkdir = fs.mkdir;
				fs.mkdir = function(path, callback) {
					process.nextTick(callback.bind(null, { code: "EACCES" }));
				};
				self.rfs = rfs(
					function() {
						fs.mkdir = mkdir;
						done();
					},
					{},
					function() {
						return "log/t/test.log";
					}
				);
			});
		});

		it("Error", function() {
			assert.equal(this.rfs.err.code, "EACCES");
		});

		it("0 rotation", function() {
			assert.equal(this.rfs.ev.rotation.length, 0);
		});

		it("0 rotated", function() {
			assert.equal(this.rfs.ev.rotated.length, 0);
		});

		it("0 single write", function() {
			assert.equal(this.rfs.ev.single, 0);
		});

		it("0 multi write", function() {
			assert.equal(this.rfs.ev.multi, 0);
		});
	});

	describe("error creating missing path in rotation", function() {
		before(function(done) {
			var self = this;
			exec(done, "rm -rf *log", function() {
				var mkdir = fs.mkdir;
				fs.mkdir = function(path, callback) {
					process.nextTick(callback.bind(null, { code: "EACCES" }));
				};
				self.rfs = rfs(
					function() {
						fs.mkdir = mkdir;
						done();
					},
					{ size: "5B" },
					function(time) {
						if(time) return "log/t/test.log";
						return "test.log";
					}
				);
				self.rfs.end("test\n");
			});
		});

		it("Error", function() {
			assert.equal(this.rfs.err.code, "EACCES");
		});

		it("1 rotation", function() {
			assert.equal(this.rfs.ev.rotation.length, 1);
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
	});

	describe("error on no rotated file open", function() {
		before(function(done) {
			var self = this;
			var oldC = fs.createWriteStream;
			fs.createWriteStream = function() {
				return {
					once: function(event, callback) {
						if(event === "error") setTimeout(callback.bind(null, { code: "TEST" }), 50);
					}
				};
			};
			exec(done, "rm -rf *log", function() {
				self.rfs = rfs(function() {
					fs.createWriteStream = oldC;
					done();
				});
			});
		});

		it("Error", function() {
			assert.equal(this.rfs.err.code, "TEST");
		});

		it("0 rotation", function() {
			assert.equal(this.rfs.ev.rotation.length, 0);
		});

		it("0 rotated", function() {
			assert.equal(this.rfs.ev.rotated.length, 0);
		});

		it("0 single write", function() {
			assert.equal(this.rfs.ev.single, 0);
		});

		it("0 multi write", function() {
			assert.equal(this.rfs.ev.multi, 0);
		});
	});

	describe("error unlinking file", function() {
		before(function(done) {
			var self = this;
			var oldU = fs.unlink;
			exec(done, "rm -rf *log", function() {
				fs.unlink = function(path, callback) {
					setTimeout(function() {
						fs.unlink = oldU;
						setTimeout(done, 50);
						callback({ code: "TEST" });
					}, 50);
				};
				self.rfs = rfs(function() {}, { size: "5B", compress: "gzip" });
				self.rfs.end("test\n");
			});
		});

		it("no error", function() {
			assert.ifError(this.rfs.ev.err);
		});

		it("warning", function() {
			assert.equal(this.rfs.ev.warn.code, "TEST");
		});

		it("1 rotation", function() {
			assert.equal(this.rfs.ev.rotation.length, 1);
		});

		it("1 rotated", function() {
			assert.equal(this.rfs.ev.rotated.length, 1);
		});

		it("1 single write", function() {
			assert.equal(this.rfs.ev.single, 1);
		});

		it("0 multi write", function() {
			assert.equal(this.rfs.ev.multi, 0);
		});
	});

	describe("error unlinking external compression file", function() {
		before(function(done) {
			var self = this;
			var oldU = fs.unlink;
			exec(done, "rm -rf *log", function() {
				fs.unlink = function(path, callback) {
					setTimeout(function() {
						fs.unlink = oldU;
						callback({ code: "TEST" });
					}, 50);
				};
				self.rfs = rfs(done, { size: "5B", compress: true });
				self.rfs.end("test\n");
			});
		});

		it("no error", function() {
			assert.ifError(this.rfs.ev.err);
		});

		it("warning", function() {
			assert.equal(this.rfs.ev.warn.code, "TEST");
		});

		it("1 rotation", function() {
			assert.equal(this.rfs.ev.rotation.length, 1);
		});

		it("1 rotated", function() {
			assert.equal(this.rfs.ev.rotated.length, 1);
		});

		it("1 single write", function() {
			assert.equal(this.rfs.ev.single, 1);
		});

		it("0 multi write", function() {
			assert.equal(this.rfs.ev.multi, 0);
		});
	});

	describe("error in external compression function", function() {
		before(function(done) {
			var self = this;
			exec(done, "rm -rf *log", function() {
				self.rfs = rfs(done, {
					size:     "5B",
					compress: function() {
						var e = new Error("test");
						e.code = "TEST";
						throw e;
					}
				});
				self.rfs.write("test\n");
			});
		});

		it("error", function() {
			assert.equal(this.rfs.err.code, "TEST");
		});

		it("no warning", function() {
			assert.ifError(this.rfs.ev.warn);
		});

		it("1 rotation", function() {
			assert.equal(this.rfs.ev.rotation.length, 1);
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
	});

	describe("error in stat (immutable)", function() {
		before(function(done) {
			var self = this;
			var preS = fs.stat;
			fs.stat = function(a, b) {
				process.nextTick(b.bind(null, new Error("test")));
			};
			exec(done, "rm -rf *log", function() {
				self.rfs = rfs(done, { immutable: true, interval: "1d", size: "5B" });
				self.rfs.on("error", function() {
					fs.stat = preS;
				});
			});
		});

		it("error", function() {
			assert.equal(this.rfs.err.message, "test");
		});

		it("no warning", function() {
			assert.ifError(this.rfs.ev.warn);
		});

		it("0 rotation", function() {
			assert.equal(this.rfs.ev.rotation.length, 0);
		});

		it("0 rotated", function() {
			assert.equal(this.rfs.ev.rotated.length, 0);
		});

		it("0 single write", function() {
			assert.equal(this.rfs.ev.single, 0);
		});

		it("0 multi write", function() {
			assert.equal(this.rfs.ev.multi, 0);
		});
	});

	describe("immutable exhausted", function() {
		before(function(done) {
			var self = this;
			exec(done, "rm -rf *log ; echo test > test.log", function() {
				self.rfs = rfs(done, { immutable: true, interval: "1d", size: "5B" }, function() {
					return "test.log";
				});
			});
		});

		it("error", function() {
			assert.equal(this.rfs.err.message, "Too many destination file attempts");
		});

		it("no warning", function() {
			assert.ifError(this.rfs.ev.warn);
		});

		it("0 rotation", function() {
			assert.equal(this.rfs.ev.rotation.length, 0);
		});

		it("0 rotated", function() {
			assert.equal(this.rfs.ev.rotated.length, 0);
		});

		it("0 single write", function() {
			assert.equal(this.rfs.ev.single, 0);
		});

		it("0 multi write", function() {
			assert.equal(this.rfs.ev.multi, 0);
		});
	});
	*/
});
