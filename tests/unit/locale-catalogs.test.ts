import assert from "node:assert/strict";
import test from "node:test";
import english from "@/messages/en.json";
import portuguese from "@/messages/pt.json";

type MessageCatalog = { readonly [key: string]: string | MessageCatalog };

function collectKeys(value: MessageCatalog, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof child === "string" ? [path] : collectKeys(child, path);
  });
}

test("Portuguese and English catalogs expose matching translation keys", () => {
  assert.deepEqual(collectKeys(portuguese), collectKeys(english));
});
