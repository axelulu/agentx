/**
 * Blog post status type
 */
export type BlogPostStatus = "draft" | "published" | "archived";

/**
 * Blog post data type
 */
export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string | null;
  featuredImage?: string | null;
  authorId?: string | null; // Nullable for AI-generated posts
  status: BlogPostStatus;
  publishedAt?: Date | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  metaKeywords?: string | null;
  ogImage?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Blog category data type
 */
export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  parentId?: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Blog post category junction data type
 */
export interface BlogPostCategory {
  id: string;
  postId: string;
  categoryId: string;
  createdAt: Date;
}

/**
 * Blog post list item - minimal data for list views
 */
export interface BlogPostListItem {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  featuredImage?: string | null;
  status: BlogPostStatus;
  publishedAt?: Date | null;
  createdAt: Date;
  author?: {
    id: string;
    name: string;
    image?: string | null;
  } | null; // Nullable for AI-generated posts
  categories?: {
    id: string;
    name: string;
    slug: string;
  }[];
}

/**
 * Blog post detail - full data for detail view
 */
export interface BlogPostDetail extends BlogPost {
  author?: {
    id: string;
    name: string;
    image?: string | null;
  } | null; // Nullable for AI-generated posts
  categories: BlogCategory[];
}

/**
 * Create blog post request parameters
 */
export interface CreateBlogPostRequest {
  title: string;
  slug?: string; // Auto-generate from title if not provided
  content: string;
  excerpt?: string;
  featuredImage?: string;
  status?: BlogPostStatus;
  publishedAt?: Date;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  ogImage?: string;
  categoryIds?: string[];
}

/**
 * Update blog post request parameters
 */
export interface UpdateBlogPostRequest {
  title?: string;
  slug?: string;
  content?: string;
  excerpt?: string;
  featuredImage?: string;
  status?: BlogPostStatus;
  publishedAt?: Date;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  ogImage?: string;
  categoryIds?: string[];
}

/**
 * Create blog category request parameters
 */
export interface CreateBlogCategoryRequest {
  name: string;
  slug?: string; // Auto-generate from name if not provided
  description?: string;
  parentId?: string;
  sortOrder?: number;
}

/**
 * Update blog category request parameters
 */
export interface UpdateBlogCategoryRequest {
  name?: string;
  slug?: string;
  description?: string;
  parentId?: string;
  sortOrder?: number;
}

/**
 * Blog post filters for querying
 */
export interface BlogPostFilters {
  status?: BlogPostStatus;
  categoryId?: string;
  categorySlug?: string;
  authorId?: string;
  search?: string;
}

/**
 * Blog posts query parameters
 */
export interface BlogPostsQuery {
  page?: number;
  pageSize?: number;
  status?: BlogPostStatus;
  categorySlug?: string;
  search?: string;
}

/**
 * Blog categories query parameters
 */
export interface BlogCategoriesQuery {
  page?: number;
  pageSize?: number;
  parentId?: string;
}
