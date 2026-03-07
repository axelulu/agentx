/**
 * File conversion types and interfaces
 */

/**
 * Supported input formats for conversion
 */
export type InputFormat =
  | "html"
  | "markdown"
  | "md"
  | "docx"
  | "pdf"
  | "txt"
  | "rtf"
  | "image";

/**
 * Supported output formats for conversion
 */
export type OutputFormat =
  | "pdf"
  | "docx"
  | "pptx"
  | "html"
  | "markdown"
  | "md"
  | "txt"
  | "rtf"
  | "epub";

/**
 * Conversion configuration options
 */
export interface ConversionOptions {
  /** Custom filename for the output file (without extension) */
  filename?: string;

  /** Additional pandoc arguments for fine-tuning conversion */
  pandocArgs?: string[];

  /** Quality settings for PDF output */
  pdfOptions?: {
    /** Enable table of contents */
    toc?: boolean;
    /** Number of table of contents levels */
    tocDepth?: number;
    /** Enable section numbering */
    numberSections?: boolean;
    /** PDF engine to use (default: wkhtmltopdf) */
    pdfEngine?: "wkhtmltopdf" | "weasyprint" | "prince" | "context";
  };

  /** Options for DOCX output */
  docxOptions?: {
    /** Reference document for styling */
    referenceDoc?: string;
    /** Enable table of contents */
    toc?: boolean;
  };

  /** Options for presentation (PPTX) output */
  pptxOptions?: {
    /** Slide level (default: 2) */
    slideLevel?: number;
    /** Include incremental lists */
    incremental?: boolean;
  };
}

/**
 * File conversion request payload
 */
export interface FileConvertRequest {
  /** Source URL to fetch and convert (required if content and sourceUrls are not provided) */
  sourceUrl?: string;

  /** Multiple source URLs to fetch and convert (required if content and sourceUrl are not provided) */
  sourceUrls?: string[];

  /** Direct content to convert (required if sourceUrl and sourceUrls are not provided) */
  content?: string;

  /** Input format of the source content */
  inputFormat: InputFormat;

  /** Desired output format */
  outputFormat: OutputFormat;

  /** Conversion options */
  options?: ConversionOptions;
}

/**
 * File conversion response
 */
export interface FileConvertResponse {
  /** Success status */
  success: boolean;

  /** Error message if conversion failed */
  error?: string;

  /** Conversion result data */
  data?: {
    /** Generated filename */
    filename: string;

    /** File size in bytes */
    fileSize: number;

    /** MIME type of the converted file */
    mimeType: string;

    /** Conversion duration in milliseconds */
    conversionTime: number;
  };
}

/**
 * Supported conversion mappings
 */
export const SUPPORTED_CONVERSIONS: Record<InputFormat, OutputFormat[]> = {
  html: ["pdf", "docx", "pptx", "markdown", "txt", "rtf", "epub"],
  markdown: ["pdf", "docx", "pptx", "html", "txt", "rtf", "epub"],
  md: ["pdf", "docx", "pptx", "html", "txt", "rtf", "epub"],
  docx: ["pdf", "html", "markdown", "txt", "rtf", "epub"],
  pdf: ["html", "txt"], // Limited conversion from PDF
  txt: ["pdf", "docx", "html", "markdown", "rtf", "epub"],
  rtf: ["pdf", "docx", "html", "markdown", "txt", "epub"],
  image: ["pdf", "pptx"], // Image slides to PDF/PPTX
};

/**
 * MIME type mappings for output formats
 */
export const OUTPUT_MIME_TYPES: Record<OutputFormat, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  html: "text/html",
  markdown: "text/markdown",
  md: "text/markdown",
  txt: "text/plain",
  rtf: "application/rtf",
  epub: "application/epub+zip",
};

/**
 * Default file extensions for output formats
 */
export const OUTPUT_EXTENSIONS: Record<OutputFormat, string> = {
  pdf: ".pdf",
  docx: ".docx",
  pptx: ".pptx",
  html: ".html",
  markdown: ".md",
  md: ".md",
  txt: ".txt",
  rtf: ".rtf",
  epub: ".epub",
};
