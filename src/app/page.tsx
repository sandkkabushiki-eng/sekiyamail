"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { InfoBlock, BlockType, blockTemplates } from "./types";
import { blockPresets } from "./presets";

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
  const replyTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const notesTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [showBlockPicker, setShowBlockPicker] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!reply) {
      setCopiedJapanese(false);
      setCopiedEnglish(false);
    }
  }, [reply]);

  // お客様メールのテキストが変更されたら、翻訳結果をクリア
  useEffect(() => {
    setTranslatedText("");
    setDetectedLanguage(null);
  }, [customerText]);

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


  // ブロックを追加（チップとして表示）
  const addBlock = useCallback((type: BlockType) => {
    // 既に同じタイプのブロックがあるかチェック
    const existingBlock = infoBlocks.find((b) => b.type === type);
    if (existingBlock) {
      // 既存のブロックがあれば何もしない（または削除したい場合はここで削除）
      return;
    }

    const template = blockTemplates[type];
    const presets = blockPresets[type] || [];
    const firstPreset = presets[0];
    
    const newBlock: InfoBlock = {
      id: `block-${Date.now()}`,
      type,
      title: template.label,
      fields: template.defaultFields.map((df, idx) => ({
        id: `field-${Date.now()}-${idx}`,
        label: df.label,
        value: firstPreset?.values[df.label] || "",
      })),
    };
    
    // ブロックを追加（チップとして表示される）
    setInfoBlocks((prev) => [...prev, newBlock]);
    setShowBlockPicker(false);
  }, [infoBlocks]);

  const updateBlock = useCallback((id: string, updatedBlock: InfoBlock) => {
    setInfoBlocks((prev) =>
      prev.map((block) => (block.id === id ? updatedBlock : block)),
    );
  }, []);

  const deleteBlock = useCallback((id: string) => {
    setInfoBlocks((prev) => prev.filter((block) => block.id !== id));
  }, []);

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
        notes,
        infoBlocks, // ブロックの詳細情報を送信
        tone,
        ...(translatedText.trim()
          ? { translatedCustomerText: translatedText }
          : {}),
      };

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
  }, [customerText, translatedText, notes, tone, length]);

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
      setIsTranslating(false);
      return;
    }

    setIsTranslating(true);
    // 翻訳開始時に前の翻訳結果をクリア（新しい翻訳が来るまで古い結果を表示しない）
    setEnglishTranslation("");
    
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

    // 既存のタイマーをクリア（前の翻訳リクエストをキャンセル）
    if (translateTimeoutRef.current) {
      clearTimeout(translateTimeoutRef.current);
      translateTimeoutRef.current = null;
    }

    // テキストが空の場合は翻訳もクリア
    if (!value.trim()) {
      setEnglishTranslation("");
      setIsTranslating(false);
      return;
    }

    // 1秒後に自動翻訳を実行（デバウンス）
    translateTimeoutRef.current = setTimeout(() => {
      translateToEnglish(value);
      translateTimeoutRef.current = null;
    }, 1000);
  }, [translateToEnglish]);

  // ブロック情報をフォーマットする関数（表示用：アイコン＋ラベルのみ）
  const formatBlockForInsert = useCallback((block: InfoBlock): string => {
    const template = blockTemplates[block.type];
    return `${template.icon}${block.title || template.label}`;
  }, []);

  // ブロック情報をカーソル位置に挿入（返信文用）
  const insertBlockAtCursor = useCallback((block: InfoBlock) => {
    const textarea = replyTextareaRef.current;
    if (!textarea) return;

    const formattedText = formatBlockForInsert(block);
    if (!formattedText) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = reply;
    const before = text.substring(0, start);
    const after = text.substring(end);
    const newText = before + formattedText + after;

    // handleReplyChangeを使用して、翻訳も自動でトリガーされるようにする
    handleReplyChange(newText);

    // カーソル位置を調整（少し遅延させて状態更新後に実行）
    setTimeout(() => {
      const newCursorPos = start + formattedText.length;
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 10);
  }, [reply, formatBlockForInsert, handleReplyChange]);

  return (
    <div className="min-h-screen bg-slate-100 py-10">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 rounded-2xl bg-white p-8 shadow-lg">
        <header className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-sky-600">Mail Reply Studio</p>
            <h1 className="text-2xl font-bold text-slate-900">
              メール返信文ジェネレーター
            </h1>
          </div>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="rounded-lg border border-slate-300 bg-white p-2 text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-800"
            title="設定"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </header>

        {/* 1. お客様メール */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <label htmlFor="customer" className="text-sm font-semibold text-slate-700">
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
            className="min-h-[160px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-800 shadow-inner outline-none ring-slate-300 transition focus:ring"
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
        </section>

        {/* 2. 要点（自由記述）+ ブロック挿入 */}
        <section className="space-y-3">
          <label htmlFor="notes" className="text-sm font-semibold text-slate-700">
            要点（自由記述）
          </label>
          
          {/* テキストエリア + ブロック選択 */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {/* 追加されたブロック（チップとして表示） */}
            {infoBlocks.length > 0 && (
              <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
                {infoBlocks.map((block) => {
                  const template = blockTemplates[block.type];
                  return (
                    <div
                      key={block.id}
                      className="group inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-3 py-1.5 text-sm font-medium text-sky-800 shadow-sm transition hover:bg-sky-200"
                    >
                      <span className="text-base">{template.icon}</span>
                      <span>{block.title || template.label}</span>
                      <button
                        type="button"
                        onClick={() => deleteBlock(block.id)}
                        className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-sky-200 text-sky-600 opacity-0 transition group-hover:opacity-100 hover:bg-red-200 hover:text-red-600"
                        title="ブロックを削除"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="relative">
              <textarea
                ref={notesTextareaRef}
                id="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="文章を入力してください..."
                className="min-h-[120px] w-full border-none bg-white px-4 py-3 pr-12 text-sm leading-relaxed text-slate-800 outline-none resize-none"
              />
              {/* ＋ボタン */}
              <button
                type="button"
                onClick={() => setShowBlockPicker(!showBlockPicker)}
                className={`absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full shadow-lg transition hover:scale-110 ${
                  showBlockPicker 
                    ? "bg-slate-400 text-white" 
                    : "bg-sky-500 text-white hover:bg-sky-600"
                }`}
                title="ブロックを追加"
              >
                <span className="text-xl font-bold">{showBlockPicker ? "✕" : "＋"}</span>
              </button>
            </div>
            
            {/* ブロック選択（テキストエリアの下に表示） */}
            {showBlockPicker && (
              <div className="border-t border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(blockTemplates) as BlockType[]).map((type) => {
                    const isAdded = infoBlocks.some((b) => b.type === type);
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => addBlock(type)}
                        disabled={isAdded}
                        className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition ${
                          isAdded
                            ? "border-sky-300 bg-sky-100 text-sky-400 cursor-not-allowed"
                            : "border-slate-300 bg-white text-slate-700 hover:border-sky-400 hover:bg-sky-50 hover:text-sky-700"
                        }`}
                      >
                        <span>{blockTemplates[type].icon}</span>
                        <span>{blockTemplates[type].label}</span>
                        {isAdded && <span className="ml-1">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 3. 口調 */}
        <section className="space-y-3">
          <span className="text-sm font-semibold text-slate-700">口調</span>
          <div className="flex gap-2">
            {toneOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTone(option.value)}
                className={`flex-1 rounded-xl border px-4 py-3 text-sm font-medium shadow-sm transition ${
                  tone === option.value
                    ? "border-sky-500 bg-sky-50 text-sky-800"
                    : "border-slate-200 bg-white text-slate-700 hover:border-sky-200"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

        {/* 生成ボタン */}
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

        {/* 4. 生成された返信文 */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">生成された返信文</h2>
            <button
              type="button"
              onClick={handleCopyJapanese}
              disabled={!reply}
              className="rounded-full border border-slate-200 px-4 py-1.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              {copiedJapanese ? "コピー済み" : "コピー"}
            </button>
          </div>
          <div className="relative">
            <textarea
              ref={replyTextareaRef}
              value={reply}
              onChange={(e) => handleReplyChange(e.target.value)}
              placeholder="返信文がここに表示されます"
              className="min-h-[180px] w-full rounded-xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-800 outline-none ring-slate-300 transition focus:ring"
            />
            {isTranslating && (
              <div className="absolute bottom-3 right-3 text-xs text-slate-500">
                翻訳中...
              </div>
            )}
          </div>
        </section>

        {/* 5. 英訳 */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">英訳</h2>
            <button
              type="button"
              onClick={handleCopyEnglish}
              disabled={!englishTranslation}
              className="rounded-full border border-slate-200 px-4 py-1.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              {copiedEnglish ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="min-h-[120px] rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
            {englishTranslation ? (
              <p className="whitespace-pre-wrap">{englishTranslation}</p>
            ) : (
              <p className="text-slate-400">日本語の返信文を入力すると自動翻訳されます</p>
            )}
          </div>
        </section>
      </main>

      {/* 設定モーダル */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">プリセット設定</h2>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <p className="mb-4 text-sm text-slate-500">
              各ブロックタイプのデフォルト値を設定できます。ブロック追加時に自動で適用されます。
            </p>
            <div className="space-y-4">
              {(Object.keys(blockTemplates) as BlockType[]).map((type) => {
                const template = blockTemplates[type];
                const presets = blockPresets[type] || [];
                const firstPreset = presets[0];
                
                return (
                  <div key={type} className="rounded-lg border border-slate-200 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-xl">{template.icon}</span>
                      <span className="font-semibold text-slate-800">{template.label}</span>
                    </div>
                    <div className="space-y-1 text-sm">
                      {template.defaultFields.map((field) => (
                        <div key={field.label} className="flex items-center gap-2 text-slate-600">
                          <span className="w-24">{field.label}:</span>
                          <span className="text-slate-800">
                            {firstPreset?.values[field.label] || "(未設定)"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-xs text-slate-400">
              ※ プリセット値の編集は presets.ts ファイルで行ってください
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
