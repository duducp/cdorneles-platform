"use client";

import { Button, Group, Image, Paper, Stack, Text, rem } from "@mantine/core";
import { Upload, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";

export interface FileUploadProps {
  /** Accepted file types (MIME or extensions). */
  accept?: string[];
  /** Maximum file size in bytes. */
  maxSize?: number;
  /** Called with the selected file. The consumer handles the actual upload. */
  onFile: (file: File) => void;
  /** Current file URL for preview (e.g. after upload). */
  previewUrl?: string | null;
  /** Called when the user removes the current file. */
  onRemove?: () => void;
  /** Whether the upload is in progress. */
  loading?: boolean;
  /** Disabled state. */
  disabled?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Drag-and-drop file upload with preview. The consumer provides the upload
 * logic via `onFile`; this component handles selection, validation, and UI.
 */
export function FileUpload({
  accept,
  maxSize,
  onFile,
  previewUrl,
  onRemove,
  loading = false,
  disabled = false,
}: FileUploadProps) {
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validate = useCallback(
    (file: File): boolean => {
      setError(null);

      if (maxSize && file.size > maxSize) {
        setError(
          `File too large (${formatFileSize(file.size)}). Maximum: ${formatFileSize(maxSize)}`,
        );
        return false;
      }

      if (accept && accept.length > 0) {
        const matches = accept.some((type) => {
          if (type.startsWith(".")) {
            return file.name.toLowerCase().endsWith(type.toLowerCase());
          }
          return file.type === type || file.type.startsWith(type.replace("*", ""));
        });
        if (!matches) {
          setError(`File type not accepted. Allowed: ${accept.join(", ")}`);
          return false;
        }
      }

      return true;
    },
    [accept, maxSize],
  );

  const handleFile = useCallback(
    (file: File | null) => {
      if (!file) return;
      if (validate(file)) {
        onFile(file);
      }
    },
    [validate, onFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragging(false);
  }, []);

  if (previewUrl) {
    return (
      <Paper withBorder p="sm" radius="md">
        <Stack gap="xs">
          <Image src={previewUrl} alt="Preview" h={200} fit="contain" radius="md" />
          {onRemove && (
            <Group justify="flex-end">
              <Button
                variant="subtle"
                color="danger"
                size="xs"
                leftSection={<X size={14} />}
                onClick={onRemove}
                disabled={disabled || loading}
              >
                Remove
              </Button>
            </Group>
          )}
        </Stack>
      </Paper>
    );
  }

  return (
    <Stack gap="xs">
      <Paper
        withBorder
        p="xl"
        radius="md"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        style={{
          borderStyle: dragging ? "dashed" : undefined,
          borderWidth: dragging ? rem(2) : undefined,
          borderColor: dragging ? "var(--mantine-color-brand-6)" : undefined,
          backgroundColor: dragging ? "var(--mantine-color-brand-0)" : undefined,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
          textAlign: "center",
        }}
        onClick={() => !disabled && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept?.join(",")}
          hidden
          disabled={disabled}
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        <Stack align="center" gap="sm">
          <Upload size={32} opacity={0.5} />
          <Text c="dimmed" size="sm">
            Drag and drop or click to select
          </Text>
          {accept && accept.length > 0 && (
            <Text c="dimmed" size="xs">
              Accepted: {accept.join(", ")}
            </Text>
          )}
          {maxSize && (
            <Text c="dimmed" size="xs">
              Maximum size: {formatFileSize(maxSize)}
            </Text>
          )}
        </Stack>
      </Paper>
      {error && (
        <Text c="danger" size="sm" role="alert">
          {error}
        </Text>
      )}
    </Stack>
  );
}
