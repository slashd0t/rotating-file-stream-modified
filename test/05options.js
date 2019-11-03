"use strict";

var assert = require("assert");
var exec = require("./helper").exec;
var fs = require("fs");
var rfs = require("./helper").rfs;
var utils = require("../utils");

describe("options", function() {
	describe("size KiloBytes", function() {
		before(function(done) {
			this.rfs = rfs(done, { size: "10K" });
			this.rfs.end();
		});

		it("10K", function() {
			assert.equal(this.rfs.options.size, 10240);
		});
	});

	describe("size MegaBytes", function() {
		before(function(done) {
			this.rfs = rfs(done, { size: "10M" });
			this.rfs.end();
		});

		it("10M", function() {
			assert.equal(this.rfs.options.size, 10485760);
		});
	});

	describe("size GigaBytes", function() {
		before(function(done) {
			this.rfs = rfs(done, { size: "10G" });
			this.rfs.end();
		});

		it("10G", function() {
			assert.equal(this.rfs.options.size, 10737418240);
		});
	});

	describe("interval minutes", function() {
		before(function(done) {
			var self = this;
			var doIt = function() {
				self.rfs = rfs(done, { interval: "3m" });
				self.rfs.end();
			};

			var now = new Date().getTime();
			var sec = parseInt(now / 1000, 10) * 1000;

			if(now - sec < 900) return doIt();

			setTimeout(doIt, 101);
		});

		it("3'", function() {
			assert.equal(this.rfs.options.interval.num, 3);
			assert.equal(this.rfs.options.interval.unit, "m");
		});
	});

	describe("interval hours", function() {
		before(function(done) {
			var self = this;
			var doIt = function() {
				self.rfs = rfs(done, { interval: "3h" });
				setTimeout(function() {
					self.rfs._interval(new Date(2015, 2, 29, 1, 29, 23, 123).getTime());
					self.rfs.end();
				}, 30);
			};

			var now = new Date().getTime();
			var sec = parseInt(now / 1000, 10) * 1000;

			if(now - sec < 900) return doIt();

			setTimeout(doIt, 101);
		});

		it("3h", function() {
			assert.equal(this.rfs.options.interval.num, 3);
			assert.equal(this.rfs.options.interval.unit, "h");
		});

		it("hours daylight saving", function() {
			assert.equal(this.rfs.next - this.rfs.prev, 7200000);
		});
	});

	describe("interval days", function() {
		before(function(done) {
			var self = this;
			var doIt = function() {
				self.rfs = rfs(done, { interval: "3d" });
				setTimeout(function() {
					self.rfs._interval(new Date(2015, 2, 29, 1, 29, 23, 123).getTime());
					self.rfs.end();
				}, 30);
			};

			var now = new Date().getTime();
			var sec = parseInt(now / 1000, 10) * 1000;

			if(now - sec < 900) return doIt();

			setTimeout(doIt, 101);
		});

		it("3d", function() {
			assert.equal(this.rfs.options.interval.num, 3);
			assert.equal(this.rfs.options.interval.unit, "d");
		});

		it("days daylight saving", function() {
			assert.equal(this.rfs.next - this.rfs.prev, 255600000);
		});
	});

	describe("path", function() {
		before(function(done) {
			var self = this;
			// process.env.npm_config_tmp
			exec(done, "rm -rf /tmp/test.log /tmp/1-test.log ; echo test > /tmp/test.log", function() {
				self.rfs = rfs(done, { path: "/tmp", size: "10B" });
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
			assert.equal(this.rfs.ev.rotated[0], "/tmp/1-test.log");
		});

		it("1 single write", function() {
			assert.equal(this.rfs.ev.single, 1);
		});

		it("0 multi write", function() {
			assert.equal(this.rfs.ev.multi, 0);
		});

		it("file content", function() {
			assert.equal(fs.readFileSync("/tmp/test.log"), "");
		});

		it("rotated file content", function() {
			assert.equal(fs.readFileSync("/tmp/1-test.log"), "test\ntest\n");
		});
	});

	describe("safe options object", function() {
		before(function(done) {
			this.options = { size: "10M", interval: "30s", rotate: 5 };
			this.rfs = rfs(done, this.options);
			this.rfs.end();
		});

		it("10M", function() {
			assert.equal(this.options.size, "10M");
		});

		it("30s", function() {
			assert.equal(this.options.interval, "30s");
		});

		it("5 rotate", function() {
			assert.equal(this.options.rotate, 5);
		});
	});

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
});
