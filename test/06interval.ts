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
		const events = test(
			{ filename: "test.log", files: { "test.log": { content: "test\n", date: new Date(2015, 0, 23, 1, 29, 23, 123) } }, options: { size: "10B", interval: "1d", initialRotation: true } },
			rfs => {
				rfs.now = (): Date => new Date(2015, 2, 29, 1, 29, 23, 123);
				rfs.end("test\n");
			}
		);

		it("events", () => deq(events, { finish: 1, open: ["test.log"], rotated: ["20150123-0000-01-test.log"], rotation: 1, write: 1 }));
		it("file content", () => eq(readFileSync("test.log", "utf8"), "test\n"));
		it("rotated file content", () => eq(readFileSync("20150123-0000-01-test.log", "utf8"), "test\n"));
	});

	describe("initialRotation option but ok", () => {
		const events = test(
			{ filename: "test.log", files: { "test.log": { content: "test\n", date: new Date(2015, 2, 29, 1, 0, 0, 0) } }, options: { size: "10B", interval: "1d", initialRotation: true } },
			rfs => {
				rfs.now = (): Date => new Date(2015, 2, 29, 1, 29, 23, 123);
				rfs.end("test\n");
			}
		);

		it("events", () => deq(events, { finish: 1, open: ["test.log", "test.log"], rotated: ["20150329-0000-01-test.log"], rotation: 1, write: 1 }));
		it("file content", () => eq(readFileSync("test.log", "utf8"), ""));
		it("rotated file content", () => eq(readFileSync("20150329-0000-01-test.log", "utf8"), "test\ntest\n"));
	});

	describe("_write while rotation", () => {
		const events = test({ files: { "test.log": "test\ntest\n" }, options: { interval: "1s" } }, rfs => rfs.on("rotation", () => rfs.end("test\n")));

		it("events", () => deq(events, { finish: 1, open: ["test.log", "test.log"], rotated: ["1-test.log"], rotation: 1, write: 1 }));
		it("file content", () => eq(readFileSync("test.log", "utf8"), "test\n"));
		it("rotated file content", () => eq(readFileSync("1-test.log", "utf8"), "test\ntest\n"));
	});

	describe("_write while rotation", () => {
		const events = test({ files: { "test.log": "test\ntest\n" }, options: { interval: "1s" } }, rfs => {
			const prev = rfs._write;
			rfs._write = (chunk: any, encoding: any, callback: any): any => rfs.once("rotation", prev.bind(rfs, chunk, encoding, callback));

			rfs.end("test\n");
		});

		it("events", () => deq(events, { finish: 1, open: ["test.log", "test.log"], rotated: ["1-test.log"], rotation: 1, write: 1 }));
		it("file content", () => eq(readFileSync("test.log", "utf8"), "test\n"));
		it("rotated file content", () => eq(readFileSync("1-test.log", "utf8"), "test\ntest\n"));
	});
});
