import os
import sys
import openpyxl

sys.stdout.reconfigure(encoding='utf-8')

excel_path = os.path.join(os.path.dirname(__file__), "data", "Книга1.xlsx")
if os.path.exists(excel_path):
    wb = openpyxl.load_workbook(excel_path, data_only=True)
    ws = wb["2026 июль"]
    print("--- Searching 'Общежитие' rows in Книга1.xlsx ---")
    for r_idx, row in enumerate(ws.iter_rows(values_only=True), start=1):
        row_str = " | ".join([str(c) for c in row if c is not None])
        if "404" in row_str or "509" in row_str or "Қадырхан" in row_str or "Кадырхан" in row_str:
            print(f"L{r_idx}: {row_str[:250]}")
