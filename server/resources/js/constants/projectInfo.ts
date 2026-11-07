/**
 * Dữ liệu chuẩn xác từ Thuyết minh đề án Exam Guard (10/2026)
 * Cuộc thi: “Sinh viên với ý tưởng sáng tạo & khởi nghiệp” Năm 2026
 * Trường Đại học Mở TP. Hồ Chí Minh · Khoa Công nghệ Thông tin · Lĩnh vực STEM
 */

export interface TeamMember {
  name: string;
  mssv: string;
  role: string;
  department: string;
  email: string;
  phone?: string;
  duties: string;
  badge: string;
  isLeader?: boolean;
}

export interface Advisor {
  name: string;
  title: string;
  role: string;
  department: string;
}

export const PROJECT_INFO = {
  institution: 'Trường Đại học Mở TP. Hồ Chí Minh',
  faculty: 'Khoa Công nghệ Thông tin',
  competition: 'Cuộc thi “Sinh viên với ý tưởng sáng tạo & khởi nghiệp” năm 2026',
  projectTitle: 'Exam Guard: Hệ thống giám sát thi cử trực tuyến thông minh',
  field: 'STEM',
  date: 'Tháng 10/2026',
  address: '35 - 37 Hồ Hảo Hớn, Phường Cô Giang, Quận 1, TP.HCM',
  leaderContact: {
    name: 'Lê Minh Khôi',
    phone: '0387 291 237',
    email: 'minkhoi.dev@gmail.com',
  },
};

export const ADVISORS: Advisor[] = [
  {
    name: 'ThS. Nguyễn Trung Hậu',
    title: 'Giảng viên',
    role: 'Cố vấn chuyên môn kinh tế',
    department: 'Khoa Công nghệ Thông tin, Trường Đại học Mở TP.HCM',
  },
  {
    name: 'ThS. Dương Hữu Thành',
    title: 'Giảng viên',
    role: 'Cố vấn chuyên môn kỹ thuật',
    department: 'Khoa Công nghệ Thông tin, Trường Đại học Mở TP.HCM',
  },
];

export const TEAM_MEMBERS: TeamMember[] = [
  {
    name: 'Lê Minh Khôi',
    mssv: '2351050084',
    role: 'Trưởng nhóm đề án',
    department: 'Công nghệ thông tin',
    email: 'minkhoi.dev@gmail.com',
    phone: '0387 291 237',
    duties: 'Nghiên cứu mô hình trí tuệ nhân tạo (MobileFaceNet, YOLOX), điều phối vận hành kỳ thi thử và trực hỗ trợ kỹ thuật xử lý sự cố.',
    badge: 'TRƯỞNG NHÓM & VẬN HÀNH',
    isLeader: true,
  },
  {
    name: 'Nguyễn Thanh Triều',
    mssv: '2251052127',
    role: 'Kỹ sư kỹ thuật & hạ tầng',
    department: 'Công nghệ thông tin',
    email: 'trieukon1011@gmail.com',
    phone: '0772 816 986',
    duties: 'Phát triển ứng dụng khóa môi trường thi (Kiosk lockdown), máy chủ điều phối, kiểm thử tải và tối ưu mô hình thị giác máy tính.',
    badge: 'KỸ THUẬT & HẠ TẦNG',
  },
  {
    name: 'Cao Đỗ Huyền Trân',
    mssv: '2454050030',
    role: 'Phụ trách dữ liệu & pháp lý',
    department: 'Công nghệ thông tin',
    email: '2454050030tran@ou.edu.vn',
    duties: 'Xây dựng hồ sơ đánh giá tác động dữ liệu cá nhân (DPIA), thỏa thuận xử lý dữ liệu (DPA), tư vấn thủ tục thành lập pháp nhân và kế toán.',
    badge: 'DỮ LIỆU & PHÁP LÝ',
  },
  {
    name: 'Lê Phan Huyền Trang',
    mssv: '2454052084',
    role: 'Phụ trách kinh doanh & truyền thông',
    department: 'Công nghệ thông tin',
    email: 'huyentrang11k6@gmail.com',
    phone: '0868 772 951',
    duties: 'Liên hệ các đơn vị khoa/trường, tổ chức chương trình thí điểm, phỏng vấn nhu cầu khách hàng, xây dựng bảng báo giá và kế hoạch tiếp thị B2B.',
    badge: 'KINH DOANH & TRUYỀN THÔNG',
  },
  {
    name: 'Phạm Thị Diễm Kiều',
    mssv: '2551050116',
    role: 'Phụ trách tài chính & quản trị rủi ro',
    department: 'Công nghệ thông tin',
    email: 'kiiz602103@gmail.com',
    phone: '0387 631 476',
    duties: 'Lập mô hình tài chính kế toán, hạch toán định phí và biến phí phục vụ, quản trị rủi ro pháp lý và quy chuẩn dữ liệu sinh trắc học.',
    badge: 'TÀI CHÍNH & RỦI RO',
  },
];

export const OFFICIAL_PRICING = {
  // Gói theo lớp lẻ
  perClass: [
    {
      title: 'Lớp nhỏ gọn',
      scale: 'Tối đa 50 sinh viên',
      price: '300.000',
      unit: 'VNĐ / lớp / buổi thi',
      perStudent: '6.000 đ / sinh viên',
      desc: 'Phù hợp cho các bài kiểm tra giữa kỳ, thi học phần nhỏ hoặc thi vấn đáp trực tuyến.',
      popular: false,
      ctaText: 'Đăng ký ca thi lẻ',
      features: [
        'Giám sát đồng thời đến 50 thí sinh',
        'Khóa môi trường thi toàn màn hình',
        'Camera kép (webcam và điện thoại phụ)',
        'Cảnh báo vi phạm trong vòng 2 giây',
        'Hỗ trợ kỹ thuật trực tuyến trong giờ thi',
      ],
    },
    {
      title: 'Lớp tiêu chuẩn',
      scale: 'Tối đa 100 sinh viên',
      price: '500.000',
      unit: 'VNĐ / lớp / buổi thi',
      perStudent: '5.000 đ / sinh viên',
      desc: 'Tối ưu cho các lớp học phần đại trà, kiểm tra tiến độ học tập định kỳ của khoa.',
      popular: true,
      ctaText: 'Chọn lớp tiêu chuẩn',
      features: [
        'Giám sát đồng thời đến 100 thí sinh',
        'Đầy đủ 4 tầng bảo vệ chống gian lận',
        'Trí tuệ nhân tạo phát hiện điện thoại, tai nghe',
        'Tự động cắt video bằng chứng đối soát',
        'Kỹ sư hỗ trợ trực tiếp từ xa trong ca thi',
      ],
    },
    {
      title: 'Lớp mở rộng',
      scale: 'Tối đa 300 sinh viên',
      price: '1.350.000',
      unit: 'VNĐ / lớp / buổi thi',
      perStudent: '4.500 đ / sinh viên',
      desc: 'Dành cho các kỳ thi học phần quy mô lớn ghép nhiều nhóm lớp hoặc chứng chỉ tin học, ngoại ngữ.',
      popular: false,
      ctaText: 'Đăng ký lớp mở rộng',
      features: [
        'Giám sát đồng thời đến 300 thí sinh',
        'Hỗ trợ phân quyền nhiều giám thị coi thi',
        'Băng thông video ưu tiên mượt mà',
        'Báo cáo và biên bản vi phạm có mã toàn vẹn',
        'Cung cấp hợp đồng kinh tế và hóa đơn GTGT',
      ],
    },
  ],

  // Gói học kỳ
  semester: [
    {
      title: 'Gói học kỳ S',
      scale: 'Cấp bộ môn hoặc khoa nhỏ',
      price: '15.000.000',
      unit: 'VNĐ / học kỳ',
      perStudent: '20 lớp (tối đa 2.000 lượt)',
      desc: 'Khoa chủ động xếp lịch thi cho 20 lớp học phần, phụ trội chỉ 5.500 - 7.000 đ/lượt.',
      popular: false,
      ctaText: 'Chọn gói học kỳ S',
      features: [
        'Hạn mức 20 lớp (tối đa 100 SV / lớp)',
        'Không giới hạn tài khoản giảng viên',
        'Lưu trữ hồ sơ video vi phạm 12 tháng',
        'Tập huấn sử dụng chu đáo cho giảng viên',
        'Báo cáo tổng kết khảo thí toàn học kỳ',
      ],
    },
    {
      title: 'Gói học kỳ M',
      scale: 'Cấp khoa lớn hoặc trường vừa',
      price: '32.500.000',
      unit: 'VNĐ / học kỳ',
      perStudent: '50 lớp (tối đa 5.000 lượt)',
      desc: 'Phục vụ trọn vẹn mùa thi giữa kỳ và cuối kỳ cho toàn khoa, tiết kiệm 70% chi phí.',
      popular: true,
      ctaText: 'Chọn gói học kỳ M',
      features: [
        'Hạn mức 50 lớp (tối đa 100 SV / lớp)',
        'Tích hợp danh sách sinh viên qua Excel / API',
        'Hỗ trợ kỹ thuật trực ca thi liên tục',
        'Ký cam kết chất lượng dịch vụ (SLA)',
        'Áp dụng chỉ định thầu rút gọn theo NĐ 214/2025',
      ],
    },
    {
      title: 'Gói học kỳ L',
      scale: 'Quy mô trường đại học',
      price: '60.000.000',
      unit: 'VNĐ / học kỳ',
      perStudent: '10.000 lượt thi trọn gói',
      desc: 'Đơn giá chỉ 6.000 đ/lượt; lượt vượt gói chỉ 5.500 đ/lượt. Phù hợp cho đào tạo từ xa.',
      popular: false,
      ctaText: 'Yêu cầu tư vấn gói L',
      features: [
        'Hạn mức 10.000 lượt thi trong học kỳ',
        'Tùy chọn kết nối trực tiếp với Moodle LMS',
        'Bảo mật dữ liệu cá nhân theo NĐ 13/2023',
        'Kỹ sư on-site hoặc hỗ trợ trực tuyến độc quyền',
        'Ưu đãi giảm 30% cho 3 khách hàng đầu tiên',
      ],
    },
  ],

  // Gói tại chỗ (On-premise)
  onPremise: {
    title: 'Gói cài đặt tại chỗ (Private On-premise)',
    setupFee: '30.000.000 VNĐ (Phí triển khai ban đầu)',
    maintenanceFee: '70.000.000 VNĐ / năm (Phí bảo trì & cập nhật AI)',
    desc: 'Cài đặt trực tiếp lên hệ thống máy chủ nội bộ của nhà trường. Dữ liệu bài thi và sinh trắc học không rời khỏi tường lửa nội bộ.',
    features: [
      'Triển khai trên cụm máy chủ riêng của nhà trường',
      'Bảo trì định kỳ và cập nhật thuật toán 12 tháng',
      'Tích hợp sâu Single Sign-On (SSO / CAS / SAML)',
      'Tùy biến thương hiệu và quy chế khảo thí riêng',
    ],
  },
};
