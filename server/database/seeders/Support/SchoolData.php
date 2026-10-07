<?php

namespace Database\Seeders\Support;

/**
 * Content catalogue for the demo organizations: classical question banks (every question type)
 * and programming problem banks. Pure data — SchoolSeeder turns it into rows.
 *
 * Question spec: type, content, points, difficulty, [answers: [[text, correct]]], [is_true], [settings], [children], [explanation]
 */
class SchoolData
{
    public static function names(): array
    {
        return [
            'last' => ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý'],
            'middle' => ['Văn', 'Thị', 'Minh', 'Quốc', 'Hoàng', 'Thanh', 'Ngọc', 'Gia', 'Đức', 'Anh', 'Thùy', 'Hải'],
            'first' => ['An', 'Bình', 'Cường', 'Dung', 'Giang', 'Hà', 'Hiếu', 'Hùng', 'Khoa', 'Lan', 'Linh', 'Long', 'Mai', 'Nam', 'Phúc', 'Quân', 'Sơn', 'Thảo', 'Trang', 'Tuấn', 'Vy', 'Yến', 'Đạt', 'Nhi', 'Khánh'],
        ];
    }

    private static function sc(string $c, array $opts, string $diff = 'EASY', float $pts = 1.0, string $ex = ''): array
    {
        return ['type' => 'SINGLE_CHOICE', 'content' => $c, 'points' => $pts, 'difficulty' => $diff, 'explanation' => $ex,
            'answers' => array_map(fn ($o, $i) => [$o, $i === 0], $opts, array_keys($opts))];
    }

    private static function mc(string $c, array $right, array $wrong, string $diff = 'MEDIUM', float $pts = 2.0): array
    {
        return ['type' => 'MULTIPLE_CHOICE', 'content' => $c, 'points' => $pts, 'difficulty' => $diff,
            'answers' => [...array_map(fn ($o) => [$o, true], $right), ...array_map(fn ($o) => [$o, false], $wrong)]];
    }

    private static function tf(string $c, bool $v, string $ex = ''): array
    {
        return ['type' => 'TRUE_FALSE', 'content' => $c, 'points' => 1.0, 'difficulty' => 'EASY', 'is_true' => $v, 'explanation' => $ex];
    }

    private static function fill(string $c, array $blanks, string $diff = 'MEDIUM'): array
    {
        return ['type' => 'MULTIPLE_FILL_IN_BLANK', 'content' => $c, 'points' => 1.5, 'difficulty' => $diff,
            'settings' => ['blanks' => array_map(fn ($b) => ['answers' => (array) $b], $blanks)]];
    }

    private static function short(string $c, string $ref): array
    {
        return ['type' => 'SHORT_ANSWER', 'content' => $c, 'points' => 1.0, 'difficulty' => 'EASY', 'settings' => ['reference' => $ref]];
    }

    private static function essay(string $c, string $ex = ''): array
    {
        return ['type' => 'ESSAY', 'content' => $c, 'points' => 2.0, 'difficulty' => 'HARD', 'explanation' => $ex,
            'settings' => ['mode' => 'write', 'min_words' => 80, 'max_words' => 400]];
    }

    private static function group(string $passage, array $children): array
    {
        return ['type' => 'GROUP_QUESTION', 'content' => 'Đọc đoạn văn và trả lời các câu hỏi bên dưới.', 'points' => 2.5, 'difficulty' => 'MEDIUM',
            'settings' => ['media' => 'text', 'passage' => $passage, 'listen_limit' => 2, 'allow_seek' => false], 'children' => $children];
    }

    /** The first option of sc()/mc() lists is the correct one. */
    public static function classical(string $bank): array
    {
        return match ($bank) {
            'ds' => [
                self::sc('Độ phức tạp trung bình của tìm kiếm nhị phân trên mảng đã sắp xếp là gì?', ['O(log N)', 'O(1)', 'O(N)', 'O(N²)'], 'EASY', 1.0, 'Mỗi bước loại một nửa không gian tìm kiếm.'),
                self::sc('Cấu trúc dữ liệu nào hoạt động theo nguyên tắc LIFO?', ['Ngăn xếp (Stack)', 'Hàng đợi (Queue)', 'Danh sách liên kết', 'Bảng băm']),
                self::mc('Những thuật toán sắp xếp nào có độ phức tạp trung bình O(N log N)?', ['Merge sort', 'Quick sort', 'Heap sort'], ['Bubble sort', 'Insertion sort']),
                self::tf('Bảng băm có thể tìm kiếm phần tử với thời gian trung bình O(1).', true),
                self::fill('Duyệt cây theo thứ tự [1] thăm nút gốc trước, còn duyệt [2] thăm nút gốc sau cùng.', [['tiền thứ tự', 'preorder', 'pre-order'], ['hậu thứ tự', 'postorder', 'post-order']]),
                self::short('Cấu trúc dữ liệu nào dùng để cài đặt thuật toán BFS?', 'queue|hàng đợi'),
                self::essay('So sánh danh sách liên kết và mảng động về chi phí truy cập, chèn và xóa. Nêu một tình huống nên dùng mỗi loại.'),
            ],
            'db' => [
                self::sc('Câu lệnh SQL nào dùng để lấy dữ liệu từ bảng?', ['SELECT', 'INSERT', 'UPDATE', 'DELETE']),
                self::sc('Khóa nào dùng để định danh duy nhất một dòng trong bảng?', ['Khóa chính (Primary key)', 'Khóa ngoại (Foreign key)', 'Chỉ mục (Index)', 'Khung nhìn (View)']),
                self::mc('Những thuộc tính nào thuộc ACID của giao dịch?', ['Atomicity', 'Consistency', 'Isolation', 'Durability'], ['Availability', 'Scalability']),
                self::tf('Mệnh đề WHERE được áp dụng sau khi GROUP BY đã gom nhóm.', false, 'WHERE lọc dòng trước khi gom nhóm; HAVING lọc sau khi gom nhóm.'),
                self::fill('Để nối hai bảng ta dùng [1]; để lọc nhóm sau GROUP BY ta dùng [2].', [['join', 'inner join'], ['having']]),
                self::short('Viết tên từ khóa SQL loại bỏ các dòng trùng lặp trong kết quả.', 'distinct'),
                self::essay('Giải thích chuẩn hóa 3NF và vì sao nên chuẩn hóa lược đồ cơ sở dữ liệu.'),
            ],
            'net' => [
                self::sc('Giao thức nào đảm bảo truyền dữ liệu tin cậy ở tầng giao vận?', ['TCP', 'UDP', 'ICMP', 'ARP']),
                self::sc('Cổng mặc định của HTTPS là?', ['443', '80', '22', '53']),
                self::mc('Đâu là các giao thức thuộc tầng ứng dụng?', ['HTTP', 'DNS', 'SMTP'], ['TCP', 'IP']),
                self::tf('Địa chỉ IPv4 gồm 128 bit.', false, 'IPv4 dài 32 bit; IPv6 mới là 128 bit.'),
                self::fill('Tiến trình chuyển tên miền thành địa chỉ IP gọi là [1], do giao thức [2] thực hiện.', [['phân giải tên miền', 'dns resolution', 'resolve'], ['dns']]),
                self::short('Thiết bị nào định tuyến gói tin giữa các mạng khác nhau?', 'router|bộ định tuyến'),
                self::essay('Mô tả các bước của bắt tay ba bước (three-way handshake) trong TCP và mục đích của nó.'),
            ],
            default /* en */ => [
                self::sc('Choose the correct word: "The server ___ down yesterday."', ['went', 'goes', 'gone', 'going']),
                self::sc('Which word is a synonym of "reliable"?', ['dependable', 'fragile', 'random', 'obsolete']),
                self::mc('Which of the following are programming languages?', ['Python', 'Java', 'Rust'], ['HTML5 Canvas', 'Photoshop']),
                self::tf('"Latency" refers to the delay before a transfer of data begins.', true),
                self::fill('A [1] is a set of rules for communication, and a [2] stores data permanently.', [['protocol'], ['database', 'disk', 'storage']]),
                self::short('What is the abbreviation for "Application Programming Interface"?', 'api'),
                self::group(
                    'Cloud computing lets companies rent servers instead of buying them. This reduces upfront costs and allows teams to scale resources within minutes. However, relying on a single provider may create a risk of vendor lock-in, and sensitive data must be protected with strong encryption.',
                    [
                        self::sc('According to the passage, what is one benefit of cloud computing?', ['It reduces upfront costs.', 'It removes the need for security.', 'It needs no internet.', 'It is always free.'], 'MEDIUM', 1.0),
                        self::mc('Which risks are mentioned?', ['Vendor lock-in', 'Data needing protection'], ['Slow keyboards', 'Hardware overheating'], 'MEDIUM', 1.5),
                    ],
                ),
                self::essay('In about 100 words, explain why software teams write automated tests.'),
            ],
        };
    }

    /** Programming banks: list of problems with test cases [input, output, is_sample]. */
    public static function programming(string $bank): array
    {
        $p = fn (string $t, string $d, string $diff, array $cases, int $ms = 1000) => [
            'title' => $t, 'description' => $d, 'difficulty' => $diff, 'time_limit_ms' => $ms, 'cases' => $cases,
        ];

        return match ($bank) {
            'arrays' => [
                $p('Tổng các phần tử mảng', "### Đề bài\nCho mảng gồm \$N\$ số nguyên. In **tổng** các phần tử.\n\n### Input\nDòng 1: \$N\$. Dòng 2: \$N\$ số.\n\n### Output\nMột số nguyên: tổng.", 'EASY', [["5\n1 2 3 4 5", '15', true], ["3\n-1 -2 3", '0', false], ["1\n100", '100', false]]),
                $p('Phần tử xuất hiện nhiều nhất', "### Đề bài\nCho mảng \$N\$ số nguyên. In giá trị xuất hiện nhiều lần nhất (nếu hòa, in giá trị nhỏ hơn).\n\n### Input\nDòng 1: \$N\$. Dòng 2: \$N\$ số.", 'MEDIUM', [["6\n1 2 2 3 3 3", '3', true], ["4\n5 5 7 7", '5', false], ["1\n9", '9', false]]),
            ],
            'strings' => [
                $p('Chuỗi đối xứng', "### Đề bài\nKiểm tra chuỗi \$S\$ (chữ thường, không dấu cách) có phải palindrome không.\n\n### Output\nIn `YES` hoặc `NO`.", 'EASY', [['level', 'YES', true], ['foxy', 'NO', false], ['a', 'YES', false]]),
                $p('Đếm nguyên âm', "### Đề bài\nĐếm số nguyên âm (`a e i o u`) trong chuỗi \$S\$ gồm chữ thường.\n\n### Output\nMột số nguyên.", 'EASY', [['hello', '2', true], ['rhythm', '0', false], ['aeiou', '5', false]]),
            ],
            'math' => [
                $p('Ước chung lớn nhất', "### Đề bài\nCho hai số nguyên dương \$a, b\$. In ước chung lớn nhất.\n\n### Input\nMột dòng: \$a\$ \$b\$.", 'EASY', [['12 18', '6', true], ['7 13', '1', false], ['100 75', '25', false]]),
                $p('Số Fibonacci thứ N', "### Đề bài\nIn số Fibonacci thứ \$N\$ (\$F_1=F_2=1\$, \$N \\le 40\$).", 'MEDIUM', [['1', '1', true], ['10', '55', false], ['40', '102334155', false]]),
            ],
            default /* sorting */ => [
                $p('Sắp xếp tăng dần', "### Đề bài\nCho \$N\$ số nguyên. In dãy sau khi sắp xếp tăng dần, cách nhau bởi dấu cách.", 'EASY', [["5\n3 1 4 1 5", '1 1 3 4 5', true], ["3\n-2 0 -5", '-5 -2 0', false], ["1\n7", '7', false]]),
                $p('Tìm số lớn thứ hai', "### Đề bài\nCho mảng \$N\$ số nguyên. In giá trị lớn thứ hai (khác giá trị lớn nhất). Đảm bảo luôn tồn tại.", 'MEDIUM', [["5\n4 9 9 2 7", '7', true], ["2\n1 2", '1', false], ["4\n10 10 5 3", '5', false]], 1500),
            ],
        };
    }
}
