
const allText = "Screenshot Path: C:\\Users\\Phil\\.gemini\\antigravity\\brain\\50ecedb1-0a11-448e-9e40-5d737fa5aa43\\rendering_test_success_1775023291216.png";
const winRegex = /([a-zA-Z]:[\\/]+[^\"\'\r\n*?<>|]+\.(?:png|webp|jpg|jpeg))/gi;
let m;
const foundPaths = new Set();
while ((m = winRegex.exec(allText)) !== null) {
  foundPaths.add(m[1].trim());
}
console.log("Found Paths:", Array.from(foundPaths));

const newMedia = Array.from(foundPaths).map((p) => {
  let uri = p;
  if (!p.startsWith("file:")) {
    uri = "file:///" + p.replace(/\\/g, "/").replace(/^\/+/, "");
  }
  return {
    mimeType: "image/png",
    fileUri: uri,
  };
});
console.log("New Media:", JSON.stringify(newMedia, null, 2));
