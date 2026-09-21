import asyncio
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.models.purchase_payment_schedule import PurchasePaymentSchedule
from app.models.housing_department_record import HousingDepartmentRecord

DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/astana_opera_housing"

async def main():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # Check purchase payment schedule count
        sched_cnt = await session.scalar(select(func.count(PurchasePaymentSchedule.id)))
        print(f"PurchasePaymentSchedule count: {sched_cnt}")
        
        # Check housing department records count
        dept_cnt = await session.scalar(select(func.count(HousingDepartmentRecord.id)))
        print(f"HousingDepartmentRecord count: {dept_cnt}")
        
        # Print a few purchase schedule rows if they exist
        if sched_cnt > 0:
            res = await session.execute(select(PurchasePaymentSchedule).limit(5))
            rows = res.scalars().all()
            print("\n=== Sample Purchase Payment Schedule ===")
            for r in rows:
                print(f"ID: {r.id}, AptID: {r.apartment_id}, Year: {r.year}, Month: {r.month}, Due: {r.amount_due}, Paid: {r.amount_paid}")
                
        # Print a few housing department records
        if dept_cnt > 0:
            res = await session.execute(select(HousingDepartmentRecord).limit(5))
            rows = res.scalars().all()
            print("\n=== Sample Housing Department Records ===")
            for r in rows:
                print(f"ID: {r.id}, FIO: '{r.fio}', Status: '{r.status}', Monthly: {r.reimbursement_cost_monthly}")

if __name__ == "__main__":
    asyncio.run(main())
