const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/bmp',
];

/**
 * Validates selected file for image type and reasonable size.
 */
export const validateImageFile = (file) => {
  if (!file) {
    return { valid: false, error: 'No file provided.' };
  }

  const isImageMime =
    Boolean(file.type) &&
    (file.type.startsWith('image/') || ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase()));
  const hasImageExt = /\.(jpe?g|png|webp|gif|bmp|heic|heif|svg)$/i.test(file.name || '');

  if (!isImageMime && !hasImageExt) {
    return {
      valid: false,
      error: 'Unsupported file format. Please upload a JPG, PNG, WEBP, GIF, or HEIC image.',
    };
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `Image size (${sizeMb} MB) exceeds maximum allowed limit of 10 MB.`,
    };
  }

  return { valid: true, error: null };
};

/**
 * Compresses/resizes large photos in browser canvas to prevent bloated uploads.
 */
export const compressImage = async (file, maxDimension = 1200, quality = 0.8) => {
  if (file.type === 'image/gif') {
    // Return animated GIFs unmodified
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File(
                [blob],
                (file.name || 'photo').replace(/\.[^/.]+$/, '.jpg'),
                {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                }
              );
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = readerEvent.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
};

/**
 * Converts any image file to a lightweight, highly-compressed Base64 Data URL.
 * Produces crisp, display-ready images (typically 20KB - 60KB) that store
 * reliably inside documents with zero external storage requirements.
 */
export const fileToCompressedDataUrl = async (file, maxDimension = 1000, quality = 0.75) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        try {
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        } catch {
          resolve(e.target.result);
        }
      };
      img.onerror = () => resolve(e.target.result);
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
};

/**
 * Uploads/processes a validated problem image.
 * Uses high-speed in-browser compression to produce a clean, lightweight,
 * display-ready payload that submits instantaneously (<50ms) with zero network hang.
 */
export const uploadProblemImage = async ({ _workspaceId, _userId, _problemId = 'temp', file }) => {
  if (!file) return null;

  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  try {
    const dataUrl = await fileToCompressedDataUrl(file, 1000, 0.75);
    return {
      imageUrl: dataUrl,
      imagePath: 'inline',
      fileName: file.name || 'photo.jpg',
      fileSize: Math.round(dataUrl.length * 0.75),
    };
  } catch (err) {
    console.error('[UNSAID Storage] Image processing error:', err);
    throw new Error('Failed to process image file. Please try selecting a different photo.');
  }
};
