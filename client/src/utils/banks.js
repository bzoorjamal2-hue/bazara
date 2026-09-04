// البنوك الفلسطينية المدعومة عبر بوّابة Lahza — مصدرها GET /bank من API لحظة.
// code: رمز البنك عند Lahza (يُرسَل عند إنشاء الحساب الفرعي).
// swift: رمز SWIFT/BIC الرسمي للبنك.
const BANKS = [
  { code: 'AB',   name: 'Arab Bank',                            nameAr: 'البنك العربي',                   swift: 'ARABPS22' },
  { code: 'BOP',  name: 'Bank of Palestine',                    nameAr: 'بنك فلسطين',                     swift: 'PABORPS1' },
  { code: 'QUDS', name: 'Quds Bank',                            nameAr: 'بنك القدس',                      swift: 'QUDSPS22' },
  { code: 'ISBK', name: 'Palestine Islamic Bank',               nameAr: 'البنك الإسلامي الفلسطيني',       swift: 'PISBPS22' },
  { code: 'CAB',  name: 'Cairo Amman Bank',                     nameAr: 'بنك القاهرة عمّان',              swift: 'CAAMPS22' },
  { code: 'PIB',  name: 'Palestine Investment Bank',            nameAr: 'بنك فلسطين للاستثمار',           swift: 'PINVPS22' },
  { code: 'SAFA', name: 'Safa Bank',                            nameAr: 'بنك صفا',                        swift: 'SAFAPS22' },
  { code: 'AIB',  name: 'Arab Islamic Bank',                    nameAr: 'البنك الإسلامي العربي',          swift: 'ARIBPS22' },
  { code: 'BOJ',  name: 'Bank of Jordan',                       nameAr: 'بنك الأردن',                     swift: 'BJORPS22' },
  { code: 'HBTF', name: 'Housing Bank for Trade and Finance',   nameAr: 'بنك الإسكان للتجارة والتمويل',  swift: 'HBTFPS22' },
  { code: 'EALB', name: 'Egyptian Arab Land Bank',              nameAr: 'البنك العقاري المصري العربي',    swift: 'EALBPS22' },
  { code: 'TNB',  name: 'The National Bank',                    nameAr: 'البنك الوطني',                   swift: 'TNBKPS22' },
  { code: 'JAB',  name: 'Jordan Ahli Bank',                     nameAr: 'البنك الأهلي الأردني',           swift: 'JAHLPS22' },
  { code: 'JCB',  name: 'Jordan Commercial Bank',               nameAr: 'البنك التجاري الأردني',          swift: 'JCBLPS22' },
];

export default BANKS;
