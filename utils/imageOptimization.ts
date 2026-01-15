/**
 * Image Optimization Utilities
 * Provides functions for compressing and optimizing images for web storage
 */

export interface ImageOptimizationConfig {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    targetSizeKB?: number;
    format?: 'image/jpeg' | 'image/webp';
}

/**
 * Presets for different optimization scenarios
 */
export const OPTIMIZATION_PRESETS = {
    // Ultra-aggressive compression for local browser storage
    STORAGE: {
        maxWidth: 600,
        quality: 0.5,
        targetSizeKB: 150,
        format: 'image/jpeg' as const
    },
    // Balanced compression for cloud upload
    CLOUD: {
        maxWidth: 800,
        quality: 0.6,
        targetSizeKB: 250,
        format: 'image/jpeg' as const
    },
    // Thumbnail generation
    THUMBNAIL: {
        maxWidth: 200,
        quality: 0.7,
        targetSizeKB: 30,
        format: 'image/jpeg' as const
    },
    // High quality but still optimized
    HIGH_QUALITY: {
        maxWidth: 1200,
        quality: 0.8,
        targetSizeKB: 500,
        format: 'image/jpeg' as const
    }
};

/**
 * Estimates the file size in KB from a base64 data URL
 */
export const estimateBase64SizeKB = (base64String: string): number => {
    const base64Data = base64String.split(',')[1] || base64String;
    const sizeBytes = (base64Data.length * 3) / 4;
    return sizeBytes / 1024;
};

/**
 * Converts a File to a data URL
 */
export const fileToDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

/**
 * Loads an image from a data URL
 */
export const loadImage = (dataURL: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = dataURL;
    });
};

/**
 * Advanced image optimization with progressive quality reduction
 * Automatically adjusts quality to meet target size
 */
export const optimizeImage = async (
    file: File,
    config: ImageOptimizationConfig = OPTIMIZATION_PRESETS.STORAGE
): Promise<{ dataURL: string; sizeKB: number; quality: number }> => {
    const {
        maxWidth = 600,
        maxHeight,
        quality: initialQuality = 0.5,
        targetSizeKB = 150,
        format = 'image/jpeg'
    } = config;

    // Load the image
    const dataURL = await fileToDataURL(file);
    const img = await loadImage(dataURL);

    // Create canvas and resize
    const canvas = document.createElement('canvas');
    let { width, height } = img;

    // Calculate new dimensions while maintaining aspect ratio
    if (maxWidth && width > maxWidth) {
        height = (maxWidth / width) * height;
        width = maxWidth;
    }
    if (maxHeight && height > maxHeight) {
        width = (maxHeight / height) * width;
        height = maxHeight;
    }

    canvas.width = Math.round(width);
    canvas.height = Math.round(height);

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    // Draw image
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Progressive quality reduction
    let quality = initialQuality;
    let result = canvas.toDataURL(format, quality);
    let sizeKB = estimateBase64SizeKB(result);

    // If over target, reduce quality progressively
    if (targetSizeKB && sizeKB > targetSizeKB) {
        const qualities = [0.4, 0.3, 0.25, 0.2, 0.15];

        for (const q of qualities) {
            quality = q;
            result = canvas.toDataURL(format, quality);
            sizeKB = estimateBase64SizeKB(result);

            if (sizeKB <= targetSizeKB) {
                break;
            }
        }
    }

    return {
        dataURL: result,
        sizeKB,
        quality
    };
};

/**
 * Batch optimize multiple images
 */
export const optimizeImages = async (
    files: File[],
    config?: ImageOptimizationConfig
): Promise<Array<{ dataURL: string; sizeKB: number; quality: number; fileName: string }>> => {
    const results = await Promise.all(
        files.map(async (file) => {
            const result = await optimizeImage(file, config);
            return {
                ...result,
                fileName: file.name
            };
        })
    );
    return results;
};

/**
 * Calculate total storage savings
 */
export const calculateSavings = (originalSizeMB: number, optimizedSizeKB: number): {
    savedKB: number;
    savedMB: number;
    percentSaved: number;
} => {
    const originalSizeKB = originalSizeMB * 1024;
    const savedKB = originalSizeKB - optimizedSizeKB;
    const savedMB = savedKB / 1024;
    const percentSaved = (savedKB / originalSizeKB) * 100;

    return {
        savedKB: Math.round(savedKB),
        savedMB: parseFloat(savedMB.toFixed(2)),
        percentSaved: Math.round(percentSaved)
    };
};
