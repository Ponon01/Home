import pandas as pd
from pathlib import Path

def print_all_columns():
    path = Path("data") / "рассрочка и выкупленные общее поступление.xlsx"
    if not path.exists():
        print("File not found")
        return
    df = pd.read_excel(path, sheet_name=0, header=None)
    headers = [str(x) for x in df.iloc[1].tolist() if pd.notna(x)]
    print("Total columns in Row 1:", len(headers))
    for i, h in enumerate(headers):
        print(f"[{i}] {h}")

if __name__ == "__main__":
    print_all_columns()
