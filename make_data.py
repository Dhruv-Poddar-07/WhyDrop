import numpy as np
import pandas as pd

rng = np.random.default_rng(42)

regions = ["Jaipur", "Delhi", "Mumbai", "Pune"]
categories = ["Vegetables", "Dairy", "Bakery"]
dates = pd.date_range("2026-01-01", periods=60)

rows = []
for day_number, date in enumerate(dates):
    for region in regions:
        for category in categories:
            sales = rng.normal(1000, 30)

            if region == "Jaipur" and category == "Vegetables" and day_number >= 35:
                sales = sales * 0.5

            rows.append([date, region, category, sales])

df = pd.DataFrame(rows, columns=["date", "region", "category", "revenue"])
df.to_excel("sales.xlsx", index=False)
print(df.shape)