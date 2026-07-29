'use client';

import {
  Archive,
  Check,
  Copy,
  Download,
  FileCheck2,
  Loader2,
  Printer,
  RotateCcw,
  Save,
  ShieldAlert,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/fabrika/ConfirmDialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { validateDocumentValues } from '@/lib/document-center/engine';
import type {
  DocumentContextDTO,
  DocumentFieldDefinition,
  DocumentValue,
  DocumentValues,
} from '@/lib/document-center/types';
import DocumentPreview from './DocumentPreview';
import {
  createInitialValues,
  fieldIsVisible,
  fillFromContact,
  fillFromProperty,
  legalStatusLabel,
  toInputValue,
} from './helpers';
import { DOCUMENT_WIZARD_DIALOG_CLASS_NAME } from './layout';
import type {
  DocumentRecordDTO,
  DocumentTemplateDTO,
  WizardDocument,
} from './types';

interface DocumentWizardProps {
  open: boolean;
  template: DocumentTemplateDTO | null;
  existing: DocumentRecordDTO | null;
  context: DocumentContextDTO;
  principalType: 'OWNER' | 'EMPLOYEE';
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}

type FieldGroup = {
  id: string;
  title: string;
  description: string;
  fields: DocumentFieldDefinition[];
};

function groupFields(fields: DocumentFieldDefinition[]): FieldGroup[] {
  const groups: Record<string, FieldGroup> = {
    general: {
      id: 'general',
      title: 'Belge bilgileri',
      description: 'Belgenin kimliği, düzenleme tarihi ve şirket bilgileri.',
      fields: [],
    },
    parties: {
      id: 'parties',
      title: 'Taraflar',
      description: 'Belgede yer alacak gerçek veya tüzel kişiler.',
      fields: [],
    },
    property: {
      id: 'property',
      title: 'Taşınmaz',
      description: 'Portföy, adres, tapu ve fiziksel özellikler.',
      fields: [],
    },
    financial: {
      id: 'financial',
      title: 'Bedel ve tarihler',
      description: 'Tutar, ödeme, süre ve işlem tarihleri.',
      fields: [],
    },
    conditions: {
      id: 'conditions',
      title: 'Koşullar ve ek bilgiler',
      description: 'İşleme özgü koşullar, izinler ve özel maddeler.',
      fields: [],
    },
  };

  const financialPattern =
    /(price|amount|rent|deposit|fee|commission|rate|payment|date|duration|day)/i;
  const propertyPattern =
    /(property|portfolio|address|province|district|neighborhood|deed|parcel|island|section|room|area|occupancy)/i;
  const partyPattern =
    /(name|identity|phone|email|customer|buyer|seller|tenant|landlord|owner|guarantor|corporate|tax|mersis|representative)/i;

  for (const field of fields) {
    if (
      ['documentNumber', 'issuePlace', 'issueDate', 'companyName', 'advisorName'].includes(
        field.key
      )
    ) {
      groups.general.fields.push(field);
    } else if (propertyPattern.test(field.key) || field.type === 'portfolio') {
      groups.property.fields.push(field);
    } else if (
      financialPattern.test(field.key) ||
      ['money', 'percent', 'date', 'datetime'].includes(field.type)
    ) {
      groups.financial.fields.push(field);
    } else if (
      partyPattern.test(field.key) ||
      ['person', 'company', 'contact'].includes(field.type)
    ) {
      groups.parties.fields.push(field);
    } else {
      groups.conditions.fields.push(field);
    }
  }

  return Object.values(groups).filter((group) => group.fields.length > 0);
}

function FieldControl({
  field,
  value,
  error,
  disabled,
  context,
  onChange,
}: {
  field: DocumentFieldDefinition;
  value: DocumentValue | undefined;
  error?: string;
  disabled: boolean;
  context: DocumentContextDTO;
  onChange: (value: DocumentValue) => void;
}) {
  const baseClass = `min-h-10 w-full rounded-lg border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60 ${
    error ? 'border-rose-500' : 'border-slate-700'
  }`;

  if (field.type === 'boolean') {
    return (
      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-emerald-500">
        <input
          type="checkbox"
          checked={Boolean(value)}
          disabled={disabled || field.readOnly}
          onChange={(event) => onChange(event.target.checked)}
          className="h-4 w-4 accent-emerald-500"
        />
        <span>{field.helpText || 'Evet, bu koşul geçerli.'}</span>
      </label>
    );
  }

  if (field.type === 'select') {
    return (
      <select
        className={baseClass}
        value={toInputValue(value)}
        disabled={disabled || field.readOnly}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Seçin</option>
        {field.options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === 'multiselect') {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {field.options?.map((option) => (
          <label
            key={option.value}
            className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-200"
          >
            <input
              type="checkbox"
              checked={selected.includes(option.value)}
              disabled={disabled || field.readOnly}
              onChange={(event) => {
                onChange(
                  event.target.checked
                    ? [...selected, option.value]
                    : selected.filter((item) => item !== option.value)
                );
              }}
              className="accent-emerald-500"
            />
            {option.label}
          </label>
        ))}
      </div>
    );
  }

  if (field.type === 'textarea' || field.type === 'address') {
    return (
      <textarea
        rows={field.type === 'address' ? 2 : 4}
        className={baseClass}
        value={toInputValue(value)}
        placeholder={field.placeholder}
        disabled={disabled || field.readOnly}
        maxLength={field.maxLength}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  if (field.type === 'portfolio') {
    return (
      <select
        className={baseClass}
        value={toInputValue(value)}
        disabled={disabled || field.readOnly}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Manuel bilgi gireceğim</option>
        {context.properties.map((property) => (
          <option key={property.id} value={property.id}>
            {property.title}
            {property.referenceCode ? ` · ${property.referenceCode}` : ''}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === 'file') {
    return (
      <input
        type="file"
        className={`${baseClass} file:mr-3 file:rounded file:border-0 file:bg-emerald-500/15 file:px-2 file:py-1 file:text-emerald-300`}
        disabled={disabled || field.readOnly}
        onChange={(event) =>
          onChange(
            Array.from(event.target.files || [])
              .map((file) => file.name)
              .join(', ')
          )
        }
      />
    );
  }

  const inputType =
    field.type === 'date'
      ? 'date'
      : field.type === 'datetime'
        ? 'datetime-local'
        : ['money', 'number', 'percent'].includes(field.type)
          ? 'number'
          : 'text';

  return (
    <input
      type={inputType}
      className={baseClass}
      value={toInputValue(value)}
      placeholder={field.placeholder}
      disabled={disabled || field.readOnly}
      min={field.min}
      max={field.max}
      minLength={field.minLength}
      maxLength={field.maxLength}
      inputMode={inputType === 'number' ? 'decimal' : undefined}
      onChange={(event) => {
        if (inputType === 'number') {
          onChange(event.target.value === '' ? null : Number(event.target.value));
        } else {
          onChange(event.target.value);
        }
      }}
    />
  );
}

export default function DocumentWizard({
  open,
  template: initialTemplate,
  existing,
  context,
  principalType,
  onClose,
  onChanged,
}: DocumentWizardProps) {
  const [template, setTemplate] = useState<DocumentTemplateDTO | null>(
    initialTemplate
  );
  const [document, setDocument] = useState<WizardDocument | null>(null);
  const [values, setValues] = useState<DocumentValues>({});
  const [title, setTitle] = useState('');
  const [activeGroup, setActiveGroup] = useState('general');
  const [mobilePane, setMobilePane] = useState<'form' | 'preview'>('form');
  const [selectedContact, setSelectedContact] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const initializedRef = useRef(false);
  const changeVersionRef = useRef(0);

  const readOnly = document?.status !== 'DRAFT';
  const groups = useMemo(
    () => (template ? groupFields(template.fields) : []),
    [template]
  );
  const visibleGroups = useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          fields: group.fields.filter((field) => fieldIsVisible(field, values)),
        }))
        .filter((group) => group.fields.length > 0),
    [groups, values]
  );
  const currentGroup =
    visibleGroups.find((group) => group.id === activeGroup) || visibleGroups[0];

  const applyDocument = useCallback(
    (nextDocument: WizardDocument, nextTemplate?: DocumentTemplateDTO) => {
      const resolvedTemplate =
        nextTemplate ||
        ({
          ...(nextDocument.templateSnapshot as DocumentTemplateDTO),
          favorite: initialTemplate?.favorite ?? false,
        } satisfies DocumentTemplateDTO);
      setTemplate(resolvedTemplate);
      setDocument(nextDocument);
      setValues(nextDocument.values || {});
      setTitle(nextDocument.title);
      setActiveGroup('general');
      setDirty(false);
      setErrors({});
    },
    [initialTemplate]
  );

  useEffect(() => {
    if (!open || initializedRef.current) return;
    initializedRef.current = true;

    async function initialize() {
      setLoading(true);
      try {
        if (existing) {
          const response = await fetch(
            `/api/fabrika/documents/${existing.publicId}`,
            { cache: 'no-store' }
          );
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error);
          applyDocument(payload.data.document as WizardDocument);
          return;
        }
        if (!initialTemplate) throw new Error('Belge şablonu seçilmedi.');
        const initialValues = createInitialValues(initialTemplate, context);
        setTemplate(initialTemplate);
        setValues(initialValues);
        setTitle(initialTemplate.name);
        const response = await fetch('/api/fabrika/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            templateKey: initialTemplate.key,
            title: initialTemplate.name,
            values: initialValues,
            generate: false,
          }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error);
        applyDocument(
          payload.data.document as WizardDocument,
          initialTemplate
        );
        await onChanged();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Belge açılamadı.'
        );
        onClose();
      } finally {
        setLoading(false);
      }
    }

    void initialize();
  }, [
    applyDocument,
    context,
    existing,
    initialTemplate,
    onChanged,
    onClose,
    open,
  ]);

  useEffect(() => {
    if (!open) initializedRef.current = false;
  }, [open]);

  const saveDraft = useCallback(async () => {
    if (!document || document.status !== 'DRAFT' || !dirty || saving) return;
    const saveVersion = changeVersionRef.current;
    setSaving(true);
    try {
      const response = await fetch(
        `/api/fabrika/documents/${document.publicId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'SAVE', title, values }),
        }
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      if (changeVersionRef.current === saveVersion) setDirty(false);
      setDocument((current) =>
        current
          ? ({ ...current, ...payload.data.document } as WizardDocument)
          : current
      );
      await onChanged();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Taslak kaydedilemedi.'
      );
    } finally {
      setSaving(false);
    }
  }, [dirty, document, onChanged, saving, title, values]);

  useEffect(() => {
    if (!dirty || readOnly) return;
    const timer = window.setTimeout(() => void saveDraft(), 900);
    return () => window.clearTimeout(timer);
  }, [dirty, readOnly, saveDraft, values, title]);

  useEffect(() => {
    function warnOnExit(event: BeforeUnloadEvent) {
      if (!dirty && !saving) return;
      event.preventDefault();
    }
    window.addEventListener('beforeunload', warnOnExit);
    return () => window.removeEventListener('beforeunload', warnOnExit);
  }, [dirty, saving]);

  function changeField(field: DocumentFieldDefinition, next: DocumentValue) {
    changeVersionRef.current += 1;
    setValues((current) => {
      if (field.type === 'portfolio' && typeof next === 'string') {
        return fillFromProperty(current, next, context);
      }
      return { ...current, [field.key]: next };
    });
    setDirty(true);
    setErrors((current) => {
      if (!current[field.key]) return current;
      const nextErrors = { ...current };
      delete nextErrors[field.key];
      return nextErrors;
    });
  }

  function handleContact(value: string) {
    setSelectedContact(value);
    if (!template) return;
    changeVersionRef.current += 1;
    setValues((current) =>
      fillFromContact(current, value, template, context)
    );
    setDirty(true);
  }

  async function generate() {
    if (!template || !document) return;
    const validation = validateDocumentValues(template, values);
    if (!validation.valid) {
      const nextErrors = Object.fromEntries(
        validation.errors.map((error) => [error.key, error.message])
      );
      setErrors(nextErrors);
      const firstKey = validation.errors[0]?.key;
      const targetGroup = visibleGroups.find((group) =>
        group.fields.some((field) => field.key === firstKey)
      );
      if (targetGroup) setActiveGroup(targetGroup.id);
      toast.error(`${validation.errors.length} zorunlu alanı tamamlayın.`);
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(
        `/api/fabrika/documents/${document.publicId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'GENERATE', title, values }),
        }
      );
      const payload = await response.json();
      if (!response.ok) {
        if (Array.isArray(payload.details)) {
          setErrors(
            Object.fromEntries(
              payload.details.map((error: { key: string; message: string }) => [
                error.key,
                error.message,
              ])
            )
          );
        }
        throw new Error(payload.error);
      }
      setDocument((current) =>
        current
          ? ({ ...current, ...payload.data.document } as WizardDocument)
          : current
      );
      setDirty(false);
      toast.success('Belge değiştirilemez sürüm olarak oluşturuldu.');
      await onChanged();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Belge oluşturulamadı.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function action(
    actionName: 'ARCHIVE' | 'CANCEL' | 'RESTORE' | 'DUPLICATE'
  ) {
    if (!document) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/fabrika/documents/${document.publicId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: actionName }),
        }
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      if (actionName === 'DUPLICATE') {
        const next = payload.data.document as WizardDocument;
        setDocument(next);
        setValues(next.values);
        setTitle(next.title);
        setDirty(false);
        toast.success('Düzenlenebilir yeni belge sürümü oluşturuldu.');
      } else {
        setDocument((current) =>
          current
            ? ({ ...current, ...payload.data.document } as WizardDocument)
            : current
        );
        toast.success('Belge durumu güncellendi.');
      }
      await onChanged();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'İşlem tamamlanamadı.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function softDelete() {
    if (!document) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/fabrika/documents/${document.publicId}`,
        { method: 'DELETE' }
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      toast.success('Belge geri yüklenebilir şekilde silindi.');
      await onChanged();
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Belge silinemedi.'
      );
    } finally {
      setBusy(false);
    }
  }

  function closeWizard() {
    if (dirty) {
      void saveDraft().finally(onClose);
    } else {
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && closeWizard()}>
      <DialogContent
        showCloseButton={false}
        data-testid="document-wizard-dialog"
        className={DOCUMENT_WIZARD_DIALOG_CLASS_NAME}
      >
        <DialogHeader className="border-b border-slate-800 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="truncate text-base font-semibold text-white">
                {title || template?.name || 'Belge hazırlanıyor'}
              </DialogTitle>
              <DialogDescription className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span>{document?.documentNumber || 'Belge numarası hazırlanıyor'}</span>
                {document ? (
                  <span className="rounded bg-slate-800 px-2 py-0.5">
                    Sürüm {document.versionNumber}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1 text-emerald-400">
                  {saving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )}
                  {saving ? 'Kaydediliyor' : dirty ? 'Kaydedilecek' : 'Kaydedildi'}
                </span>
              </DialogDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg border border-slate-700 p-1 lg:hidden">
                <button
                  type="button"
                  onClick={() => setMobilePane('form')}
                  className={`rounded px-2 py-1 text-xs ${
                    mobilePane === 'form'
                      ? 'bg-emerald-500 text-emerald-950'
                      : 'text-slate-400'
                  }`}
                >
                  Form
                </button>
                <button
                  type="button"
                  onClick={() => setMobilePane('preview')}
                  className={`rounded px-2 py-1 text-xs ${
                    mobilePane === 'preview'
                      ? 'bg-emerald-500 text-emerald-950'
                      : 'text-slate-400'
                  }`}
                >
                  Önizleme
                </button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={closeWizard}
                className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white"
              >
                Kapat
              </Button>
            </div>
          </div>
        </DialogHeader>

        {loading || !template || !document ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-400" />
              <p className="mt-3 text-sm text-slate-400">
                Güvenli taslak hazırlanıyor…
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex min-h-0 flex-1">
              <aside
                className={`w-full min-w-0 border-r border-slate-800 bg-slate-950/35 lg:flex lg:w-[52%] ${
                  mobilePane === 'form' ? 'flex' : 'hidden'
                }`}
              >
                <nav className="hidden w-52 shrink-0 overflow-y-auto border-r border-slate-800 p-3 xl:block">
                  <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Belge adımları
                  </p>
                  <div className="space-y-1">
                    {visibleGroups.map((group, index) => (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => setActiveGroup(group.id)}
                        className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition ${
                          currentGroup?.id === group.id
                            ? 'bg-emerald-500/12 text-emerald-300'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                        }`}
                      >
                        <span className="flex h-6 w-6 items-center justify-center rounded-md border border-current/20 text-[10px]">
                          {index + 1}
                        </span>
                        <span className="truncate">{group.title}</span>
                      </button>
                    ))}
                  </div>
                </nav>

                <div className="custom-scrollbar min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
                  {readOnly ? (
                    <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/8 p-3 text-sm text-emerald-100">
                      <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                      <div>
                        <p className="font-semibold">Değiştirilemez belge sürümü</p>
                        <p className="mt-1 text-xs leading-5 text-emerald-200/70">
                          Bu sürümün değerleri ve şablonu korunur. Değişiklik için
                          “Yeni sürüm” seçin.
                        </p>
                      </div>
                    </div>
                  ) : null}

                  <div className="mb-5 grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-medium text-slate-300">
                        Belge adı
                      </span>
                      <input
                        value={title}
                        disabled={readOnly}
                        maxLength={180}
                        onChange={(event) => {
                          setTitle(event.target.value);
                          changeVersionRef.current += 1;
                          setDirty(true);
                        }}
                        className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-emerald-500 disabled:opacity-60"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-medium text-slate-300">
                        CRM kişisiyle doldur
                      </span>
                      <select
                        value={selectedContact}
                        disabled={readOnly}
                        onChange={(event) => handleContact(event.target.value)}
                        className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-emerald-500 disabled:opacity-60"
                      >
                        <option value="">Manuel bilgi gireceğim</option>
                        {context.contacts.map((contact) => (
                          <option key={contact.id} value={contact.id}>
                            {contact.name}
                            {contact.phone ? ` · ${contact.phone}` : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="mb-4 flex gap-2 overflow-x-auto pb-1 xl:hidden">
                    {visibleGroups.map((group, index) => (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => setActiveGroup(group.id)}
                        className={`shrink-0 rounded-lg px-3 py-2 text-xs ${
                          currentGroup?.id === group.id
                            ? 'bg-emerald-500 text-emerald-950'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {index + 1}. {group.title}
                      </button>
                    ))}
                  </div>

                  {currentGroup ? (
                    <section>
                      <h3 className="text-lg font-semibold text-white">
                        {currentGroup.title}
                      </h3>
                      <p className="mt-1 text-sm text-slate-400">
                        {currentGroup.description}
                      </p>
                      <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        {currentGroup.fields.map((field) => (
                          <label
                            key={field.key}
                            className={`block ${
                              ['textarea', 'address', 'multiselect', 'boolean'].includes(
                                field.type
                              )
                                ? 'sm:col-span-2'
                                : ''
                            }`}
                          >
                            <span className="mb-1.5 flex items-center gap-1 text-xs font-medium text-slate-300">
                              {field.label}
                              {field.required ? (
                                <span className="text-rose-400" aria-label="zorunlu">
                                  *
                                </span>
                              ) : (
                                <span className="font-normal text-slate-600">
                                  (isteğe bağlı)
                                </span>
                              )}
                            </span>
                            <FieldControl
                              field={field}
                              value={values[field.key]}
                              error={errors[field.key]}
                              disabled={readOnly}
                              context={context}
                              onChange={(next) => changeField(field, next)}
                            />
                            {field.helpText ? (
                              <span className="mt-1 block text-[11px] leading-4 text-slate-500">
                                {field.helpText}
                              </span>
                            ) : null}
                            {errors[field.key] ? (
                              <span className="mt-1 block text-xs text-rose-400">
                                {errors[field.key]}
                              </span>
                            ) : null}
                          </label>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  <section className="mt-8 border-t border-slate-800 pt-5">
                    <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/7 p-3">
                      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                      <div className="text-xs leading-5 text-amber-100/80">
                        <p className="font-semibold text-amber-200">
                          {legalStatusLabel(template.legalStatus)}
                        </p>
                        <p className="mt-1">{template.legalNotice}</p>
                        {template.officialFormWarning ? (
                          <p className="mt-2 font-medium">
                            {template.officialFormWarning}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <details className="mt-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-400">
                      <summary className="cursor-pointer font-medium text-slate-300">
                        Resmî kaynaklar ve inceleme tarihi
                      </summary>
                      <p className="mt-2">
                        Son katalog incelemesi:{' '}
                        {new Date(template.lastReviewedAt).toLocaleDateString(
                          'tr-TR'
                        )}
                      </p>
                      <ul className="mt-2 space-y-2">
                        {template.sources.map((source) => (
                          <li key={source.url}>
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noreferrer"
                              className="font-medium text-emerald-400 hover:underline"
                            >
                              {source.title}
                            </a>
                            <p className="mt-0.5 text-slate-500">{source.note}</p>
                          </li>
                        ))}
                      </ul>
                    </details>
                  </section>
                </div>
              </aside>

              <section
                className={`custom-scrollbar min-w-0 flex-1 overflow-auto bg-slate-950/70 p-3 sm:p-6 lg:block ${
                  mobilePane === 'preview' ? 'block' : 'hidden'
                }`}
              >
                <DocumentPreview
                  template={template}
                  values={values}
                  companyName={context.company.name}
                  logo={context.company.logo}
                />
              </section>
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 bg-slate-950/80 px-4 py-3 sm:px-6">
              <div className="flex flex-wrap items-center gap-2">
                {document.status === 'DRAFT' ? (
                  <Button
                    variant="outline"
                    onClick={() => void saveDraft()}
                    disabled={!dirty || saving || busy}
                    className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white"
                  >
                    {saving ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Save />
                    )}
                    Taslağı kaydet
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={() =>
                        window.open(
                          `/api/fabrika/documents/${document.publicId}/pdf`,
                          '_blank',
                          'noopener,noreferrer'
                        )
                      }
                      className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white"
                    >
                      <Download />
                      PDF
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        window.open(
                          `/api/fabrika/documents/${document.publicId}/docx`,
                          '_blank',
                          'noopener,noreferrer'
                        )
                      }
                      className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white"
                    >
                      <Download />
                      DOCX
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        window.open(
                          `/api/fabrika/documents/${document.publicId}/pdf?inline=1`,
                          '_blank',
                          'noopener,noreferrer'
                        )
                      }
                      className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white"
                    >
                      <Printer />
                      Yazdır
                    </Button>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                {document.status !== 'DRAFT' ? (
                  <Button
                    variant="outline"
                    onClick={() => void action('DUPLICATE')}
                    disabled={busy}
                    className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white"
                  >
                    <Copy />
                    Yeni sürüm
                  </Button>
                ) : null}
                {document.status === 'GENERATED' ? (
                  <Button
                    variant="outline"
                    onClick={() => void action('ARCHIVE')}
                    disabled={busy}
                    className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white"
                  >
                    <Archive />
                    Arşivle
                  </Button>
                ) : null}
                {document.status !== 'ARCHIVED' &&
                document.status !== 'CANCELLED' ? (
                  <Button
                    variant="outline"
                    onClick={() => void action('CANCEL')}
                    disabled={busy}
                    className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white"
                  >
                    <XCircle />
                    İptal et
                  </Button>
                ) : null}
                {document.deletedAt && principalType === 'OWNER' ? (
                  <Button
                    onClick={() => void action('RESTORE')}
                    disabled={busy}
                    className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                  >
                    <RotateCcw />
                    Geri yükle
                  </Button>
                ) : null}
                {!document.deletedAt && principalType === 'OWNER' ? (
                  <ConfirmDialog
                    title="Belge silinsin mi?"
                    description="Belge çöp kutusuna taşınır ve daha sonra patron tarafından geri yüklenebilir."
                    confirmLabel="Belgeyi sil"
                    destructive
                    onConfirm={softDelete}
                    trigger={
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Belgeyi sil"
                        className="border-rose-500/30 bg-transparent text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                      >
                        <Trash2 />
                      </Button>
                    }
                  />
                ) : null}
                {document.status === 'DRAFT' ? (
                  <Button
                    onClick={() => void generate()}
                    disabled={busy}
                    className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                  >
                    {busy ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <FileCheck2 />
                    )}
                    Belgeyi oluştur
                  </Button>
                ) : null}
              </div>
            </footer>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
