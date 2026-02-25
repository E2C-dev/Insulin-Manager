import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const API_KEY = process.env.GEMINI_API_KEY;
const OUTPUT_DIR = join(process.cwd(), "client/public/images");

mkdirSync(OUTPUT_DIR, { recursive: true });

interface ImageTask {
  filename: string;
  prompt: string;
  aspectRatio?: string;
}

const images: ImageTask[] = [
  // ユーザーアバター（ヒーローセクション）
  {
    filename: "avatar-user-1.png",
    prompt:
      "Professional headshot portrait of a Japanese woman in her 30s, pregnant or postpartum look, warm friendly smile, clean white background, photorealistic, soft lighting, circular crop style",
    aspectRatio: "1:1",
  },
  {
    filename: "avatar-user-2.png",
    prompt:
      "Professional headshot portrait of a Japanese man in his 40s, healthy looking, confident friendly smile, clean white background, photorealistic, soft lighting",
    aspectRatio: "1:1",
  },
  {
    filename: "avatar-user-3.png",
    prompt:
      "Professional headshot portrait of a Japanese person in their 50s, mature, kind expression, clean white background, photorealistic, soft natural lighting",
    aspectRatio: "1:1",
  },
  {
    filename: "avatar-user-4.png",
    prompt:
      "Professional headshot portrait of a Japanese elderly person in their 60s, gentle warm smile, clean white background, photorealistic, soft natural lighting",
    aspectRatio: "1:1",
  },

  // ユーザーの声（テスティモニアル）
  {
    filename: "testimonial-avatar-1.png",
    prompt:
      "Professional headshot portrait of a Japanese woman in her 30s, warm and approachable smile, casual neat clothing, clean white or light background, photorealistic, high quality",
    aspectRatio: "1:1",
  },
  {
    filename: "testimonial-avatar-2.png",
    prompt:
      "Professional headshot portrait of a Japanese man in his 40s, confident friendly expression, casual business attire, clean white or light background, photorealistic, high quality",
    aspectRatio: "1:1",
  },
  {
    filename: "testimonial-avatar-3.png",
    prompt:
      "Professional headshot portrait of a Japanese person in their 50s, mature dignified expression, clean light background, photorealistic, high quality",
    aspectRatio: "1:1",
  },
  {
    filename: "testimonial-avatar-4.png",
    prompt:
      "Professional headshot portrait of a Japanese elderly person in their 60s, kind trustworthy expression, clean light background, photorealistic, high quality",
    aspectRatio: "1:1",
  },

  // ステップ画像（使い方説明）
  {
    filename: "step-1-preset-setup.png",
    prompt:
      "Clean modern smartphone app UI screenshot showing insulin preset setup screen. Japanese medical app interface with insulin type selection, dosage settings, clean blue and white design, minimal flat illustration style",
    aspectRatio: "4:3",
  },
  {
    filename: "step-2-glucose-input.png",
    prompt:
      "Clean modern smartphone app UI screenshot showing blood glucose value input form. Japanese medical app with number input fields, morning/evening/night meal timing tabs, clean blue and white design, minimal flat illustration style",
    aspectRatio: "4:3",
  },
  {
    filename: "step-3-auto-calculate.png",
    prompt:
      "Clean modern smartphone app UI screenshot showing automatic insulin dose calculation result screen. Japanese medical app displaying calculated insulin units, green checkmark, clean blue and white design, minimal flat illustration style",
    aspectRatio: "4:3",
  },

  // 問題提示（手書きノート）
  {
    filename: "problem-notebook.png",
    prompt:
      "Realistic photo of a handwritten Japanese medical notebook for blood glucose and insulin recording. Open spiral notebook with handwritten numbers, tables, date columns, glucose values, insulin units in Japanese. Slightly messy real-world feel, warm lighting on wooden desk",
    aspectRatio: "4:3",
  },

  // サービス紹介画像
  {
    filename: "service-meal-delivery.png",
    prompt:
      "Professional food photography of a healthy low-carb Japanese diabetes-friendly meal in a delivery container. Balanced bento meal with vegetables, protein, rice alternative, colorful and appetizing, white background, commercial food photography style",
    aspectRatio: "16:9",
  },
  {
    filename: "service-glucose-meter.png",
    prompt:
      "Professional product photo of a modern blood glucose meter and test strips on clean white background. Freestyle Libre style CGM sensor or traditional glucose meter, clean medical product photography, soft shadow",
    aspectRatio: "16:9",
  },
  {
    filename: "service-nutritionist.png",
    prompt:
      "Professional photo of a friendly Japanese female nutritionist or dietitian in white coat, having an online video consultation on laptop, smiling and helpful expression, bright modern medical office background",
    aspectRatio: "16:9",
  },

  // 開発者アバター
  {
    filename: "developer-avatar.png",
    prompt:
      "Professional headshot portrait of a young Japanese software developer, friendly intelligent expression, casual t-shirt or hoodie, clean background, photorealistic, high quality",
    aspectRatio: "1:1",
  },
];

async function generateImage(
  prompt: string,
  aspectRatio: string = "1:1"
): Promise<Buffer> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as {
    predictions: Array<{ bytesBase64Encoded: string; mimeType: string }>;
  };

  if (!data.predictions || data.predictions.length === 0) {
    throw new Error("No image returned from API");
  }

  return Buffer.from(data.predictions[0].bytesBase64Encoded, "base64");
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  if (!API_KEY) {
    console.error("GEMINI_API_KEY が設定されていません");
    process.exit(1);
  }

  console.log(`出力先: ${OUTPUT_DIR}`);
  console.log(`生成する画像数: ${images.length}`);
  console.log("---");

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < images.length; i++) {
    const { filename, prompt, aspectRatio } = images[i];
    const outputPath = join(OUTPUT_DIR, filename);

    console.log(`[${i + 1}/${images.length}] ${filename} を生成中...`);

    try {
      const imageBuffer = await generateImage(prompt, aspectRatio ?? "1:1");
      writeFileSync(outputPath, imageBuffer);
      console.log(`  ✓ 保存完了: ${outputPath} (${imageBuffer.length} bytes)`);
      successCount++;
    } catch (err) {
      console.error(`  ✗ 失敗: ${err instanceof Error ? err.message : err}`);
      failCount++;
    }

    // Rate limit対策: 各リクエスト間に1秒待機
    if (i < images.length - 1) {
      await sleep(1000);
    }
  }

  console.log("---");
  console.log(`完了: 成功=${successCount}, 失敗=${failCount}`);
}

main();
