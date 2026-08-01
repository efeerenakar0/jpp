'use client';

import { Building2 } from 'lucide-react';
import { renderDocument } from '@/lib/document-center/engine';
import type {
  DocumentTemplateDefinition,
  DocumentValues,
} from '@/lib/document-center/types';

interface DocumentPreviewProps {
  template: DocumentTemplateDefinition;
  values: DocumentValues;
  companyName: string;
  logo: string | null;
}

export default function DocumentPreview({
  template,
  values,
  companyName,
  logo,
}: DocumentPreviewProps) {
  const rendered = renderDocument(template, values);
  const validLogo =
    logo && /^data:image\/(?:png|jpe?g);base64,/i.test(logo) ? logo : null;

  return (
    <article
      className="mx-auto min-h-[842px] w-full min-w-[595px] max-w-[720px] bg-white px-10 py-8 text-sm leading-6 text-slate-800 shadow-2xl shadow-black/40 sm:px-12"
      aria-label="Belge canlı önizlemesi"
    >
      <header className="mb-7 flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          {validLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={validLogo}
              alt=""
              className="h-7 w-7 object-contain"
            />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded bg-emerald-50 text-emerald-700">
              <Building2 className="h-4 w-4" aria-hidden="true" />
            </span>
          )}
          <span className="font-semibold text-emerald-800">{companyName}</span>
        </div>
        <span className="text-xs text-slate-500">
          {rendered.documentNumber}
        </span>
      </header>

      <h2 className="text-center text-2xl font-bold tracking-tight text-slate-950">
        {rendered.title}
      </h2>
      <p className="mb-6 mt-1 text-center text-xs text-slate-500">
        {rendered.issueLine}
      </p>

      <div className="space-y-4">
        {rendered.sections.map((section) => (
          <section key={section.id} className="break-inside-avoid">
            <h3 className="mb-2 border-l-[3px] border-emerald-600 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-900">
              {section.heading}
            </h3>
            <div className="space-y-1.5 text-justify">
              {section.paragraphs.map((paragraph, index) => (
                <p key={`${section.id}-${index}`}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </div>

      {rendered.officialFormWarning ? (
        <p className="mt-5 rounded border border-amber-300 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          {rendered.officialFormWarning}
        </p>
      ) : null}
      <p className="mt-3 rounded border border-slate-200 bg-slate-50 p-3 text-xs italic leading-5 text-slate-600">
        {rendered.legalNotice}
      </p>

      <div className="mt-10 grid grid-cols-2 gap-x-8 gap-y-10">
        {rendered.signatures.map((signature, index) => (
          <div
            key={`${signature.label}-${index}`}
            className="border-t border-slate-500 pt-1.5"
          >
            <p className="font-semibold">{signature.label}</p>
            <p className="text-slate-500">{signature.name}</p>
          </div>
        ))}
      </div>
    </article>
  );
}
