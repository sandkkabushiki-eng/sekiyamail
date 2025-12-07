import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

// Groq API (OpenAI互換)
const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

const blockFieldSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string(),
});

const infoBlockSchema = z.object({
  id: z.string(),
  type: z.enum(["breakfast", "dinner", "transfer", "checkin", "massage", "spa", "cake", "service", "decoration", "meal_add", "lunch", "facility", "bar", "other"]),
  title: z.string().optional(),
  fields: z.array(blockFieldSchema),
});

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("translate"),
    customerText: z.string().min(1, "customerText is required"),
  }),
  z.object({
    action: z.literal("translate-to-english"),
    japaneseText: z.string().min(1, "japaneseText is required"),
  }),
  z.object({
    action: z.literal("generate"),
    customerText: z.string().min(1, "customerText is required"),
    translatedCustomerText: z.string().optional(),
    infoBlocks: z.array(infoBlockSchema).optional(),
    notes: z.string().optional(),
    tone: z.enum(["polite", "light", "casual"]).optional().default("polite"),
    length: z.enum(["short", "medium", "long"]).optional().default("short"),
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
  bar: "Bar",
  other: "その他",
};

function formatInfoBlocks(blocks: z.infer<typeof infoBlockSchema>[]): string {
  if (!blocks || blocks.length === 0) return "";

  const formatted = blocks
    .filter((block) => block.fields.some((f) => f.value.trim()))
    .map((block) => {
      const label = block.title || blockLabels[block.type] || block.type;
      const fields = block.fields
        .filter((f) => f.value.trim())
        .map((f) => `${f.label}: ${f.value}`)
        .join("、");
      return `- ${label}: ${fields}`;
    })
    .join("\n");

  if (!formatted) return "";

  return "\n\n# 利用可能な情報（返信に使用すること）\n" + formatted;
}

function ensureClient() {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not set");
  }
  return client;
}

// Groqで使用するモデル (Llama 3.3 70B - 高品質・高速)
const MODEL = "llama-3.3-70b-versatile";

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
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "あなたはプロの翻訳者です。常に自然で丁寧な日本語に翻訳し、原文のニュアンスを損なわないでください。出力は必ず指定されたJSON形式で返してください。",
          },
          {
            role: "user",
            content: `以下のテキストを日本語に翻訳してください。

# 原文
${payload.customerText}

# 出力フォーマット（この形式で出力してください）
{"language":"<原文の言語名>","translatedText":"<自然な日本語訳>"}`,
          },
        ],
      });

      const outputText = response.choices[0]?.message?.content ?? "";

      try {
        // JSON部分を抽出
        const jsonMatch = outputText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          // JSONが見つからない場合、原文をそのまま返す
          return NextResponse.json({
            translatedText: payload.customerText,
            detectedLanguage: "日本語",
          });
        }
        const data = JSON.parse(jsonMatch[0]);
        return NextResponse.json({
          translatedText: data.translatedText,
          detectedLanguage: data.language,
        });
      } catch (error) {
        console.error("Failed to parse translation result", error, outputText);
        return NextResponse.json({
          translatedText: payload.customerText,
          detectedLanguage: "不明",
        });
      }
    }

    if (payload.action === "translate-to-english") {
      const response = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are a professional translator. Translate the following Japanese business email reply into natural, professional English. Maintain the same tone and formality level. Output only the translated text without any explanations.",
          },
          {
            role: "user",
            content: `Translate this Japanese business email reply into English:\n\n${payload.japaneseText}`,
          },
        ],
      });

      const translatedText = response.choices[0]?.message?.content?.trim() ?? "";

      return NextResponse.json({
        translatedText: translatedText,
      });
    }

    // generateアクションの処理
    const baseText = payload.translatedCustomerText?.trim()
      ? payload.translatedCustomerText.trim()
      : payload.customerText.trim();

    const notesText = payload.notes?.trim() || "";
    
    // ブロック情報をフォーマット
    const infoBlocksText = payload.infoBlocks && payload.infoBlocks.length > 0
      ? formatInfoBlocks(payload.infoBlocks)
      : "";

    const fullPrompt = `# タスク
お客様からのメールに対する、丁寧で心のこもった返信文を作成してください。

# お客様からのメール
${baseText}

# 返信の要点
${notesText || "（要点なし）"}
${infoBlocksText}

# 返信スタイル
${toneGuides[payload.tone]}

# 作成ルール（重要度順）
1. 【最重要】「利用可能な情報」に記載された料金・時間・条件などは、一字一句正確にそのまま使用すること（絶対に変更・省略しない）
2. お客様の質問・要望を正確に理解し、それに対して的確かつ丁寧に回答する
3. 温かみのある丁寧な表現を心がける（「〜いただけます」「〜ございます」など）
4. 本文のみを記載（件名・署名は不要）
5. 「お世話になっております」などの冒頭挨拶は省略
6. 簡潔でありながらも、お客様に寄り添った返答にする

# 例
お客様メール: 「朝食を追加したいのですが可能ですか？」
要点: 「可能です🍳朝食」
利用可能な情報: 朝食 - 料金: 4,400円、時間: 7:45~10:00 (LO 9:30)、備考: 前日20:30まで予約可

→ 良い返信例:
「朝食の追加、承知いたしました。
料金は4,400円、お時間は7:45〜10:00（ラストオーダー9:30）となっております。
前日の20:30までにご予約いただけますと幸いです。
ご不明な点がございましたら、お気軽にお申し付けくださいませ。」

返信文のみを出力してください（説明不要）:`;

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "あなたはホテル・レストランのプロのメール担当者です。お客様の質問に対して、温かみのある丁寧な言葉遣いで回答します。【最重要ルール】提供された情報ブロックの内容（料金、時間、条件など）は一字一句正確にそのまま使用し、絶対に変更・省略・推測しないでください。返信文のみを出力し、説明は不要です。",
        },
        {
          role: "user",
          content: fullPrompt,
        },
      ],
    });

    const replyText = response.choices[0]?.message?.content?.trim() ?? "";

    if (!replyText) {
      console.error("[DEBUG] Empty response from Groq");
      return NextResponse.json(
        { error: "返信文の生成に失敗しました。AIからの応答が空でした。" },
        { status: 500 },
      );
    }

    // 英語翻訳を生成
    let englishTranslation = "";
    try {
      const translationResponse = await openai.chat.completions.create({
        model: MODEL,
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
    return NextResponse.json(
      {
        error: message,
        ...(process.env.NODE_ENV === "development" && stack
          ? { stack }
          : {}),
      },
      { status: 500 },
    );
  }
}
