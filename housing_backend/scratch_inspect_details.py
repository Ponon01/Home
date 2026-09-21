import pandas as pd
from pathlib import Path

def inspect_details():
    path = Path("data") / "рассрочка и выкупленные общее поступление.xlsx"
    if not path.exists():
        return "File not found"
    df = pd.read_excel(path, sheet_name=0, header=None)
    headers = df.iloc[1].tolist()
    
    out = []
    out.append("Columns and values:")
    for idx, (h, val2, val14) in enumerate(zip(headers, df.iloc[2].tolist(), df.iloc[14].tolist())):
        h_str = str(h) if pd.notna(h) else f"col_{idx}"
        out.append(f"[{idx}] '{h_str}': Row2='{val2}' | Row14='{val14}'")
    return "\n".join(out)

if __name__ == "__main__":
    content = inspect_details()
    Path("scratch_inspect_details.txt").write_text(content, encoding="utf-8")
    print("Done")
