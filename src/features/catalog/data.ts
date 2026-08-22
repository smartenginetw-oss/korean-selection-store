export type Product = {
  id: string;
  slug: string;
  name: string;
  price: number;
  originalPrice?: number;
  badge?: "NEW" | "SALE";
  availability: "in_stock" | "preorder";
  arrival?: string;
  palette: [string, string];
  colors: string[];
  sizes: string[];
  description: string;
  category: ProductCategory;
  optionGroups?: ProductOptionGroup[];
  variants?: ProductVariant[];
};

export type ProductCategory = "tops" | "bottoms" | "outerwear" | "accessories";

export const productCategories: ProductCategory[] = ["tops", "bottoms", "outerwear", "accessories"];

export type ProductOptionGroup = {
  name: string;
  values: string[];
};

export type ProductVariant = {
  id: string;
  sku: string;
  price: number;
  availability: "in_stock" | "preorder" | "unavailable";
  arrival?: string;
  options: Record<string, string>;
};

export const products: Product[] = [
  {
    id: "prod-knit-01",
    slug: "soft-oversize-knit",
    name: "柔霧 Oversize 針織上衣",
    price: 890,
    originalPrice: 1080,
    badge: "NEW",
    availability: "in_stock",
    palette: ["#d8c5ae", "#9a8a79"],
    colors: ["奶茶", "灰色"],
    sizes: ["S", "M", "L"],
    description: "選用柔軟細緻的針織面料，帶有恰好的寬鬆輪廓。單穿或作為秋冬層次都自然耐看。",
    category: "tops",
  },
  {
    id: "prod-shirt-02",
    slug: "daily-soft-shirt",
    name: "日常柔光落肩襯衫",
    price: 1080,
    badge: "NEW",
    availability: "in_stock",
    palette: ["#ddd6ca", "#adb3aa"],
    colors: ["暖白", "鼠尾草"],
    sizes: ["Free"],
    description: "俐落但不緊繃的落肩版型，適合日常通勤與週末穿搭。",
    category: "tops",
  },
  {
    id: "prod-bag-03",
    slug: "half-moon-bag",
    name: "半月柔革肩背包",
    price: 1290,
    availability: "preorder",
    arrival: "9 月下旬",
    palette: ["#b4a294", "#756b63"],
    colors: ["燕麥", "深棕"],
    sizes: ["Free"],
    description: "輕巧弧形包身與霧面質感，容量足以收納每日隨身用品。",
    category: "accessories",
  },
  {
    id: "prod-trousers-04",
    slug: "calm-pleated-trousers",
    name: "靜謐細褶寬褲",
    price: 1180,
    availability: "in_stock",
    palette: ["#b8b1a8", "#77716c"],
    colors: ["暖灰", "霧黑"],
    sizes: ["S", "M"],
    description: "垂墜細褶隨步伐自然展開，鬆緊腰頭讓日常穿著更自在。",
    category: "bottoms",
  },
];

export function getProduct(slug: string) {
  return products.find((product) => product.slug === slug);
}
