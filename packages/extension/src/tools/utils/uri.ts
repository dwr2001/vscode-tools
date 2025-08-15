import * as URI from "uri-js";

/** Converts any OS path to cleaned up URI path segment format with no leading/trailing slashes
   e.g. \path\to\folder\ -> path/to/folder
        \this\is\afile.ts -> this/is/afile.ts
        is/already/clean -> is/already/clean
  **/
export function pathToUriPathSegment(path: string) {
  let clean = path.replace(/[\\]/g, "/"); // backslashes -> forward slashes
  clean = clean.replace(/^\//, ""); // remove start slash
  clean = clean.replace(/\/$/, ""); // remove end slash
  return clean
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

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

/*
  Returns the file extension of a URI
*/

export function joinPathsToUri(uri: string, ...pathSegments: string[]) {
  let baseUri = uri;
  if (baseUri.at(-1) !== "/") {
    baseUri += "/";
  }
  const segments = pathSegments.map((segment) => pathToUriPathSegment(segment));
  return URI.resolve(baseUri, segments.join("/"));
}

export function joinEncodedUriPathSegmentToUri(uri: string, pathSegment: string) {
  let baseUri = uri;
  if (baseUri.at(-1) !== "/") {
    baseUri += "/";
  }
  return URI.resolve(baseUri, pathSegment);
}