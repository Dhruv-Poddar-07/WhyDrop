import numpy as np
import pandas as pd

REGIONS = ["Jaipur", "Delhi", "Mumbai", "Pune"]
CATEGORIES = ["Vegetables", "Dairy", "Bakery"]


def make_data(drop_region, drop_category, drop_start_day, drop_amount, seed):
    rng = np.random.default_rng(seed)
    dates = pd.date_range("2026-01-01", periods=60)

    rows = []
    for day_number, date in enumerate(dates):
        for region in REGIONS:
            for category in CATEGORIES:
                sales = rng.normal(1000, 30)

                if region == drop_region and category == drop_category and day_number >= drop_start_day:
                    sales = sales * (1 - drop_amount)

                rows.append([date, region, category, sales])

    return pd.DataFrame(rows, columns=["date", "region", "category", "revenue"])
