/**
 * Test fixture corpus with 40 realistic, anonymized Hebrew & English courier SMS,
 * email, and notification samples across Israeli and global delivery networks.
 */

export const SMS_CORPUS = [
  // 1. Israel Post
  {
    id: 'ilp-branch-pickup',
    rawText: 'שלום, דבר דואר שמספרו RS948219481IL נמסר לחלוקה ביחידת הדואר דיזנגוף סנטר תל אביב. שעות פתיחה: 08:00-19:00.',
    expected: {
      trackingNumber: 'RS948219481IL',
      carrier: 'israel-post',
      pickupLocation: 'דיזנגוף סנטר תל אביב'
    }
  },
  {
    id: 'ilp-itemtrace-url',
    rawText: 'דואר ישראל: חבילתך שמספרה EE123456789IL הגיעה לארץ. למעקב: https://mypost.israelpost.co.il/itemtrace?itemcode=EE123456789IL',
    expected: {
      trackingNumber: 'EE123456789IL',
      carrier: 'israel-post'
    }
  },
  {
    id: 'ilp-branch-code',
    rawText: 'דואר ישראל: דבר דואר שמספרו RR987654321IL מחכה לך בסניף אבן גבירול. קוד איסוף: 4821',
    expected: {
      trackingNumber: 'RR987654321IL',
      carrier: 'israel-post',
      pickupLocation: 'אבן גבירול',
      lockerPin: '4821'
    }
  },
  {
    id: 'ilp-en-branch',
    rawText: 'Israel Post: Your shipment RR123456789IL has arrived at branch Dizengoff Center. Collection code: 9942',
    expected: {
      trackingNumber: 'RR123456789IL',
      carrier: 'israel-post',
      pickupLocation: 'Dizengoff Center',
      lockerPin: '9942'
    }
  },

  // 2. Cheetah / Chita
  {
    id: 'chita-locker-pin-url',
    rawText: 'חבילה מחברת צ\'יטה שמספרה CH10849201 מחכה לך בלוקר סופר פארם גבעתיים. קוד לאיסוף: 8392. למעקב: https://chtr.co.il/t/CH10849201',
    expected: {
      trackingNumber: 'CH10849201',
      carrier: 'chita',
      pickupLocation: 'סופר פארם גבעתיים',
      lockerPin: '8392'
    }
  },
  {
    id: 'chita-cht-url',
    rawText: 'משלוח מצ\'יטה שליחויות CHT10029482 בדרך אליך עם השליח יניב. לתיאום: https://chita-il.com/runportal/tracking?b=CHT10029482',
    expected: {
      trackingNumber: 'CHT10029482',
      carrier: 'chita'
    }
  },
  {
    id: 'chita-pickup-point',
    rawText: 'חבילתך מחברת צ\'יטה הגיעה לנקודת איסוף: מכולת האחים הרצל 14. מספר משלוח: CT99482019, קוד פתיחה: 5541',
    expected: {
      trackingNumber: 'CT99482019',
      carrier: 'chita',
      pickupLocation: 'מכולת האחים הרצל 14',
      lockerPin: '5541'
    }
  },
  {
    id: 'chita-en-locker',
    rawText: 'Cheetah Delivery: Package CH98765432 is ready for pickup at locker Dizengoff Hub. Locker PIN: 7721. Link: https://chtr.co.il/CH98765432',
    expected: {
      trackingNumber: 'CH98765432',
      carrier: 'chita',
      pickupLocation: 'Dizengoff Hub',
      lockerPin: '7721'
    }
  },

  // 3. HFD / E-Post
  {
    id: 'hfd-epost-locker',
    rawText: 'משלוח מ-HFD (אי-פוסט) HFD90481029 הגיע ללוקר מנטה פז ירושלים. קוד איסוף: 9021. למעקב: https://epost.co.il/t/HFD90481029',
    expected: {
      trackingNumber: 'HFD90481029',
      carrier: 'hfd',
      pickupLocation: 'מנטה פז ירושלים',
      lockerPin: '9021'
    }
  },
  {
    id: 'hfd-ep-pickup',
    rawText: 'חבילתך מ-E-Post הגיעה לנקודת חלוקה: קיוסק מרכז הכרמל חיפה. מספר מעקב: EP10849201, קוד סודי: 3349',
    expected: {
      trackingNumber: 'EP10849201',
      carrier: 'hfd',
      pickupLocation: 'קיוסק מרכז הכרמל חיפה',
      lockerPin: '3349'
    }
  },
  {
    id: 'hfd-numeric-link',
    rawText: 'שלום, משלוח מחברת HFD שמספרו 512345678 יצא לחלוקה. לפרטים: https://tracking.hfd.co.il/?t=512345678',
    expected: {
      trackingNumber: '512345678',
      carrier: 'hfd'
    }
  },

  // 4. BoxIt
  {
    id: 'boxit-locker-pin',
    rawText: 'חבילתך מ-BoxIt מחכה בלוקר תחנת דלק פז השלום תל אביב. קוד לפתיחת הלוקר: 4421. מספר חבילה: BOX920194. פרטים: https://boxit.co.il/b/BOX920194',
    expected: {
      trackingNumber: 'BOX920194',
      carrier: 'boxit',
      pickupLocation: 'תחנת דלק פז השלום תל אביב',
      lockerPin: '4421'
    }
  },
  {
    id: 'boxit-bx-point',
    rawText: 'הודעה מבוקסיט: משלוח BX1084920 הגיע לנקודת איסוף: חנות ספרים בזל. קוד משיכה: 7812',
    expected: {
      trackingNumber: 'BX1084920',
      carrier: 'boxit',
      pickupLocation: 'חנות ספרים בזל',
      lockerPin: '7812'
    }
  },

  // 5. Buzzr
  {
    id: 'buzzr-courier-sms',
    rawText: 'באזר שליחויות: החבילה שלך BZR84920194 בדרך אליך! השליח יגיע בין 14:00-16:00. למעקב: https://buzzr.co.il/track/BZR84920194',
    expected: {
      trackingNumber: 'BZR84920194',
      carrier: 'buzzr'
    }
  },
  {
    id: 'buzzr-locker-code',
    rawText: 'משלוח מחברת באזר BZR123456 הגיע ללוקר קניון עזריאלי. קוד איסוף: 6632',
    expected: {
      trackingNumber: 'BZR123456',
      carrier: 'buzzr',
      pickupLocation: 'קניון עזריאלי',
      lockerPin: '6632'
    }
  },

  // 6. Tapuz Delivery
  {
    id: 'tapuz-tracking-sms',
    rawText: 'תפוז שליחויות: חבילה מספר TPZ84920194 נקלטה במרכז המיון. למעקב: https://tapuzdelivery.co.il/tracking?num=TPZ84920194',
    expected: {
      trackingNumber: 'TPZ84920194',
      carrier: 'tapuz'
    }
  },
  {
    id: 'tapuz-ydm-sms',
    rawText: 'משלוח מתפוז שליחויות YDM8492019 הגיע לסניף מסירה ראשון לציון.',
    expected: {
      trackingNumber: 'YDM8492019',
      carrier: 'tapuz',
      pickupLocation: 'ראשון לציון'
    }
  },

  // 7. Bar Distribution
  {
    id: 'bar-tracking-sms',
    rawText: 'בר הפצה: משלוח שמספרו BAR1094821 נמסר לשליח. קישור למעקב: https://bardistribution.co.il/track?track=BAR1094821',
    expected: {
      trackingNumber: 'BAR1094821',
      carrier: 'bar-distribution'
    }
  },
  {
    id: 'bar-bd-point',
    rawText: 'חברת בר הפצה: החבילה שלך BD987654321 ממתינה בנקודת איסוף: סופרמרקט שכונתי. קוד איסוף: 1209',
    expected: {
      trackingNumber: 'BD987654321',
      carrier: 'bar-distribution',
      pickupLocation: 'סופרמרקט שכונתי',
      lockerPin: '1209'
    }
  },

  // 8. LionWheel
  {
    id: 'lionwheel-tracking-sms',
    rawText: 'ליאון וויל: השליח בדרך עם חבילה LW94820194. למעקב בזמן אמת: https://tracking.lionwheel.com/orders/LW94820194',
    expected: {
      trackingNumber: 'LW94820194',
      carrier: 'lionwheel'
    }
  },

  // 9. AliExpress / Cainiao
  {
    id: 'aliexpress-cainiao-lp',
    rawText: 'AliExpress update: Your order for Phone Case (LP00582910482CN) has arrived at local delivery hub in Israel.',
    expected: {
      trackingNumber: 'LP00582910482CN',
      carrier: 'cainiao',
      store: 'AliExpress'
    }
  },
  {
    id: 'aliexpress-hebrew-ilp',
    rawText: 'עליאקספרס: חבילתך RS948219483IL נמסרה לחלוקה ביחידת הדואר דיזנגוף. תיהנו מהקנייה!',
    expected: {
      trackingNumber: 'RS948219483IL',
      carrier: 'israel-post',
      store: 'AliExpress',
      pickupLocation: 'דיזנגוף'
    }
  },
  {
    id: 'cainiao-s0000-global',
    rawText: 'AliExpress / Cainiao shipment S00001234567890 has departed country of origin.',
    expected: {
      trackingNumber: 'S00001234567890',
      carrier: 'cainiao',
      store: 'AliExpress'
    }
  },
  {
    id: 'cainiao-ae-order',
    rawText: 'Your AliExpress order AE109482019482 has been shipped with Cainiao Global.',
    expected: {
      trackingNumber: 'AE109482019482',
      carrier: 'cainiao',
      store: 'AliExpress'
    }
  },

  // 10. SHEIN
  {
    id: 'shein-hebrew-chita-locker',
    rawText: 'חבילתך מ-SHEIN שמספרה GSH12345678901 הגיעה לארץ ונמסרה לחברת צ\'יטה (CH10849201). קוד איסוף: 9812 בלוקר שרונה.',
    expected: {
      trackingNumber: 'CH10849201',
      carrier: 'chita',
      store: 'SHEIN',
      pickupLocation: 'שרונה',
      lockerPin: '9812'
    }
  },
  {
    id: 'shein-gsh-en',
    rawText: 'SHEIN order update: Package GSH9988776655 is in transit to Israel via courier.',
    expected: {
      trackingNumber: 'GSH9988776655',
      carrier: 'shein',
      store: 'SHEIN'
    }
  },
  {
    id: 'shein-hebrew-text',
    rawText: 'שיין: המשלוח שלך מ-SHEIN (GSH5544332211) יצא מהמחסן המרכזי.',
    expected: {
      trackingNumber: 'GSH5544332211',
      carrier: 'shein',
      store: 'SHEIN'
    }
  },

  // 11. Amazon
  {
    id: 'amazon-dhl-delivered',
    rawText: 'Amazon.com: Your package with DHL tracking 4829104821 was delivered to front door.',
    expected: {
      trackingNumber: '4829104821',
      carrier: 'dhl',
      store: 'Amazon'
    }
  },
  {
    id: 'amazon-hebrew-fedex',
    rawText: 'אמזון: ההזמנה שלך נשלחה עם פדאקס שמספר מעקב 794820194821.',
    expected: {
      trackingNumber: '794820194821',
      carrier: 'fedex',
      store: 'Amazon'
    }
  },
  {
    id: 'amazon-ups-1z',
    rawText: 'Your Amazon order has shipped with UPS tracking 1Z999AA10123456784.',
    expected: {
      trackingNumber: '1Z999AA10123456784',
      carrier: 'ups',
      store: 'Amazon'
    }
  },
  {
    id: 'amazon-usps-impb',
    rawText: 'Amazon delivery: Package tracked via USPS 9400100000000000000000 is out for delivery.',
    expected: {
      trackingNumber: '9400100000000000000000',
      carrier: 'usps',
      store: 'Amazon'
    }
  },

  // 12. iHerb
  {
    id: 'iherb-hebrew-boxit',
    rawText: 'אייהרב (iHerb): החבילה שלך הגיעה לארץ ונמסרה ל-BoxIt. מספר משלוח: BOX554433, קוד איסוף: 2190.',
    expected: {
      trackingNumber: 'BOX554433',
      carrier: 'boxit',
      store: 'iHerb',
      lockerPin: '2190'
    }
  },
  {
    id: 'iherb-yunexpress',
    rawText: 'iHerb Order Shipped: Your package with tracking YT2109849201948201 is on its way via YunExpress.',
    expected: {
      trackingNumber: 'YT2109849201948201',
      carrier: 'yunexpress',
      store: 'iHerb'
    }
  },

  // 13. Temu
  {
    id: 'temu-hebrew-cainiao',
    rawText: 'טמו (Temu): חבילתך יצאה למשלוח. מספר מעקב: LP994488221CN.',
    expected: {
      trackingNumber: 'LP994488221CN',
      carrier: 'cainiao',
      store: 'Temu'
    }
  },
  {
    id: 'temu-4px-customs',
    rawText: 'Temu update: Your package with tracking 4PX300184920194 has arrived at customs.',
    expected: {
      trackingNumber: '4PX300184920194',
      carrier: '4px',
      store: 'Temu'
    }
  },

  // 14. KSP & Ivory
  {
    id: 'ksp-chita-delivery',
    rawText: 'קיי.אס.פי (KSP): ההזמנה שלך נמסרה לחברת צ\'יטה (CH90807060). השליח ייצור קשר.',
    expected: {
      trackingNumber: 'CH90807060',
      carrier: 'chita',
      store: 'KSP'
    }
  },
  {
    id: 'ivory-tapuz-delivery',
    rawText: 'אייבורי מחשבים: המשלוח שלך יצא עם תפוז שליחויות מספר TPZ11223344.',
    expected: {
      trackingNumber: 'TPZ11223344',
      carrier: 'tapuz',
      store: 'Ivory'
    }
  },

  // 15. Negative Controls (No tracking / spam)
  {
    id: 'neg-spam-loan',
    rawText: 'הלוואה ברגע עד 50,000 שח ללא ערבים! לחץ כאן להסרה.',
    expected: {
      trackingNumber: '',
      carrier: 'other'
    }
  },
  {
    id: 'neg-otp-code',
    rawText: 'Your verification code for Google is 948201. Do not share this code with anyone.',
    expected: {
      trackingNumber: '',
      carrier: 'other'
    }
  },
  {
    id: 'neg-chat-message',
    rawText: 'היי אחי, מתי אתה מגיע להורים בשישי בערב? תביא בבקשה שתייה.',
    expected: {
      trackingNumber: '',
      carrier: 'other'
    }
  }
];
