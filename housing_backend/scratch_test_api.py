import asyncio
import httpx

async def test_api():
    async with httpx.AsyncClient() as client:
        # The API prefix prefix is /api/budget-excel/analytics/purchase.
        # But wait, it requires a user login or token?
        # Let's log in first to fetch the access token.
        # We can see in auth.py or user table: username/password are probably postgres or admin.
        # Let's login as admin to get a valid token.
        login_url = "http://localhost:8000/api/auth/login"
        r = await client.post(login_url, data={"username": "admin", "password": "adminpassword"}) # wait, let's look at user credentials or run without auth if we bypass it.
        # Let's bypass auth if we run a direct db service test, or let's try to query the backend router function directly inside python!
        # Direct python call is much easier and doesn't depend on network / auth credentials.
        
        print("Testing direct DB call...")
        from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
        from sqlalchemy.orm import sessionmaker
        from app.routers.budget_excel import get_purchase_analytics, get_rent_analytics
        
        DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/astana_opera_housing"
        engine = create_async_engine(DATABASE_URL, echo=False)
        async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        
        async with async_session() as session:
            res_rent = await get_rent_analytics(session)
            print("Rent analytics keys:", res_rent.keys())
            print("Rent overdue list length:", len(res_rent["overdueList"]))
            
            res_purchase = await get_purchase_analytics(session)
            print("Purchase analytics keys:", res_purchase.keys())
            print("Purchase overdue list length:", len(res_purchase["overdueList"]))
            print("Purchase debtTotal:", res_purchase["debtTotal"])

if __name__ == "__main__":
    asyncio.run(test_api())
