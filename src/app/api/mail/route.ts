import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const blockFieldSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string(),
  includeInReply: z.boolean().optional().default(true),
});

const infoBlockSchema = z.object({
  id: z.string(),
  type: z.enum(["breakfast", "dinner", "transfer", "checkin", "massage", "spa", "cake", "service", "decoration", "meal_add", "lunch", "facility", "other"]),
  title: z.string().optional(),
  fields: z.array(blockFieldSchema),
});

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("translate"),
    customerText: z.string().min(1, "customerText is required"),
  }),
  z.object({
    action: z.literal("generate"),
    customerText: z.string().min(1, "customerText is required"),
    translatedCustomerText: z.string().optional(),
    infoBlocks: z.array(infoBlockSchema).optional(),
    notes: z.string().optional(),
    tone: z.enum(["polite", "light", "casual"]),
    length: z.enum(["short", "medium", "long"]),
  }),
]);

const toneGuides: Record<"polite" | "light" | "casual", string> = {
  polite:
    "ビジネスメールとして丁寧で落ち着いた敬語を用い、誠実で落ち着いた印象を与えてください。",
  light:
    "ビジネスの礼儀を守りつつも、親しみやすく柔らかい表現でコミュニケーションしてください。",
  casual:
    "カジュアルかつフレンドリーに、相手との距離を縮める言葉遣いで返信してください。ただし失礼にはならないように配慮してください。",
};

const lengthGuides: Record<"short" | "medium" | "long", string> = {
  short:
    "全体で4〜5文程度にまとめ、要点だけを手短に伝えてください。",
  medium:
    "全体で6〜8文ほど、2段落程度で適度に情報量を持たせてください。",
  long:
    "全体で8〜12文程度、必要に応じて箇条書きも用いて詳細に説明してください。",
};

const blockLabels: Record<string, string> = {
  breakfast: "朝食",
  dinner: "夕食",
  transfer: "送迎",
  checkin: "チェックイン/アウト",
  massage: "マッサージ",
  spa: "スパ",
  cake: "ケーキ",
  service: "サービス",
  decoration: "装飾",
  meal_add: "食事追加",
  lunch: "ランチ",
  facility: "施設利用",
  other: "その他",
};

function formatInfoBlocks(blocks: z.infer<typeof infoBlockSchema>[]): string {
  if (!blocks || blocks.length === 0) return "";

  const formatted = blocks
    .map((block, index) => {
      const label = block.title || blockLabels[block.type] || block.type;
      const parts: string[] = [`[${index + 1}] ${label}`];

      block.fields.forEach((field) => {
        // includeInReplyがfalseの場合は除外（デフォルトはtrue）
        const shouldInclude = field.includeInReply ?? true;
        if (shouldInclude && field.value.trim()) {
          parts.push(`  ${field.label}: ${field.value}`);
        }
      });

      return parts.join("\n");
    })
    .join("\n\n");

  const header = "========================================\n【必須情報：返信文に必ず含めること】\n========================================\n\n";
  const instruction = "以下の情報を正確に返信文に組み込んでください。\n各ブロックの情報は、そのままの数値・時間・料金・場所などを使用してください。\n\n";
  const footer = "\n\n========================================\n【必須情報ここまで】\n========================================\n\n";

  return "\n\n" + header + instruction + formatted + footer;
}

function ensureClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return client;
}

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const parsed = schema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const payload = parsed.data;
    const openai = ensureClient();

    if (payload.action === "translate") {
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL_TRANSLATE ?? "gpt-4o-mini", 
        messages: [
          {
            role: "system",
            content:
              "あなたはプロの翻訳者です。常に自然で丁寧な日本語に翻訳し、原文のニュアンスを損なわないでください。出力は必ずJSONで返してください。",
          },
          {
            role: "user",
            content: `# 原文\n${payload.customerText}\n\n# 出力フォーマット\n{"language":"<原文の言語名>","translatedText":"<自然な日本語訳>"}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "translation",
            schema: {
              type: "object",
              properties: {
                language: { type: "string" },
                translatedText: { type: "string" },
              },
              required: ["language", "translatedText"],
              additionalProperties: false,
            },
          },
        },
      });

      const outputText = response.choices[0]?.message?.content ?? "";

      try {
        const data = JSON.parse(outputText);
        return NextResponse.json({
          translatedText: data.translatedText,
          detectedLanguage: data.language,
        });
      } catch (error) {
        console.error("Failed to parse translation result", error, outputText);
        return NextResponse.json(
          {
            error: "Failed to parse translation result",
            raw: outputText,
          },
          { status: 502 },
        );
      }
    }

    const baseText = payload.translatedCustomerText?.trim()
      ? payload.translatedCustomerText.trim()
      : payload.customerText.trim();

    // デバッグログ: infoBlocksの受信内容を確認
    console.log("[DEBUG] Received infoBlocks:", JSON.stringify(payload.infoBlocks, null, 2));
    console.log("[DEBUG] infoBlocks count:", payload.infoBlocks?.length || 0);

    const infoBlocksText = payload.infoBlocks
      ? formatInfoBlocks(payload.infoBlocks)
      : "";

    // デバッグログ: formatInfoBlocksの出力を確認
    console.log("[DEBUG] Formatted infoBlocks text:", infoBlocksText);

    const fullPrompt = `# お客様からのメール（参照用）
${baseText}
${infoBlocksText}
# 社内メモ（返信に盛り込みたい要点）
${payload.notes?.trim() || "特になし"}

# 返信スタイル
${toneGuides[payload.tone]}
${lengthGuides[payload.length]}

# 出力条件（厳守）
1. 本文のみを記載（件名・署名・挨拶文は不要）
2. 「お世話になっております」「今後ともよろしくお願いします」などの定型句は省略
3. **「必須情報」セクションの全ての情報を、数値・時間・料金・場所などを正確にそのまま使用して返信文に組み込むこと**
4. 情報を推測や変更せず、提供されたデータを正確に反映すること
5. 社内メモの内容も反映させること
6. 必要最小限の情報だけを簡潔に記載
7. 余計な確認や質問は追加しない
8. 要点だけを端的に伝える

# 重要な注意
- 「必須情報」セクションに記載された料金は、そのままの数値を使用してください（例: 4,400円 → 「4,400円」）
- 時間もそのまま使用してください（例: 7:45~10:00 → 「7時45分から10時まで」）
- 場所やその他の情報も、提供されたデータを正確にそのまま使用してください
- 情報を推測したり、変更したりしないでください`;

    // デバッグログ: プロンプト全体を確認
    console.log("[DEBUG] Full prompt:", fullPrompt);

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL_REPLY ?? "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "あなたは日本語のメール文面を作成するプロのアシスタントです。\n\n重要な指示:\n1. 「必須情報」セクションに記載された情報は、数値・時間・料金・場所などを正確にそのまま使用して返信文に組み込むこと\n2. 情報を推測や変更せず、提供されたデータを正確に反映すること\n3. 簡潔で要点を押さえた返答を作成すること",
        },
        {
          role: "user",
          content: fullPrompt,
        },
      ],
    });

    const replyText =
      response.choices[0]?.message?.content?.trim() ?? "";

    if (!replyText) {
      console.error("[DEBUG] Empty response from OpenAI:", response);
      return NextResponse.json(
        { error: "返信文の生成に失敗しました。AIからの応答が空でした。" },
        { status: 500 },
      );
    }

    // 英語翻訳を生成
    let englishTranslation = "";
    try {
      const translationResponse = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL_TRANSLATE ?? "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a professional translator. Translate the following Japanese business email reply into natural, professional English. Maintain the same tone and formality level. Output only the translated text without any explanations.",
          },
          {
            role: "user",
            content: `Translate this Japanese business email reply into English:\n\n${replyText}`,
          },
        ],
      });

      englishTranslation =
        translationResponse.choices[0]?.message?.content?.trim() ?? "";
    } catch (error) {
      console.error("[DEBUG] Translation error:", error);
      // 翻訳エラーは無視して、日本語のみを返す
    }

    return NextResponse.json({
      reply: replyText,
      englishTranslation: englishTranslation || undefined,
    });
  } catch (error) {
    console.error("/api/mail error", error);
    const message =
      error instanceof Error ? error.message : "Unexpected server error";
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[DEBUG] Error stack:", stack);
    const status = message.includes("OPENAI_API_KEY") ? 500 : 500;
    return NextResponse.json(
      {
        error: message,
        ...(process.env.NODE_ENV === "development" && stack
          ? { stack }
          : {}),
      },
      { status },
    );
  }
}

