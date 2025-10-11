
import crypto from "crypto";

/**
 * Compute a weak ETag for JSON/string payloads.
 * Uses sha1 over the incoming string and encodes as W/"<hex>-<len>".
 */
export function computeWeakETagFromString(str) {
  const hash = crypto.createHash("sha1").update(str, "utf8").digest("hex");
  const len = Buffer.byteLength(str, "utf8");
  return `W/"${hash}-${len}"`;
}

/**
 * Compute a weak ETag for plain JS objects by JSON.stringify-ing them.
 */
export function computeWeakETag(obj) {
  const json = JSON.stringify(obj);
  return computeWeakETagFromString(json);
}
