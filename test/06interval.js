"use strict";

var assert = require("assert");
var exec = require("./helper").exec;
var fs = require("fs");
var rfs = require("./helper").rfs;
var utils = require("../utils");

describe("interval", function() {
	describe("initial rotation with interval", function() {
		before(function(done) {
			var self = this;
			exec(done, "rm -rf *log ; echo test > test.log ; echo test >> test.log", function() {
				self.rfs = rfs(done, { size: "10B", interval: "1M" }, "test.log");
				self.rfs.now = function() {
					return new Date(2015, 2, 29, 1, 29, 23, 123).getTime();
				};
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
			assert.equal(this.rfs.ev.rotated[0], "20150301-0000-01-test.log");
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
			assert.equal(fs.readFileSync("20150301-0000-01-test.log"), "test\ntest\n");
		});
	});

	describe("rotationTime option", function() {
		before(function(done) {
			var self = this;
			exec(done, "rm -rf *log ; echo test > test.log ; echo test >> test.log", function() {
				self.rfs = rfs(done, { size: "10B", interval: "1d", rotationTime: true, initialRotation: true }, function(time, index) {
					self.time = time;
					return utils.createGenerator("test.log")(time, index);
				});
				self.rfs.now = function() {
					return new Date(2015, 2, 29, 1, 29, 23, 123).getTime();
				};
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
			this.name = utils.createGenerator("test.log")(this.time, 1);
			assert.equal(this.rfs.ev.rotated.length, 1);
			assert.equal(this.rfs.ev.rotated[0], this.name);
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
			assert.equal(fs.readFileSync(this.name), "test\ntest\n");
		});
	});

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
});
