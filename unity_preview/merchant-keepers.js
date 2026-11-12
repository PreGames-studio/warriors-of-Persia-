/** Dedicated full-resolution portraits for all 18 catalog merchants. Forge and apothecary use their existing dedicated screens. */
export const MERCHANT_KEEPERS = Object.freeze({
  jeweler: {image:'./assets/merchants/keepers/jeweler.png',description:'جمشید، گوهرشناس با تک‌چشمی و ردای آبی، در حال بررسی فیروزه'},
  astrologer: {image:'./assets/merchants/keepers/astrologer.png',description:'مهرسپهر، ستاره‌شناس سالخورده با شنل بنفش و اسطرلاب'},
  carpet_bazaar: {image:'./assets/merchants/keepers/carpet_bazaar.png',description:'بانو پرنیان با روسری اناری و قالی دست‌باف در سرای ابریشم'},
  teahouse: {image:'./assets/merchants/keepers/teahouse.png',description:'پهلوان بهرام، چایچی تنومند با سبیل تاب‌داده، کنار سماور'},
  district_shop_01: {image:'./assets/merchants/keepers/district_shop_01.png',description:'رستم، سلاح‌فروش جوان با نشان زخم ابرو، میان نیزه‌ها و کمان‌ها'},
  district_shop_02: {image:'./assets/merchants/keepers/district_shop_02.png',description:'اردشیر، زره‌فروش کهنه‌سرباز با ریش خاکستری، در حال بررسی کلاه‌خود'},
  district_shop_03: {image:'./assets/merchants/keepers/district_shop_03.png',description:'کاوش، چرم‌دوز جوان با موی بسته و پیش‌بند چرمی، در حال دوخت چکمه'},
  district_shop_04: {image:'./assets/merchants/keepers/district_shop_04.png',description:'ماهور، زیورساز با موی بلند و لباس عاجی، با گردنبند نقره'},
  district_shop_05: {image:'./assets/merchants/bookshop-dana.png',description:'دانا، کتاب‌فروش، پشت پیشخوان کتابخانه'},
  district_shop_06: {image:'./assets/merchants/keepers/district_shop_06.png',description:'روشن، شمع‌ساز سالخورده با کلاه زعفرانی و فتیلهٔ مومی'},
  district_shop_07: {image:'./assets/merchants/keepers/district_shop_07.png',description:'فرهاد، نانوای آردآلود و خندان با پاروی نان کنار تنور'},
  district_shop_08: {image:'./assets/merchants/keepers/district_shop_08.png',description:'نسترن، خیاط جوان با روسری فیروزه‌ای و متر روی شانه، در حال دوخت ردای ابریشمی'},
  district_shop_09: {image:'./assets/merchants/keepers/district_shop_09.png',description:'آریا، طلسم‌ساز با گیسوی بافته و ردای بنفش، میان مهرها و بخور'},
  district_shop_10: {image:'./assets/merchants/keepers/district_shop_10.png',description:'زاگرس، زنبوردار آفتاب‌سوخته با کلاه حصیری و قاب عسل کوهستان'},
  district_shop_11: {image:'./assets/merchants/keepers/district_shop_11.png',description:'ارغوان، روغن‌فروش سالخورده با روسری سبز، در حال پرکردن شیشهٔ روغن گیاهی'},
  district_shop_12: {image:'./assets/merchants/keepers/district_shop_12.png',description:'شهریار، زین‌ساز با پیش‌بند چرمی و رکاب، میان خورجین‌ها و افسارها'},
  district_shop_13: {image:'./assets/merchants/keepers/district_shop_13.png',description:'کاسپین، سفالگر جوان با سربند و دستان گلی، پشت چرخ سفالگری'},
  district_shop_14: {image:'./assets/merchants/keepers/district_shop_14.png',description:'دارا، سکه‌فروش با عینک گرد و کت زرشکی، در حال بررسی نشان زرین'}
});
export function merchantKeeper(shopId){return MERCHANT_KEEPERS[shopId]||{image:'./assets/merchants/merchant-hall.jpg',description:'حجرهٔ بازرگان پارسی'};}
