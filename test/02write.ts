"use strict";

import { deepStrictEqual as deq, strictEqual as eq } from "assert";
import { readFileSync } from "fs";
import { test } from "./helper";

describe("write(s)", () => {
	describe("single write", () => {
		const events = test({}, rfs => rfs.end("test\n"));

		it("events", () => deq(events, { finish: 1, open: ["test.log"], write: 1 }));
		it("file content", () => eq(readFileSync("test.log", "utf8"), "test\n"));
	});

	describe("multi write", () => {
		const events = test({ files: { "test.log": "test\n" } }, rfs => {
			rfs.write("test\n");
			rfs.write("test\n");
			rfs.end("test\n");
		});

		it("events", () => deq(events, { finish: 1, open: ["test.log"], write: 1, writev: 1 }));
		it("file content", () => eq(readFileSync("test.log", "utf8"), "test\ntest\ntest\ntest\n"));
	});

	describe("end callback", function() {
		const events = test({}, rfs => {
			rfs.end("test\n", "utf8", () => (events.endcb = true));
		});

		it("events", () => deq(events, { endcb: true, finish: 1, open: ["test.log"], write: 1 }));
		it("file content", () => eq(readFileSync("test.log", "utf8"), "test\n"));
	});

	describe("write after open", function() {
		const events = test({}, rfs => rfs.once("open", () => rfs.end("test\n", "utf8")));

		it("events", () => deq(events, { finish: 1, open: ["test.log"], write: 1 }));
		it("file content", () => eq(readFileSync("test.log", "utf8"), "test\n"));
	});

	describe("destroy before open", function() {
		let stream: any;
		let open: boolean;

		const event = (done?: any): void => {
			open = true;
			if(done) done();
		};

		const events = test({}, rfs => {
			stream = rfs;
			rfs.on("open", () => event());
			rfs.destroy();
			rfs.write("test\n");
		});

		before(done => {
			if(open) return done();
			stream.on("open", () => event(done));
		});

		it("events", () => deq(events, { close: 1, finish: 1, error: ["ERR_STREAM_DESTROYED"], open: ["test.log"] }));
		it("file content", () => eq(readFileSync("test.log", "utf8"), ""));
	});

	describe("destroy between open and write", function() {
		const events = test({}, rfs =>
			rfs.once("open", () => {
				rfs.destroy();
				rfs.write("test\n");
			})
		);

		it("events", () => deq(events, { close: 1, finish: 1, error: ["ERR_STREAM_DESTROYED"], open: ["test.log"] }));
		it("file content", () => eq(readFileSync("test.log", "utf8"), ""));
	});

	describe("destroy while writing", function() {
		const events = test({}, rfs =>
			rfs.once("open", () => {
				rfs.write("test\n");
				rfs.destroy();
			})
		);

		it("events", () => deq(events, { close: 1, finish: 1, open: ["test.log"], write: 1 }));
		it("file content", () => eq(readFileSync("test.log", "utf8"), "test\n"));
	});

	describe("destroy after write", function() {
		const events = test({}, rfs =>
			rfs.once("open", () => {
				rfs.write("test\n", () => rfs.destroy());
			})
		);

		it("events", () => deq(events, { close: 1, finish: 1, open: ["test.log"], write: 1 }));
		it("file content", () => eq(readFileSync("test.log", "utf8"), "test\n"));
	});
});
