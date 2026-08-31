import { Button, Group, Image, Paper, Text } from "@mantine/core";
import { ImageIcon, Upload } from "lucide-react";
import type React from "react";
import { useRef, useState } from "react";

export type FileUploadProps = {
  onUpload: (file: File) => Promise<void>;
  accept?: string;
  label?: string;
};

export const FileUpload = ({ onUpload, accept, label = "Upload File" }: FileUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState("");

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setUploading(true);
    await onUpload(file);
    setUploading(false);
  };

  return (
    <Group>
      <input ref={inputRef} type="file" accept={accept} onChange={handleChange} style={{ display: "none" }} />
      <Button onClick={() => inputRef.current?.click()} loading={uploading} leftSection={<Upload size={16} />}>
        {label}
      </Button>
      {fileName && <Text size="sm">{fileName}</Text>}
    </Group>
  );
};

export type ImagePreviewProps = {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
};

export const ImagePreview = ({ src, alt = "", width, height }: ImagePreviewProps) => (
  <Paper p="xs" withBorder>
    {src ? (
      <Image src={src} alt={alt} width={width} height={height} fit="contain" />
    ) : (
      <Group justify="center" align="center" style={{ width, height, minHeight: 100 }}>
        <ImageIcon size={48} color="var(--mantine-color-dimmed)" />
      </Group>
    )}
  </Paper>
);
