import type { ImageAttachment, Message } from "./index.ts";

export const messageImages = (message: Message): readonly ImageAttachment[] => {
  const images = message.images ?? [];
  if (!images.length) return images;
  if (message.role !== "user") throw new Error("Images belong on user messages.");
  for (const image of images) {
    if (
      !/^image\/(jpeg|png|webp|gif)$/.test(image.mediaType) ||
      !image.data ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(image.data)
    )
      throw new Error("Image attachments require an image media type and base64 data.");
  }
  return images;
};
