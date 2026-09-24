import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, parseCsvObjects, pick } from "./csv";

test("handles quotes, embedded commas/newlines, CRLF and BOM", () => {
  const rows = parseCsv('﻿a,b,c\r\n"x, y","say ""hi""","line1\nline2"\r\n\r\n1,2,3');
  assert.deepEqual(rows, [
    ["a", "b", "c"],
    ["x, y", 'say "hi"', "line1\nline2"],
    ["1", "2", "3"],
  ]);
});

test("objects use normalised headers", () => {
  const [o] = parseCsvObjects("First Name,Company Name,Email\nAnn,Acme Sand,ann@acme.com");
  assert.equal(o.first_name, "Ann");
  assert.equal(pick(o, "company", "company_name"), "Acme Sand");
});
