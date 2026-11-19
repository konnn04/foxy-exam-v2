import type { Language } from './translations';

/**
 * Built-in terms shown before a contact request is sent. A platform admin can replace them in
 * Nội dung website → Điều khoản; this text is only the saved starting point and is NOT legal advice.
 * Format: blank line = new paragraph; a line starting with "## " = heading.
 */
export const DEFAULT_TERMS: Record<Language, string> = {
  vi: `## 1. Mục đích thu thập
Thông tin bạn nhập (họ tên, email, số điện thoại, đơn vị) chỉ dùng để ban dự án liên hệ tư vấn, đăng ký thí điểm và gửi báo giá cho đơn vị của bạn.

## 2. Phạm vi sử dụng
Chúng tôi không bán, trao đổi hoặc chia sẻ thông tin này cho bên thứ ba vì mục đích quảng cáo. Thông tin chỉ được chia sẻ trong nội bộ nhóm dự án có trách nhiệm xử lý yêu cầu.

## 3. Thời gian lưu trữ
Thông tin được giữ trong thời gian cần thiết để xử lý yêu cầu và tối đa 24 tháng kể từ lần liên hệ cuối, sau đó sẽ được xoá hoặc ẩn danh.

## 4. Quyền của bạn
Bạn có quyền yêu cầu truy cập, chỉnh sửa, xoá thông tin hoặc rút lại sự đồng ý bất kỳ lúc nào bằng cách gửi email tới địa chỉ liên hệ ở chân trang, phù hợp Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân.

## 5. Thư điện tử
Yêu cầu của bạn được gửi qua ứng dụng email trên thiết bị của bạn. Hãy kiểm tra nội dung thư trước khi gửi; chúng tôi chỉ nhận được thông tin khi bạn bấm gửi.

## 6. Cam kết
Việc gửi yêu cầu liên hệ không ràng buộc nhà trường mua hay sử dụng dịch vụ. Chương trình thí điểm áp dụng theo điều kiện nêu trên trang đăng ký và có thể thay đổi.`,
  en: `## 1. Purpose of collection
The details you enter (name, email, phone, organization) are used only so the project team can contact you for consultation, pilot registration and quotations.

## 2. Use
We do not sell, trade or share this information with third parties for advertising. It is shared only within the project team responsible for handling your request.

## 3. Retention
Your details are kept for as long as needed to handle the request and for at most 24 months after the last contact, after which they are deleted or anonymized.

## 4. Your rights
You may request access, correction or deletion of your data, or withdraw consent at any time, by emailing the contact address in the footer, in line with Decree 13/2023/ND-CP on personal data protection.

## 5. Email
Your request is sent through the email application on your device. Please review the message before sending; we only receive your details once you press send.

## 6. No obligation
Submitting a contact request does not oblige your institution to buy or use the service. The pilot programme follows the conditions stated on the registration page and may change.`,
};

/** sha256 (hex) of the terms text a visitor saw: stored with the request as proof of which version was accepted. */
export async function hashText(text: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // insecure context without SubtleCrypto: a stable 64-hex fingerprint is still better than refusing the request
    let h = 2166136261;
    const out: string[] = [];
    for (let k = 0; k < 8; k++) {
      for (let i = 0; i < text.length; i++) h = Math.imul(h ^ (text.charCodeAt(i) + k), 16777619) >>> 0;
      out.push(h.toString(16).padStart(8, '0'));
    }
    return out.join('');
  }
}
