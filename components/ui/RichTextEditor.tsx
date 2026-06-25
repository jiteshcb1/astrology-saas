"use client";

import dynamic from "next/dynamic";
import "react-quill-new/dist/quill.snow.css";

// Prebuilt rich-text editor (Quill 2 via react-quill-new) — proven toolbar: Heading (Normal/H2/H3),
// Bold, Italic, bullet + ordered list. Emits standard semantic HTML; value contract is an HTML string
// ("" when empty). Client-only (Quill needs the DOM), so loaded with ssr:false.
const ReactQuill = dynamic(() => import("react-quill-new"), {
  ssr: false,
  loading: () => <div className="h-44 rounded-control border border-line bg-sand-2/30" />,
});

// Restrict to the formats we expose so the stored HTML stays clean + safe to render on the public page.
const MODULES = {
  toolbar: [[{ header: [2, 3, false] }], ["bold", "italic", "link"], [{ list: "ordered" }, { list: "bullet" }], ["clean"]],
};
const FORMATS = ["header", "bold", "italic", "link", "list"];

function isEmptyHtml(html: string): boolean {
  return !html || html.replace(/<[^>]*>/g, "").trim().length === 0;
}

/** Controlled rich-text editor. `value`/`onChange` are HTML strings ("" empty). */
export function RichTextEditor({ value, onChange, placeholder = "What this session covers…" }: { value: string; onChange: (html: string) => void; placeholder?: string }) {
  return (
    <div className="rte">
      <ReactQuill
        theme="snow"
        value={value}
        onChange={(html: string) => onChange(isEmptyHtml(html) ? "" : html)}
        modules={MODULES}
        formats={FORMATS}
        placeholder={placeholder}
      />
      {/* Theme Quill's chrome to our tokens (scoped under .rte). */}
      <style jsx global>{`
        .rte .ql-toolbar.ql-snow,
        .rte .ql-container.ql-snow {
          border-color: rgba(42, 39, 72, 0.12);
        }
        .rte .ql-toolbar.ql-snow {
          border-top-left-radius: 11px;
          border-top-right-radius: 11px;
          background: #efe5d2;
        }
        .rte .ql-container.ql-snow {
          border-bottom-left-radius: 11px;
          border-bottom-right-radius: 11px;
          font-family: inherit;
          font-size: 0.9rem;
          color: #2a2748;
        }
        .rte .ql-editor {
          min-height: 11rem;
        }
        .rte .ql-editor.ql-blank::before {
          color: rgba(42, 39, 72, 0.5);
          font-style: normal;
        }
        .rte .ql-snow .ql-stroke {
          stroke: #2a2748;
        }
        .rte .ql-snow .ql-fill,
        .rte .ql-snow .ql-picker-label {
          fill: #2a2748;
          color: #2a2748;
        }
        .rte .ql-snow.ql-toolbar button:hover .ql-stroke,
        .rte .ql-snow.ql-toolbar button.ql-active .ql-stroke,
        .rte .ql-snow .ql-picker-label:hover,
        .rte .ql-snow .ql-picker-item.ql-selected {
          stroke: #b9772a;
          color: #b9772a;
        }
        .rte .ql-snow.ql-toolbar button.ql-active {
          background: rgba(232, 163, 61, 0.18);
          border-radius: 6px;
        }
      `}</style>
    </div>
  );
}
