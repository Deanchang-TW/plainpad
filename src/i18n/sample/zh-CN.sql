-- 示例：每月订单汇总（试试“搜索 > 替换”的正则表达式模式）
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

/* 块注释也能折叠：点击行号右边的 ⊟ 方块（“设置 > 折叠标记”可改为 VS Code 式箭头） */
CREATE INDEX IX_Orders_Customer_Date
    ON dbo.Orders (CustomerId, OrderDate)
    INCLUDE (TotalAmount, Status);
