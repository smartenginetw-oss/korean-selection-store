export type Product = {
  id: string;
  slug: string;
  name: string;
  price: number;
  originalPrice?: number;
  badge?: "NEW" | "SALE";
  availability: "in_stock" | "preorder" | "mixed" | "unavailable";
  isAvailable: boolean;
  soldQuantity?: number;
  arrival?: string;
  images?: string[];
  palette: [string, string];
  colors: string[];
  sizes: string[];
  description: string;
  material?: string;
  sizeGuide?: string;
  modelInfo?: string;
  origin?: string;
  careInstructions?: string;
  category: ProductCategory;
  optionGroups?: ProductOptionGroup[];
  variants?: ProductVariant[];
};

// Category slugs come from the database; keep the type open so new admin
// categories can appear in the storefront without a code deploy.
export type ProductCategory = string;

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
