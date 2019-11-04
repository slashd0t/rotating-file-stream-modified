"use strict";

import { deepStrictEqual as deq, strictEqual as eq } from "assert";
import { readFileSync } from "fs";
import { test } from "./helper";

describe("size", () => {
	describe("initial rotation", () => {
		const events = test({ files: { "test.log": "test\ntest\n" }, options: { size: "10B" } }, rfs => {
			rfs.end("test\n");
		});

		it("events", () => deq(events, { finish: 1, open: ["test.log"], rotated: ["1-test.log"], rotation: 1, write: 1 }));
		it("file content", () => eq(readFileSync("test.log", "utf8"), "test\n"));
		it("rotated file content", () => eq(readFileSync("1-test.log", "utf8"), "test\ntest\n"));
	});

	describe("single write rotation by size", () => {
		const events = test({ files: { "test.log": "test\n" }, options: { size: "10B" } }, rfs => {
			rfs.end("test\n");
		});

		it("events", () => deq(events, { finish: 1, open: ["test.log", "test.log"], rotated: ["1-test.log"], rotation: 1, write: 1 }));
		it("file content", () => eq(readFileSync("test.log", "utf8"), ""));
		it("rotated file content", () => eq(readFileSync("1-test.log", "utf8"), "test\ntest\n"));
	});

	describe("multi write rotation by size", () => {
		const events = test({ options: { size: "10B" } }, rfs => {
			rfs.write("test\n");
			rfs.write("test\n");
			rfs.end("test\n");
		});

		it("events", () => deq(events, { finish: 1, open: ["test.log", "test.log"], rotated: ["1-test.log"], rotation: 1, write: 1, writev: 1 }));
		it("file content", () => eq(readFileSync("test.log", "utf8"), "test\n"));
		it("rotated file content", () => eq(readFileSync("1-test.log", "utf8"), "test\ntest\n"));
	});

	describe("one write one file", () => {
		const events = test({ files: { "test.log": "test\n" }, options: { size: "15B" } }, rfs => {
			rfs.write("test\n");
			rfs.write("test\ntest\n");
			rfs.end("test\n");
		});

		it("events", () => deq(events, { finish: 1, open: ["test.log", "test.log"], rotated: ["1-test.log"], rotation: 1, write: 1, writev: 1 }));
		it("file content", () => eq(readFileSync("test.log", "utf8"), "test\n"));
		it("rotated file content", () => eq(readFileSync("1-test.log", "utf8"), "test\ntest\ntest\ntest\n"));
	});

	describe("missing path creation", function() {
		const events = test({ filename: (time: Date): string => (time ? "log/t/rot/test.log" : "log/t/test.log"), options: { size: "10B" } }, rfs =>
			rfs.once("open", () => {
				rfs.write("test\n");
				rfs.write("test\n");
				rfs.end("test\n");
			})
		);

		it("events", () => deq(events, { finish: 1, open: ["log/t/test.log", "log/t/test.log"], rotated: ["log/t/rot/test.log"], rotation: 1, write: 1, writev: 1 }));
		it("file content", () => eq(readFileSync("log/t/test.log", "utf8"), "test\n"));
		it("rotated file content", () => eq(readFileSync("log/t/rot/test.log", "utf8"), "test\ntest\n"));
	});
});
