from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from api import nodes_router, review_router, edges_router, exploration_router, catalog_router
from db import close_neo4j_client


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时
    print("Knowledge Graph API starting...")
    yield
    # 关闭时
    print("Closing Neo4j connection...")
    close_neo4j_client()


app = FastAPI(
    title="Knowledge Graph API",
    description="AI长期记忆知识图谱后端",
    version="0.1.0",
    lifespan=lifespan
)

# CORS设置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 开发环境，生产环境需要限制
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(nodes_router)
app.include_router(review_router)
app.include_router(edges_router)
app.include_router(exploration_router)
app.include_router(catalog_router)


@app.get("/")
async def root():
    """根路径"""
    return {
        "message": "Knowledge Graph API",
        "version": "0.1.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health():
    """健康检查"""
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
