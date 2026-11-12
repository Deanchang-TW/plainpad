-- 範例：每月訂單彙總（試試「搜尋 > 取代」的規則運算式模式）
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

/* 區塊註解也能摺疊：點行號右邊的 ⊟ 方塊（「設定 > 摺疊標記」可改成 VS Code 式箭頭） */
CREATE INDEX IX_Orders_Customer_Date
    ON dbo.Orders (CustomerId, OrderDate)
    INCLUDE (TotalAmount, Status);
