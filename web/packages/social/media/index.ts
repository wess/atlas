export type ImageType = { contentType: "image/jpeg" | "image/png" | "image/webp"; extension: "jpg" | "png" | "webp" };

export const imageType = (bytes: Uint8Array): ImageType | null => {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return { contentType: "image/jpeg", extension: "jpg" };
  if (
    bytes[0] === 137 &&
    bytes[1] === 80 &&
    bytes[2] === 78 &&
    bytes[3] === 71 &&
    bytes[4] === 13 &&
    bytes[5] === 10 &&
    bytes[6] === 26 &&
    bytes[7] === 10
  )
    return { contentType: "image/png", extension: "png" };
  if (
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
  )
    return { contentType: "image/webp", extension: "webp" };
  return null;
};
