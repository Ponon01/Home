import openpyxl
from pathlib import Path

def inspect_sheet_cols(filename, sheet_name, header_row=1):
    path = Path("data") / filename
    if not path.exists():
        print(f"File {filename} not found")
        return
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb[sheet_name]
    print(f"\n=== File: {filename}, Sheet: {sheet_name} ===")
    
    # Print all headers
    headers = [cell.value for cell in next(ws.iter_rows(min_row=header_row, max_row=header_row))]
    print(f"Total columns: {len(headers)}")
    for idx, h in enumerate(headers):
        if h:
            print(f"  Col {idx+1}: {repr(h)}")
            
    # Print sample data for first 5 rows with values
    count = 0
    for r_idx in range(header_row + 1, ws.max_row + 1):
        row_vals = [ws.cell(row=r_idx, column=c_idx+1).value for c_idx in range(len(headers))]
        if any(row_vals):
            count += 1
            print(f"  Row {r_idx}:")
            for c_idx, val in enumerate(row_vals):
                if val:
                    header_name = headers[c_idx] or f"Col_{c_idx+1}"
                    print(f"    {header_name}: {repr(val)}")
            if count >= 3:
                break
    wb.close()

if __name__ == "__main__":
    inspect_sheet_cols("1Расчет по квартирам 2026 (АРЕНДА).xlsx", "2026 Март", header_row=1)
    inspect_sheet_cols("рассрочка и выкупленные общее поступление 2222.xlsx", "Лист1", header_row=5)
    inspect_sheet_cols("рассрочка и выкупленные общее поступление 2222.xlsx", "Лист2", header_row=3)
