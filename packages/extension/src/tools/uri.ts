import * as URI from "uri-js";

export function getCleanUriPath(uri: string) {
  const path = URI.parse(uri).path ?? "";
  let clean = path.replace(/^\//, ""); // remove start slash
  clean = clean.replace(/\/$/, ""); // remove end slash
  return clean;
}

/*
  Returns just the file or folder name of a URI
*/
export function getUriPathBasename(uri: string): string {
  const path = getCleanUriPath(uri);
  const basename = path.split("/").pop() || "";
  return decodeURIComponent(basename);
}
