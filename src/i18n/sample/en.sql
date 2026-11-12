-- Sample: monthly order summary (try regular expressions in Search > Replace)
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

/* Block comments fold too: click the ⊟ box right of the line numbers (Settings > Fold Markers switches to VS Code-style chevrons) */
CREATE INDEX IX_Orders_Customer_Date
    ON dbo.Orders (CustomerId, OrderDate)
    INCLUDE (TotalAmount, Status);
