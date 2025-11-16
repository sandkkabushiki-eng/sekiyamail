export type BlockType = "breakfast" | "dinner" | "transfer" | "checkin" | "massage" | "spa" | "cake" | "service" | "decoration" | "meal_add" | "lunch" | "facility" | "other";

export interface BlockField {
  id: string;
  label: string;
  value: string;
  includeInReply?: boolean; // 返信文に含めるかどうか（デフォルト: true）
}

export interface InfoBlock {
  id: string;
  type: BlockType;
  title?: string;
  fields: BlockField[];
}

export const blockTemplates: Record<
  BlockType,
  { label: string; icon: string; defaultFields: Array<{ label: string }> }
> = {
  breakfast: {
    label: "朝食",
    icon: "🍳",
    defaultFields: [
      { label: "料金" },
      { label: "時間" },
      { label: "備考" },
    ],
  },
  dinner: {
    label: "夕食",
    icon: "🍽️",
    defaultFields: [
      { label: "料金" },
      { label: "時間" },
      { label: "備考" },
    ],
  },
  transfer: {
    label: "送迎",
    icon: "🚗",
    defaultFields: [
      { label: "場所" },
      { label: "時間" },
      { label: "料金" },
    ],
  },
  checkin: {
    label: "チェックイン/アウト",
    icon: "🏨",
    defaultFields: [
      { label: "チェックイン時間" },
      { label: "チェックアウト時間" },
    ],
  },
  massage: {
    label: "マッサージ",
    icon: "💆",
    defaultFields: [
      { label: "コース" },
      { label: "料金" },
      { label: "時間" },
      { label: "備考" },
    ],
  },
  spa: {
    label: "スパ",
    icon: "🧖",
    defaultFields: [
      { label: "コース" },
      { label: "料金" },
      { label: "時間" },
    ],
  },
  cake: {
    label: "ケーキ",
    icon: "🎂",
    defaultFields: [
      { label: "種類" },
      { label: "サイズ" },
      { label: "料金" },
    ],
  },
  service: {
    label: "サービス",
    icon: "✨",
    defaultFields: [
      { label: "サービス名" },
      { label: "料金" },
      { label: "備考" },
    ],
  },
  decoration: {
    label: "装飾",
    icon: "🎈",
    defaultFields: [
      { label: "内容" },
      { label: "料金" },
    ],
  },
  meal_add: {
    label: "食事追加",
    icon: "🍱",
    defaultFields: [
      { label: "メニュー" },
      { label: "料金" },
      { label: "時間" },
    ],
  },
  lunch: {
    label: "ランチ",
    icon: "🥗",
    defaultFields: [
      { label: "メニュー" },
      { label: "料金" },
      { label: "時間" },
    ],
  },
  facility: {
    label: "施設利用",
    icon: "🏢",
    defaultFields: [
      { label: "項目" },
      { label: "料金" },
      { label: "備考" },
    ],
  },
  other: {
    label: "その他",
    icon: "📝",
    defaultFields: [
      { label: "タイトル" },
      { label: "内容" },
    ],
  },
};

