import {
  DOCUMENT_LEGAL_NOTICE,
  type DocumentCategory,
  type DocumentFieldDefinition,
  type DocumentSectionTemplate,
  type DocumentSource,
  type DocumentTemplateDefinition,
} from './types';

const UPDATED_AT = '2026-07-29T00:00:00.000Z';
const REVIEWED_AT = '2026-07-29T00:00:00.000Z';

const SOURCES = {
  obligations: {
    title: '6098 sayılı Türk Borçlar Kanunu',
    url: 'https://www.mevzuat.gov.tr/mevzuatmetin/1.5.6098.pdf',
    note: 'Sözleşme, kira, cayma, teslim ve borç ilişkileri için genel resmî mevzuat kaynağı.',
  },
  realEstate: {
    title: 'T.C. Ticaret Bakanlığı - Taşınmaz Ticareti Mevzuatı',
    url: 'https://ticaret.gov.tr/ic-ticaret/mevzuat/tasinmaz-ticareti',
    note: 'Taşınmaz ticareti ve hizmet sözleşmelerine ilişkin resmî mevzuat sayfası.',
  },
  deed: {
    title: 'Tapu ve Kadastro Genel Müdürlüğü',
    url: 'https://www.tkgm.gov.tr/',
    note: 'Tapu işlemleri, resmî şekil ve güncel işlem duyuruları için kurum kaynağı.',
  },
  kvkk: {
    title: 'KVKK - Aydınlatma Yükümlülüğünün Yerine Getirilmesi Rehberi',
    url: 'https://www.kvkk.gov.tr/Icerik/5394/Aydinlatma-Yukumlulugunun-Yerine-Getirilmesi-Rehberi',
    note: 'Aydınlatma ile açık rızanın ayrı süreçler olarak ele alınmasına ilişkin resmî rehber.',
  },
  commercialMessages: {
    title: 'T.C. Ticaret Bakanlığı - İleti Yönetim Sistemi',
    url: 'https://ticaret.gov.tr/ic-ticaret/ticari-elektronik-iletiler/ileti-yonetim-sistemi-iys',
    note: 'Ticari elektronik ileti onay ve ret süreçlerine ilişkin resmî açıklama.',
  },
} satisfies Record<string, DocumentSource>;

const propertyTypes = [
  { value: 'KONUT', label: 'Konut' },
  { value: 'DAIRE', label: 'Daire' },
  { value: 'VILLA', label: 'Villa' },
  { value: 'IS_YERI', label: 'İş yeri' },
  { value: 'ARSA', label: 'Arsa' },
  { value: 'DIGER', label: 'Diğer' },
];

const paymentMethods = [
  { value: 'BANK_TRANSFER', label: 'Banka havalesi / EFT' },
  { value: 'CASH', label: 'Nakit' },
  { value: 'CREDIT_CARD', label: 'Kredi kartı' },
  { value: 'OTHER', label: 'Diğer' },
];

const responsibilityOptions = [
  { value: 'BUYER', label: 'Alıcı' },
  { value: 'SELLER', label: 'Satıcı' },
  { value: 'TENANT', label: 'Kiracı' },
  { value: 'LANDLORD', label: 'Kiraya veren' },
  { value: 'SHARED', label: 'Taraflar ortak' },
  { value: 'COMPANY', label: 'Hizmet veren şirket' },
];

const baseFields: DocumentFieldDefinition[] = [
  {
    key: 'documentNumber',
    label: 'Belge numarası',
    type: 'text',
    required: true,
    readOnly: true,
    autofill: 'document.number',
  },
  {
    key: 'issuePlace',
    label: 'Düzenlenme yeri',
    type: 'text',
    required: true,
    maxLength: 120,
    autofill: 'company.city',
  },
  {
    key: 'issueDate',
    label: 'Düzenlenme tarihi',
    type: 'date',
    required: true,
    autofill: 'today',
  },
  {
    key: 'companyName',
    label: 'Hizmet veren şirket',
    type: 'company',
    required: true,
    maxLength: 180,
    autofill: 'company.name',
  },
  {
    key: 'advisorName',
    label: 'Gayrimenkul danışmanı',
    type: 'person',
    required: true,
    maxLength: 140,
    autofill: 'principal.name',
  },
  {
    key: 'specialTerms',
    label: 'Özel şartlar',
    type: 'textarea',
    required: false,
    maxLength: 2_500,
    placeholder: 'Varsa yalnızca bu işleme özel ek koşulları yazın.',
  },
];

const locationFields: DocumentFieldDefinition[] = [
  {
    key: 'propertyId',
    label: 'Portföyden taşınmaz seç',
    type: 'portfolio',
    autofill: 'property.id',
  },
  {
    key: 'propertyType',
    label: 'Taşınmaz tipi',
    type: 'select',
    required: true,
    options: propertyTypes,
    autofill: 'property.type',
  },
  {
    key: 'propertyAddress',
    label: 'Taşınmazın açık adresi',
    type: 'address',
    required: true,
    minLength: 5,
    maxLength: 500,
    autofill: 'property.location',
  },
  {
    key: 'province',
    label: 'İl',
    type: 'text',
    required: true,
    maxLength: 80,
  },
  {
    key: 'district',
    label: 'İlçe',
    type: 'text',
    required: true,
    maxLength: 80,
  },
  {
    key: 'neighborhood',
    label: 'Mahalle',
    type: 'text',
    required: true,
    maxLength: 120,
  },
  {
    key: 'portfolioNumber',
    label: 'Portföy numarası',
    type: 'text',
    required: false,
    maxLength: 80,
    autofill: 'property.referenceCode',
  },
  {
    key: 'deedIsland',
    label: 'Ada',
    type: 'deed',
    required: false,
    maxLength: 30,
  },
  {
    key: 'deedParcel',
    label: 'Parsel',
    type: 'deed',
    required: false,
    maxLength: 30,
  },
  {
    key: 'independentSection',
    label: 'Bağımsız bölüm',
    type: 'deed',
    required: false,
    maxLength: 30,
  },
];

const partyField = (
  key: string,
  label: string,
  required = true
): DocumentFieldDefinition => ({
  key,
  label,
  type: 'person',
  required,
  maxLength: 180,
});

const contactField = (
  key: string,
  label: string,
  required = false
): DocumentFieldDefinition => ({
  key,
  label,
  type: 'contact',
  required,
  maxLength: 180,
});

const identityField = (
  key: string,
  label: string
): DocumentFieldDefinition => ({
  key,
  label,
  type: 'text',
  maxLength: 40,
  pattern: '^[0-9A-Za-zÇĞİÖŞÜçğıöşü -]{5,40}$',
});

const yesNoField = (
  key: string,
  label: string,
  defaultValue = false
): DocumentFieldDefinition => ({
  key,
  label,
  type: 'boolean',
  defaultValue,
});

const commonConditionalFields: DocumentFieldDefinition[] = [
  yesNoField('furnished', 'Taşınmaz eşyalı mı?'),
  {
    key: 'inventoryDetails',
    label: 'Demirbaş ve eşya listesi',
    type: 'textarea',
    required: true,
    visibleWhen: { field: 'furnished', truthy: true },
    maxLength: 2_500,
  },
  yesNoField('guarantorExists', 'Kefil var mı?'),
  {
    ...partyField('guarantorName', 'Kefilin adı soyadı'),
    visibleWhen: { field: 'guarantorExists', truthy: true },
  },
  {
    ...identityField('guarantorIdentityNumber', 'Kefilin kimlik numarası'),
    required: true,
    visibleWhen: { field: 'guarantorExists', truthy: true },
  },
  yesNoField('corporateParty', 'Taraflardan biri tüzel kişi mi?'),
  {
    key: 'corporateTitle',
    label: 'Şirket unvanı',
    type: 'company',
    required: true,
    visibleWhen: { field: 'corporateParty', truthy: true },
  },
  {
    key: 'taxNumber',
    label: 'Vergi numarası',
    type: 'text',
    required: true,
    visibleWhen: { field: 'corporateParty', truthy: true },
  },
  {
    key: 'mersisNumber',
    label: 'MERSİS numarası',
    type: 'text',
    visibleWhen: { field: 'corporateParty', truthy: true },
  },
  {
    ...partyField('corporateRepresentative', 'Şirket yetkilisi'),
    visibleWhen: { field: 'corporateParty', truthy: true },
  },
];

interface TemplateDescriptor {
  key: string;
  name: string;
  category: DocumentCategory;
  description: string;
  estimatedMinutes: number;
  profile:
    | 'authorization'
    | 'service'
    | 'sale'
    | 'rental'
    | 'property'
    | 'privacy';
  purpose: string;
  obligations: string[];
  duration: string;
  termination: string;
  specificField: DocumentFieldDefinition;
  signatures: string[];
  tags: string[];
  officialFormWarning?: string;
  extraFields?: DocumentFieldDefinition[];
  legalStatus?: DocumentTemplateDefinition['legalStatus'];
}

const authorizationFields: DocumentFieldDefinition[] = [
  partyField('ownerName', 'Malik / yetki veren'),
  identityField('ownerIdentityNumber', 'Malik kimlik veya vergi numarası'),
  contactField('ownerPhone', 'Malik telefonu', true),
  ...locationFields,
  {
    key: 'authorizationStartDate',
    label: 'Yetki başlangıç tarihi',
    type: 'date',
    required: true,
  },
  {
    key: 'authorizationEndDate',
    label: 'Yetki bitiş tarihi',
    type: 'date',
    required: true,
  },
  {
    key: 'commissionRate',
    label: 'Hizmet bedeli oranı',
    type: 'percent',
    required: true,
    min: 0,
    max: 100,
  },
  yesNoField('exclusive', 'Tek yetki veriliyor mu?'),
  yesNoField('mediaPermission', 'Fotoğraf/video ve ilan yayınına izin veriliyor mu?', true),
  {
    key: 'expenseResponsibility',
    label: 'İlan ve tanıtım masraflarından sorumlu taraf',
    type: 'select',
    required: true,
    options: responsibilityOptions,
  },
];

const serviceFields: DocumentFieldDefinition[] = [
  partyField('customerName', 'Müşteri adı soyadı'),
  identityField('customerIdentityNumber', 'Müşteri kimlik numarası'),
  contactField('customerPhone', 'Müşteri telefonu', true),
  contactField('customerEmail', 'Müşteri e-postası'),
  ...locationFields,
  {
    key: 'serviceDate',
    label: 'Hizmet / görüşme tarihi',
    type: 'datetime',
    required: true,
  },
  {
    key: 'serviceFee',
    label: 'Hizmet bedeli',
    type: 'money',
    required: false,
    min: 0,
  },
  {
    key: 'commissionRate',
    label: 'Komisyon oranı',
    type: 'percent',
    required: false,
    min: 0,
    max: 100,
  },
];

const salesFields: DocumentFieldDefinition[] = [
  partyField('buyerName', 'Alıcı'),
  identityField('buyerIdentityNumber', 'Alıcı kimlik / vergi numarası'),
  contactField('buyerPhone', 'Alıcı telefonu', true),
  partyField('sellerName', 'Satıcı'),
  identityField('sellerIdentityNumber', 'Satıcı kimlik / vergi numarası'),
  contactField('sellerPhone', 'Satıcı telefonu', true),
  ...locationFields,
  {
    key: 'salePrice',
    label: 'Toplam satış bedeli',
    type: 'money',
    required: true,
    min: 1,
    autofill: 'property.price',
  },
  {
    key: 'paymentMethod',
    label: 'Ödeme yöntemi',
    type: 'select',
    required: true,
    options: paymentMethods,
  },
  {
    key: 'paymentDate',
    label: 'Ödeme tarihi',
    type: 'date',
    required: true,
  },
  {
    key: 'deedTransferDate',
    label: 'Planlanan tapu devri tarihi',
    type: 'date',
    required: true,
  },
  {
    key: 'expenseResponsibility',
    label: 'Vergi, harç ve işlem masrafları sorumlusu',
    type: 'select',
    required: true,
    options: responsibilityOptions,
    defaultValue: 'SHARED',
  },
  ...commonConditionalFields,
];

const rentalFields: DocumentFieldDefinition[] = [
  partyField('landlordName', 'Kiraya veren'),
  identityField('landlordIdentityNumber', 'Kiraya veren kimlik / vergi numarası'),
  contactField('landlordPhone', 'Kiraya veren telefonu', true),
  partyField('tenantName', 'Kiracı'),
  identityField('tenantIdentityNumber', 'Kiracı kimlik / vergi numarası'),
  contactField('tenantPhone', 'Kiracı telefonu', true),
  ...locationFields,
  {
    key: 'monthlyRent',
    label: 'Aylık kira bedeli',
    type: 'money',
    required: true,
    min: 1,
  },
  {
    key: 'depositAmount',
    label: 'Depozito tutarı',
    type: 'money',
    required: false,
    min: 0,
  },
  {
    key: 'leaseStartDate',
    label: 'Kira başlangıç tarihi',
    type: 'date',
    required: true,
  },
  {
    key: 'leaseDurationMonths',
    label: 'Kira süresi (ay)',
    type: 'number',
    required: true,
    min: 1,
    max: 240,
  },
  {
    key: 'paymentDay',
    label: 'Aylık son ödeme günü',
    type: 'number',
    required: true,
    min: 1,
    max: 28,
  },
  {
    key: 'paymentMethod',
    label: 'Ödeme yöntemi',
    type: 'select',
    required: true,
    options: paymentMethods,
  },
  {
    key: 'expenseResponsibility',
    label: 'Aidat ve kullanım giderleri sorumlusu',
    type: 'select',
    required: true,
    options: responsibilityOptions,
    defaultValue: 'TENANT',
  },
  ...commonConditionalFields,
];

const propertyFields: DocumentFieldDefinition[] = [
  partyField('ownerName', 'Mülk sahibi'),
  contactField('ownerPhone', 'Mülk sahibi telefonu', true),
  ...locationFields,
  {
    key: 'askingPrice',
    label: 'Talep edilen fiyat',
    type: 'money',
    required: true,
    min: 0,
    autofill: 'property.price',
  },
  {
    key: 'roomCount',
    label: 'Oda sayısı',
    type: 'select',
    required: false,
    options: ['1+0', '1+1', '2+1', '3+1', '4+1', '5+1', '6+'].map(
      (value) => ({ value, label: value })
    ),
    autofill: 'property.roomCount',
  },
  {
    key: 'area',
    label: 'Brüt metrekare',
    type: 'number',
    required: false,
    min: 0,
    autofill: 'property.area',
  },
  {
    key: 'occupancyStatus',
    label: 'Kullanım durumu',
    type: 'select',
    required: true,
    options: [
      { value: 'BOŞ', label: 'Boş' },
      { value: 'MALİK', label: 'Malik kullanıyor' },
      { value: 'KİRACI', label: 'Kiracılı' },
      { value: 'DİĞER', label: 'Diğer' },
    ],
  },
];

const privacyFields: DocumentFieldDefinition[] = [
  partyField('dataSubjectName', 'İlgili kişi'),
  identityField('dataSubjectIdentityNumber', 'Kimlik numarası'),
  contactField('dataSubjectPhone', 'Telefon', true),
  contactField('dataSubjectEmail', 'E-posta'),
  {
    key: 'dataControllerName',
    label: 'Veri sorumlusu',
    type: 'company',
    required: true,
    autofill: 'company.name',
  },
  {
    key: 'processingPurposes',
    label: 'İşleme / kullanım amaçları',
    type: 'multiselect',
    required: true,
    options: [
      { value: 'SERVICE', label: 'Hizmetin yürütülmesi' },
      { value: 'CONTACT', label: 'İletişim ve randevu' },
      { value: 'MARKETING', label: 'Pazarlama ve kampanya' },
      { value: 'LEGAL', label: 'Hukuki yükümlülükler' },
      { value: 'SECURITY', label: 'İşlem güvenliği' },
    ],
  },
  {
    key: 'retentionPeriod',
    label: 'Saklama süresi / ölçütü',
    type: 'text',
    required: true,
    maxLength: 300,
  },
  {
    key: 'consentDate',
    label: 'Beyan tarihi',
    type: 'date',
    required: true,
  },
  yesNoField('consentGranted', 'Onay / açık rıza verildi mi?', true),
];

function profileFields(profile: TemplateDescriptor['profile']) {
  if (profile === 'authorization') return authorizationFields;
  if (profile === 'service') return serviceFields;
  if (profile === 'sale') return salesFields;
  if (profile === 'rental') return rentalFields;
  if (profile === 'property') return propertyFields;
  return privacyFields;
}

function propertySummary(profile: TemplateDescriptor['profile']) {
  if (profile === 'privacy') {
    return 'İlgili kişi {{dataSubjectName}}, veri sorumlusu {{dataControllerName}} tarafından yürütülen süreç hakkında bilgilendirilmiştir. İşleme veya kullanım amaçları: {{processingPurposes}}. Saklama süresi veya belirleme ölçütü: {{retentionPeriod}}.';
  }
  return '{{province}} ili, {{district}} ilçesi, {{neighborhood}} Mahallesi, {{propertyAddress}} adresinde bulunan {{propertyType:property}} niteliğindeki taşınmaz bu belgenin konusunu oluşturur. Portföy numarası {{portfolioNumber}}, tapu bilgileri ise ada {{deedIsland}}, parsel {{deedParcel}}, bağımsız bölüm {{independentSection}} olarak beyan edilmiştir.';
}

function partySummary(profile: TemplateDescriptor['profile']) {
  if (profile === 'authorization') {
    return 'Yetki veren {{ownerName}} ile hizmet veren {{companyName}} adına gayrimenkul danışmanı {{advisorName}}, aşağıdaki hükümlerde mutabık kalmıştır.';
  }
  if (profile === 'service') {
    return 'Müşteri {{customerName}} ile hizmet veren {{companyName}} adına gayrimenkul danışmanı {{advisorName}}, hizmetin kapsamını ve kayıt koşullarını kabul etmiştir.';
  }
  if (profile === 'sale') {
    return 'Alıcı {{buyerName}} ile satıcı {{sellerName}}, {{companyName}} bünyesinde görevli gayrimenkul danışmanı {{advisorName}} aracılığıyla aşağıdaki hususları kayıt altına almıştır.';
  }
  if (profile === 'rental') {
    return 'Kiraya veren {{landlordName}} ile kiracı {{tenantName}}, {{companyName}} bünyesinde görevli gayrimenkul danışmanı {{advisorName}} aracılığıyla aşağıdaki hususları kayıt altına almıştır.';
  }
  if (profile === 'property') {
    return 'Mülk sahibi {{ownerName}} ile {{companyName}} adına gayrimenkul danışmanı {{advisorName}}, taşınmaza ilişkin bilgilerin mevcut beyan ve incelemeye göre kayda alınmasını kabul etmiştir.';
  }
  return 'İlgili kişi {{dataSubjectName}} ile veri sorumlusu {{dataControllerName}} arasındaki bu kayıt, {{companyName}} adına {{advisorName}} tarafından düzenlenmiştir.';
}

function commercialTerms(profile: TemplateDescriptor['profile']) {
  if (profile === 'authorization') {
    return 'Hizmet bedeli, gerçekleşen işlem üzerinden %{{commissionRate}} olarak belirlenmiştir. İlan ve tanıtım giderleri {{expenseResponsibility:responsibility}} tarafından karşılanır. Yasal vergi ve kesintiler yürürlükteki mevzuata göre ayrıca değerlendirilir.';
  }
  if (profile === 'service') {
    return 'Varsa hizmet bedeli {{serviceFee:money}}, komisyon oranı %{{commissionRate}} olarak kayda alınmıştır. Bedelin doğumu, tahsili ve vergisel sonuçları somut hizmet ve yürürlükteki mevzuata göre değerlendirilir.';
  }
  if (profile === 'sale') {
    return 'Toplam satış bedeli {{salePrice:moneywords}} olarak kararlaştırılmıştır. Ödeme {{paymentMethod:payment}} yöntemiyle {{paymentDate:date}} tarihinde yapılacak; tapu devri için hedef tarih {{deedTransferDate:date}} olacaktır. Vergi, harç ve işlem giderleri {{expenseResponsibility:responsibility}} tarafından karşılanır.';
  }
  if (profile === 'rental') {
    return 'Aylık kira bedeli {{monthlyRent:moneywords}}, depozito {{depositAmount:money}} ve aylık son ödeme günü {{paymentDay}} olarak belirlenmiştir. Ödeme {{paymentMethod:payment}} ile yapılır; aidat ve kullanım giderlerinden {{expenseResponsibility:responsibility}} sorumludur.';
  }
  if (profile === 'property') {
    return 'Malik tarafından bildirilen talep fiyatı {{askingPrice:money}}, oda sayısı {{roomCount}}, brüt alan {{area:number}} m² ve kullanım durumu {{occupancyStatus}} olarak kaydedilmiştir. Bu bilgiler resmî ekspertiz veya tapu kaydı yerine geçmez.';
  }
  return 'Bu belge, seçilen amaçlarla sınırlı bir bilgilendirme ve/veya irade beyanı kaydıdır. İlgili kişinin Kanun kapsamındaki başvuru, düzeltme, silme ve itiraz hakları saklıdır.';
}

function buildSections(descriptor: TemplateDescriptor): DocumentSectionTemplate[] {
  const sections: DocumentSectionTemplate[] = [
    {
      id: 'parties',
      heading: '1. TARAFLAR VE DÜZENLEME',
      keepTogether: true,
      paragraphs: [{ text: partySummary(descriptor.profile) }],
    },
    {
      id: 'subject',
      heading: '2. BELGENİN KONUSU',
      paragraphs: [
        { text: descriptor.purpose },
        {
          text: `Bu belgede “taraflar” birlikte anılan ilgilileri; “şirket” {{companyName}} unvanlı hizmet vereni; “taşınmaz” ise belgede bilgileri belirtilen mülkü ifade eder.`,
          condition:
            descriptor.profile === 'privacy'
              ? { field: 'dataSubjectName', truthy: false }
              : undefined,
        },
      ],
    },
    {
      id: 'property',
      heading:
        descriptor.profile === 'privacy'
          ? '3. KİŞİSEL VERİ VE İŞLEM BİLGİLERİ'
          : '3. TAŞINMAZ BİLGİLERİ',
      paragraphs: [{ text: propertySummary(descriptor.profile) }],
    },
    {
      id: 'commercial',
      heading:
        descriptor.profile === 'privacy'
          ? '4. İŞLEME ŞARTLARI VE HAKLAR'
          : '4. BEDEL VE MALİ KOŞULLAR',
      paragraphs: [{ text: commercialTerms(descriptor.profile) }],
    },
    {
      id: 'obligations',
      heading: '5. HAKLAR, YÜKÜMLÜLÜKLER VE BEYANLAR',
      paragraphs: descriptor.obligations.map((text) => ({ text })),
    },
    {
      id: 'duration',
      heading: '6. SÜRE, TESLİM VE UYGULAMA',
      paragraphs: [{ text: descriptor.duration }],
    },
    {
      id: 'termination',
      heading: '7. CAYMA, FESİH, İADE VE UYUŞMAZLIK',
      paragraphs: [
        { text: descriptor.termination },
        {
          text: 'Taraflar, uyuşmazlık halinde öncelikle yazılı bildirim ve iyi niyetli görüşme yolunu deneyeceklerini; görevli ve yetkili mercilerin kanuna göre belirleneceğini kabul eder.',
        },
      ],
    },
    {
      id: 'exclusive',
      heading: '8. TEK YETKİ HÜKÜMLERİ',
      condition: { field: 'exclusive', truthy: true },
      paragraphs: [
        {
          text: 'Yetki süresince taşınmazın pazarlanması için tek yetkili hizmet veren {{companyName}} olarak belirlenmiştir. Malik, kendi bulduğu alıcı veya kiracı dahil olmak üzere işlem ihtimalini şirkete gecikmeden bildirecek; bu hükmün kapsamı ve hizmet bedeline etkisi somut işlem öncesinde ayrıca hukuk uzmanına kontrol ettirilecektir.',
        },
      ],
    },
    {
      id: 'bank',
      heading: '8. ÖDEME KAYDI',
      condition: { field: 'paymentMethod', equals: 'BANK_TRANSFER' },
      paragraphs: [
        {
          text: 'Ödeme banka havalesi/EFT ile yapılacak; dekontta belgenin numarası ve ödeme amacı yazılacak, banka kaydı tahsilatın ispatında esas alınacaktır.',
        },
      ],
    },
    {
      id: 'cash',
      heading: '8. NAKİT TESLİM KAYDI',
      condition: { field: 'paymentMethod', equals: 'CASH' },
      paragraphs: [
        {
          text: 'Nakit ödeme, teslim alanın yazılı teyidi ve imzasıyla kayıt altına alınır. Bu belge tek başına kaynağı veya hukuka uygunluğu hakkında ek bir garanti oluşturmaz.',
        },
      ],
    },
    {
      id: 'inventory',
      heading: '9. DEMİRBAŞ VE EŞYALAR',
      condition: { field: 'furnished', truthy: true },
      paragraphs: [
        {
          text: 'Taşınmaz eşyalı olarak işlem görmektedir. Tarafların teslimde birlikte kontrol edeceği demirbaş ve eşyalar: {{inventoryDetails}}. Olağan kullanımdan doğan yıpranma ile hasar ayrımı teslim tutanağındaki fotoğraf ve kayıtlarla belirlenir.',
        },
      ],
    },
    {
      id: 'guarantor',
      heading: '10. KEFİL',
      condition: { field: 'guarantorExists', truthy: true },
      paragraphs: [
        {
          text: 'Kefil {{guarantorName}} (kimlik no: {{guarantorIdentityNumber}}), kefaletin türü, azami tutarı, tarihi ve varsa eş rızası dahil kanuni şekil şartları ayrıca ve el yazısıyla tamamlanmadan bu bölümün geçerli bir kefalet taahhüdü oluşturmayacağını bildiğini kabul eder.',
        },
      ],
    },
    {
      id: 'corporate',
      heading: '11. TÜZEL KİŞİ TARAF',
      condition: { field: 'corporateParty', truthy: true },
      paragraphs: [
        {
          text: 'Tüzel kişi taraf {{corporateTitle}}, vergi no {{taxNumber}}, MERSİS no {{mersisNumber}} ve yetkili {{corporateRepresentative}} bilgileriyle işlem yapmaktadır. Temsil ve imza yetkisini gösteren güncel belgeler imza öncesinde kontrol edilir.',
        },
      ],
    },
    {
      id: 'special',
      heading: '12. ÖZEL ŞARTLAR VE EKLER',
      condition: { field: 'specialTerms', truthy: true },
      paragraphs: [
        { text: 'Tarafların bu işleme özgü ek şartları: {{specialTerms}}' },
      ],
    },
    {
      id: 'notices',
      heading: '13. TEBLİGAT, NÜSHA VE İMZA',
      paragraphs: [
        {
          text: 'Tarafların belgeye yazdığı telefon, e-posta ve adres bilgileri iletişim amacıyla kullanılır; kanunen özel tebligat usulü gereken haller saklıdır. Belge, taraflarca okunup anlaşıldıktan sonra aynı içerikte nüshalar halinde imzalanır. Ekler ve teslim kayıtları belgenin ayrılmaz parçasıdır.',
        },
      ],
    },
  ];
  return sections;
}

const descriptor = (
  value: TemplateDescriptor
): TemplateDescriptor => value;

const descriptors: TemplateDescriptor[] = [
  descriptor({
    key: 'satis-yetkilendirme-sozlesmesi',
    name: 'Satış yetkilendirme sözleşmesi',
    category: 'AUTHORIZATION_MARKETING',
    description: 'Malikin taşınmazın satışına yönelik pazarlama ve aracılık yetkisini kapsamlı biçimde düzenler.',
    estimatedMinutes: 8,
    profile: 'authorization',
    purpose: 'Malik, belirtilen taşınmazın satışa hazırlanması, pazarlanması, alıcı adaylarıyla görüşülmesi ve tekliflerin kendisine iletilmesi için şirkete sınırlı aracılık yetkisi verir.',
    obligations: [
      'Şirket, taşınmaz bilgilerini makul ölçüde doğrular, ilanları yanıltıcı olmayacak biçimde hazırlar ve teklifleri malike gecikmeden iletir.',
      'Malik, mülkiyet ve takyidat durumunu etkileyen bilgileri doğru açıklamak, gerekli belgeleri sağlamak ve gösterim için makul erişim sunmakla yükümlüdür.',
    ],
    duration: 'Yetki {{authorizationStartDate:date}} tarihinde başlar ve {{authorizationEndDate:date}} tarihinde kendiliğinden sona erer; uzatma ancak yeni yazılı mutabakatla yapılır.',
    termination: 'Taraflar, esaslı ihlal halinde yazılı bildirimle fesih talep edebilir. Fesih tarihinden önce sunulan ve kayıt altına alınan alıcı adayları bakımından doğmuş haklar ayrıca değerlendirilir.',
    specificField: yesNoField('deedDocumentChecked', 'Tapu belgesi görüldü mü?'),
    signatures: ['MALİK / YETKİ VEREN::ownerName', 'HİZMET VEREN::advisorName'],
    tags: ['satış', 'yetki', 'malik'],
  }),
  descriptor({
    key: 'kiralama-yetkilendirme-sozlesmesi',
    name: 'Kiralama yetkilendirme sözleşmesi',
    category: 'AUTHORIZATION_MARKETING',
    description: 'Taşınmazın kiraya verilmesi için ilan, aday değerlendirme ve görüşme yetkisini düzenler.',
    estimatedMinutes: 8,
    profile: 'authorization',
    purpose: 'Malik, taşınmazın kiracı adaylarına tanıtılması, başvuruların toplanması ve kira koşullarına ilişkin tekliflerin kendisine sunulması için şirkete yetki verir.',
    obligations: [
      'Şirket, adaylardan yalnızca hizmet için gerekli bilgileri toplar ve nihai kiracı seçiminin malike ait olduğunu açıkça belirtir.',
      'Malik, kira bedeli, kullanım amacı, demirbaşlar ve taşınmazın hukuki/fiilî durumu hakkında doğru bilgi verir.',
    ],
    duration: 'Yetki {{authorizationStartDate:date}} ile {{authorizationEndDate:date}} arasında geçerlidir.',
    termination: 'Fesih, yazılı bildirimle ileriye etkili olur; daha önce gerçekleştirilen hizmet ve belgeli giderler ayrıca hesaplanır.',
    specificField: {
      key: 'targetMonthlyRent',
      label: 'Hedef aylık kira bedeli',
      type: 'money',
      required: true,
      min: 1,
    },
    signatures: ['MALİK / YETKİ VEREN::ownerName', 'HİZMET VEREN::advisorName'],
    tags: ['kiralama', 'yetki', 'malik'],
  }),
  descriptor({
    key: 'tek-yetkili-satis-sozlesmesi',
    name: 'Tek yetkili satış sözleşmesi',
    category: 'AUTHORIZATION_MARKETING',
    description: 'Belirli süre boyunca satış pazarlamasında tek yetkili çalışma esaslarını kayıt altına alır.',
    estimatedMinutes: 10,
    profile: 'authorization',
    purpose: 'Malik, belirtilen süre içinde taşınmazın satışa yönelik pazarlanması ve alıcı bulunması konusunda şirkete tek yetki verir.',
    obligations: [
      'Şirket, pazarlama planını uygular, faaliyetleri malike raporlar ve gelen teklifleri zamanında iletir.',
      'Malik, yetki süresince doğrudan veya başka bir aracıyla yürüttüğü görüşmeleri şirkete bildirir ve çelişkili ilan yayımlamaz.',
    ],
    duration: 'Tek yetki {{authorizationStartDate:date}} tarihinde başlayıp {{authorizationEndDate:date}} tarihinde sona erer.',
    termination: 'Haklı nedenle fesih halleri saklıdır. Tek yetki ve hizmet bedeli hükümleri imza öncesinde somut olay bakımından ayrıca kontrol edilmelidir.',
    specificField: {
      ...yesNoField('activityReportRequired', 'Periyodik faaliyet raporu isteniyor mu?', true),
      required: true,
    },
    extraFields: [
      {
        key: 'reportingFrequency',
        label: 'Raporlama sıklığı',
        type: 'select',
        required: true,
        visibleWhen: { field: 'activityReportRequired', truthy: true },
        options: [
          { value: 'WEEKLY', label: 'Haftalık' },
          { value: 'BIWEEKLY', label: 'İki haftada bir' },
          { value: 'MONTHLY', label: 'Aylık' },
        ],
      },
    ],
    signatures: ['MALİK / YETKİ VEREN::ownerName', 'TEK YETKİLİ ŞİRKET::advisorName'],
    tags: ['satış', 'tek yetki'],
  }),
  descriptor({
    key: 'tek-yetkili-kiralama-sozlesmesi',
    name: 'Tek yetkili kiralama sözleşmesi',
    category: 'AUTHORIZATION_MARKETING',
    description: 'Kiralama pazarlamasının tek bir hizmet veren üzerinden yürütülmesini düzenler.',
    estimatedMinutes: 10,
    profile: 'authorization',
    purpose: 'Malik, taşınmazın kiralanmasına ilişkin tanıtım, aday toplama ve teklif iletme faaliyetlerinde şirkete tek yetki verir.',
    obligations: [
      'Şirket, adayları eşit ve ölçülü kriterlerle değerlendirir; kira sözleşmesinin taraflarca ayrıca kurulacağını bildirir.',
      'Malik, başka kanallardan gelen adayları şirkete bildirir ve aynı taşınmaz için çelişkili kiralama koşulları açıklamaz.',
    ],
    duration: 'Tek yetkili kiralama dönemi {{authorizationStartDate:date}} ile {{authorizationEndDate:date}} arasındadır.',
    termination: 'Sürenin dolması veya yazılı haklı fesih bildirimiyle yetki sona erer; kazanılmış haklar saklıdır.',
    specificField: {
      key: 'tenantScreeningCriteria',
      label: 'Kiracı değerlendirme ölçütleri',
      type: 'textarea',
      required: true,
      maxLength: 1_000,
    },
    signatures: ['MALİK / YETKİ VEREN::ownerName', 'TEK YETKİLİ ŞİRKET::advisorName'],
    tags: ['kiralama', 'tek yetki'],
  }),
  descriptor({
    key: 'ilan-yayinlama-izin-belgesi',
    name: 'İlan yayınlama izin belgesi',
    category: 'AUTHORIZATION_MARKETING',
    description: 'Taşınmaz bilgilerinin seçilen ilan kanallarında yayımlanmasına ilişkin izin kapsamını belirler.',
    estimatedMinutes: 5,
    profile: 'authorization',
    purpose: 'Malik, taşınmaza ait doğru ve güncel bilgilerin seçilen mecralarda ilan olarak yayımlanmasına izin verir.',
    obligations: [
      'Şirket, ilanda kişisel iletişim bilgilerini gereksiz biçimde açıklamaz ve değişiklikleri makul sürede günceller.',
      'Malik, fiyat, durum veya satıştan çekilme değişikliklerini gecikmeden bildirir.',
    ],
    duration: 'Yayın izni {{authorizationStartDate:date}} ile {{authorizationEndDate:date}} arasında geçerlidir.',
    termination: 'Malik yazılı olarak yayından kaldırma talep edebilir; platformların teknik kaldırma süreleri saklıdır.',
    specificField: {
      key: 'publicationChannels',
      label: 'İlan yayın kanalları',
      type: 'multiselect',
      required: true,
      options: [
        { value: 'WEBSITE', label: 'Şirket web sitesi' },
        { value: 'PORTALS', label: 'Emlak portalları' },
        { value: 'SOCIAL', label: 'Sosyal medya' },
        { value: 'PRINT', label: 'Basılı materyal' },
      ],
    },
    signatures: ['İZİN VEREN MALİK::ownerName', 'HİZMET VEREN::advisorName'],
    tags: ['ilan', 'yayın izni'],
  }),
  descriptor({
    key: 'fotograf-video-cekim-yayin-izin-belgesi',
    name: 'Fotoğraf ve video çekim/yayın izin belgesi',
    category: 'AUTHORIZATION_MARKETING',
    description: 'Taşınmazın görsel kaydının alınması, düzenlenmesi ve yayımlanması için sınırları belirler.',
    estimatedMinutes: 6,
    profile: 'authorization',
    purpose: 'Malik, taşınmazın pazarlanması amacıyla fotoğraf ve video çekilmesine, gerekli teknik düzenlemelerin yapılmasına ve izin verilen kanallarda yayımlanmasına izin verir.',
    obligations: [
      'Şirket, kişileri, özel belgeleri ve güvenlik riski yaratabilecek ayrıntıları yayımlamamak için makul özen gösterir.',
      'Görsel üzerinde yapay zekâ ile temsilî değişiklik yapılırsa bunun açıkça belirtilmesi gerekir.',
    ],
    duration: 'İzin {{authorizationStartDate:date}} ile {{authorizationEndDate:date}} arasında ve pazarlama amacıyla sınırlıdır.',
    termination: 'Geri alma bildirimi, bildirimin şirkete ulaşmasından sonraki yeni kullanımlar için sonuç doğurur; daha önce basılmış materyaller ayrıca değerlendirilir.',
    specificField: {
      key: 'visualUsageScope',
      label: 'Görsel kullanım kapsamı',
      type: 'multiselect',
      required: true,
      options: [
        { value: 'LISTING', label: 'İlan' },
        { value: 'SOCIAL', label: 'Sosyal medya' },
        { value: 'BROCHURE', label: 'Broşür / sunum' },
        { value: 'INTERNATIONAL', label: 'Yurt dışı pazarlama' },
      ],
    },
    signatures: ['İZİN VEREN::ownerName', 'ÇEKİM/YAYIN SORUMLUSU::advisorName'],
    tags: ['fotoğraf', 'video', 'izin'],
  }),
  descriptor({
    key: 'anahtar-teslim-alma-belgesi',
    name: 'Anahtar teslim alma belgesi',
    category: 'AUTHORIZATION_MARKETING',
    description: 'Pazarlama ve gösterim amacıyla teslim alınan anahtarların sayısını ve saklama sorumluluğunu kaydeder.',
    estimatedMinutes: 5,
    profile: 'authorization',
    purpose: 'Malik, yalnızca yetkili gösterim ve tanıtım faaliyetlerinde kullanılmak üzere taşınmaza ait anahtarları şirkete teslim eder.',
    obligations: [
      'Şirket anahtarları güvenli biçimde saklar, yetkisiz kişilere vermez ve kullanım kaydı tutar.',
      'Malik, alarm, bina giriş kuralı ve anahtarın açtığı bölümler hakkında doğru bilgi verir.',
    ],
    duration: 'Anahtarlar {{authorizationStartDate:date}} tarihinde teslim alınır ve yetkinin sona erdiği {{authorizationEndDate:date}} tarihinde veya talep üzerine iade edilir.',
    termination: 'Anahtar kaybı veya güvenlik olayı derhal malike bildirilir; sorumluluk somut olay ve kusur durumuna göre belirlenir.',
    specificField: {
      key: 'keyCount',
      label: 'Teslim alınan anahtar sayısı',
      type: 'number',
      required: true,
      min: 1,
      max: 50,
    },
    extraFields: [
      {
        key: 'keyDescription',
        label: 'Anahtarların açtığı bölümler',
        type: 'textarea',
        required: true,
        maxLength: 600,
      },
    ],
    signatures: ['TESLİM EDEN MALİK::ownerName', 'TESLİM ALAN::advisorName'],
    tags: ['anahtar', 'teslim'],
  }),
  descriptor({
    key: 'portfoyden-cekilme-fesih-formu',
    name: 'Portföyden çekilme/fesih formu',
    category: 'AUTHORIZATION_MARKETING',
    description: 'Mevcut pazarlama yetkisinin sona erdirilmesi ve ilanların kaldırılması talebini belgeler.',
    estimatedMinutes: 5,
    profile: 'authorization',
    purpose: 'Malik, taşınmazın aktif pazarlama portföyünden çıkarılmasını ve mevcut yetkilendirme ilişkisinin belirtilen tarihte sona erdirilmesini talep eder.',
    obligations: [
      'Şirket, kontrolündeki ilanları makul teknik sürede pasife alır ve elindeki anahtar/belgeleri teslim eder.',
      'Malik, fesih öncesinde kendisine tanıştırılmış adaylara ilişkin devam eden görüşmeleri doğru şekilde bildirir.',
    ],
    duration: 'Çekilme ve fesih {{withdrawalEffectiveDate:date}} tarihi itibarıyla ileriye etkili olur.',
    termination: 'Fesih; daha önce doğmuş hizmet bedeli, belgeli gider veya üçüncü kişi haklarını kendiliğinden ortadan kaldırmaz.',
    specificField: {
      key: 'withdrawalReason',
      label: 'Portföyden çekilme / fesih nedeni',
      type: 'textarea',
      required: true,
      maxLength: 1_000,
    },
    extraFields: [
      {
        key: 'withdrawalEffectiveDate',
        label: 'Fesih geçerlilik tarihi',
        type: 'date',
        required: true,
      },
    ],
    signatures: ['FESİH TALEP EDEN::ownerName', 'TESLİM ALAN ŞİRKET::advisorName'],
    tags: ['fesih', 'portföyden çekilme'],
  }),

  descriptor({
    key: 'tasinmaz-gosterme-belgesi',
    name: 'Taşınmaz gösterme belgesi',
    category: 'SHOWING_CUSTOMER_SERVICE',
    description: 'Müşteriye gösterilen taşınmazı, gösterim zamanını ve danışmanlık ilişkisini kayıt altına alır.',
    estimatedMinutes: 5,
    profile: 'service',
    purpose: 'Müşteri, belirtilen taşınmazın şirket aracılığıyla kendisine gösterildiğini ve taşınmaz bilgisini bu hizmet kapsamında edindiğini kabul eder.',
    obligations: [
      'Şirket, gösterimi malik/kullanıcı izniyle ve güvenlik kurallarına uygun düzenler.',
      'Müşteri, taşınmaza ve eşyalara zarar vermemeyi, elde ettiği özel bilgileri amaç dışı kullanmamayı kabul eder.',
    ],
    duration: 'Gösterim {{serviceDate:datetime}} tarihinde gerçekleştirilir; bu kayıt o gösterime ilişkindir.',
    termination: 'Bu belge satış veya kira vaadi değildir; tarafların sonraki işlemden vazgeçme hakları kanun ve ayrı sözleşmelere tabidir.',
    specificField: {
      key: 'showingParticipants',
      label: 'Gösterime katılan diğer kişiler',
      type: 'textarea',
      maxLength: 500,
    },
    signatures: ['MÜŞTERİ::customerName', 'GÖSTERİMİ YAPAN::advisorName'],
    tags: ['gösterim', 'müşteri'],
  }),
  descriptor({
    key: 'yer-gosterme-tutanagi',
    name: 'Yer gösterme tutanağı',
    category: 'SHOWING_CUSTOMER_SERVICE',
    description: 'Yer gösterme işleminin gerçekleştiğini ve görülen portföyün kimliğini tutanakla tespit eder.',
    estimatedMinutes: 5,
    profile: 'service',
    purpose: 'Bu tutanak, müşteriye yerinde tanıtılan taşınmazın ve gösterim sürecinin taraflarca birlikte tespit edilmesi amacıyla düzenlenmiştir.',
    obligations: [
      'Müşteri, taşınmazı şirketin organizasyonuyla gördüğünü ve doğrudan iletişim kurulması halinde şirketi bilgilendireceğini beyan eder.',
      'Şirket, gösterim sırasında fark edilen önemli hususları müşteriye açıklar; resmî inceleme yükümlülüğü alıcı/kiracıya aittir.',
    ],
    duration: 'Tutanak {{serviceDate:datetime}} tarihli gösterim için geçerlidir.',
    termination: 'Gösterimin iptali veya taşınmazın işlemden çekilmesi halinde bu tutanak yalnızca gerçekleşen hizmetin kaydı olarak saklanır.',
    specificField: {
      key: 'showingObservations',
      label: 'Gösterim sırasında tespit edilen hususlar',
      type: 'textarea',
      required: true,
      maxLength: 1_500,
    },
    signatures: ['MÜŞTERİ::customerName', 'DANIŞMAN::advisorName'],
    tags: ['yer gösterme', 'tutanak'],
  }),
  descriptor({
    key: 'alici-talep-formu',
    name: 'Alıcı talep formu',
    category: 'SHOWING_CUSTOMER_SERVICE',
    description: 'Alıcının bölge, bütçe, taşınmaz tipi ve kullanım amacına ilişkin arama kriterlerini yapılandırır.',
    estimatedMinutes: 6,
    profile: 'service',
    purpose: 'Müşterinin satın almak istediği taşınmaza ilişkin temel ihtiyaç ve bütçe kriterleri kayda alınarak portföy eşleştirmesinde kullanılacaktır.',
    obligations: [
      'Şirket, kriterlere uygun seçenekleri makul ölçüde araştırır; bulunabilirlik veya fiyat konusunda garanti vermez.',
      'Müşteri, finansman ve bütçe bilgisini gerçeğe uygun paylaşır; kriter değişikliklerini danışmana bildirir.',
    ],
    duration: 'Talep kaydı {{serviceDate:datetime}} tarihinden itibaren müşteri tarafından güncellenene veya kapatılana kadar takip edilir.',
    termination: 'Müşteri talebini dilediği zaman kapatabilir; kişisel veri saklama süreleri ayrıca uygulanır.',
    specificField: {
      key: 'purchasePurpose',
      label: 'Satın alma amacı',
      type: 'select',
      required: true,
      options: [
        { value: 'İkamet', label: 'İkamet' },
        { value: 'Yatırım', label: 'Yatırım' },
        { value: 'Vatandaşlık', label: 'Vatandaşlık başvurusu' },
        { value: 'Diğer', label: 'Diğer' },
      ],
    },
    extraFields: [
      { key: 'desiredProvince', label: 'İstenen il', type: 'text', required: true },
      { key: 'desiredDistrict', label: 'İstenen ilçe', type: 'text', required: true },
      {
        key: 'desiredPropertyType',
        label: 'İstenen taşınmaz tipi',
        type: 'select',
        required: true,
        options: propertyTypes,
      },
      { key: 'desiredRoomCount', label: 'İstenen oda sayısı', type: 'text', required: true },
      { key: 'budgetMin', label: 'Asgari bütçe', type: 'money', required: true, min: 0 },
      { key: 'budgetMax', label: 'Azami bütçe', type: 'money', required: true, min: 0 },
    ],
    signatures: ['ALICI ADAYI::customerName', 'DANIŞMAN::advisorName'],
    tags: ['alıcı', 'talep'],
  }),
  descriptor({
    key: 'kiraci-talep-formu',
    name: 'Kiracı talep formu',
    category: 'SHOWING_CUSTOMER_SERVICE',
    description: 'Kiracı adayının konum, bütçe, süre ve kullanım kriterlerini standart biçimde toplar.',
    estimatedMinutes: 6,
    profile: 'service',
    purpose: 'Kiracı adayının aradığı taşınmaza ve planlanan kullanımına ilişkin kriterler uygun portföy eşleştirmesi amacıyla kayda alınır.',
    obligations: [
      'Şirket, adayın onayı dışında gereksiz kişisel veri toplamaz ve nihai kiralama kararının taraflara ait olduğunu bildirir.',
      'Kiracı adayı, kullanım amacı, taşınacak kişi sayısı ve bütçe bilgisini doğru verir.',
    ],
    duration: 'Talep {{serviceDate:datetime}} tarihinde açılır ve kapatılana kadar güncellenebilir.',
    termination: 'Talep kapatıldığında aktif eşleştirme durdurulur; kanuni saklama yükümlülükleri saklıdır.',
    specificField: {
      key: 'plannedOccupants',
      label: 'Taşınacak kişi sayısı',
      type: 'number',
      required: true,
      min: 1,
      max: 30,
    },
    extraFields: [
      { key: 'desiredDistrictForRent', label: 'İstenen ilçe / bölgeler', type: 'text', required: true },
      { key: 'rentBudgetMax', label: 'Azami aylık kira bütçesi', type: 'money', required: true, min: 0 },
      { key: 'desiredMoveInDate', label: 'Planlanan taşınma tarihi', type: 'date', required: true },
      { key: 'petInformation', label: 'Evcil hayvan bilgisi', type: 'text' },
    ],
    signatures: ['KİRACI ADAYI::customerName', 'DANIŞMAN::advisorName'],
    tags: ['kiracı', 'talep'],
  }),
  descriptor({
    key: 'musteri-gorusme-formu',
    name: 'Müşteri görüşme formu',
    category: 'SHOWING_CUSTOMER_SERVICE',
    description: 'Görüşmenin amacı, alınan kararlar ve takip adımlarını tek kayıtta toplar.',
    estimatedMinutes: 5,
    profile: 'service',
    purpose: 'Müşteriyle yapılan görüşmenin konusu, ihtiyaçları, sunulan bilgiler ve kararlaştırılan sonraki adımlar bu formda kayıt altına alınır.',
    obligations: [
      'Danışman, teyit edilmemiş bilgileri kesin bilgi gibi sunmaz ve önemli takip sözlerini açıkça yazar.',
      'Müşteri, yanlış veya eksik anlaşılan hususları kayıt tamamlanmadan bildirir.',
    ],
    duration: 'Görüşme {{serviceDate:datetime}} tarihinde yapılmıştır; takip tarihleri ayrıca belirtilir.',
    termination: 'Bu form tek başına bağlayıcı satış, kira veya hizmet taahhüdü oluşturmaz.',
    specificField: {
      key: 'meetingOutcome',
      label: 'Görüşme sonucu ve alınan kararlar',
      type: 'textarea',
      required: true,
      maxLength: 2_000,
    },
    extraFields: [
      { key: 'nextFollowUpDate', label: 'Sonraki takip tarihi', type: 'date' },
    ],
    signatures: ['MÜŞTERİ::customerName', 'GÖRÜŞMEYİ YAPAN::advisorName'],
    tags: ['görüşme', 'takip'],
  }),
  descriptor({
    key: 'gayrimenkul-danismanlik-hizmet-sozlesmesi',
    name: 'Gayrimenkul danışmanlık/hizmet sözleşmesi',
    category: 'SHOWING_CUSTOMER_SERVICE',
    description: 'Danışmanlık hizmetinin kapsamını, ücretini, taraf yükümlülüklerini ve iletişim düzenini belirler.',
    estimatedMinutes: 10,
    profile: 'service',
    purpose: 'Şirket, müşterinin gayrimenkul ihtiyacına yönelik araştırma, bilgilendirme, randevu ve müzakere desteği sunmayı; müşteri de kararlaştırılan iş birliği esaslarına uymayı kabul eder.',
    obligations: [
      'Şirket, mesleki özenle hareket eder, çıkar çatışmasını açıklar ve müşteri kararını baskı altına almaz.',
      'Müşteri, araştırma ve işlem için gerekli bilgileri doğru verir; resmî, teknik ve hukuki incelemeleri yetkili uzmanlara yaptırır.',
    ],
    duration: 'Hizmet {{serviceDate:datetime}} tarihinde başlar ve {{serviceEndDate:date}} tarihine kadar sürer.',
    termination: 'Taraflardan biri esaslı ihlali gidermek için makul süre veren yazılı bildirimden sonra sözleşmeyi feshedebilir.',
    specificField: {
      key: 'serviceScope',
      label: 'Danışmanlık hizmetinin kapsamı',
      type: 'multiselect',
      required: true,
      options: [
        { value: 'SEARCH', label: 'Portföy araştırma' },
        { value: 'VALUATION', label: 'Ön değerleme' },
        { value: 'NEGOTIATION', label: 'Müzakere desteği' },
        { value: 'PROCESS', label: 'İşlem takibi' },
      ],
    },
    extraFields: [
      { key: 'serviceEndDate', label: 'Hizmet bitiş tarihi', type: 'date', required: true },
    ],
    signatures: ['MÜŞTERİ::customerName', 'HİZMET VEREN::advisorName'],
    tags: ['danışmanlık', 'hizmet'],
  }),
  descriptor({
    key: 'komisyon-hizmet-bedeli-sozlesmesi',
    name: 'Komisyon ve hizmet bedeli sözleşmesi',
    category: 'SHOWING_CUSTOMER_SERVICE',
    description: 'Aracılık veya danışmanlık hizmet bedelinin doğum, oran, tahsil ve iade koşullarını açıklar.',
    estimatedMinutes: 8,
    profile: 'service',
    purpose: 'Taraflar, şirket tarafından sağlanan gayrimenkul hizmeti karşılığında doğacak hizmet bedelinin kapsamını ve ödeme koşullarını belirler.',
    obligations: [
      'Şirket, ücretin hangi hizmet ve işlem sonucunda doğacağını anlaşılır biçimde açıklar.',
      'Müşteri, ücret doğuran işlemin gerçekleşmesini ve tahsilatı etkileyen değişiklikleri şirkete bildirir.',
    ],
    duration: 'Ücret düzenlemesi {{serviceDate:datetime}} tarihinden itibaren ilgili işlem sonuçlanana veya hizmet ilişkisi sona erene kadar uygulanır.',
    termination: 'İade veya ücretin doğmaması halleri; gerçekleşen hizmet, masraf, kusur ve emredici mevzuat birlikte değerlendirilerek belirlenir.',
    specificField: {
      key: 'feeDueEvent',
      label: 'Hizmet bedelini doğuran olay',
      type: 'select',
      required: true,
      options: [
        { value: 'CONTRACT', label: 'Satış/kira sözleşmesinin kurulması' },
        { value: 'DEED', label: 'Tapu devri' },
        { value: 'SERVICE_COMPLETION', label: 'Danışmanlık hizmetinin tamamlanması' },
      ],
    },
    signatures: ['MÜŞTERİ::customerName', 'HİZMET VEREN::advisorName'],
    tags: ['komisyon', 'hizmet bedeli'],
  }),

  descriptor({
    key: 'gayrimenkul-alim-satim-sozlesmesi-taslagi',
    name: 'Gayrimenkul alım-satım sözleşmesi taslağı',
    category: 'SALES',
    description: 'Alıcı ve satıcının temel ticari mutabakatını tapu/noter işlemi öncesi taslak olarak düzenler.',
    estimatedMinutes: 14,
    profile: 'sale',
    purpose: 'Taraflar, taşınmazın belirtilen bedel ve koşullarla devrine ilişkin irade ve hazırlık esaslarını bu taslakta kayıt altına alır.',
    obligations: [
      'Satıcı, mülkiyet, takyidat, vergi borcu ve fiilî kullanım durumunu doğru açıklamak ve devir için gerekli belgeleri hazırlamakla yükümlüdür.',
      'Alıcı, ödeme kaynağı ve finansmanını zamanında hazır etmek; taşınmazın hukuki ve teknik incelemesini yaptırmakla yükümlüdür.',
    ],
    duration: 'Taraflar tapu/noter işlemini hedeflenen {{deedTransferDate:date}} tarihine kadar tamamlamayı planlar.',
    termination: 'Devrin gerçekleşmemesi halinde ödeme, gider ve tazminat sonuçları kusur, imkânsızlık ve emredici hukuk kurallarına göre ayrıca belirlenir.',
    specificField: {
      key: 'encumbranceDisclosure',
      label: 'Takyidat ve borç açıklaması',
      type: 'textarea',
      required: true,
      maxLength: 1_500,
    },
    signatures: ['ALICI::buyerName', 'SATICI::sellerName', 'DANIŞMAN::advisorName'],
    tags: ['satış', 'taslak', 'tapu'],
    officialFormWarning: 'Taşınmaz mülkiyetinin devri resmî şekle tabidir. Bu taslak tapu müdürlüğü veya kanunen yetkili noter önündeki resmî satış işleminin yerine geçmez.',
  }),
  descriptor({
    key: 'satin-alma-teklif-formu',
    name: 'Satın alma teklif formu',
    category: 'SALES',
    description: 'Alıcı adayının fiyat, ödeme ve geçerlilik süresi içeren satın alma teklifini yapılandırır.',
    estimatedMinutes: 7,
    profile: 'sale',
    purpose: 'Alıcı, taşınmazı belirtilen bedel ve ödeme koşullarıyla satın alma niyetini satıcının değerlendirmesine sunar.',
    obligations: [
      'Teklif, satıcının yazılı kabulüne kadar tek başına satış sözleşmesi oluşturmaz.',
      'Alıcı, finansman koşulu ve teklifin bağlı olduğu inceleme şartlarını açıkça bildirir.',
    ],
    duration: 'Teklif {{offerExpiryDate:datetime}} tarih ve saatine kadar geçerlidir; bu sürede kabul edilmezse kendiliğinden sona erer.',
    termination: 'Kabul öncesi geri alma ve kabul sonrası sonuçlar teklif metni, emredici hukuk ve tarafların sonraki sözleşmesine göre değerlendirilir.',
    specificField: {
      key: 'offerExpiryDate',
      label: 'Teklif geçerlilik sonu',
      type: 'datetime',
      required: true,
    },
    extraFields: [
      yesNoField('financingCondition', 'Teklif finansman koşuluna bağlı mı?'),
    ],
    signatures: ['TEKLİF VEREN ALICI::buyerName', 'TEKLİFİ İLETEN::advisorName'],
    tags: ['satın alma', 'teklif'],
  }),
  descriptor({
    key: 'satis-teklifi-kabul-formu',
    name: 'Satış teklifi/kabul formu',
    category: 'SALES',
    description: 'Sunulan satış teklifinin satıcı tarafından kabul, karşı teklif veya ret şeklinde cevaplanmasını belgeler.',
    estimatedMinutes: 7,
    profile: 'sale',
    purpose: 'Satıcı, kendisine iletilen satın alma teklifini belirtilen karar ve koşullarla cevaplar; tarafların sonraki resmî işlem takvimi kayda alınır.',
    obligations: [
      'Satıcı, kabul veya karşı teklif koşullarını açıkça belirtir.',
      'Alıcıya cevap gecikmeden iletilir; resmî devir tamamlanmadan mülkiyet geçmez.',
    ],
    duration: 'Satıcının bu formdaki cevabı {{acceptanceExpiryDate:datetime}} tarihine kadar geçerlidir.',
    termination: 'Karşı teklif, önceki teklifin kabulü sayılmaz; alıcının ayrıca kabulü gerekir.',
    specificField: {
      key: 'sellerDecision',
      label: 'Satıcının kararı',
      type: 'select',
      required: true,
      options: [
        { value: 'ACCEPT', label: 'Kabul' },
        { value: 'COUNTER', label: 'Karşı teklif' },
        { value: 'REJECT', label: 'Ret' },
      ],
    },
    extraFields: [
      { key: 'acceptanceExpiryDate', label: 'Cevap geçerlilik sonu', type: 'datetime', required: true },
      {
        key: 'counterOfferTerms',
        label: 'Karşı teklif koşulları',
        type: 'textarea',
        required: true,
        visibleWhen: { field: 'sellerDecision', equals: 'COUNTER' },
      },
    ],
    signatures: ['ALICI::buyerName', 'SATICI::sellerName', 'DANIŞMAN::advisorName'],
    tags: ['satış', 'teklif', 'kabul'],
  }),
  descriptor({
    key: 'kapora-teslim-belgesi',
    name: 'Kapora teslim belgesi',
    category: 'SALES',
    description: 'Satış bedeline mahsuben verilen kaporanın tutarını, teslimini, iade ve cayma koşullarını kayıt altına alır.',
    estimatedMinutes: 12,
    profile: 'sale',
    purpose: '{{province}} ili, {{district}} ilçesi, {{neighborhood}} Mahallesi’nde bulunan {{propertyType:property}} niteliğindeki taşınmazın satışı için, toplam {{salePrice:money}} satış bedeline mahsuben {{depositAmount:money}} kapora teslim edilmiştir.',
    obligations: [
      'Kaporayı alan, tutarı yalnızca bu belgede belirtilen işlem amacıyla teslim aldığını ve nihai satış bedeline mahsup edeceğini kabul eder.',
      'Taraflar, tapu ve taşınmaz incelemelerinin kapora verilmiş olması nedeniyle ortadan kalkmadığını kabul eder.',
    ],
    duration: 'Kapora {{paymentDate:date}} tarihinde teslim edilmiş olup kalan ödemenin {{remainingPaymentDate:date}}, planlanan tapu devrinin {{deedTransferDate:date}} tarihinde yapılması öngörülmüştür.',
    termination: 'İade koşulu: {{refundCondition}} Cayma koşulu: {{withdrawalCondition}} Bu koşullar emredici hukuk ve somut olay bakımından hukuk uzmanına kontrol ettirilmelidir.',
    specificField: partyField('depositGiverName', 'Kaporayı veren kişi'),
    extraFields: [
      partyField('depositReceiverName', 'Kaporayı alan kişi'),
      { key: 'depositReceiverTitle', label: 'Kaporayı alanın sıfatı', type: 'text', required: true },
      { key: 'depositAmount', label: 'Kapora tutarı', type: 'money', required: true, min: 1 },
      { key: 'remainingPaymentDate', label: 'Kalan ödeme tarihi', type: 'date', required: true },
      { key: 'refundCondition', label: 'Kaporanın iade koşulları', type: 'textarea', required: true },
      { key: 'withdrawalCondition', label: 'Tarafların cayması halindeki koşullar', type: 'textarea', required: true },
    ],
    signatures: [
      'KAPORAYI VEREN::depositGiverName',
      'KAPORAYI ALAN::depositReceiverName',
      'ALICI::buyerName',
      'SATICI::sellerName',
    ],
    tags: ['kapora', 'satış', 'teslim'],
  }),
  descriptor({
    key: 'on-odeme-alindi-belgesi',
    name: 'Ön ödeme/alındı belgesi',
    category: 'SALES',
    description: 'Belirli işlem için yapılan ön ödemenin miktarını, ödeme amacını ve mahsup düzenini belgeler.',
    estimatedMinutes: 7,
    profile: 'sale',
    purpose: 'Alıcı tarafından yapılan ön ödemenin satış bedeline mahsuben teslim alındığı ve ödemenin amacı bu belgeyle kayıt altına alınır.',
    obligations: [
      'Teslim alan, ödeme tutarı ve yöntemini doğrular; varsa banka dekontunu belgeye ekler.',
      'Taraflar, ön ödemenin kapora, cayma parası veya avans niteliğini açıkça belirler.',
    ],
    duration: 'Ön ödeme {{paymentDate:date}} tarihinde alınmış ve nihai hesaplaşma {{deedTransferDate:date}} tarihine planlanmıştır.',
    termination: 'İşlemin gerçekleşmemesi halinde iade ve mahsup, seçilen ödeme niteliği ve tarafların kusuruna göre değerlendirilir.',
    specificField: {
      key: 'advanceAmount',
      label: 'Ön ödeme tutarı',
      type: 'money',
      required: true,
      min: 1,
    },
    extraFields: [
      {
        key: 'advanceNature',
        label: 'Ödemenin niteliği',
        type: 'select',
        required: true,
        options: [
          { value: 'ADVANCE', label: 'Avans' },
          { value: 'DEPOSIT', label: 'Kapora' },
          { value: 'WITHDRAWAL_MONEY', label: 'Cayma parası' },
        ],
      },
    ],
    signatures: ['ÖDEYEN::buyerName', 'TESLİM ALAN::sellerName'],
    tags: ['ön ödeme', 'alındı'],
  }),
  descriptor({
    key: 'kapora-iade-tutanagi',
    name: 'Kapora iade tutanağı',
    category: 'SALES',
    description: 'Daha önce teslim edilen kaporanın iade tutarı, yöntemi ve tarafların kalan taleplerini kayıt altına alır.',
    estimatedMinutes: 7,
    profile: 'sale',
    purpose: 'Taraflar, önceki satış görüşmesi kapsamında alınan kaporanın bu tutanakta belirtilen tutar ve yöntemle iade edildiğini kayıt altına alır.',
    obligations: [
      'İade eden, ödemenin banka veya nakit teslim kaydını sağlar.',
      'İade alan, aldığı tutarı kontrol eder ve varsa bakiye itirazını açıkça yazar.',
    ],
    duration: 'İade {{refundDate:date}} tarihinde gerçekleştirilmiştir.',
    termination: 'İadenin tarafları tamamen ibra edip etmediği yalnızca açık ibra beyanı varsa ve kanunen geçerliyse sonuç doğurur.',
    specificField: {
      key: 'refundedDepositAmount',
      label: 'İade edilen kapora tutarı',
      type: 'money',
      required: true,
      min: 0,
    },
    extraFields: [
      { key: 'refundDate', label: 'İade tarihi', type: 'date', required: true },
      { key: 'refundReason', label: 'İade nedeni', type: 'textarea', required: true },
      yesNoField('fullSettlement', 'Taraflar karşılıklı olarak tamamen ibra oluyor mu?'),
    ],
    signatures: ['İADE EDEN::sellerName', 'İADE ALAN::buyerName'],
    tags: ['kapora', 'iade'],
  }),
  descriptor({
    key: 'cayma-iade-tutanagi',
    name: 'Cayma ve iade tutanağı',
    category: 'SALES',
    description: 'Satış görüşmesinden cayma kararını, yapılan ödemelerin iadesini ve açık kalan yükümlülükleri belirler.',
    estimatedMinutes: 8,
    profile: 'sale',
    purpose: 'Taraflar, planlanan taşınmaz satış işleminden belirtilen nedenle vazgeçildiğini ve buna bağlı mali hesaplaşmayı bu tutanakla tespit eder.',
    obligations: [
      'Taraflar, birbirlerine teslim ettikleri para, belge ve anahtarları ayrı ayrı listeler.',
      'Danışman, taraf iradelerini kayıt altına alır; hukuki sonuç hakkında garanti vermez.',
    ],
    duration: 'Cayma ve hesaplaşma {{withdrawalDate:date}} tarihi itibarıyla geçerlidir.',
    termination: 'İade edilen tutar, kesinti ve kalan uyuşmazlıklar açıkça yazılır; genel ibra yoruma bırakılmaz.',
    specificField: {
      key: 'withdrawalParty',
      label: 'Cayan taraf',
      type: 'select',
      required: true,
      options: [
        { value: 'BUYER', label: 'Alıcı' },
        { value: 'SELLER', label: 'Satıcı' },
        { value: 'MUTUAL', label: 'Karşılıklı mutabakat' },
      ],
    },
    extraFields: [
      { key: 'withdrawalDate', label: 'Cayma tarihi', type: 'date', required: true },
      { key: 'withdrawalReasonDetail', label: 'Cayma nedeni', type: 'textarea', required: true },
      { key: 'settlementAmount', label: 'İade / hesaplaşma tutarı', type: 'money', required: true, min: 0 },
    ],
    signatures: ['ALICI::buyerName', 'SATICI::sellerName', 'TANIK/DANIŞMAN::advisorName'],
    tags: ['cayma', 'iade', 'tutanak'],
  }),
  descriptor({
    key: 'tasinmaz-teslim-tutanagi',
    name: 'Taşınmaz teslim tutanağı',
    category: 'SALES',
    description: 'Satış sonrası taşınmazın fiilî teslim durumunu, sayaçları, kusurları ve teslim edilenleri kaydeder.',
    estimatedMinutes: 10,
    profile: 'sale',
    purpose: 'Satıcı, taşınmazın fiilî kullanımını ve zilyetliğini belirtilen durumuyla alıcıya teslim eder.',
    obligations: [
      'Taraflar sayaç değerlerini, görülebilir hasarları, demirbaşları ve teslim edilen belgeleri birlikte kontrol eder.',
      'Gizli ayıp ve kanuni sorumluluklar bu tutanakla kendiliğinden ortadan kalkmaz.',
    ],
    duration: 'Fiilî teslim {{deliveryDate:datetime}} tarihinde yapılmıştır.',
    termination: 'Eksik veya ayıplı teslim hususları giderim tarihiyle birlikte tutanağa yazılır; açık kalemler tamamlanana kadar saklanır.',
    specificField: {
      key: 'deliveryCondition',
      label: 'Taşınmazın teslim anındaki durumu',
      type: 'textarea',
      required: true,
      maxLength: 2_000,
    },
    extraFields: [
      { key: 'deliveryDate', label: 'Teslim tarihi ve saati', type: 'datetime', required: true },
      { key: 'meterReadings', label: 'Sayaç değerleri', type: 'textarea', required: true },
    ],
    signatures: ['TESLİM EDEN SATICI::sellerName', 'TESLİM ALAN ALICI::buyerName'],
    tags: ['taşınmaz', 'teslim', 'satış'],
  }),
  descriptor({
    key: 'satis-anahtar-teslim-tutanagi',
    name: 'Anahtar teslim tutanağı',
    category: 'SALES',
    description: 'Satış işlemi kapsamında anahtar ve erişim araçlarının alıcıya teslimini belgeler.',
    estimatedMinutes: 5,
    profile: 'sale',
    purpose: 'Satıcı, taşınmaza ait anahtar, kart, kumanda ve erişim araçlarını alıcıya teslim eder.',
    obligations: [
      'Teslim edilen her erişim aracı tür ve adet olarak sayılır.',
      'Alıcı, teslim sonrası şifre ve erişim kodlarını güvenlik amacıyla değiştirmekten sorumludur.',
    ],
    duration: 'Anahtar teslimi {{keyDeliveryDate:datetime}} tarihinde yapılmıştır.',
    termination: 'Eksik anahtar veya erişim aracı varsa tamamlama tarihi ve sorumlusu ayrıca yazılır.',
    specificField: {
      key: 'saleKeyCount',
      label: 'Teslim edilen anahtar adedi',
      type: 'number',
      required: true,
      min: 1,
      max: 100,
    },
    extraFields: [
      { key: 'keyDeliveryDate', label: 'Anahtar teslim tarihi ve saati', type: 'datetime', required: true },
      { key: 'accessDevices', label: 'Kart, kumanda ve diğer erişim araçları', type: 'textarea' },
    ],
    signatures: ['TESLİM EDEN SATICI::sellerName', 'TESLİM ALAN ALICI::buyerName'],
    tags: ['anahtar', 'teslim', 'satış'],
  }),

  descriptor({
    key: 'konut-kira-sozlesmesi',
    name: 'Konut kira sözleşmesi',
    category: 'RENTAL',
    description: 'Konutun kullanım amacı, kira bedeli, depozito, giderler ve teslim koşullarını kapsamlı düzenler.',
    estimatedMinutes: 15,
    profile: 'rental',
    purpose: 'Kiraya veren, taşınmazı yalnızca konut olarak kullanılmak üzere kiracıya bırakmayı; kiracı kira bedelini ödemeyi ve taşınmazı özenle kullanmayı kabul eder.',
    obligations: [
      'Kiraya veren, taşınmazı kararlaştırılan tarihte kullanıma elverişli halde teslim eder ve zorunlu büyük onarımları kanuna uygun biçimde yürütür.',
      'Kiracı, komşuluk ve yönetim kurallarına uyar, olağan kullanım dışındaki zararı bildirir ve izinsiz esaslı değişiklik yapmaz.',
    ],
    duration: 'Kira {{leaseStartDate:date}} tarihinde başlar ve {{leaseDurationMonths:number}} ay sürer; uzama ve fesih TBK hükümlerine tabidir.',
    termination: 'Bildirim süreleri, tahliye ve depozito iadesi emredici kira hükümleri gözetilerek uygulanır.',
    specificField: {
      key: 'residentialUseOnly',
      label: 'Yalnızca konut olarak kullanım kabul edildi mi?',
      type: 'boolean',
      required: true,
      defaultValue: true,
    },
    signatures: ['KİRAYA VEREN::landlordName', 'KİRACI::tenantName', 'KEFİL::guarantorName'],
    tags: ['konut', 'kira'],
  }),
  descriptor({
    key: 'is-yeri-kira-sozlesmesi',
    name: 'İş yeri kira sözleşmesi',
    category: 'RENTAL',
    description: 'İş yerinin faaliyet konusu, kira, gider, ruhsat ve teslim koşullarını düzenler.',
    estimatedMinutes: 16,
    profile: 'rental',
    purpose: 'Kiraya veren, taşınmazı belirtilen ticari faaliyet amacıyla kiracıya bırakır; ruhsat ve faaliyet uygunluğu tarafların sorumluluk paylaşımına göre yürütülür.',
    obligations: [
      'Kiracı, faaliyet için gerekli ruhsat ve izinleri almak, çevre ve yönetim kurallarına uymakla yükümlüdür.',
      'Kiraya veren, kendi yetki ve mülkiyet alanındaki belgeleri makul sürede sağlar; belirli faaliyet için ruhsat garantisi vermez.',
    ],
    duration: 'Kira {{leaseStartDate:date}} tarihinde başlar ve {{leaseDurationMonths:number}} ay sürer.',
    termination: 'Temerrüt, ruhsat alınamaması, kullanım amacına aykırılık ve tahliye sonuçları somut olaya göre ayrıca incelenir.',
    specificField: {
      key: 'businessActivity',
      label: 'İş yerinde yürütülecek faaliyet',
      type: 'text',
      required: true,
      maxLength: 300,
    },
    extraFields: [
      yesNoField('licenseResponsibilityAccepted', 'Ruhsat sorumluluğu kiracı tarafından kabul edildi mi?', true),
    ],
    signatures: ['KİRAYA VEREN::landlordName', 'KİRACI::tenantName', 'KEFİL::guarantorName'],
    tags: ['iş yeri', 'kira'],
  }),
  descriptor({
    key: 'depozito-teslim-belgesi',
    name: 'Depozito teslim belgesi',
    category: 'RENTAL',
    description: 'Kira ilişkisi kapsamında teslim edilen güvence bedelinin tutarı, yöntemi ve iade ölçütlerini kaydeder.',
    estimatedMinutes: 6,
    profile: 'rental',
    purpose: 'Kiracı, kira sözleşmesindeki yükümlülüklerin güvencesi olarak depozito tutarını kiraya verene teslim eder.',
    obligations: [
      'Teslim alan depozito tutarını ve ödeme yöntemini doğrular.',
      'Depozitonun kullanımı ve iadesi TBK’nın emredici hükümleri ile somut kira ilişkisine göre yürütülür.',
    ],
    duration: 'Depozito {{depositDeliveryDate:date}} tarihinde teslim edilmiştir.',
    termination: 'Kira sonunda borç, hasar ve teslim durumu birlikte tespit edildikten sonra kanuna uygun iade hesabı yapılır.',
    specificField: {
      key: 'depositDeliveryDate',
      label: 'Depozito teslim tarihi',
      type: 'date',
      required: true,
    },
    extraFields: [
      { key: 'depositRefundCriteria', label: 'Depozito iade ölçütleri', type: 'textarea', required: true },
    ],
    signatures: ['TESLİM EDEN KİRACI::tenantName', 'TESLİM ALAN KİRAYA VEREN::landlordName'],
    tags: ['depozito', 'teslim'],
  }),
  descriptor({
    key: 'kira-tahsilat-alindi-belgesi',
    name: 'Kira tahsilat/alındı belgesi',
    category: 'RENTAL',
    description: 'Belirli döneme ait kira ödemesinin tutarını, tarihini ve ödeme yöntemini belgeler.',
    estimatedMinutes: 5,
    profile: 'rental',
    purpose: 'Kiracının belirtilen kira dönemine ilişkin ödemesi teslim alınmış ve bu belgeyle tahsilat kaydı oluşturulmuştur.',
    obligations: [
      'Tahsil eden, tutarı ve hangi aya/döneme ait olduğunu açıkça doğrular.',
      'Kısmi ödeme varsa kalan bakiye ayrıca yazılır; belge diğer borçlar için genel ibra oluşturmaz.',
    ],
    duration: 'Tahsilat {{rentPaymentDate:date}} tarihinde gerçekleştirilmiştir.',
    termination: 'Hatalı veya mükerrer ödeme halinde banka kayıtları ve taraf teyitleri üzerinden düzeltme yapılır.',
    specificField: {
      key: 'rentPeriod',
      label: 'Ödemenin ait olduğu kira dönemi',
      type: 'text',
      required: true,
      maxLength: 120,
    },
    extraFields: [
      { key: 'rentPaymentDate', label: 'Tahsilat tarihi', type: 'date', required: true },
      { key: 'rentPaidAmount', label: 'Tahsil edilen tutar', type: 'money', required: true, min: 0 },
    ],
    signatures: ['ÖDEYEN KİRACI::tenantName', 'TAHSİL EDEN::landlordName'],
    tags: ['kira', 'tahsilat', 'alındı'],
  }),
  descriptor({
    key: 'demirbas-listesi',
    name: 'Demirbaş listesi',
    category: 'RENTAL',
    description: 'Kiralanan taşınmazdaki eşya ve demirbaşların adet, durum ve ayırt edici özelliklerini kaydeder.',
    estimatedMinutes: 8,
    profile: 'rental',
    purpose: 'Taşınmazla birlikte kiracıya teslim edilen demirbaşlar, teslim anındaki durumlarıyla bu listede kayıt altına alınır.',
    obligations: [
      'Taraflar her kalemi birlikte kontrol eder; fotoğraflar varsa ek olarak numaralandırılır.',
      'Kiracı olağan kullanımdan doğan eskime dışında oluşan hasarı gecikmeden bildirir.',
    ],
    duration: 'Demirbaş kontrolü {{inventoryCheckDate:date}} tarihinde yapılmıştır.',
    termination: 'Kira sonunda aynı liste üzerinden iade kontrolü yapılır; eksik veya hasarlı kalemler somut delillerle değerlendirilir.',
    specificField: {
      key: 'inventoryCheckDate',
      label: 'Demirbaş kontrol tarihi',
      type: 'date',
      required: true,
    },
    extraFields: [
      { key: 'detailedInventory', label: 'Demirbaşların ayrıntılı listesi ve durumu', type: 'textarea', required: true, maxLength: 5_000 },
      { key: 'inventoryAttachments', label: 'Fotoğraf/ek bilgisi', type: 'file' },
    ],
    signatures: ['KİRAYA VEREN::landlordName', 'KİRACI::tenantName'],
    tags: ['demirbaş', 'eşya'],
  }),
  descriptor({
    key: 'tasinmaz-durum-tespit-tutanagi',
    name: 'Taşınmaz durum tespit tutanağı',
    category: 'RENTAL',
    description: 'Kiralama başlangıcında duvar, zemin, tesisat, sayaç ve görülebilir kusurları ayrıntılı kaydeder.',
    estimatedMinutes: 10,
    profile: 'rental',
    purpose: 'Taşınmazın kira başlangıcındaki fiziksel durumu, görülebilir eksik ve kusurlarıyla birlikte taraflarca tespit edilmiştir.',
    obligations: [
      'Taraflar odaları ve temel tesisatı birlikte inceler; fotoğraf eklerini tarih ve sıra numarasıyla ilişkilendirir.',
      'Bu tespit görünmeyen teknik kusurlar bakımından uzman incelemesinin yerine geçmez.',
    ],
    duration: 'Durum tespiti {{conditionInspectionDate:datetime}} tarihinde yapılmıştır.',
    termination: 'Kira sonunda yapılacak karşılaştırmada olağan yıpranma ile zarar ayrımı bu başlangıç kaydı ve kanuni ölçütlerle yapılır.',
    specificField: {
      key: 'conditionInspectionDate',
      label: 'Durum tespit tarihi ve saati',
      type: 'datetime',
      required: true,
    },
    extraFields: [
      { key: 'conditionFindings', label: 'Oda, tesisat ve görülebilir kusur tespitleri', type: 'textarea', required: true, maxLength: 5_000 },
    ],
    signatures: ['KİRAYA VEREN::landlordName', 'KİRACI::tenantName'],
    tags: ['durum tespiti', 'kira'],
  }),
  descriptor({
    key: 'kiralanan-tasinmaz-teslim-tutanagi',
    name: 'Kiralanan taşınmaz teslim tutanağı',
    category: 'RENTAL',
    description: 'Kiralananın fiilî teslimini, sayaç değerlerini, anahtarları ve mevcut durumu kaydeder.',
    estimatedMinutes: 9,
    profile: 'rental',
    purpose: 'Kiraya veren, kiralananı sözleşmede kararlaştırılan kullanım için kiracıya fiilen teslim eder.',
    obligations: [
      'Sayaç değerleri, anahtar sayısı, görünür durum ve teslim edilen belgeler birlikte kontrol edilir.',
      'Kiracı, teslim anında gördüğü eksikleri tutanağa yazdırır; kanuni ayıp hakları saklıdır.',
    ],
    duration: 'Teslim {{rentalDeliveryDate:datetime}} tarihinde gerçekleşmiştir.',
    termination: 'Eksik teslim kalemlerinin sorumlusu ve tamamlanma tarihi ayrıca belirlenir.',
    specificField: {
      key: 'rentalDeliveryDate',
      label: 'Kiralanan teslim tarihi ve saati',
      type: 'datetime',
      required: true,
    },
    extraFields: [
      { key: 'rentalMeterReadings', label: 'Sayaç değerleri', type: 'textarea', required: true },
      { key: 'rentalDeliveryNotes', label: 'Teslim durumu ve eksikler', type: 'textarea', required: true },
    ],
    signatures: ['TESLİM EDEN KİRAYA VEREN::landlordName', 'TESLİM ALAN KİRACI::tenantName'],
    tags: ['kiralanan', 'teslim'],
  }),
  descriptor({
    key: 'kira-anahtar-teslim-tutanagi',
    name: 'Anahtar teslim tutanağı',
    category: 'RENTAL',
    description: 'Kira başlangıcı veya sonunda anahtar ve erişim araçlarının teslimini sayısal olarak belgeler.',
    estimatedMinutes: 5,
    profile: 'rental',
    purpose: 'Kiralanana ait anahtar ve erişim araçları belirtilen yönde ve adette teslim edilmiştir.',
    obligations: [
      'Taraflar anahtar, kart ve kumandaları birlikte sayar.',
      'Teslim alan, erişim araçlarını güvenli saklamak ve yetkisiz çoğaltmamakla yükümlüdür.',
    ],
    duration: 'Anahtar işlemi {{rentalKeyDate:datetime}} tarihinde yapılmıştır.',
    termination: 'Kayıp veya eksik anahtarın yenileme ve güvenlik gideri kusur durumuna göre belirlenir.',
    specificField: {
      key: 'rentalKeyDirection',
      label: 'Teslim yönü',
      type: 'select',
      required: true,
      options: [
        { value: 'TO_TENANT', label: 'Kiraya verenden kiracıya' },
        { value: 'TO_LANDLORD', label: 'Kiracıdan kiraya verene' },
      ],
    },
    extraFields: [
      { key: 'rentalKeyDate', label: 'Anahtar teslim tarihi', type: 'datetime', required: true },
      { key: 'rentalKeyCount', label: 'Anahtar adedi', type: 'number', required: true, min: 1 },
    ],
    signatures: ['KİRAYA VEREN::landlordName', 'KİRACI::tenantName'],
    tags: ['anahtar', 'kira'],
  }),
  descriptor({
    key: 'tahliye-taahhutnamesi-taslagi',
    name: 'Tahliye taahhütnamesi taslağı',
    category: 'RENTAL',
    description: 'Kiracının belirli tarihte tahliye iradesini yalnızca hukuk kontrolüne sunulacak taslak olarak hazırlar.',
    estimatedMinutes: 7,
    profile: 'rental',
    purpose: 'Kiracı, kanuni şekil ve zaman koşullarına uygunluğu ayrıca kontrol edilmek üzere taşınmazı belirtilen tarihte tahliye etmeye ilişkin iradesini taslak olarak beyan eder.',
    obligations: [
      'Tahliye taahhüdünün kira ilişkisinin kurulmasından ve teslimden sonraki özgür iradeyi yansıtması gerekir.',
      'Kiraya veren, tahliye talebinde kanuni süre ve başvuru yollarına uymakla yükümlüdür.',
    ],
    duration: 'Taslakta öngörülen tahliye tarihi {{promisedEvictionDate:date}} olarak belirtilmiştir.',
    termination: 'Geçerlilik, düzenlenme zamanı, irade ve şekil şartlarına bağlıdır; bu çıktı tek başına icra veya tahliye garantisi vermez.',
    specificField: {
      key: 'promisedEvictionDate',
      label: 'Taahhüt edilen tahliye tarihi',
      type: 'date',
      required: true,
    },
    extraFields: [
      yesNoField('signedAfterDelivery', 'Taşınmaz tesliminden sonra mı imzalanıyor?'),
    ],
    signatures: ['KİRACI / TAAHHÜT EDEN::tenantName', 'KİRAYA VEREN::landlordName'],
    tags: ['tahliye', 'taahhüt', 'taslak'],
    officialFormWarning: 'Tahliye taahhüdü sıkı tarih, irade ve şekil koşullarına tabidir. İmzalanmadan önce mutlaka hukuk uzmanına inceletilmelidir.',
  }),
  descriptor({
    key: 'kira-sozlesmesi-fesih-protokol-taslagi',
    name: 'Kira sözleşmesi fesih/protokol taslağı',
    category: 'RENTAL',
    description: 'Kira ilişkisinin sona erme tarihi, teslim, borç ve depozito hesaplaşmasını taslak protokolde düzenler.',
    estimatedMinutes: 10,
    profile: 'rental',
    purpose: 'Taraflar, mevcut kira ilişkisinin karşılıklı mutabakatla sona erdirilmesine ve taşınmazın iadesine ilişkin koşulları bu taslak protokolde belirler.',
    obligations: [
      'Kiracı taşınmazı, anahtarları ve demirbaşları kararlaştırılan tarihte teslim eder.',
      'Kiraya veren, kira, aidat, hasar ve depozito hesaplaşmasını belgeler üzerinden yapar.',
    ],
    duration: 'Kira ilişkisi {{terminationEffectiveDate:date}} tarihinde sona erecek; teslim {{terminationDeliveryDate:datetime}} tarihinde yapılacaktır.',
    termination: 'Bakiye borç, depozito iadesi ve ibra kapsamı açıkça yazılmadan tarafların haklarından vazgeçtiği varsayılmaz.',
    specificField: {
      key: 'terminationEffectiveDate',
      label: 'Fesih geçerlilik tarihi',
      type: 'date',
      required: true,
    },
    extraFields: [
      { key: 'terminationDeliveryDate', label: 'Teslim tarihi ve saati', type: 'datetime', required: true },
      { key: 'depositSettlement', label: 'Depozito hesaplaşması', type: 'textarea', required: true },
      { key: 'outstandingDebts', label: 'Kalan borç ve alacaklar', type: 'textarea', required: true },
    ],
    signatures: ['KİRAYA VEREN::landlordName', 'KİRACI::tenantName'],
    tags: ['kira', 'fesih', 'protokol'],
  }),

  descriptor({
    key: 'portfoy-bilgi-formu',
    name: 'Portföy bilgi formu',
    category: 'PORTFOLIO_PROPERTY',
    description: 'Bir taşınmazın temel kimlik, fiyat, kullanım ve pazarlama bilgilerini tek portföy kaydında toplar.',
    estimatedMinutes: 8,
    profile: 'property',
    purpose: 'Taşınmazın portföy oluşturma ve pazarlama hazırlığında kullanılacak temel bilgileri malik beyanı ve mevcut kayıtlar üzerinden derlenmiştir.',
    obligations: [
      'Malik, portföy bilgisindeki değişiklikleri şirkete bildirir.',
      'Danışman, doğrulanmamış beyanları resmî kayıt gibi sunmaz ve ilan öncesi temel tutarlılık kontrolü yapar.',
    ],
    duration: 'Form {{issueDate:date}} tarihinde düzenlenmiş olup bilgiler değiştikçe yeni sürüm hazırlanır.',
    termination: 'Portföy kapatıldığında form arşivlenir; saklama süreleri ve erişim yetkileri korunur.',
    specificField: {
      key: 'marketingHighlights',
      label: 'Pazarlamada öne çıkarılacak özellikler',
      type: 'textarea',
      required: true,
      maxLength: 1_500,
    },
    signatures: ['BİLGİYİ VEREN MALİK::ownerName', 'FORMU DÜZENLEYEN::advisorName'],
    tags: ['portföy', 'bilgi formu'],
  }),
  descriptor({
    key: 'tasinmaz-ozellik-tespit-formu',
    name: 'Taşınmaz özellik tespit formu',
    category: 'PORTFOLIO_PROPERTY',
    description: 'Taşınmazın fiziksel, teknik ve çevresel özelliklerini gözleme dayalı olarak yapılandırır.',
    estimatedMinutes: 12,
    profile: 'property',
    purpose: 'Taşınmazın görülebilir fiziksel özellikleri, donatıları ve çevresel nitelikleri pazarlama ve ön değerlendirme amacıyla tespit edilmiştir.',
    obligations: [
      'Danışman yalnızca gözlenebilir ve beyan edilen bilgileri kaydeder; teknik ekspertiz yapmış sayılmaz.',
      'Malik, gizli kusur veya önemli teknik sorunu bildirmekle yükümlüdür.',
    ],
    duration: 'Tespit {{featureInspectionDate:datetime}} tarihinde yapılmıştır.',
    termination: 'Sonradan yapılan değişiklikler yeni tespit formuyla kayda alınır.',
    specificField: {
      key: 'featureInspectionDate',
      label: 'Özellik tespit tarihi ve saati',
      type: 'datetime',
      required: true,
    },
    extraFields: [
      { key: 'technicalFeatures', label: 'Teknik özellik ve donatılar', type: 'textarea', required: true, maxLength: 3_000 },
      { key: 'environmentFeatures', label: 'Konum ve çevre özellikleri', type: 'textarea', required: true, maxLength: 2_000 },
    ],
    signatures: ['MALİK::ownerName', 'TESPİTİ YAPAN::advisorName'],
    tags: ['taşınmaz', 'özellik', 'tespit'],
  }),
  descriptor({
    key: 'mulk-sahibi-gorusme-formu',
    name: 'Mülk sahibi görüşme formu',
    category: 'PORTFOLIO_PROPERTY',
    description: 'Malikin satış/kiralama hedefini, beklentilerini, zamanlamasını ve karar ölçütlerini kaydeder.',
    estimatedMinutes: 7,
    profile: 'property',
    purpose: 'Mülk sahibiyle yapılan görüşmede taşınmazın işlem hedefi, beklenen fiyat, zamanlama ve hizmet beklentileri kayda alınmıştır.',
    obligations: [
      'Danışman, piyasa tahminini garanti olarak sunmaz ve kararları malik onayına bırakır.',
      'Malik, kararını etkileyen mülkiyet, aile, ortaklık veya finansman koşullarını gerekli ölçüde açıklar.',
    ],
    duration: 'Görüşme {{ownerMeetingDate:datetime}} tarihinde yapılmıştır.',
    termination: 'Bu görüşme formu tek başına yetkilendirme sözleşmesi oluşturmaz.',
    specificField: {
      key: 'ownerMeetingDate',
      label: 'Malik görüşme tarihi',
      type: 'datetime',
      required: true,
    },
    extraFields: [
      { key: 'ownerMotivation', label: 'Malikin işlem nedeni ve hedefi', type: 'textarea', required: true },
      { key: 'decisionTimeline', label: 'Karar ve işlem zamanlaması', type: 'text', required: true },
    ],
    signatures: ['MÜLK SAHİBİ::ownerName', 'DANIŞMAN::advisorName'],
    tags: ['malik', 'görüşme'],
  }),
  descriptor({
    key: 'ekspertiz-on-bilgi-formu',
    name: 'Ekspertiz ön bilgi formu',
    category: 'PORTFOLIO_PROPERTY',
    description: 'Resmî ekspertiz öncesi değerlemeyi etkileyebilecek temel beyan ve karşılaştırma bilgilerini toplar.',
    estimatedMinutes: 9,
    profile: 'property',
    purpose: 'Taşınmaz için resmî ekspertiz veya lisanslı değerleme yapılmadan önce gerekli olabilecek ön bilgiler ve malik beyanları derlenmiştir.',
    obligations: [
      'Bu formdaki fiyat görüşü resmî değerleme raporu değildir.',
      'Malik, tadilat, takyidat, kira ve gelir gibi değeri etkileyen hususları doğru bildirir.',
    ],
    duration: 'Ön bilgi formu {{issueDate:date}} tarihindeki verileri yansıtır.',
    termination: 'Piyasa veya taşınmaz bilgisi değiştiğinde form güncellenmeden kullanılmamalıdır.',
    specificField: {
      key: 'comparableEvidence',
      label: 'Karşılaştırılabilir satış/kira örnekleri',
      type: 'textarea',
      required: true,
      maxLength: 2_500,
    },
    extraFields: [
      { key: 'estimatedMarketRange', label: 'Ön piyasa değer aralığı', type: 'text', required: true },
    ],
    signatures: ['BİLGİ VEREN MALİK::ownerName', 'ÖN İNCELEMEYİ YAPAN::advisorName'],
    tags: ['ekspertiz', 'ön bilgi'],
  }),
  descriptor({
    key: 'tapu-tasinmaz-belge-kontrol-listesi',
    name: 'Tapu ve taşınmaz belge kontrol listesi',
    category: 'PORTFOLIO_PROPERTY',
    description: 'Tapu, kimlik, vekâlet, takyidat ve işlem belgelerinin görülme/kopya durumunu takip eder.',
    estimatedMinutes: 8,
    profile: 'property',
    purpose: 'Taşınmaza ilişkin işlem hazırlığında görülmesi veya yetkili merciden doğrulanması gereken belgeler kontrol listesi halinde kaydedilmiştir.',
    obligations: [
      'Danışman, belgenin görülmüş olmasını hukuki geçerlilik veya güncellik garantisi olarak sunmaz.',
      'Malik, belge kopyalarının doğru ve güncel olduğunu beyan eder; resmî doğrulama ilgili kurumdan yapılır.',
    ],
    duration: 'Kontrol {{documentCheckDate:date}} tarihinde yapılmıştır.',
    termination: 'Eksik belgeler tamamlandığında yeni kontrol tarihi ve sonucu işlenir.',
    specificField: {
      key: 'documentCheckDate',
      label: 'Belge kontrol tarihi',
      type: 'date',
      required: true,
    },
    extraFields: [
      {
        key: 'checkedDocuments',
        label: 'Kontrol edilen belgeler',
        type: 'multiselect',
        required: true,
        options: [
          { value: 'DEED', label: 'Tapu senedi' },
          { value: 'ID', label: 'Kimlik / şirket belgesi' },
          { value: 'POWER', label: 'Vekâletname' },
          { value: 'ENCUMBRANCE', label: 'Takyidat kaydı' },
          { value: 'DASK', label: 'DASK' },
          { value: 'TAX', label: 'Vergi / rayiç belgesi' },
        ],
      },
      { key: 'missingDocuments', label: 'Eksik veya güncellenecek belgeler', type: 'textarea' },
    ],
    signatures: ['MALİK::ownerName', 'KONTROL EDEN::advisorName'],
    tags: ['tapu', 'belge kontrol'],
    officialFormWarning: 'Kontrol listesi tapu sicilinin veya resmî kurum kayıtlarının yerine geçmez; işlem günü güncel resmî kayıt ayrıca kontrol edilmelidir.',
  }),
  descriptor({
    key: 'imar-iskan-ruhsat-kontrol-listesi',
    name: 'İmar, iskan ve ruhsat kontrol listesi',
    category: 'PORTFOLIO_PROPERTY',
    description: 'Taşınmazın imar, yapı ruhsatı, iskan ve kullanım amacı belgelerinin takip listesini oluşturur.',
    estimatedMinutes: 9,
    profile: 'property',
    purpose: 'Taşınmazla ilgili imar, yapı ruhsatı, yapı kullanma izin belgesi ve faaliyet ruhsatı gibi kayıtların ön kontrolü yapılmıştır.',
    obligations: [
      'Danışman teknik veya imar hukuku uzmanı sıfatıyla görüş vermez; resmî kurum doğrulamasına yönlendirir.',
      'Malik, aykırı imalat ve kullanım değişikliklerini bildirmekle yükümlüdür.',
    ],
    duration: 'Kontrol {{planningCheckDate:date}} tarihindeki belge ve beyanlara dayanır.',
    termination: 'Eksik veya çelişkili kayıt varsa ilgili belediye/kurum incelemesi tamamlanmadan kesin ifade kullanılmaz.',
    specificField: {
      key: 'planningCheckDate',
      label: 'İmar/ruhsat kontrol tarihi',
      type: 'date',
      required: true,
    },
    extraFields: [
      { key: 'planningDocumentsStatus', label: 'İmar, ruhsat ve iskan belgelerinin durumu', type: 'textarea', required: true },
      { key: 'nonComplianceNotes', label: 'Aykırılık veya inceleme notları', type: 'textarea' },
    ],
    signatures: ['BİLGİ VEREN MALİK::ownerName', 'KONTROL EDEN::advisorName'],
    tags: ['imar', 'iskan', 'ruhsat'],
    officialFormWarning: 'Bu liste belediye, tapu, yapı denetim veya teknik uzman incelemesinin yerine geçmez.',
  }),
  descriptor({
    key: 'tasinmaz-inceleme-durum-raporu',
    name: 'Taşınmaz inceleme/durum raporu',
    category: 'PORTFOLIO_PROPERTY',
    description: 'Yerinde inceleme bulgularını, güçlü yönleri, riskleri ve önerilen takip adımlarını raporlar.',
    estimatedMinutes: 12,
    profile: 'property',
    purpose: 'Taşınmazın yerinde gözlenen mevcut durumu, pazarlama hazırlığı ve gerekli takip kontrolleri bu raporda özetlenmiştir.',
    obligations: [
      'Rapor yalnızca gözleme ve sunulan belgelere dayanır; statik, elektrik, tesisat veya hukuki ekspertiz değildir.',
      'Önemli risk veya çelişkiler ayrı başlık altında açıkça belirtilir.',
    ],
    duration: 'İnceleme {{inspectionReportDate:datetime}} tarihinde yapılmıştır.',
    termination: 'Koşullar değiştiğinde rapor yeni tarih ve sürümle yenilenmelidir.',
    specificField: {
      key: 'inspectionReportDate',
      label: 'İnceleme tarihi ve saati',
      type: 'datetime',
      required: true,
    },
    extraFields: [
      { key: 'positiveFindings', label: 'Olumlu bulgular', type: 'textarea', required: true },
      { key: 'riskFindings', label: 'Risk ve eksik bulguları', type: 'textarea', required: true },
      { key: 'recommendedActions', label: 'Önerilen takip adımları', type: 'textarea', required: true },
    ],
    signatures: ['MALİK::ownerName', 'İNCELEMEYİ YAPAN::advisorName'],
    tags: ['inceleme', 'durum raporu'],
  }),
  descriptor({
    key: 'teslim-edilen-evraklar-tutanagi',
    name: 'Teslim edilen evraklar tutanağı',
    category: 'PORTFOLIO_PROPERTY',
    description: 'Malik ile şirket arasında fiziksel/dijital evrak teslimini tür, adet ve iade koşuluyla belgeler.',
    estimatedMinutes: 6,
    profile: 'property',
    purpose: 'Taşınmaz işlemi kapsamında şirkete veya malike teslim edilen evraklar tür ve adetleriyle bu tutanakta kaydedilmiştir.',
    obligations: [
      'Teslim alan, evrakları güvenli saklar ve yalnızca işlem amacıyla kullanır.',
      'Asıl belgeler ile kopyalar açıkça ayrılır; iade gereken asıllar için teslim tarihi belirlenir.',
    ],
    duration: 'Evrak teslimi {{documentDeliveryDate:datetime}} tarihinde yapılmıştır.',
    termination: 'İşlem sona erdiğinde asıl evraklar tutanakla iade edilir; kanuni saklama zorunluluğu bulunan kopyalar korunur.',
    specificField: {
      key: 'documentDeliveryDate',
      label: 'Evrak teslim tarihi ve saati',
      type: 'datetime',
      required: true,
    },
    extraFields: [
      { key: 'deliveredDocuments', label: 'Teslim edilen evrakların ayrıntılı listesi', type: 'textarea', required: true, maxLength: 4_000 },
      yesNoField('containsOriginals', 'Teslimde asıl belge var mı?'),
      { key: 'plannedReturnDate', label: 'Planlanan asıl evrak iade tarihi', type: 'date', visibleWhen: { field: 'containsOriginals', truthy: true } },
    ],
    signatures: ['TESLİM EDEN::ownerName', 'TESLİM ALAN::advisorName'],
    tags: ['evrak', 'teslim'],
  }),

  descriptor({
    key: 'alici-bilgi-formu',
    name: 'Alıcı bilgi formu',
    category: 'CUSTOMER_PRIVACY',
    description: 'Alıcının iletişim, işlem amacı ve hizmet için gerekli temel bilgilerini ölçülü biçimde kaydeder.',
    estimatedMinutes: 6,
    profile: 'privacy',
    purpose: 'İlgili kişinin alıcı adayı olarak portföy araştırması, iletişim ve işlem takibi için gerekli temel bilgileri kayda alınır.',
    obligations: [
      'Yalnızca hizmet için gerekli ve ölçülü bilgiler işlenir.',
      'İlgili kişi iletişim ve tercih bilgilerindeki değişiklikleri bildirebilir.',
    ],
    duration: 'Kayıt {{consentDate:date}} tarihinde oluşturulur ve {{retentionPeriod}} boyunca saklanır.',
    termination: 'Talep kapanınca aktif takip durdurulur; silme ve saklama işlemleri yasal yükümlülüklerle birlikte değerlendirilir.',
    specificField: {
      key: 'buyerFinancingStatus',
      label: 'Finansman durumu',
      type: 'select',
      required: true,
      options: [
        { value: 'CASH_READY', label: 'Nakit hazır' },
        { value: 'CREDIT', label: 'Kredi kullanılacak' },
        { value: 'PLANNING', label: 'Finansman planlanıyor' },
      ],
    },
    signatures: ['İLGİLİ KİŞİ::dataSubjectName', 'FORMU ALAN::advisorName'],
    tags: ['alıcı', 'bilgi', 'KVKK'],
  }),
  descriptor({
    key: 'satici-bilgi-formu',
    name: 'Satıcı bilgi formu',
    category: 'CUSTOMER_PRIVACY',
    description: 'Satıcının kimlik, iletişim, temsil ve işlem tercihlerini hizmet amacıyla kaydeder.',
    estimatedMinutes: 6,
    profile: 'privacy',
    purpose: 'İlgili kişinin satıcı/malik olarak hizmet, iletişim ve işlem takibinde gerekli temel bilgileri kayda alınır.',
    obligations: [
      'Mülkiyet ve temsil belgeleri yalnızca yetkili kişilerce görüntülenir.',
      'Satıcı, ortaklık veya temsil durumunu etkileyen değişiklikleri bildirir.',
    ],
    duration: 'Kayıt {{consentDate:date}} tarihinde oluşturulur ve {{retentionPeriod}} ölçütüne göre saklanır.',
    termination: 'Aktif hizmet sona erdiğinde erişim daraltılır; yasal saklama süreleri sonunda güvenli silme uygulanır.',
    specificField: {
      key: 'sellerAuthorityBasis',
      label: 'Satış yetkisinin dayanağı',
      type: 'select',
      required: true,
      options: [
        { value: 'OWNER', label: 'Malik' },
        { value: 'POWER_OF_ATTORNEY', label: 'Vekâletname' },
        { value: 'COMPANY_AUTHORITY', label: 'Şirket temsil yetkisi' },
        { value: 'OTHER', label: 'Diğer' },
      ],
    },
    signatures: ['SATICI / MALİK::dataSubjectName', 'FORMU ALAN::advisorName'],
    tags: ['satıcı', 'bilgi', 'KVKK'],
  }),
  descriptor({
    key: 'kiraci-bilgi-formu',
    name: 'Kiracı bilgi formu',
    category: 'CUSTOMER_PRIVACY',
    description: 'Kiracı adayının iletişim ve kiralama değerlendirmesi için gerekli ölçülü bilgilerini toplar.',
    estimatedMinutes: 6,
    profile: 'privacy',
    purpose: 'İlgili kişinin kiracı adayı olarak portföy eşleştirmesi ve kiralama sürecinde gerekli temel bilgileri işlenir.',
    obligations: [
      'Gelir veya referans bilgileri amaçla sınırlı ve erişimi kısıtlı tutulur.',
      'Hassas veri niteliğindeki bilgiler gereksiz yere istenmez.',
    ],
    duration: 'Kayıt {{consentDate:date}} tarihinde oluşturulur ve {{retentionPeriod}} boyunca saklanır.',
    termination: 'Kiralama talebi kapatıldığında aktif değerlendirme durdurulur; hukuki saklama yükümlülükleri saklıdır.',
    specificField: {
      key: 'tenantOccupation',
      label: 'Meslek / çalışma durumu',
      type: 'text',
      required: true,
      maxLength: 180,
    },
    extraFields: [
      { key: 'tenantReferenceSummary', label: 'İsteğe bağlı referans özeti', type: 'textarea' },
    ],
    signatures: ['KİRACI ADAYI::dataSubjectName', 'FORMU ALAN::advisorName'],
    tags: ['kiracı', 'bilgi', 'KVKK'],
  }),
  descriptor({
    key: 'kiraya-veren-bilgi-formu',
    name: 'Kiraya veren bilgi formu',
    category: 'CUSTOMER_PRIVACY',
    description: 'Kiraya verenin iletişim, temsil ve ödeme tercihlerini kiralama hizmeti için kaydeder.',
    estimatedMinutes: 6,
    profile: 'privacy',
    purpose: 'İlgili kişinin kiraya veren sıfatıyla kiralama hizmeti, iletişim ve işlem takibi için gerekli bilgileri kayda alınır.',
    obligations: [
      'Banka ve kimlik bilgilerine erişim görevle sınırlanır.',
      'Kiraya veren, yetki ve iletişim bilgilerindeki değişiklikleri bildirir.',
    ],
    duration: 'Kayıt {{consentDate:date}} tarihinde oluşturulur ve {{retentionPeriod}} ölçütüne göre saklanır.',
    termination: 'Hizmet sona erdiğinde gereksiz veriler silinir veya anonimleştirilir.',
    specificField: {
      key: 'landlordPaymentPreference',
      label: 'Kira tahsilat tercihi',
      type: 'select',
      required: true,
      options: paymentMethods,
    },
    signatures: ['KİRAYA VEREN::dataSubjectName', 'FORMU ALAN::advisorName'],
    tags: ['kiraya veren', 'bilgi', 'KVKK'],
  }),
  descriptor({
    key: 'kvkk-aydinlatma-metni',
    name: 'KVKK aydınlatma metni',
    category: 'CUSTOMER_PRIVACY',
    description: 'Veri sorumlusu, amaç, hukuki sebep, aktarım, yöntem ve ilgili kişi haklarını ayrı bir aydınlatma metninde sunar.',
    estimatedMinutes: 8,
    profile: 'privacy',
    purpose: 'Veri sorumlusu; kimlik, iletişim, müşteri işlem, portföy tercih ve sözleşme bilgilerinin hangi amaçlarla, hangi yöntemlerle ve hangi hukuki sebeplere dayanarak işlendiği konusunda ilgili kişiyi aydınlatır.',
    obligations: [
      'Veriler; hizmetin yürütülmesi, sözleşme ve hukuki yükümlülüklerin yerine getirilmesi, talep/şikâyet yönetimi ve açık rıza varsa pazarlama amaçlarıyla sınırlı işlenir.',
      'İlgili kişi KVKK’nın 11. maddesindeki bilgi talep etme, düzeltme, silme/yok etme, aktarılanları öğrenme, otomatik sonuca itiraz ve zararın giderilmesini isteme haklarını veri sorumlusuna başvurarak kullanabilir.',
    ],
    duration: 'Aydınlatma {{consentDate:date}} tarihinde sunulmuş; saklama ölçütü {{retentionPeriod}} olarak açıklanmıştır.',
    termination: 'Aydınlatma açık rıza değildir. Amaç, veri kategorisi veya alıcı grubu değişirse metin güncellenir ve ilgili kişiye yeniden sunulur.',
    specificField: {
      key: 'legalGrounds',
      label: 'Kişisel veri işleme hukuki sebepleri',
      type: 'multiselect',
      required: true,
      options: [
        { value: 'CONTRACT', label: 'Sözleşmenin kurulması/ifası' },
        { value: 'LEGAL_OBLIGATION', label: 'Hukuki yükümlülük' },
        { value: 'LEGITIMATE_INTEREST', label: 'Meşru menfaat' },
        { value: 'RIGHT', label: 'Bir hakkın tesisi/kullanılması' },
        { value: 'CONSENT', label: 'Açık rıza' },
      ],
    },
    extraFields: [
      { key: 'recipientGroups', label: 'Veri aktarılabilecek alıcı grupları', type: 'textarea', required: true },
      { key: 'collectionMethods', label: 'Veri toplama yöntemleri', type: 'textarea', required: true },
      { key: 'applicationAddress', label: 'İlgili kişi başvuru adresi/kanalı', type: 'contact', required: true },
    ],
    signatures: ['AYDINLATILAN İLGİLİ KİŞİ::dataSubjectName', 'VERİ SORUMLUSU TEMSİLCİSİ::advisorName'],
    tags: ['KVKK', 'aydınlatma'],
    legalStatus: 'NEEDS_UPDATE',
  }),
  descriptor({
    key: 'acik-riza-metni',
    name: 'Açık rıza metni',
    category: 'CUSTOMER_PRIVACY',
    description: 'Açık rıza gerektiren belirli veri işleme faaliyetleri için özgür, belirli ve bilgilendirilmiş tercihi kaydeder.',
    estimatedMinutes: 7,
    profile: 'privacy',
    purpose: 'İlgili kişi, aydınlatma metninden ayrı olarak ve yalnızca seçilen amaçlar bakımından kişisel verilerinin işlenmesine özgür iradesiyle açık rıza verip vermediğini beyan eder.',
    obligations: [
      'Rıza hizmetin zorunlu olmayan unsurları için ayrı seçeneklerle alınır ve hizmet şartı haline getirilmez.',
      'İlgili kişi rızasını ileriye etkili olarak geri alabilir; geri alma öncesi işlemenin hukuka uygunluğu etkilenmez.',
    ],
    duration: 'Beyan {{consentDate:date}} tarihinde alınmıştır; rıza geri çekilene veya amaç sona erene kadar değerlendirilir.',
    termination: 'Rıza verilmemesi veya geri alınması, açık rıza dışındaki geçerli hukuki sebeplere dayalı işlemleri kendiliğinden ortadan kaldırmaz.',
    specificField: {
      key: 'specialConsentPurposes',
      label: 'Açık rıza verilen özel amaçlar',
      type: 'multiselect',
      required: true,
      options: [
        { value: 'MARKETING', label: 'Kişiselleştirilmiş pazarlama' },
        { value: 'IMAGE', label: 'Fotoğraf/görüntü kullanımı' },
        { value: 'OVERSEAS', label: 'Yurt dışına veri aktarımı' },
        { value: 'PROFILE', label: 'Tercih profili oluşturma' },
      ],
    },
    signatures: ['İLGİLİ KİŞİ::dataSubjectName', 'BEYANI ALAN::advisorName'],
    tags: ['KVKK', 'açık rıza'],
    legalStatus: 'NEEDS_UPDATE',
  }),
  descriptor({
    key: 'elektronik-ticari-iletisim-izni',
    name: 'Elektronik ticari ileti izni',
    category: 'CUSTOMER_PRIVACY',
    description: 'SMS, telefon, e-posta ve benzeri kanallardan ticari ileti tercihini kanal bazında kaydeder.',
    estimatedMinutes: 5,
    profile: 'privacy',
    purpose: 'İlgili kişi, seçtiği elektronik iletişim kanalları üzerinden kampanya, portföy ve hizmet tanıtımı içerikli ticari ileti alıp almama tercihini beyan eder.',
    obligations: [
      'Hizmet sağlayıcı, onay ve ret kayıtlarını yürürlükteki kurallara ve İYS yükümlülüklerine uygun yönetir.',
      'Her iletide kolay ve ücretsiz ret imkânı sağlanır; ret bildirimi sonrası yasal sürede gönderim durdurulur.',
    ],
    duration: 'İleti tercihi {{consentDate:date}} tarihinde alınmış olup ilgili kişi tarafından değiştirilene kadar geçerlidir.',
    termination: 'Ret hakkı her zaman kullanılabilir; ret, zorunlu işlem ve hizmet bilgilendirmelerini mevzuatın izin verdiği ölçüde etkilemez.',
    specificField: {
      key: 'commercialChannels',
      label: 'İzin verilen ileti kanalları',
      type: 'multiselect',
      required: true,
      options: [
        { value: 'SMS', label: 'SMS' },
        { value: 'PHONE', label: 'Telefon araması' },
        { value: 'EMAIL', label: 'E-posta' },
        { value: 'WHATSAPP', label: 'WhatsApp' },
      ],
    },
    extraFields: [
      { key: 'brandNameForMessages', label: 'İletide görünecek hizmet sağlayıcı/marka', type: 'company', required: true, autofill: 'company.name' },
    ],
    signatures: ['ALICI / İLGİLİ KİŞİ::dataSubjectName', 'HİZMET SAĞLAYICI::advisorName'],
    tags: ['ticari ileti', 'İYS', 'izin'],
    legalStatus: 'NEEDS_UPDATE',
  }),
  descriptor({
    key: 'fotograf-goruntu-kullanim-izni',
    name: 'Fotoğraf ve görüntü kullanım izni',
    category: 'CUSTOMER_PRIVACY',
    description: 'Kişinin yer aldığı fotoğraf ve görüntülerin belirli amaç ve kanallarda kullanım tercihini kaydeder.',
    estimatedMinutes: 6,
    profile: 'privacy',
    purpose: 'İlgili kişi, kendisinin yer aldığı fotoğraf ve görüntülerin seçilen amaç, süre ve mecralarla sınırlı kullanılmasına izin verip vermediğini beyan eder.',
    obligations: [
      'Görüntüler kişiyi küçük düşürücü, yanıltıcı veya izin kapsamını aşan bağlamda kullanılmaz.',
      'Üçüncü kişilerin ve çocukların görüntüleri için ayrıca uygun yetki ve rıza kontrolü yapılır.',
    ],
    duration: 'İzin {{consentDate:date}} tarihinde verilmiş ve {{imageUsageEndDate:date}} tarihine kadar sınırlandırılmıştır.',
    termination: 'İzin ileriye etkili olarak geri alınabilir; daha önce basılan veya yayımlanan içeriklerin kaldırılması teknik ve hukuki imkânlar içinde yürütülür.',
    specificField: {
      key: 'imageUsageChannels',
      label: 'Görüntü kullanım kanalları',
      type: 'multiselect',
      required: true,
      options: [
        { value: 'WEBSITE', label: 'Web sitesi' },
        { value: 'SOCIAL', label: 'Sosyal medya' },
        { value: 'PRINT', label: 'Basılı tanıtım' },
        { value: 'INTERNAL', label: 'Şirket içi sunum' },
      ],
    },
    extraFields: [
      { key: 'imageUsageEndDate', label: 'Kullanım izni bitiş tarihi', type: 'date', required: true },
      { key: 'imageDescription', label: 'İzin kapsamındaki görüntülerin açıklaması', type: 'textarea', required: true },
    ],
    signatures: ['İZİN VEREN İLGİLİ KİŞİ::dataSubjectName', 'İZNİ ALAN::advisorName'],
    tags: ['fotoğraf', 'görüntü', 'izin'],
    legalStatus: 'NEEDS_UPDATE',
  }),
];

function sourcesForCategory(category: DocumentCategory): DocumentSource[] {
  if (category === 'CUSTOMER_PRIVACY') {
    return [SOURCES.kvkk, SOURCES.commercialMessages];
  }
  if (category === 'PORTFOLIO_PROPERTY') {
    return [SOURCES.realEstate, SOURCES.deed];
  }
  if (category === 'AUTHORIZATION_MARKETING') {
    return [SOURCES.realEstate, SOURCES.obligations];
  }
  return [SOURCES.obligations, SOURCES.realEstate];
}

function buildTemplate(
  descriptorValue: TemplateDescriptor
): DocumentTemplateDefinition {
  const fields = [
    ...baseFields,
    ...profileFields(descriptorValue.profile),
    descriptorValue.specificField,
    ...(descriptorValue.extraFields || []),
  ].filter(
    (field, index, list) =>
      list.findIndex((candidate) => candidate.key === field.key) === index
  );

  return {
    key: descriptorValue.key,
    name: descriptorValue.name,
    category: descriptorValue.category,
    description: descriptorValue.description,
    estimatedMinutes: descriptorValue.estimatedMinutes,
    version: 1,
    active: true,
    updatedAt: UPDATED_AT,
    lastReviewedAt: REVIEWED_AT,
    legalStatus: descriptorValue.legalStatus || 'DRAFT',
    legalNotice: DOCUMENT_LEGAL_NOTICE,
    officialFormWarning: descriptorValue.officialFormWarning,
    sources: sourcesForCategory(descriptorValue.category),
    fields,
    sections: buildSections(descriptorValue),
    signatureRoles: descriptorValue.signatures,
    tags: descriptorValue.tags,
  };
}

export const documentTemplates = descriptors.map(buildTemplate);

export const DOCUMENT_TEMPLATE_NAMES = [
  'Satış yetkilendirme sözleşmesi',
  'Kiralama yetkilendirme sözleşmesi',
  'Tek yetkili satış sözleşmesi',
  'Tek yetkili kiralama sözleşmesi',
  'İlan yayınlama izin belgesi',
  'Fotoğraf ve video çekim/yayın izin belgesi',
  'Anahtar teslim alma belgesi',
  'Portföyden çekilme/fesih formu',
  'Taşınmaz gösterme belgesi',
  'Yer gösterme tutanağı',
  'Alıcı talep formu',
  'Kiracı talep formu',
  'Müşteri görüşme formu',
  'Gayrimenkul danışmanlık/hizmet sözleşmesi',
  'Komisyon ve hizmet bedeli sözleşmesi',
  'Gayrimenkul alım-satım sözleşmesi taslağı',
  'Satın alma teklif formu',
  'Satış teklifi/kabul formu',
  'Kapora teslim belgesi',
  'Ön ödeme/alındı belgesi',
  'Kapora iade tutanağı',
  'Cayma ve iade tutanağı',
  'Taşınmaz teslim tutanağı',
  'Anahtar teslim tutanağı',
  'Konut kira sözleşmesi',
  'İş yeri kira sözleşmesi',
  'Depozito teslim belgesi',
  'Kira tahsilat/alındı belgesi',
  'Demirbaş listesi',
  'Taşınmaz durum tespit tutanağı',
  'Kiralanan taşınmaz teslim tutanağı',
  'Anahtar teslim tutanağı',
  'Tahliye taahhütnamesi taslağı',
  'Kira sözleşmesi fesih/protokol taslağı',
  'Portföy bilgi formu',
  'Taşınmaz özellik tespit formu',
  'Mülk sahibi görüşme formu',
  'Ekspertiz ön bilgi formu',
  'Tapu ve taşınmaz belge kontrol listesi',
  'İmar, iskan ve ruhsat kontrol listesi',
  'Taşınmaz inceleme/durum raporu',
  'Teslim edilen evraklar tutanağı',
  'Alıcı bilgi formu',
  'Satıcı bilgi formu',
  'Kiracı bilgi formu',
  'Kiraya veren bilgi formu',
  'KVKK aydınlatma metni',
  'Açık rıza metni',
  'Elektronik ticari ileti izni',
  'Fotoğraf ve görüntü kullanım izni',
] as const;

export function getDocumentTemplate(key: string) {
  const template = documentTemplates.find((item) => item.key === key);
  if (!template) throw new Error('Belge şablonu bulunamadı.');
  return template;
}
