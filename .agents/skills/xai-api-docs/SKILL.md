---
name: xai-api-docs
description: "Reference guide for xAI (Grok) Image Generation API integrations and endpoints."
---

# xAI Image Generation API Documentation

Use this skill as a technical reference guide when integrating or modifying xAI image generation features within the codebase.

## 1. Authentication
All requests to the xAI API must include an `Authorization` header with a Bearer token.
* **Header:** `Authorization: Bearer <XAI_API_KEY>`
* **API Key Source:** Retrieved from `.env.local` as `XAI_API_KEY`.

## 2. Image Generation Endpoint
The API exposes an OpenAI-compatible REST endpoint for generating new images from scratch.
* **URL:** `https://api.x.ai/v1/images/generations`
* **HTTP Method:** `POST`
* **Content-Type:** `application/json`

## 3. Recommended Model
* **Model Name:** `grok-imagine-image-quality`
> [!IMPORTANT]
> `grok-imagine-image-pro` is deprecated as of May 15, 2026. Use `grok-imagine-image-quality` for all new image generation requests.

## 4. Supported Parameters

The request payload accepts the following fields:

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| **`model`** | `string` | Yes | Use `grok-imagine-image-quality`. |
| **`prompt`** | `string` | Yes | Detailed description of the image to generate. |
| **`aspect_ratio`** | `string` | No | Defines image dimensions. Supported values: `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `3:2`, `2:3`, `2:1`, `1:2`, `19.5:9`, `9:19.5`, `20:9`, `9:20`, `auto`. |
| **`resolution`** | `string` | No | Target resolution. Supported: `"1k"`, `"2k"`. |
| **`response_format`** | `string` | No | Format of the returned assets. Use `"b64_json"` for base64 strings or `"url"` for CDN links. |
| **`image_urls`** | `array of strings` | No | Up to 3 source image URLs or base64 data URIs to edit/merge. |
| **`n`** | `number` | No | Number of image variations to generate (e.g., batch size). |

## 5. TypeScript Integration Example

Below is a standard integration snippet using the native `fetch` API for base64 responses:

```typescript
const generateImageXAI = async (
  prompt: string, 
  aspectRatio: string,
  imageUrls?: string[],
  resolution: string = "2k"
): Promise<string> => {
  const xaiKey = process.env.XAI_API_KEY;
  if (!xaiKey) {
    throw new Error("XAI_API_KEY is not defined");
  }

  const response = await fetch('https://api.x.ai/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${xaiKey}`
    },
    body: JSON.stringify({
      model: 'grok-imagine-image-quality',
      prompt: prompt,
      aspect_ratio: aspectRatio,
      resolution: resolution,
      response_format: 'b64_json',
      image_urls: imageUrls // supports up to 3 image inputs
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`xAI API returned status ${response.status}: ${errText}`);
  }

  const resData = await response.json();
  const b64Data = resData?.data?.[0]?.b64_json;
  if (b64Data) {
    return `data:image/png;base64,${b64Data}`;
  }
  throw new Error("No image data found in xAI response");
};
```

## 6. Files API Integration
The Imagine API integrates with the Files API in two directions:
* **Inputs:** You can pass a `file_id` (from Files storage) instead of public URLs or base64-encoded image/video payload.
* **Outputs:** Use `storage_options` to save generated images directly into private storage (e.g., `storage_options={"filename": "filename.jpg"}`).
* Chained operations can reference `file_id` from a previous output (e.g., `image_file_id` inside image edit API).

## 7. Video Generation (grok-imagine-video)
For animating images to video, use:
* **Model:** `grok-imagine-video`
* **Input Parameters:**
  * `image_file_id` (the ID of the starting frame) or image URLs.
  * `duration` (e.g., in seconds).
  * `prompt` (camera move instructions or visual target descriptions).

## 8. Multi-Image Editing (Character Consistency)
For character consistency where up to three player/coach reference images need to be merged into a single scene, pass them via the `image_urls` parameter.
* **Parameter:** `image_urls` (array of strings - public URLs or base64-encoded data URIs)
* **Rule:** Max 3 source images.
