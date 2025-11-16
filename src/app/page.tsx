"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { InfoBlock, BlockType, blockTemplates } from "./types";
import { InfoBlockEditor } from "./components/InfoBlockEditor";

const toneOptions = [
  { value: "polite" as const, label: "ビジネス丁寧" },
  { value: "light" as const, label: "ややカジュアル" },
  { value: "casual" as const, label: "フレンドリー" },
];

const lengthOptions = [
  { value: "short" as const, label: "短め" },
  { value: "medium" as const, label: "ふつう" },
  { value: "long" as const, label: "しっかり" },
];

export default function Home() {
  const [customerText, setCustomerText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
  const [infoBlocks, setInfoBlocks] = useState<InfoBlock[]>([]);
  const [notes, setNotes] = useState("");
  const [tone, setTone] = useState<(typeof toneOptions)[number]["value"]>(
    toneOptions[0]?.value ?? "polite",
  );
  const [length, setLength] = useState<(typeof lengthOptions)[number]["value"]>(
    lengthOptions[1]?.value ?? "medium",
  );
  const [reply, setReply] = useState("");
  const [englishTranslation, setEnglishTranslation] = useState("");
  const [translateLoading, setTranslateLoading] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedJapanese, setCopiedJapanese] = useState(false);
  const [copiedEnglish, setCopiedEnglish] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const translateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!reply) {
      setCopiedJapanese(false);
      setCopiedEnglish(false);
    }
  }, [reply]);

  // クリーンアップ: コンポーネントがアンマウントされた時にタイマーをクリア
  useEffect(() => {
    return () => {
      if (translateTimeoutRef.current) {
        clearTimeout(translateTimeoutRef.current);
      }
    };
  }, []);

  const disabledGenerate = useMemo(() => {
    return !customerText.trim() || generateLoading;
  }, [customerText, generateLoading]);

  const handleTranslate = useCallback(async () => {
    if (!customerText.trim()) {
      setErrorMessage("お客様メールを入力してください。");
      return;
    }
    setTranslateLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "translate",
          customerText,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error ?? "翻訳に失敗しました。");
      }

      const data = (await response.json()) as {
        translatedText: string;
        detectedLanguage: string;
      };

      setTranslatedText(data.translatedText);
      setDetectedLanguage(data.detectedLanguage);
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "翻訳中に不明なエラーが発生しました。",
      );
    } finally {
      setTranslateLoading(false);
    }
  }, [customerText]);

  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

  const toggleOrAddBlock = useCallback((type: BlockType) => {
    const existingBlock = infoBlocks.find((b) => b.type === type);
    
    if (existingBlock) {
      // 既に存在する場合は削除
      setInfoBlocks((prev) => prev.filter((b) => b.id !== existingBlock.id));
      if (editingBlockId === existingBlock.id) {
        setEditingBlockId(null);
      }
    } else {
      // 新規作成
      const template = blockTemplates[type];
      const newBlock: InfoBlock = {
        id: `block-${Date.now()}`,
        type,
        title: template.label,
        fields: template.defaultFields.map((df, idx) => ({
          id: `field-${Date.now()}-${idx}`,
          label: df.label,
          value: "",
          includeInReply: true, // デフォルトで返信文に含める
        })),
      };
      setInfoBlocks((prev) => [...prev, newBlock]);
      setEditingBlockId(newBlock.id);
    }
  }, [infoBlocks, editingBlockId]);

  const updateBlock = useCallback((id: string, updatedBlock: InfoBlock) => {
    setInfoBlocks((prev) =>
      prev.map((block) => (block.id === id ? updatedBlock : block)),
    );
  }, []);

  const deleteBlock = useCallback((id: string) => {
    setInfoBlocks((prev) => prev.filter((block) => block.id !== id));
    if (editingBlockId === id) {
      setEditingBlockId(null);
    }
  }, [editingBlockId]);

  const handleGenerate = useCallback(async () => {
    if (!customerText.trim()) {
      setErrorMessage("お客様メールを入力してください。");
      return;
    }
    setGenerateLoading(true);
    setErrorMessage(null);
    try {
      const requestBody = {
        action: "generate" as const,
        customerText,
        infoBlocks,
        notes,
        tone,
        length,
        ...(translatedText.trim()
          ? { translatedCustomerText: translatedText }
          : {}),
      };

      // デバッグログ: 送信データを確認
      console.log("[DEBUG] Sending request body:", JSON.stringify(requestBody, null, 2));
      console.log("[DEBUG] infoBlocks count:", infoBlocks.length);
      console.log("[DEBUG] infoBlocks details:", infoBlocks.map(b => ({
        type: b.type,
        title: b.title,
        fieldsCount: b.fields.length,
        fieldsWithValues: b.fields.filter(f => f.value.trim()).length
      })));

      const response = await fetch("/api/mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error("[DEBUG] API error response:", error);
        throw new Error(error.error ?? "返信文の生成に失敗しました。");
      }

      const data = (await response.json()) as {
        reply: string;
        englishTranslation?: string;
      };
      console.log("[DEBUG] Received reply:", data.reply);
      console.log("[DEBUG] Received English translation:", data.englishTranslation);
      setReply(data.reply);
      setEnglishTranslation(data.englishTranslation || "");
    } catch (error) {
      console.error("[DEBUG] Generate error:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "返信生成中に不明なエラーが発生しました。",
      );
    } finally {
      setGenerateLoading(false);
    }
  }, [customerText, translatedText, infoBlocks, notes, tone, length]);

  const handleCopyJapanese = useCallback(async () => {
    if (!reply) return;
    try {
      await navigator.clipboard.writeText(reply);
      setCopiedJapanese(true);
      window.setTimeout(() => setCopiedJapanese(false), 2000);
    } catch (error) {
      console.error(error);
      setErrorMessage("コピーに失敗しました。手動で選択してください。");
    }
  }, [reply]);

  const handleCopyEnglish = useCallback(async () => {
    if (!englishTranslation) return;
    try {
      await navigator.clipboard.writeText(englishTranslation);
      setCopiedEnglish(true);
      window.setTimeout(() => setCopiedEnglish(false), 2000);
    } catch (error) {
      console.error(error);
      setErrorMessage("コピーに失敗しました。手動で選択してください。");
    }
  }, [englishTranslation]);

  const translateToEnglish = useCallback(async (japaneseText: string) => {
    if (!japaneseText.trim()) {
      setEnglishTranslation("");
      return;
    }

    setIsTranslating(true);
    try {
      const response = await fetch("/api/mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "translate-to-english",
          japaneseText: japaneseText,
        }),
      });

      if (!response.ok) {
        throw new Error("翻訳に失敗しました");
      }

      const data = await response.json();
      setEnglishTranslation(data.translatedText || "");
    } catch (error) {
      console.error("自動翻訳エラー:", error);
      // エラーは無視（ユーザーに表示しない）
    } finally {
      setIsTranslating(false);
    }
  }, []);

  const handleReplyChange = useCallback((value: string) => {
    setReply(value);

    // 既存のタイマーをクリア
    if (translateTimeoutRef.current) {
      clearTimeout(translateTimeoutRef.current);
    }

    // 1秒後に自動翻訳を実行
    translateTimeoutRef.current = setTimeout(() => {
      translateToEnglish(value);
    }, 1000);
  }, [translateToEnglish]);

  return (
    <div className="min-h-screen bg-slate-100 py-10">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 rounded-2xl bg-white p-8 shadow-lg">
        <header className="space-y-3">
          <p className="text-sm font-semibold text-sky-600">Mail Reply Studio</p>
          <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
            メール返信文ジェネレーター
          </h1>
          <p className="text-sm text-slate-500">
            お客様から届いたメールを貼り付け、要点メモと口調・ボリュームを選ぶだけで、即座に自然な日本語の返信文を作成します。
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label
                htmlFor="customer"
                className="text-sm font-semibold text-slate-700"
              >
                お客様メール
              </label>
              <button
                type="button"
                onClick={handleTranslate}
                disabled={translateLoading}
                className="rounded-full bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {translateLoading ? "翻訳中..." : "日本語に翻訳"}
              </button>
            </div>
            <textarea
              id="customer"
              value={customerText}
              onChange={(event) => setCustomerText(event.target.value)}
              placeholder="お客様から届いたメール本文を貼り付けてください"
              className="min-h-[240px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-800 shadow-inner outline-none ring-slate-300 transition focus:ring"
            />
            {detectedLanguage && (
              <p className="text-xs text-slate-500">
                判定された言語: <span className="font-semibold">{detectedLanguage}</span>
              </p>
            )}
            {translatedText && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p className="mb-2 font-semibold text-slate-600">翻訳結果</p>
                <p className="whitespace-pre-wrap leading-relaxed">{translatedText}</p>
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div className="space-y-3">
              <label className="text-sm font-semibold text-slate-700">
                情報ブロック
              </label>
              
              <div className="flex flex-wrap gap-2">
                {(Object.keys(blockTemplates) as BlockType[]).map((type) => {
                  const isSelected = infoBlocks.some((b) => b.type === type);
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => toggleOrAddBlock(type)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium shadow-sm transition ${
                        isSelected
                          ? "border-sky-500 bg-sky-500 text-white"
                          : "border-slate-300 bg-white text-slate-700 hover:border-sky-400 hover:bg-sky-50 hover:text-sky-700"
                      }`}
                    >
                      <span>{blockTemplates[type].icon}</span>
                      <span>{blockTemplates[type].label}</span>
                    </button>
                  );
                })}
              </div>

              {editingBlockId && (
                <div className="rounded-xl border-2 border-sky-400 bg-sky-50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-semibold text-sky-900">ブロック編集</h3>
                    <button
                      type="button"
                      onClick={() => setEditingBlockId(null)}
                      className="rounded-full px-3 py-1 text-sm text-slate-600 transition hover:bg-white"
                    >
                      閉じる
                    </button>
                  </div>
                  {infoBlocks
                    .filter((block) => block.id === editingBlockId)
                    .map((block) => (
                      <div key={block.id}>
                        <InfoBlockEditor
                          block={block}
                          onUpdate={(updated) => updateBlock(block.id, updated)}
                          onDelete={() => deleteBlock(block.id)}
                        />
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="notes"
                className="text-sm font-semibold text-slate-700"
              >
                こちらから伝えたい要点（自由記述）
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="箇条書きや短文で記入してください（例：\n・謝罪を入れる\n・納期は5/10厳守）"
                className="min-h-[120px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-800 shadow-inner outline-none ring-slate-300 transition focus:ring"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">
                  口調
                </span>
                <div className="flex flex-col gap-2">
                  {toneOptions.map((option) => (
                    <label
                      key={option.value}
                      className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 text-sm shadow-sm transition ${
                        tone === option.value
                          ? "border-sky-500 bg-sky-50 text-sky-800"
                          : "border-slate-200 bg-white text-slate-700 hover:border-sky-200"
                      }`}
                    >
                      <span>{option.label}</span>
                      <input
                        type="radio"
                        name="tone"
                        value={option.value}
                        checked={tone === option.value}
                        onChange={() => setTone(option.value)}
                        className="hidden"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">
                  文章量
                </span>
                <div className="flex flex-col gap-2">
                  {lengthOptions.map((option) => (
                    <label
                      key={option.value}
                      className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 text-sm shadow-sm transition ${
                        length === option.value
                          ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                          : "border-slate-200 bg-white text-slate-700 hover:border-emerald-200"
                      }`}
                    >
                      <span>{option.label}</span>
                      <input
                        type="radio"
                        name="length"
                        value={option.value}
                        checked={length === option.value}
                        onChange={() => setLength(option.value)}
                        className="hidden"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={disabledGenerate}
              className="w-full rounded-full bg-sky-600 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {generateLoading ? "生成中..." : "返信文を生成"}
            </button>

            {errorMessage && (
              <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
                {errorMessage}
              </p>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">
              生成された返信文（日本語）
            </h2>
            <button
              type="button"
              onClick={handleCopyJapanese}
              disabled={!reply}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-1.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
            >
              {copiedJapanese ? "コピー済み" : "コピー"}
            </button>
          </div>
          <div className="relative">
            <textarea
              value={reply}
              onChange={(e) => handleReplyChange(e.target.value)}
              placeholder="返信文がここに表示されます。口調・文章量を調整して生成ボタンを押してください。"
              className="min-h-[180px] w-full rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-800 outline-none ring-slate-300 transition focus:ring"
            />
            {isTranslating && (
              <div className="absolute bottom-3 right-3 text-xs text-slate-500">
                翻訳中...
              </div>
            )}
          </div>

          {/* 英語版 */}
          {englishTranslation && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800">
                  生成された返信文（英語）
                </h2>
                <button
                  type="button"
                  onClick={handleCopyEnglish}
                  disabled={!englishTranslation}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-1.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                >
                  {copiedEnglish ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="min-h-[180px] rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm leading-relaxed text-slate-800">
                <p className="whitespace-pre-wrap">{englishTranslation}</p>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
