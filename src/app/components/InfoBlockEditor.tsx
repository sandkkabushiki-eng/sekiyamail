"use client";

import { useState, useEffect } from "react";
import { InfoBlock, BlockField, blockTemplates } from "../types";
import { blockPresets, PresetOption } from "../presets";

interface InfoBlockEditorProps {
  block: InfoBlock;
  onUpdate: (block: InfoBlock) => void;
  onDelete: () => void;
}

export function InfoBlockEditor({
  block,
  onUpdate,
  onDelete,
}: InfoBlockEditorProps) {
  const template = blockTemplates[block.type];
  const [selectedPresets, setSelectedPresets] = useState<Set<number>>(new Set());
  const [editingPresets, setEditingPresets] = useState<PresetOption[]>(blockPresets[block.type] || []);
  const [showEditMode, setShowEditMode] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // 最初のプリセットを自動選択
  useEffect(() => {
    if (!initialized && editingPresets.length > 0 && selectedPresets.size === 0) {
      const firstPresetIndex = 0;
      setSelectedPresets(new Set([firstPresetIndex]));
      
      // 最初のプリセットの値を適用
      const firstPreset = editingPresets[firstPresetIndex];
      if (firstPreset) {
        const mergedValues: Record<string, string> = { ...firstPreset.values };
        const updatedFields = block.fields.map((field) => ({
          ...field,
          value: mergedValues[field.label] || field.value,
        }));
        onUpdate({ ...block, fields: updatedFields });
      }
      setInitialized(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingPresets.length, initialized]);

  const handleFieldChange = (fieldId: string, value: string) => {
    onUpdate({
      ...block,
      fields: block.fields.map((f) =>
        f.id === fieldId ? { ...f, value } : f,
      ),
    });
  };

  const handleFieldLabelChange = (fieldId: string, label: string) => {
    onUpdate({
      ...block,
      fields: block.fields.map((f) =>
        f.id === fieldId ? { ...f, label } : f,
      ),
    });
  };

  const handleIncludeToggle = (fieldId: string) => {
    onUpdate({
      ...block,
      fields: block.fields.map((f) =>
        f.id === fieldId ? { ...f, includeInReply: !(f.includeInReply ?? true) } : f,
      ),
    });
  };

  const addField = () => {
    const newField: BlockField = {
      id: `field-${Date.now()}`,
      label: "新しい項目",
      value: "",
      includeInReply: true,
    };
    onUpdate({
      ...block,
      fields: [...block.fields, newField],
    });
  };

  const deleteField = (fieldId: string) => {
    onUpdate({
      ...block,
      fields: block.fields.filter((f) => f.id !== fieldId),
    });
  };

  const handleTitleChange = (title: string) => {
    onUpdate({ ...block, title });
  };

  const togglePreset = (presetIndex: number) => {
    const newSelected = new Set(selectedPresets);
    if (newSelected.has(presetIndex)) {
      newSelected.delete(presetIndex);
    } else {
      newSelected.add(presetIndex);
    }
    setSelectedPresets(newSelected);

    // 選択されたプリセットの値をマージして適用
    if (newSelected.size > 0) {
      const mergedValues: Record<string, string> = {};
      newSelected.forEach((index) => {
        const preset = editingPresets[index];
        if (preset) {
          Object.assign(mergedValues, preset.values);
        }
      });

      const updatedFields = block.fields.map((field) => ({
        ...field,
        value: mergedValues[field.label] || field.value,
      }));

      onUpdate({ ...block, fields: updatedFields });
    }
  };

  const handlePresetLabelChange = (index: number, label: string) => {
    const updated = [...editingPresets];
    updated[index] = { ...updated[index], label };
    setEditingPresets(updated);
  };

  const handlePresetValueChange = (index: number, fieldLabel: string, value: string) => {
    const updated = [...editingPresets];
    updated[index] = {
      ...updated[index],
      values: { ...updated[index].values, [fieldLabel]: value },
    };
    setEditingPresets(updated);
  };

  const addPreset = () => {
    const newPreset: PresetOption = {
      label: "新しいプリセット",
      values: {},
    };
    setEditingPresets([...editingPresets, newPreset]);
  };

  const deletePreset = (index: number) => {
    const updated = editingPresets.filter((_, i) => i !== index);
    setEditingPresets(updated);
    const newSelected = new Set(selectedPresets);
    newSelected.delete(index);
    // インデックスを再調整
    const adjustedSelected = new Set<number>();
    newSelected.forEach((idx) => {
      if (idx < index) {
        adjustedSelected.add(idx);
      } else if (idx > index) {
        adjustedSelected.add(idx - 1);
      }
    });
    setSelectedPresets(adjustedSelected);
  };

  return (
    <div className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{template.icon}</span>
          <input
            type="text"
            value={block.title || template.label}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="rounded border-none bg-transparent px-2 py-1 font-semibold text-slate-800 outline-none ring-slate-300 transition focus:bg-slate-50 focus:ring"
            placeholder={template.label}
          />
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-full px-3 py-1 text-sm text-red-600 transition hover:bg-red-50"
        >
          削除
        </button>
      </div>

      <div className="mb-3">
        <div className="mb-2 flex items-center justify-between">
          <label className="block text-xs font-medium text-slate-600">
            {editingPresets.length > 0 ? "プリセットを選択（複数選択可）" : "プリセット"}
          </label>
          <button
            type="button"
            onClick={() => setShowEditMode(!showEditMode)}
            className="text-xs text-sky-600 hover:text-sky-700 underline"
          >
            {showEditMode ? "編集を閉じる" : "プリセットを編集"}
          </button>
        </div>
        {editingPresets.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {editingPresets.map((preset, index) => (
              <button
                key={index}
                type="button"
                onClick={() => togglePreset(index)}
                className={`rounded-lg border-2 px-3 py-1.5 text-xs font-medium transition ${
                  selectedPresets.has(index)
                    ? "border-sky-500 bg-sky-100 text-sky-800 shadow-md font-semibold"
                    : "border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}

        {showEditMode && (
            <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-700">プリセット編集</span>
                <button
                  type="button"
                  onClick={addPreset}
                  className="rounded px-2 py-1 text-xs text-sky-600 hover:bg-sky-100"
                >
                  + 追加
                </button>
              </div>
              {editingPresets.map((preset, index) => (
                <div key={index} className="rounded border border-slate-200 bg-white p-2">
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      value={preset.label}
                      onChange={(e) => handlePresetLabelChange(index, e.target.value)}
                      className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 outline-none ring-slate-300 transition focus:ring"
                      placeholder="プリセット名"
                    />
                    <button
                      type="button"
                      onClick={() => deletePreset(index)}
                      className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    >
                      削除
                    </button>
                  </div>
                  <div className="space-y-1">
                    {block.fields.map((field) => (
                      <div key={field.id} className="flex items-center gap-2">
                        <span className="w-20 text-xs text-slate-600">{field.label}:</span>
                        <input
                          type="text"
                          value={preset.values[field.label] || ""}
                          onChange={(e) =>
                            handlePresetValueChange(index, field.label, e.target.value)
                          }
                          className="flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 outline-none ring-slate-300 transition focus:ring"
                          placeholder={`${field.label}の値`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>

      <div className="space-y-3">
        {block.fields.map((field) => {
          const isIncluded = field.includeInReply ?? true;
          return (
            <div key={field.id} className="space-y-2">
              {/* カード（表示のみ、クリックで切り替え） */}
              <div
                className={`group relative rounded-lg border-2 p-3 transition-all cursor-pointer hover:shadow-md ${
                  isIncluded
                    ? "border-sky-400 bg-sky-50 shadow-sm hover:bg-sky-100"
                    : "border-slate-200 bg-slate-50 opacity-60 hover:opacity-80 hover:bg-slate-100"
                }`}
                onClick={() => handleIncludeToggle(field.id)}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={field.label}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleFieldLabelChange(field.id, e.target.value);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className={`flex-shrink-0 w-32 rounded border-none bg-transparent px-2 py-1 text-sm font-semibold outline-none transition ${
                      isIncluded ? "text-sky-900" : "text-slate-500"
                    }`}
                    placeholder="項目名"
                  />
                  <div className="flex-1 border-l-2 border-slate-300 pl-3">
                    <input
                      type="text"
                      value={field.value}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleFieldChange(field.id, e.target.value);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className={`w-full rounded border-none bg-transparent px-2 py-1 text-sm outline-none transition ${
                        isIncluded ? "text-slate-800" : "text-slate-400"
                      }`}
                      placeholder="値を入力"
                    />
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`text-sm font-semibold px-4 py-2 rounded ${
                        isIncluded
                          ? "bg-sky-200 text-sky-800"
                          : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {isIncluded ? "含める" : "除外"}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteField(field.id);
                      }}
                      className="rounded-lg px-2 py-1 text-sm text-slate-400 transition hover:bg-red-100 hover:text-red-600"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        <button
          type="button"
          onClick={addField}
          className="w-full rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 py-2 text-sm font-medium text-slate-600 transition hover:border-sky-400 hover:bg-sky-50 hover:text-sky-700"
        >
          + 項目を追加
        </button>
      </div>
    </div>
  );
}
