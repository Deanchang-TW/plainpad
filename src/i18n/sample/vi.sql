-- Ví dụ: tổng hợp đơn hàng theo tháng (thử biểu thức chính quy trong Tìm kiếm > Thay thế)
SELECT  c.CustomerId,
        c.Name,
        DATEFROMPARTS(YEAR(o.OrderDate), MONTH(o.OrderDate), 1) AS OrderMonth,
        COUNT(*)            AS OrderCount,
        SUM(o.TotalAmount)  AS Revenue
FROM    dbo.Customers AS c
JOIN    dbo.Orders    AS o ON o.CustomerId = c.CustomerId
WHERE   o.OrderDate >= '2026-01-01'
  AND   o.Status IN (N'Paid', N'Shipped')
GROUP BY c.CustomerId,
         c.Name,
         DATEFROMPARTS(YEAR(o.OrderDate), MONTH(o.OrderDate), 1)
ORDER BY Revenue DESC;

/* Chú thích khối cũng thu gọn được: nhấp ô ⊟ bên phải số dòng (Cài đặt > Dấu thu gọn đổi sang mũi tên kiểu VS Code) */
CREATE INDEX IX_Orders_Customer_Date
    ON dbo.Orders (CustomerId, OrderDate)
    INCLUDE (TotalAmount, Status);
