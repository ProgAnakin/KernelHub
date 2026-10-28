/** Hands a generated file to the browser's download flow. */
export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  // Large files need time to start; release the object URL afterwards.
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
