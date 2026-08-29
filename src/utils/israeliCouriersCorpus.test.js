import { describe, it, expect } from 'vitest';
import { parseSmartText } from './smartParser.js';

describe('Israeli & International Courier Corpus Testbench (TASK-701)', () => {
  describe('Israel Post (דואר ישראל)', () => {
    it('parses standard registered mail SMS with locker PIN and location', () => {
      const sms = 'שלום, דבר דואר RS948219483IL הגיע ללוקר שופרסל דיזנגוף סנטר תל אביב. קוד לאיסוף: 8492. החבילה תמתין 72 שעות.';
      const result = parseSmartText(sms);

      expect(result.trackingNumber).toBe('RS948219483IL');
      expect(result.carrier).toBe('israel-post');
      expect(result.candidateStatus).toBe('verified');
      expect(result.status).toBe('ready_for_pickup');
      expect(result.lockerPin).toBe('8492');
      expect(result.pickupLocation).toContain('שופרסל דיזנגוף סנטר');
    });

    it('parses Post Office branch notice with shelf number and phone', () => {
      const sms = 'דבר דואר RR123456789IL ממתין בסוכנות דואר נווה שאנן, רחוב הגליל 12 חיפה. מדף 412. טלפון 04-8123456. שעות: א-ה 08:00-17:00.';
      const result = parseSmartText(sms);

      expect(result.trackingNumber).toBe('RR123456789IL');
      expect(result.carrier).toBe('israel-post');
      expect(result.candidateStatus).toBe('verified');
      expect(result.status).toBe('ready_for_pickup');
      expect(result.pickupLocation).toContain('נווה שאנן');
      expect(result.pickupPhone).toBe('04-8123456');
    });

    it('parses Israel Post direct itemtrace URL in SMS', () => {
      const sms = 'החבילה שלך בדרך! למעקב אחר המשלוח: https://mypost.israelpost.co.il/itemtrace?itemcode=CY987654321IL';
      const result = parseSmartText(sms);

      expect(result.trackingNumber).toBe('CY987654321IL');
      expect(result.carrier).toBe('israel-post');
      expect(result.candidateStatus).toBe('verified');
    });
  });

  describe('HFD / E-Post', () => {
    it('parses E-Post locker notification with PIN code and store location', () => {
      const sms = 'חבילתך מ-ASOS הגיעה! איסוף מלוקר E-Post בסופר פארם קניון שבעת הכוכבים הרצליה. קוד איסוף 7391. לפתיחה: e-post.co.il/t/3094829104';
      const result = parseSmartText(sms);

      expect(result.trackingNumber).toBe('3094829104');
      expect(result.carrier).toBe('hfd');
      expect(result.candidateStatus).toBe('verified');
      expect(result.status).toBe('ready_for_pickup');
      expect(result.lockerPin).toBe('7391');
      expect(result.store).toBe('ASOS');
    });

    it('parses HFD redirected locker notice', () => {
      const sms = 'שינוי יעד משלוח HFD: עקב עומס בלוקר דיזנגוף סנטר, החבילה הועברה לנקודת איסוף מכולת העיר ברחוב בן יהודה 45. מעקב: 3019284756';
      const result = parseSmartText(sms);

      expect(result.trackingNumber).toBe('3019284756');
      expect(result.carrier).toBe('hfd');
      expect(result.candidateStatus).toBe('verified');
      expect(result.isRedirected).toBe(true);
      expect(result.originalPickupLocation).toBe('דיזנגוף סנטר');
      expect(result.pickupLocation).toContain('מכולת העיר');
    });

    it('parses Shein / Next package delivered via HFD without URL', () => {
      const sms = 'שלום, משלוח HFD מס 039482918 מוכן לאיסוף בנקודת מסירה טמבור אהרונוביץ בני ברק. קוד לאיסוף: 1192.';
      const result = parseSmartText(sms);

      expect(result.trackingNumber).toBe('039482918');
      expect(result.carrier).toBe('hfd');
      expect(result.candidateStatus).toBe('verified');
      expect(result.status).toBe('ready_for_pickup');
      expect(result.lockerPin).toBe('1192');
      expect(result.pickupLocation).toContain('טמבור אהרונוביץ');
    });
  });

  describe('Cheetah Delivery (צ\'יטה)', () => {
    it('parses Cheetah store pickup point SMS with tracking link', () => {
      const sms = 'החבילה שלך מ-Zara ממתינה לאיסוף בחנות קולבו שלום רחוב ויצמן 40 תל אביב. מספר מעקב 84920184. פרטים: https://chtr.co.il/t?num=84920184';
      const result = parseSmartText(sms);

      expect(result.trackingNumber).toBe('84920184');
      expect(result.carrier).toBe('chita');
      expect(result.candidateStatus).toBe('verified');
      expect(result.status).toBe('ready_for_pickup');
      expect(result.store).toBe('Zara');
    });

    it('parses Cheetah home courier out for delivery SMS', () => {
      const sms = 'שליח צ\'יטה בדרך אליך עם משלוח מס\' 98765432. שעת הגעה משוערת בין 13:00 ל-15:00. תיאום: chita-delivery.co.il/track?n=98765432';
      const result = parseSmartText(sms);

      expect(result.trackingNumber).toBe('98765432');
      expect(result.carrier).toBe('chita');
      expect(result.candidateStatus).toBe('verified');
      expect(result.status).toBe('out_for_delivery');
    });

    it('parses Cheetah delivery notice without URL', () => {
      const sms = 'משלוח צ\'יטה שופס מס 49201842 הגיע לסניף מינימרקט הכפר שדרות ירושלים 10 יפו. ממתין 4 ימים.';
      const result = parseSmartText(sms);

      expect(result.trackingNumber).toBe('49201842');
      expect(result.carrier).toBe('chita');
      expect(result.candidateStatus).toBe('verified');
      expect(result.status).toBe('ready_for_pickup');
      expect(result.pickupLocation).toContain('מינימרקט הכפר');
    });
  });

  describe('BoxIt (בוקסיט)', () => {
    it('parses BoxIt locker notification with 6-digit OTP code', () => {
      const sms = 'חבילת בוקסיט מחכה לך בלוקר סופר-פארם רוטשילד ראשון לציון. קוד סודי לפתיחה: 849201. פרטים: boxit.co.il/p/8492018';
      const result = parseSmartText(sms);

      expect(result.trackingNumber).toBe('8492018');
      expect(result.carrier).toBe('boxit');
      expect(result.candidateStatus).toBe('verified');
      expect(result.status).toBe('ready_for_pickup');
      expect(result.lockerPin).toBe('849201');
      expect(result.pickupLocation).toContain('סופר-פארם רוטשילד');
    });

    it('parses BoxIt store point notice without link', () => {
      const sms = 'איסוף חבילה BoxIt: החבילה הגיעה לנקודת איסוף מכולת האחים רחוב כצנלסון 15 גבעתיים. קוד: 9942.';
      const result = parseSmartText(sms);

      expect(result.carrier).toBe('boxit');
      expect(result.candidateStatus).toBe('verified');
      expect(result.lockerPin).toBe('9942');
      expect(result.pickupLocation).toContain('מכולת האחים');
    });
  });

  describe('Tapuz / Buzzr / ZigZag / Cargo / GetPackage', () => {
    it('parses Tapuz delivery notice with track param', () => {
      const sms = 'משלוח תפוז מס\' 749201 ממתין בנקודת חלוקה דפוס אקספרס הרצל 88 רחובות. קוד מסירה 3311. למעקב: tapuzdelivery.co.il/?track=749201';
      const result = parseSmartText(sms);

      expect(result.trackingNumber).toBe('749201');
      expect(result.carrier).toBe('tapuz');
      expect(result.candidateStatus).toBe('verified');
      expect(result.lockerPin).toBe('3311');
      expect(result.pickupLocation).toContain('דפוס אקספרס');
    });

    it('parses Buzzr locker notice with shortlink', () => {
      const sms = 'משלוח Buzzr מספר 9482018 הגיע ללוקר שופרסל אבן גבירול תל אביב. קוד אימות 5582. פתיחה מהירה: link.buzzr.co.il/t/9482018';
      const result = parseSmartText(sms);

      expect(result.trackingNumber).toBe('9482018');
      expect(result.carrier).toBe('buzzr');
      expect(result.candidateStatus).toBe('verified');
      expect(result.lockerPin).toBe('5582');
      expect(result.pickupLocation).toContain('שופרסל אבן גבירול');
    });

    it('parses ZigZag courier out for delivery notice', () => {
      const sms = 'שליח זיגזג בדרך אליך! משלוח 8392019 יוצא למסירה היום בין 10:00 ל-13:00. מעקב: zigzag.co.il/track?id=8392019';
      const result = parseSmartText(sms);

      expect(result.trackingNumber).toBe('8392019');
      expect(result.carrier).toBe('zigzag');
      expect(result.candidateStatus).toBe('verified');
      expect(result.status).toBe('out_for_delivery');
    });

    it('parses Bar Distribution notice with link', () => {
      const sms = 'חבילתך מבר הפצה מס 9482103 ממתינה בנקודת איסוף פרחים בכיכר שדרות ירושלים 5 רמת גן. קוד: 4421. פרטים: barexpress.co.il/t/9482103';
      const result = parseSmartText(sms);

      expect(result.trackingNumber).toBe('9482103');
      expect(result.carrier).toBe('bar-distribution');
      expect(result.candidateStatus).toBe('verified');
      expect(result.lockerPin).toBe('4421');
    });
  });

  describe('AliExpress, Cainiao & Global Couriers', () => {
    it('parses AliExpress consolidated order notification (LP format)', () => {
      const sms = 'AliExpress Order LP00592819482910 has arrived in Israel and is in transit with local courier.';
      const result = parseSmartText(sms);

      expect(result.trackingNumber).toBe('LP00592819482910');
      expect(result.carrier).toBe('cainiao');
      expect(result.candidateStatus).toBe('verified');
      expect(result.store).toBe('AliExpress');
    });

    it('parses Cainiao global code format', () => {
      const sms = 'Your shipment CAINIAO9847291849102 is undergoing customs clearance.';
      const result = parseSmartText(sms);

      expect(result.trackingNumber).toBe('CAINIAO9847291849102');
      expect(result.carrier).toBe('cainiao');
      expect(result.candidateStatus).toBe('verified');
    });

    it('parses YunExpress tracking number (YT format)', () => {
      const sms = 'Package dispatched via YunExpress. Tracking ID: YT2409819284019284. Expected delivery in 7-10 business days.';
      const result = parseSmartText(sms);

      expect(result.trackingNumber).toBe('YT2409819284019284');
      expect(result.carrier).toBe('yunexpress');
      expect(result.candidateStatus).toBe('verified');
      expect(result.status).toBe('in_transit');
    });

    it('parses 4PX tracking number', () => {
      const sms = '4PX Express parcel 4PX3000492819482 is on its way to destination sorting center.';
      const result = parseSmartText(sms);

      expect(result.trackingNumber).toBe('4PX3000492819482');
      expect(result.carrier).toBe('4px');
      expect(result.candidateStatus).toBe('verified');
    });

    it('parses Yanwen tracking number (UB...YP format)', () => {
      const sms = 'Your order from China has shipped: UB948219482YP. Track online at Yanwen.';
      const result = parseSmartText(sms);

      expect(result.trackingNumber).toBe('UB948219482YP');
      expect(result.carrier).toBe('yanwen');
      expect(result.candidateStatus).toBe('verified');
    });
  });

  describe('DHL / FedEx / UPS / Aramex', () => {
    it('parses DHL Express 10-digit waybill', () => {
      const sms = 'DHL Express shipment with waybill 8492018492 is out for delivery today.';
      const result = parseSmartText(sms);

      expect(result.trackingNumber).toBe('8492018492');
      expect(result.carrier).toBe('dhl');
      expect(result.candidateStatus).toBe('verified');
      expect(result.status).toBe('out_for_delivery');
    });

    it('parses FedEx 12-digit tracking number', () => {
      const sms = 'FedEx: Your package 749201849281 has arrived in Israel and passed customs inspection.';
      const result = parseSmartText(sms);

      expect(result.trackingNumber).toBe('749201849281');
      expect(result.carrier).toBe('fedex');
      expect(result.candidateStatus).toBe('verified');
    });

    it('parses UPS 1Z tracking format', () => {
      const sms = 'UPS tracking notification: 1Z999AA10123456784 is ready for pickup at UPS Access Point.';
      const result = parseSmartText(sms);

      expect(result.trackingNumber).toBe('1Z999AA10123456784');
      expect(result.carrier).toBe('ups');
      expect(result.candidateStatus).toBe('verified');
      expect(result.status).toBe('ready_for_pickup');
    });
  });
});
