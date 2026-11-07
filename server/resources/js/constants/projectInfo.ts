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

export const ADVISORS_EN: Advisor[] = [
  {
    name: 'MSc. Nguyen Trung Hau',
    title: 'Lecturer',
    role: 'Economic & Business Faculty Advisor',
    department: 'Faculty of Information Technology, Ho Chi Minh City Open University',
  },
  {
    name: 'MSc. Duong Huu Thanh',
    title: 'Lecturer',
    role: 'Technical & Engineering Faculty Advisor',
    department: 'Faculty of Information Technology, Ho Chi Minh City Open University',
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

export const TEAM_MEMBERS_EN: TeamMember[] = [
  {
    name: 'Le Minh Khoi',
    mssv: '2351050084',
    role: 'Project Leader & Operations Lead',
    department: 'Information Technology',
    email: 'minkhoi.dev@gmail.com',
    phone: '0387 291 237',
    duties: 'Lead on-device AI research (MobileFaceNet, YOLOX), orchestrates pilot exam operations, and handles incident management.',
    badge: 'TEAM LEADER & OPERATIONS',
    isLeader: true,
  },
  {
    name: 'Nguyen Thanh Trieu',
    mssv: '2251052127',
    role: 'Technical & Infrastructure Lead',
    department: 'Information Technology',
    email: 'trieukon1011@gmail.com',
    phone: '0772 816 986',
    duties: 'Architects OS-level Kiosk lockdown client, SFU signaling server, stress testing, and edge computer vision inference pipelines.',
    badge: 'SYSTEMS & INFRASTRUCTURE',
  },
  {
    name: 'Cao Do Huyen Tran',
    mssv: '2454050030',
    role: 'Data Privacy & Legal Lead',
    department: 'Information Technology',
    email: '2454050030tran@ou.edu.vn',
    duties: 'Formulates Data Protection Impact Assessment (DPIA), Data Processing Agreements (DPA), legal compliance, and entity incorporation.',
    badge: 'PRIVACY & LEGAL COMPLIANCE',
  },
  {
    name: 'Le Phan Huyen Trang',
    mssv: '2454052084',
    role: 'Business Development & Partnerships',
    department: 'Information Technology',
    email: 'huyentrang11k6@gmail.com',
    phone: '0868 772 951',
    duties: 'Liaises with university faculties, coordinates pilot trial rollouts, user interviews, institutional quotations, and B2B marketing.',
    badge: 'BUSINESS & PARTNERSHIPS',
  },
  {
    name: 'Pham Thi Diem Kieu',
    mssv: '2551050116',
    role: 'Finance & Risk Governance Lead',
    department: 'Information Technology',
    email: 'kiiz602103@gmail.com',
    phone: '0387 631 476',
    duties: 'Builds financial unit economics, tracks fixed and variable operational costs, and manages biometric data risk governance.',
    badge: 'FINANCE & RISK GOVERNANCE',
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

export const OFFICIAL_PRICING_EN = {
  // Pay-per-class
  perClass: [
    {
      title: 'Compact Class',
      scale: 'Up to 50 students',
      price: '300,000',
      unit: 'VND / class / session',
      perStudent: '6,000 VND / student',
      desc: 'Ideal for midterm quizzes, small module tests, or online oral assessments.',
      popular: false,
      ctaText: 'Register Single Session',
      features: [
        'Concurrent proctoring for up to 50 students',
        'Fullscreen OS-level kiosk lockdown',
        'Dual camera (webcam + secondary phone)',
        'Violation alert delivery in ≤ 2 seconds',
        'Realtime online technical standby during exam',
      ],
    },
    {
      title: 'Standard Class',
      scale: 'Up to 100 students',
      price: '500,000',
      unit: 'VND / class / session',
      perStudent: '5,000 VND / student',
      desc: 'Optimized for standard university lecture classes and regular department exams.',
      popular: true,
      ctaText: 'Choose Standard Class',
      features: [
        'Concurrent proctoring for up to 100 students',
        'Full 4-tier anti-cheat defense architecture',
        'Edge AI detection for phones and earphones',
        'Automated evidence clip segmentation',
        'Dedicated remote standby engineer during session',
      ],
    },
    {
      title: 'Extended Exam',
      scale: 'Up to 300 students',
      price: '1,350,000',
      unit: 'VND / class / session',
      perStudent: '4,500 VND / student',
      desc: 'Designed for large combined cohorts, campus certifications, and foreign language tests.',
      popular: false,
      ctaText: 'Register Extended Exam',
      features: [
        'Concurrent proctoring for up to 300 students',
        'Multi-proctor role-based permission management',
        'Prioritized SFU high-definition video bandwidth',
        'Incident audit report with cryptographic SHA-256',
        'Official electronic contract & VAT invoice',
      ],
    },
  ],

  // Semester packages
  semester: [
    {
      title: 'Semester Pack S',
      scale: 'Department or Small Faculty',
      price: '15,000,000',
      unit: 'VND / semester',
      perStudent: '20 classes (up to 2,000 attempts)',
      desc: 'Faculty autonomously schedules 20 course modules; extra attempts at 5,500 - 7,000 VND.',
      popular: false,
      ctaText: 'Select Semester S',
      features: [
        'Quota of 20 classes (up to 100 students / class)',
        'Unlimited instructor & proctor accounts',
        '12-month secure incident video archiving',
        'Comprehensive faculty training & onboarding',
        'End-of-term institutional assessment report',
      ],
    },
    {
      title: 'Semester Pack M',
      scale: 'Large Faculty or Mid-sized College',
      price: '32,500,000',
      unit: 'VND / semester',
      perStudent: '50 classes (up to 5,000 attempts)',
      desc: 'Covers full midterm and final exam seasons for an entire faculty, cutting 70% costs.',
      popular: true,
      ctaText: 'Select Semester M',
      features: [
        'Quota of 50 classes (up to 100 students / class)',
        'Roster sync via Excel & standard REST API',
        'Continuous technical standby during all exam slots',
        'Service Level Agreement (SLA) commitment',
        'Streamlined bidding under Decree 214/2025/ND-CP',
      ],
    },
    {
      title: 'Semester Pack L',
      scale: 'Campus-wide / University',
      price: '60,000,000',
      unit: 'VND / semester',
      perStudent: '10,000 attempts all-inclusive',
      desc: 'Unit cost drops to 6,000 VND/attempt (overage at 5,500 VND). Ideal for distance learning.',
      popular: false,
      ctaText: 'Inquire Semester L',
      features: [
        'Quota of 10,000 exam attempts per semester',
        'Native direct integration with Moodle LMS / Canvas',
        'Full biometric data privacy under Decree 13/2023',
        'On-site engineer or dedicated VIP virtual queue',
        '30% early-adopter rebate for first 3 institutions',
      ],
    },
  ],

  // Private On-premise
  onPremise: {
    title: 'Private On-Premise Deployment',
    setupFee: '30,000,000 VND (Initial Deployment Fee)',
    maintenanceFee: '70,000,000 VND / year (Maintenance & AI Updates)',
    desc: 'Installed directly into your university internal data center. Exam papers and biometric streams never leave your firewall.',
    features: [
      'Self-hosted on dedicated campus server cluster',
      'Scheduled maintenance & 12-month model updates',
      'Deep Single Sign-On (SSO / CAS / SAML) integration',
      'Custom institutional branding & exam bylaws',
    ],
  },
};
