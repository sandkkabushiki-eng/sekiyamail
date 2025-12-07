"use client";

import { InfoBlock, BlockField, blockTemplates } from "../types";

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

  const addField = () => {
    const newField: BlockField = {
      id: `field-${Date.now()}`,
      label: "新しい項目",
      value: "",
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

      <div className="space-y-2">
        {block.fields.map((field) => (
          <div key={field.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
            <input
              type="text"
              value={field.label}
              onChange={(e) => handleFieldLabelChange(field.id, e.target.value)}
              className="w-20 flex-shrink-0 rounded border-none bg-transparent px-1 py-0.5 text-sm font-medium text-slate-700 outline-none"
              placeholder="項目名"
            />
            <span className="text-slate-300">:</span>
            <input
              type="text"
              value={field.value}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              className="flex-1 rounded border-none bg-white px-2 py-1 text-sm text-slate-800 outline-none ring-slate-300 transition focus:ring"
              placeholder="値を入力"
            />
            <button
              type="button"
              onClick={() => deleteField(field.id)}
              className="flex-shrink-0 text-slate-400 transition hover:text-red-600"
            >
              ✕
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={addField}
          className="w-full rounded-lg border border-dashed border-slate-300 bg-white py-1.5 text-xs font-medium text-slate-500 transition hover:border-sky-400 hover:bg-sky-50 hover:text-sky-700"
        >
          + 項目を追加
        </button>
      </div>
    </div>
  );
}
