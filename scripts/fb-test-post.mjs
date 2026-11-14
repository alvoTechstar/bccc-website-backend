/**
 * One-command Facebook Page photo test.
 * Usage (from bccc-backend/):
 *   1. Put FACEBOOK_PAGE_ACCESS_TOKEN in .env (Page ID is already set).
 *   2. node scripts/fb-test-post.mjs [path-to-photo] ["caption"]
 *
 * Posts the photo to the church Page and prints the live post link.
 * Exits non-zero with the exact Meta error if the token/permissions are wrong.
 */
import "dotenv/config.js";
import fs from "fs";

const pageId = (process.env.FACEBOOK_PAGE_ID ?? "").trim();
const token = (process.env.FACEBOOK_PAGE_ACCESS_TOKEN ?? "").trim();
const graphVersion = process.env.FACEBOOK_GRAPH_VERSION ?? "v22.0";
const imagePath = process.argv[2] ?? "../bccc-website/bcc-church/public/photos/dominion-summit-2026.jpg";
const caption = process.argv[3] ?? "Test post from the BCC website publisher — please ignore.";

if (!pageId) {
  console.error("Missing FACEBOOK_PAGE_ID in .env");
  process.exit(2);
}
if (!token) {
  console.error("Missing FACEBOOK_PAGE_ACCESS_TOKEN in .env — paste the Alvo Techstar page token there first.");
  process.exit(2);
}
if (!fs.existsSync(imagePath)) {
  console.error(`Photo not found: ${imagePath}`);
  process.exit(2);
}

const form = new FormData();
form.append("caption", caption);
form.append("published", "true");
form.append("access_token", token);
form.append("source", new Blob([fs.readFileSync(imagePath)], { type: "image/jpeg" }), "test.jpg");

const res = await fetch(`https://graph.facebook.com/${graphVersion}/${pageId}/photos`, {
  method: "POST",
  body: form,
});
const data = await res.json();
if (!res.ok || data.error) {
  console.error(`Facebook error${data.error ? ` ${data.error.code}` : ` ${res.status}`}: ${data.error?.message ?? res.statusText}`);
  process.exit(1);
}
const postId = data.post_id ?? data.id;
console.log(`Posted! id=${postId}`);
if (postId) console.log(`View it: https://www.facebook.com/${String(postId).replace("_", "/posts/")}`);
