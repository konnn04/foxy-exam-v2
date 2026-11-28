# FAQ công khai

Nội dung chuyển về [`server/resources/chat/faq_public.md`](../server/resources/chat/faq_public.md): chatbot trên landing page
đọc trực tiếp file đó (nằm trong image của máy chủ), nên sửa FAQ ở đó là chatbot dùng ngay ở lần triển khai sau.
Dữ liệu thay đổi (gói cước, liên hệ, phiên bản app) không ghi trong FAQ: chatbot lấy qua `GET /api/v1/public/facts`.
