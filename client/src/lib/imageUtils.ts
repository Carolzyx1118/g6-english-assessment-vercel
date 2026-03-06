/**
 * Client-side image compression and processing utilities.
 * Resizes and compresses images before upload to ensure exam-appropriate dimensions.
 */

/** Maximum dimension (width or height) for exam images */
const MAX_DIMENSION = 1200;
/** Maximum dimension for option thumbnails (picture-mcq options) */
const MAX_OPTION_DIMENSION = 600;
/** JPEG quality for compression (0-1) */
const COMPRESSION_QUALITY = 0.85;

export type ImageSize = 'full' | 'option' | 'scene';

/**
 * Compress and resize an image file.
 * Returns a new File object with the compressed image.
 */
export async function compressImage(
  file: File,
  size: ImageSize = 'full'
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const maxDim = size === 'option' ? MAX_OPTION_DIMENSION : MAX_DIMENSION;
      let { width, height } = img;

      // Only resize if larger than max dimension
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Use high-quality image smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // Determine output format - keep PNG for transparent images, use JPEG for others
      const isPng = file.type === 'image/png';
      const outputType = isPng ? 'image/png' : 'image/jpeg';
      const quality = isPng ? undefined : COMPRESSION_QUALITY;

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to compress image'));
            return;
          }

          // If compressed is larger than original, use original
          if (blob.size >= file.size) {
            resolve(file);
            return;
          }

          const ext = isPng ? '.png' : '.jpg';
          const baseName = file.name.replace(/\.[^.]+$/, '');
          const compressedFile = new File([blob], `${baseName}${ext}`, {
            type: outputType,
            lastModified: Date.now(),
          });
          resolve(compressedFile);
        },
        outputType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for compression'));
    };

    img.src = url;
  });
}

/**
 * Convert a File to base64 string (without the data: prefix).
 */
export async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  return btoa(
    new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
  );
}

/**
 * Get a human-readable file size string.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Validate that a file is an acceptable image.
 */
export function validateImageFile(file: File): string | null {
  const validTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    return 'Please select an image file (PNG, JPG, GIF, WebP)';
  }
  if (file.size > 10 * 1024 * 1024) {
    return 'Image file size must be under 10MB';
  }
  return null;
}
