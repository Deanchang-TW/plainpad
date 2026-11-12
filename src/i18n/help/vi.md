# Hướng dẫn Plainpad

Trình soạn thảo kiểu Notepad++ chạy trong trình duyệt. Bạn có thể đóng thẻ này,
và mở lại bất cứ lúc nào từ Cửa sổ > Hướng dẫn.

## Phím tắt thường dùng (Mac; trên Windows dùng Ctrl thay cho ⌘)

| Thao tác                            | Phím                                   |
| ----------------------------------- | -------------------------------------- |
| Thẻ mới / đóng thẻ                  | ⌥N / ⌥W                                |
| Chuyển đến thẻ 1–9                  | ⌥1 … ⌥9                                |
| Mở tệp                              | ⌘O, hoặc kéo tệp vào cửa sổ            |
| Lưu / Lưu thành                     | ⌘S / ⇧⌘S                               |
| Tìm / Thay thế                      | ⌘F / ⌥⌘F (hoặc ⌃H)                     |
| Tìm trong các tệp                   | ⇧⌘F                                    |
| Kết quả tiếp / trước                | ⌘G / ⇧⌘G (hoặc F3 / ⇧F3)               |
| Đi tới dòng                         | ⌃G                                     |
| Nhân đôi / xóa dòng                 | ⌘D / ⇧⌘K                               |
| Chuyển dòng lên / xuống             | ⌥↑ / ⌥↓                                |
| Nối dòng                            | ⌘J                                     |
| Bật/tắt chú thích                   | ⌘/                                     |
| CHỮ HOA / chữ thường                | ⇧⌘U / ⌘U                               |
| Trình soạn cột                      | ⌥C                                     |
| Hoàn thành từ                       | ⌘↩                                     |
| Bật/tắt dấu trang / tiếp / trước    | ⌘F2 / F2 / ⇧F2 (hoặc nhấp bên trái số dòng) |
| Ghi / phát macro                    | ⌥⇧R / ⌥⇧P                              |
| Tự ngắt dòng                        | ⌥Z                                     |
| Xem trước Markdown                  | ⌃⇧M                                    |
| Chuyển văn bản / Hex                | ⌃⇧H                                    |
| Phóng to, thu nhỏ                   | ⌘= / ⌘- / ⌘0                           |
| Chọn theo cột (hình chữ nhật)       | Giữ ⌥ và kéo                           |
| Nhiều con trỏ                       | Giữ ⌘ và nhấp                          |

## Chia đôi màn hình và so sánh

- Xem > Chia đôi màn hình mở khung xem thứ hai, để xem hai thẻ cạnh nhau, hoặc hai vị trí trong cùng một tệp.
  Khi hai bên cùng hiển thị một tài liệu, nội dung được đồng bộ ngay.
- Công cụ > So sánh hai thẻ so sánh từng dòng: màu vàng là dòng đã sửa, màu đỏ là dòng bị xóa ở bên trái,
  màu xanh lá là dòng thêm ở bên phải. Các khối gạch chéo là phần đệm để hai bên thẳng hàng.
  Kết quả tự cập nhật khi bạn sửa, và ↑ ↓ chuyển đến khác biệt trước hoặc kế tiếp.

## Xem trước Markdown

Nhấn nút M↓ trên thanh công cụ (hoặc ⌃⇧M) để hiện bản xem trước Markdown của thẻ hiện tại ở bên phải.
Bản xem trước cập nhật khi bạn gõ và cuộn theo trình soạn thảo. Nhấp đúp vào một đoạn trong bản xem trước sẽ nhảy tới mã nguồn của đoạn đó.
Khối mã được tô màu theo ngôn ngữ bạn ghi (ví dụ ```sql hoặc ```csharp).
Xuất HTML tải xuống một trang độc lập kèm định dạng. Sao chép HTML chỉ sao chép nội dung, tiện dán vào Confluence và các công cụ tương tự.
Bản xem trước không hiển thị ảnh từ bên ngoài hoặc đường dẫn tương đối (giới hạn của hộp cát), nhưng HTML xuất ra thì hiển thị được.

Công thức toán dùng cú pháp LaTeX: viết $E = mc^2$ trong dòng, và $$ … $$ hoặc khối ```math cho công thức riêng.
Để gõ ký hiệu đô la, hãy viết \$.
Biểu đồ dùng khối ```mermaid: lưu đồ, sơ đồ tuần tự, Gantt, lớp, ER, trạng thái và nhiều loại khác.
Hai thành phần này chỉ được tải ở lần dùng đầu tiên, nên lần đầu sẽ hơi chậm. HTML xuất ra đã chứa sẵn biểu đồ và công thức, không cần mạng.

## Trình soạn Hex

Tệp nhị phân và tệp lớn hơn 25 MB tự động mở ở chế độ Hex. Bạn cũng có thể dùng Tệp > Mở bằng Hex,
hoặc nhấn nút Hex hình lục giác trên thanh công cụ (⌃⇧H) để chuyển thẻ hiện tại giữa văn bản và Hex.

- Bên trái là vị trí, ở giữa là các byte dạng hex, bên phải là văn bản. Tab chuyển giữa hai cột.
- Gõ trực tiếp để sửa: 0–9 và A–F ở cột Hex, ký tự ở cột văn bản. Byte đã sửa chuyển sang màu đỏ.
- Mặc định là chế độ ghi đè. Nhấn Insert hoặc nút Ghi đè / Chèn trên thanh công cụ để chuyển. Delete và Backspace xóa byte.
- ⌘Z / ⇧⌘Z hoàn tác và làm lại. ⌘C, ⌘X, ⌘V làm việc với chuỗi hex ở cột Hex và với văn bản ở cột văn bản.
- Tìm kiếm được hex (?? là một byte bất kỳ, ví dụ 4D 5A ?? 00) hoặc văn bản. ⌘G / ⇧⌘G tìm kết quả tiếp hoặc trước.
- Đi tới vị trí (⌃G) nhận 0x1F4, 1F4h, 500, và dịch chuyển tương đối như +100, -0x20.
- Trình kiểm tra dữ liệu bên phải hiển thị các byte tại con trỏ dưới dạng số nguyên, số thực, time_t và FILETIME, với cả hai thứ tự byte.
- Menu Hex sao chép vùng chọn dưới dạng chuỗi hex, mảng C / C++, mảng C# hoặc Base64.
- Tệp lớn chỉ được đọc ở phần màn hình cần, nên tệp hàng GB vẫn mở được. Việc sửa cũng không cần nạp cả tệp vào bộ nhớ.
- Các phần mở rộng như .bin, .exe, .dll không tải trực tiếp được, nên khi lưu sẽ hỏi đóng gói thành .zip (giải nén ra đúng tệp gốc) hoặc lưu thành .txt rồi đổi tên.
- Thẻ Hex đến 200 MB được giữ trong trình duyệt này và vẫn còn sau khi tải lại. Tệp lớn hơn sẽ không được giữ.

## Dấu trang

Nhấp vào khoảng trống bên trái số dòng, hoặc nhấn ⌘F2. Tìm kiếm > Dấu trang sao chép, cắt hoặc xóa mọi dòng có dấu trang cùng lúc,
hoặc chỉ giữ lại các dòng có dấu trang. Tùy chọn Thêm dấu trang khi đánh dấu trong bảng tìm kiếm sẽ thêm dấu trang cho mọi dòng khớp.

## Macro

Nhấn chấm đỏ trên thanh công cụ để bắt đầu ghi. Việc gõ, phím mũi tên, xóa và các lệnh trong menu Sửa đều được ghi lại.
Nhấn lần nữa để dừng. ▶ phát một lần, ▶▶ chạy một số lần định trước hoặc đến cuối tệp.
Macro > Lưu macro hiện tại lưu macro với một tên. Các cú nhấp chuột không được ghi.

## Tìm kiếm

- Thông thường: khớp nguyên văn. Mở rộng: dùng được \n \t \r \0 \xHH \uHHHH.
- Biểu thức chính quy: cú pháp JavaScript, ^ và $ khớp theo từng dòng. Phần thay thế dùng được $1 hoặc \1.
- Liệt kê tất cả hiển thị kết quả ở bảng bên dưới. Nhấp vào một kết quả để nhảy tới.
- Tìm trong các tệp yêu cầu chọn một thư mục trước. Tệp chỉ được đọc trong trình duyệt của bạn, không bao giờ tải lên.
  Chrome sẽ hỏi trước có muốn tải tệp lên trang này không. Đó là câu chữ cố định của trình duyệt.

## Lưu và phiên làm việc

- Mọi thẻ, dấu trang và macro được tự động giữ trong trình duyệt này, không tải lên đâu cả.
- Khi lưu sẽ hiện hộp thoại tải xuống, vì trang web không thể ghi đè tệp gốc trên đĩa.
- Khi lưu, tệp giữ nguyên mã hóa gốc (tệp Big5 được lưu lại bằng Big5). Kết thúc dòng theo cài đặt ở góc dưới bên phải (LF / CRLF / CR).
  Để đổi mã hóa, dùng Mã hóa > Mã hóa khi lưu. Nếu có ký tự không biểu diễn được bằng mã hóa gốc, bạn sẽ được hỏi trước khi lưu.
- Khi mở tệp sẽ tự nhận dạng UTF-8, UTF-16, Big5, GB18030, Shift_JIS, EUC-KR và Windows-1252.
  Nếu nhận dạng sai, hãy chọn mã hóa khác trong Mã hóa > Mở lại bằng mã hóa khác.

## Ngôn ngữ giao diện

Cài đặt > Ngôn ngữ giao diện chuyển giữa 繁體中文, English, 简体中文 và Tiếng Việt. Trang sẽ tải lại và các thẻ vẫn được giữ nguyên.
