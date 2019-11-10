"use strict";

import { deepStrictEqual as deq } from "assert";
import { test } from "./helper";

describe("clean", () => {
	const events = test({}, rfs => rfs.end());

	it("clean", () => deq(events, { finish: 1 }));
});
