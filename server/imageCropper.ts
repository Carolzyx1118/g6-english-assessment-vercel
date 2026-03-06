import sharp from "sharp";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";

/**
 * Represents a detected image region within a larger image.
 */
interface ImageRegion {
  /** Description of what this image region contains */
  description: string;
  /** Suggested question/option it belongs to (e.g., "Q1 option A", "Q5 scene image") */
  target: string;
  /** Bounding box as percentage of the full image (0-100) */
  x: number; // left edge %
  y: number; // top edge %
  w: number; // width %
  h: number; // height %
}

/**
 * Result of cropping a region from an image.
 */
export interface CroppedImage {
  /** The S3 URL of the cropped image */
  url: string;
  /** Description of the image content */
  description: string;
  /** Suggested target (which question/option this belongs to) */
  target: string;
  /** Original source image URL */
  sourceUrl: string;
}

/**
 * Use AI vision to detect individual image regions within an uploaded exam page image.
 * Returns bounding boxes as percentages of the full image dimensions.
 */
async function detectImageRegions(imageUrl: string): Promise<ImageRegion[]> {
  const prompt = `You are analyzing an exam paper image. Your task is to identify ALL distinct visual elements (pictures, illustrations, diagrams, photos) that are part of the exam questions.

For each distinct image/picture you find, provide its bounding box as a percentage of the full image dimensions.

RULES:
- Only identify actual pictures/illustrations/photos used in questions, NOT text blocks or blank spaces
- For picture-based MCQ questions, identify EACH option image separately (e.g., option A image, option B image, etc.)
- For scene images or reading comprehension images, identify the whole scene
- Coordinates are percentages (0-100) of the full image: x=left edge, y=top edge, w=width, h=height
- Be generous with bounding boxes - include a small margin around each image to avoid cutting off edges
- The "target" field should describe which question/option this image belongs to (e.g., "Q1 option A", "Q3 scene image", "vocabulary picture 2")

Return a JSON array of detected regions. If there are no distinct images (only text), return an empty array [].

Example output:
[
  {"description": "picture of a cat sitting", "target": "Q1 option A", "x": 5, "y": 10, "w": 20, "h": 25},
  {"description": "picture of a dog running", "target": "Q1 option B", "x": 30, "y": 10, "w": 20, "h": 25}
]`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: prompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Please identify all distinct images/pictures in this exam paper page and provide their bounding boxes." },
            { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "image_regions",
          strict: false,
          schema: {
            type: "object",
            properties: {
              regions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    description: { type: "string" },
                    target: { type: "string" },
                    x: { type: "number" },
                    y: { type: "number" },
                    w: { type: "number" },
                    h: { type: "number" },
                  },
                  required: ["description", "target", "x", "y", "w", "h"],
                },
              },
            },
            required: ["regions"],
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (typeof content === "string") {
      const parsed = JSON.parse(content);
      const regions = parsed.regions || parsed || [];
      // Validate and clamp coordinates
      return (Array.isArray(regions) ? regions : []).map((r: any) => ({
        description: r.description || "",
        target: r.target || "",
        x: Math.max(0, Math.min(100, Number(r.x) || 0)),
        y: Math.max(0, Math.min(100, Number(r.y) || 0)),
        w: Math.max(1, Math.min(100, Number(r.w) || 10)),
        h: Math.max(1, Math.min(100, Number(r.h) || 10)),
      }));
    }
    return [];
  } catch (err) {
    console.error("Failed to detect image regions:", err);
    return [];
  }
}

/**
 * Download an image from a URL and return it as a Buffer.
 */
async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download image: ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Crop a region from an image buffer using sharp.
 * Coordinates are in percentages (0-100).
 */
async function cropRegion(
  imageBuffer: Buffer,
  region: ImageRegion
): Promise<Buffer> {
  const metadata = await sharp(imageBuffer).metadata();
  const imgWidth = metadata.width || 1;
  const imgHeight = metadata.height || 1;

  // Convert percentage coordinates to pixels
  const left = Math.round((region.x / 100) * imgWidth);
  const top = Math.round((region.y / 100) * imgHeight);
  const width = Math.round((region.w / 100) * imgWidth);
  const height = Math.round((region.h / 100) * imgHeight);

  // Clamp to image bounds
  const clampedLeft = Math.max(0, Math.min(left, imgWidth - 1));
  const clampedTop = Math.max(0, Math.min(top, imgHeight - 1));
  const clampedWidth = Math.min(width, imgWidth - clampedLeft);
  const clampedHeight = Math.min(height, imgHeight - clampedTop);

  if (clampedWidth < 1 || clampedHeight < 1) {
    throw new Error(`Invalid crop region: ${JSON.stringify(region)}`);
  }

  return sharp(imageBuffer)
    .extract({ left: clampedLeft, top: clampedTop, width: clampedWidth, height: clampedHeight })
    .png()
    .toBuffer();
}

/**
 * Process a single uploaded image: detect regions, crop each one, upload to S3.
 * Returns an array of cropped image URLs with their descriptions and targets.
 */
export async function processExamImage(imageUrl: string): Promise<CroppedImage[]> {
  console.log(`[ImageCropper] Processing image: ${imageUrl}`);

  // Step 1: Detect image regions using AI vision
  const regions = await detectImageRegions(imageUrl);
  console.log(`[ImageCropper] Detected ${regions.length} regions`);

  if (regions.length === 0) {
    return [];
  }

  // Step 2: Download the source image
  const imageBuffer = await downloadImage(imageUrl);

  // Step 3: Crop each region and upload to S3
  const results: CroppedImage[] = [];
  for (let i = 0; i < regions.length; i++) {
    const region = regions[i];
    try {
      const croppedBuffer = await cropRegion(imageBuffer, region);
      const suffix = Math.random().toString(36).slice(2, 10);
      const key = `paper-crops/${suffix}-region-${i}.png`;
      const { url } = await storagePut(key, croppedBuffer, "image/png");

      results.push({
        url,
        description: region.description,
        target: region.target,
        sourceUrl: imageUrl,
      });
      console.log(`[ImageCropper] Cropped region ${i}: ${region.target} -> ${url}`);
    } catch (err) {
      console.error(`[ImageCropper] Failed to crop region ${i}:`, err);
    }
  }

  return results;
}

/**
 * Process multiple uploaded images and return all cropped results.
 */
export async function processAllExamImages(imageUrls: string[]): Promise<CroppedImage[]> {
  const allResults: CroppedImage[] = [];
  for (const url of imageUrls) {
    const results = await processExamImage(url);
    allResults.push(...results);
  }
  return allResults;
}
