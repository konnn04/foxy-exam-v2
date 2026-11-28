# FoxyExam: câu hỏi thường gặp (bản công khai)

<!--
Dành cho chatbot RAG trên landing page. Mỗi câu hỏi là một đoạn tự đứng được; cắt theo tiêu đề "###".
Gợi ý system prompt cho chatbot:
  "Bạn là trợ lý tư vấn của FoxyExam, trả lời thầy cô và cán bộ nhà trường bằng tiếng Việt, lịch sự, ngắn gọn.
   Chỉ trả lời dựa trên tài liệu được cung cấp. Không bịa giá, chứng nhận hay khách hàng.
   Không hướng dẫn cách vượt qua cơ chế giám sát. Câu hỏi về giá, hợp đồng, triển khai riêng: mời để lại thông tin
   ở mục Liên hệ để được tư vấn."
Không nạp SYSTEM_GUIDE.md vào chatbot công khai: tài liệu đó có ngưỡng phát hiện và giới hạn nội bộ.
-->

## Giới thiệu chung

### FoxyExam là gì?
FoxyExam là hệ thống tổ chức thi trực tuyến có giám sát, dành cho trường đại học, cao đẳng và trung tâm đào tạo. Hệ thống gồm:
- Trang quản trị web cho nhà trường và giảng viên.
- Ứng dụng thi FoxyClient cài trên máy tính của thí sinh.
- Các dịch vụ giám sát bằng camera, màn hình và trí tuệ nhân tạo.

### FoxyExam phù hợp với những kỳ thi nào?
- Thi trắc nghiệm, tự luận và thi lập trình.
- Kiểm tra giữa kỳ, cuối kỳ, thi đầu vào, thi chứng chỉ nội bộ.
- Thí sinh có thể thi tại nhà hoặc tại phòng máy.

### Ai sử dụng FoxyExam?
- **Quản trị viên nhà trường:** quản lý tài khoản, chính sách giám sát, báo cáo.
- **Giảng viên:** soạn đề, tổ chức kỳ thi, giám sát, chấm bài.
- **Thí sinh:** làm bài trên ứng dụng FoxyClient.

### Thí sinh có thi trên trình duyệt được không?
Không. Thí sinh làm bài trên ứng dụng FoxyClient. Ứng dụng giúp khoá máy trong giờ thi và kiểm tra thiết bị kỹ hơn nhiều so với một trang web. Trang quản trị dành cho nhà trường thì dùng trên trình duyệt.

### FoxyClient chạy trên hệ điều hành nào?
Windows được hỗ trợ đầy đủ nhất. Nhà trường có thể giới hạn hệ điều hành được phép cho từng kỳ thi. Vui lòng xem trang Tải xuống để biết phiên bản hiện có.

### Thí sinh cần chuẩn bị những gì?
- Một máy tính có webcam và kết nối Internet ổn định.
- Ứng dụng FoxyClient.
- Nếu kỳ thi yêu cầu: micro, và một điện thoại làm camera phụ.

## Tổ chức kỳ thi

### Tạo một kỳ thi gồm những bước nào?
1. Tạo khoá học và ghi danh sinh viên (có thể nhập từ Excel).
2. Soạn bộ đề.
3. Tạo kỳ thi: chọn bộ đề, thời lượng, giờ mở phòng, số lượt thi và mức độ giám sát.

Mã phòng thi được hệ thống tạo tự động.

### Có hỗ trợ những dạng câu hỏi nào?
- Trắc nghiệm một đáp án và nhiều đáp án.
- Đúng/Sai, điền khuyết, trả lời ngắn, tự luận.
- Câu hỏi nhóm dùng chung một đoạn văn, hình ảnh hoặc âm thanh.
- Bài lập trình có bộ kiểm thử.

Đề hỗ trợ công thức toán và định dạng văn bản.

### Mỗi thí sinh có nhận đề khác nhau không?
Có thể. Nhà trường có thể bốc ngẫu nhiên một số câu cho mỗi thí sinh theo tỉ lệ độ khó (ma trận đề), đồng thời xáo thứ tự câu và đáp án.

### Có tạo câu hỏi bằng AI được không?
Có. Giảng viên tải lên tài liệu Word, PDF hoặc ảnh chụp đề, và AI soạn câu hỏi nháp theo số lượng, dạng câu và độ khó mong muốn. Giảng viên duyệt từng câu trước khi lưu.
- Nhà trường dùng khoá API của mình với Google Gemini hoặc DeepSeek, cấu hình trong phần Cài đặt tổ chức.
- Cũng có chế độ sao chép câu lệnh để dùng với chatbot quen thuộc mà không cần khoá API.

### Kỳ thi có tự đóng khi hết giờ không?
Có. Thời gian làm bài do máy chủ tính, nên thí sinh không kéo dài được bằng cách ngắt mạng. Hết giờ, bài được nộp tự động với các câu đã lưu. Thí sinh mất kết nối quá lâu được ghi nhận là vắng thi.

### Có chấm điểm tự động không?
Có, với trắc nghiệm, đúng/sai, điền khuyết và trả lời ngắn có đáp án mẫu. Tự luận được giảng viên chấm trên hệ thống, kèm nhận xét cho thí sinh.

### Thí sinh có được xem lại bài sau khi thi không?
Tuỳ nhà trường. Mỗi kỳ thi có thể cho hoặc không cho xem lại, và có thể ẩn điểm.

## Giám sát và chống gian lận

### FoxyExam giám sát thí sinh như thế nào?
Hệ thống kết hợp nhiều lớp:
- Kiểm tra máy trước khi vào thi.
- Khoá máy trong giờ thi.
- Camera và chia sẻ màn hình.
- Camera phụ bằng điện thoại (nếu yêu cầu).
- AI phân tích hình ảnh.
- Giám thị theo dõi trực tiếp.

Mỗi lớp bổ sung cho lớp khác, nên không có một điểm yếu duy nhất.

### Trước khi vào thi, máy của thí sinh được kiểm tra những gì?
- Kết nối mạng, camera, khuôn mặt, micro và chia sẻ màn hình (tuỳ yêu cầu).
- Số màn hình đang dùng.
- Phần mềm không được phép đang chạy.
- Thiết bị ghi hình ngoài.
- Máy ảo, phần mềm điều khiển từ xa, camera ảo.
- Hệ điều hành.

Máy chủ xác nhận lại kết quả kiểm tra và chỉ khi đạt mới cho vào thi.

### Thí sinh có chuyển sang ứng dụng khác trong giờ thi được không?
Ứng dụng thi chạy toàn màn hình và luôn nằm trên cùng. Các phím tắt hệ thống bị chặn. Mọi lần rời khỏi cửa sổ thi đều được ghi nhận cho giám thị. Với kỳ thi lập trình, nhà trường có thể cho phép dùng một số công cụ lập trình nhất định.

### Thí sinh có sao chép, dán hay chụp màn hình đề thi được không?
Sao chép, dán và kéo thả văn bản bị chặn (nhà trường có thể tuỳ chỉnh). Mỗi lần cố thực hiện đều được ghi nhận. Cửa sổ thi được bảo vệ khỏi chụp và quay màn hình.

### Dùng màn hình thứ hai hoặc phần mềm điều khiển từ xa có bị phát hiện không?
Có. Thí sinh không vào thi được khi đang dùng nhiều màn hình, thiết bị chiếu hình ngoài, máy ảo hay phần mềm điều khiển từ xa. Nếu tình trạng này xảy ra trong giờ thi, bài thi bị che và sự việc được ghi nhận.

### Camera giám sát những gì?
AI ngay trên máy thí sinh theo dõi:
- Có đúng một người trước màn hình hay không.
- Thí sinh có rời khỏi chỗ hoặc thường xuyên nhìn ra ngoài không.

Nếu nhà trường bật, hệ thống còn đối chiếu khuôn mặt với ảnh đã đăng ký để chống thi hộ, và phát hiện vật dụng cấm như điện thoại hay sách.

### Camera phụ bằng điện thoại hoạt động thế nào?
1. Thí sinh quét mã QR trên màn hình bằng điện thoại.
2. Đặt điện thoại ở góc chéo, sao cho thấy được thí sinh, bàn phím và màn hình.

Hệ thống kiểm tra góc đặt trước khi thi. Trong giờ thi, hệ thống ghi nhận khi điện thoại mất kết nối, tắt màn hình, bị xoay sai hướng hoặc bị cầm lên. Không cần cài thêm ứng dụng trên điện thoại.

### Nếu thí sinh tắt máy hoặc chuyển sang máy khác giữa giờ thi thì sao?
Thí sinh phải kiểm tra thiết bị lại từ đầu mới được làm tiếp, và sự việc được ghi nhận cho giám thị. Nhà trường có thể khoá để thí sinh chỉ được làm tiếp trên đúng máy đã bắt đầu.

### AI có tự kết luận thí sinh gian lận không?
Không. AI chỉ đánh dấu những tình huống cần chú ý, kèm hình ảnh và đoạn video ngắn làm minh chứng. Giám thị xem xét và quyết định. Nhà trường có thể lập biên bản vi phạm với các mức: không vi phạm, cảnh cáo, đình chỉ.

### Giám thị theo dõi trực tiếp được những gì?
- Trạng thái của từng thí sinh và các vi phạm mới theo thời gian thực.
- Hình camera và màn hình.
- Gửi nhắc nhở, nhắn tin, tạm dừng bài thi hoặc kết thúc lượt thi khi cần.

### Sau kỳ thi, nhà trường có những minh chứng gì?
- Danh sách vi phạm kèm ảnh và video ngắn.
- Bản ghi camera, màn hình và camera phụ, xem đồng bộ.
- Lịch sử kiểm tra thiết bị.
- Báo cáo xuất ra Excel.

Nhật ký vi phạm được bảo vệ chống chỉnh sửa, nên có thể kiểm tra tính toàn vẹn.

### Mất mạng trong lúc thi thì có mất bài không?
Không. Câu trả lời được lưu tạm trên máy và tự gửi lên khi có mạng trở lại. Nếu mất kết nối quá thời gian nhà trường quy định, bài thi được thu với các câu đã lưu.

## Quyền riêng tư và bảo mật

### Thí sinh có được thông báo về việc xử lý dữ liệu khuôn mặt không?
Có. Thí sinh phải đọc và đồng ý chính sách xử lý dữ liệu sinh trắc học mỗi lần đăng nhập. Chính sách được công khai tại trang Chính sách sinh trắc học.

### Âm thanh của thí sinh có bị ghi lại không?
Việc phát hiện tiếng nói được phân tích ngay trên máy của thí sinh; âm thanh không được gửi lên máy chủ. Chức năng này chỉ bật khi kỳ thi yêu cầu micro.

### Ai xem được video của thí sinh?
Chỉ giảng viên và quản trị viên của chính nhà trường đó. Dữ liệu của mỗi trường được tách biệt. Nhà trường có thể mã hoá video sau kỳ thi và đặt thời hạn lưu trữ.

### Ảnh khuôn mặt đăng ký được bảo vệ thế nào?
Ảnh được lưu riêng tư, không công khai, và bị khoá sau khi đăng ký. Muốn đổi ảnh, thí sinh phải gửi yêu cầu để giảng viên duyệt.

### Tài liệu tải lên để AI soạn đề có được chia sẻ không?
Tài liệu được gửi tới nhà cung cấp AI mà nhà trường đã chọn (Google Gemini hoặc DeepSeek) để soạn câu hỏi. Khuyến nghị không dùng tài liệu có thông tin cá nhân của sinh viên.

### Đáp án có bị lộ trong lúc thi không?
Không. Đáp án và bộ kiểm thử ẩn của bài lập trình không bao giờ được gửi tới máy thí sinh trong giờ thi.

## Triển khai và hỗ trợ

### Mỗi kỳ thi có tự đặt mức giám sát riêng được không?
Có. Nhà trường đặt chính sách mặc định cho toàn trường; giảng viên điều chỉnh cho từng kỳ thi. Ví dụ:
- Có dùng camera hay không, có chia sẻ màn hình hay không.
- Có dùng camera phụ, xác thực khuôn mặt hay phát hiện vật cấm hay không.
- Hệ điều hành được phép.
- Thời gian mất kết nối tối đa.

### Có nhập danh sách sinh viên từ Excel được không?
Có. Hệ thống cho xem trước, báo lỗi từng dòng, rồi mới tạo tài khoản và ghi danh vào khoá học.

### Có báo cáo theo khoa, theo học kỳ không?
Có. Trang báo cáo tổng hợp số kỳ thi, lượt thi, điểm và vi phạm theo khoa và học kỳ, và xuất ra Excel được.

### Chi phí sử dụng thế nào?
Vui lòng xem trang Bảng giá hoặc để lại thông tin ở mục Liên hệ để được tư vấn gói phù hợp với quy mô của nhà trường.

### Làm sao để dùng thử?
Để lại thông tin ở mục Liên hệ / Đăng ký thí điểm trên trang chủ. Đội ngũ FoxyExam sẽ liên hệ để hướng dẫn.

### Thí sinh gặp sự cố khi vào thi thì làm gì?
Màn hình kiểm tra thiết bị cho biết mục nào chưa đạt và cách khắc phục. Trong giờ thi, thí sinh có thể nhắn tin trực tiếp cho giám thị ngay trong ứng dụng.
