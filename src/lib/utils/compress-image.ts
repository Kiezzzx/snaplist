import imageCompression from 'browser-image-compression';

interface CompressionOptions {
  maxSizeMB: number;
  maxWidthOrHeight: number;
  useWebWorker: boolean;
  fileType: string;
}

const compressionOptions: CompressionOptions = {
  maxSizeMB: 2.8,
  maxWidthOrHeight: 1024,
  useWebWorker: true,
  fileType: 'image/webp',
};

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('Failed to convert blob to base64'));
      }
    };
    reader.onerror = () => {
      reject(new Error('FileReader error while converting to base64'));
    };
    reader.readAsDataURL(blob);
  });
}

export async function compressAndConvertToBase64(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Invalid file type: only images are supported');
  }

  try {
    const compressedBlob = await imageCompression(file, compressionOptions);
    const base64String = await blobToBase64(compressedBlob);
    return base64String;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Image compression failed: ${error.message}`);
    }
    throw new Error('Image compression failed: unknown error');
  }
}
