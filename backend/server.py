from fastapi import FastAPI, APIRouter, HTTPException, Depends, Query
from fastapi.security import OAuth2PasswordBearer
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
import os
import logging
from pathlib import Path
from dotenv import load_dotenv
from bson import ObjectId
import re

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

SECRET_KEY = os.environ.get('JWT_SECRET', 'agora-social-secret-key-2026')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
oauth2_optional = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ===== Helpers =====

def hash_password(p: str) -> str:
    return pwd_context.hash(p)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_token(user_id: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": user_id, "exp": exp}, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        uid = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"_id": ObjectId(uid)})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def get_current_user_opt(token: Optional[str] = Depends(oauth2_optional)):
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        uid = payload.get("sub")
        if not uid:
            return None
        return await db.users.find_one({"_id": ObjectId(uid)})
    except Exception:
        return None

def extract_hashtags(content: str) -> List[str]:
    return list(set(tag.lower() for tag in re.findall(r'#(\w+)', content)))

def serialize_user(user: dict, include_email: bool = False) -> dict:
    d = {
        "id": str(user["_id"]),
        "username": user["username"],
        "display_name": user.get("display_name", user["username"]),
        "bio": user.get("bio", ""),
        "avatar_url": user.get("avatar_url", ""),
        "banner_url": user.get("banner_url", ""),
        "followers_count": user.get("followers_count", 0),
        "following_count": user.get("following_count", 0),
        "posts_count": user.get("posts_count", 0),
        "created_at": user["created_at"].isoformat() if isinstance(user["created_at"], datetime) else user.get("created_at", ""),
    }
    if include_email:
        d["email"] = user.get("email", "")
    return d

DELETED_USER = {"id": "", "username": "deleted", "display_name": "Deleted User", "bio": "", "avatar_url": "", "banner_url": "", "followers_count": 0, "following_count": 0, "posts_count": 0, "created_at": ""}

async def serialize_post(post: dict, current_user_id: Optional[str] = None) -> dict:
    author = await db.users.find_one({"_id": ObjectId(post["author_id"])})
    author_data = serialize_user(author) if author else DELETED_USER

    post_id_str = str(post["_id"])
    liked = reposted = bookmarked = False

    if current_user_id:
        liked = await db.likes.find_one({"user_id": current_user_id, "post_id": post_id_str}) is not None
        reposted = await db.reposts.find_one({"user_id": current_user_id, "post_id": post_id_str}) is not None
        bookmarked = await db.bookmarks.find_one({"user_id": current_user_id, "post_id": post_id_str}) is not None

    return {
        "id": post_id_str,
        "author": author_data,
        "content": post["content"],
        "media_urls": post.get("media_urls", []),
        "hashtags": post.get("hashtags", []),
        "like_count": post.get("like_count", 0),
        "repost_count": post.get("repost_count", 0),
        "reply_count": post.get("reply_count", 0),
        "bookmark_count": post.get("bookmark_count", 0),
        "is_reply": post.get("is_reply", False),
        "reply_to": post.get("reply_to"),
        "is_repost": post.get("is_repost", False),
        "repost_of": post.get("repost_of"),
        "created_at": post["created_at"].isoformat() if isinstance(post["created_at"], datetime) else post.get("created_at", ""),
        "liked": liked,
        "reposted": reposted,
        "bookmarked": bookmarked,
    }

async def create_notification(recipient_id: str, notif_type: str, from_user_id: str, post_id: Optional[str] = None):
    if recipient_id == from_user_id:
        return
    await db.notifications.insert_one({
        "recipient_id": recipient_id,
        "type": notif_type,
        "from_user_id": from_user_id,
        "post_id": post_id,
        "read": False,
        "created_at": datetime.now(timezone.utc),
    })

# ===== Pydantic Models =====

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    display_name: str

class UserLogin(BaseModel):
    email: str
    password: str

class PostCreate(BaseModel):
    content: str
    media_urls: List[str] = []
    reply_to: Optional[str] = None

class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None

# ===== AUTH =====

@api_router.post("/auth/register")
async def register(data: UserCreate):
    if await db.users.find_one({"username": data.username.lower()}):
        raise HTTPException(400, "Username already taken")
    if await db.users.find_one({"email": data.email.lower()}):
        raise HTTPException(400, "Email already registered")

    user_doc = {
        "username": data.username.lower(),
        "email": data.email.lower(),
        "password_hash": hash_password(data.password),
        "display_name": data.display_name,
        "bio": "",
        "avatar_url": "",
        "banner_url": "",
        "followers_count": 0,
        "following_count": 0,
        "posts_count": 0,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.users.insert_one(user_doc)
    user_doc["_id"] = result.inserted_id
    token = create_token(str(result.inserted_id))
    return {"token": token, "user": serialize_user(user_doc, include_email=True)}

@api_router.post("/auth/login")
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email.lower()})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    token = create_token(str(user["_id"]))
    return {"token": token, "user": serialize_user(user, include_email=True)}

@api_router.get("/auth/me")
async def get_me(current_user=Depends(get_current_user)):
    return serialize_user(current_user, include_email=True)

# ===== FEED =====

@api_router.get("/feed")
async def get_feed(
    type: str = Query("for_you", enum=["for_you", "following"]),
    skip: int = 0,
    limit: int = 20,
    current_user=Depends(get_current_user)
):
    user_id = str(current_user["_id"])
    query = {"is_reply": False}

    if type == "following":
        follows = await db.follows.find({"follower_id": user_id}).to_list(1000)
        following_ids = [f["following_id"] for f in follows]
        if not following_ids:
            return []
        query["author_id"] = {"$in": following_ids}

    posts = await db.posts.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return [await serialize_post(p, user_id) for p in posts]

# ===== POSTS =====

@api_router.post("/posts")
async def create_post(data: PostCreate, current_user=Depends(get_current_user)):
    user_id = str(current_user["_id"])
    hashtags = extract_hashtags(data.content)

    if data.reply_to:
        parent = await db.posts.find_one({"_id": ObjectId(data.reply_to)})
        if not parent:
            raise HTTPException(404, "Parent post not found")

    post_doc = {
        "author_id": user_id,
        "content": data.content,
        "media_urls": data.media_urls,
        "hashtags": hashtags,
        "like_count": 0,
        "repost_count": 0,
        "reply_count": 0,
        "bookmark_count": 0,
        "is_reply": data.reply_to is not None,
        "reply_to": data.reply_to,
        "is_repost": False,
        "repost_of": None,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.posts.insert_one(post_doc)
    post_doc["_id"] = result.inserted_id

    await db.users.update_one({"_id": ObjectId(user_id)}, {"$inc": {"posts_count": 1}})

    if data.reply_to:
        await db.posts.update_one({"_id": ObjectId(data.reply_to)}, {"$inc": {"reply_count": 1}})
        if parent:
            await create_notification(parent["author_id"], "reply", user_id, data.reply_to)

    return await serialize_post(post_doc, user_id)

@api_router.get("/posts/{post_id}")
async def get_post(post_id: str, current_user=Depends(get_current_user_opt)):
    try:
        post = await db.posts.find_one({"_id": ObjectId(post_id)})
    except Exception:
        raise HTTPException(400, "Invalid post ID")
    if not post:
        raise HTTPException(404, "Post not found")
    uid = str(current_user["_id"]) if current_user else None
    return await serialize_post(post, uid)

@api_router.delete("/posts/{post_id}")
async def delete_post(post_id: str, current_user=Depends(get_current_user)):
    post = await db.posts.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(404, "Post not found")
    user_id = str(current_user["_id"])
    if post["author_id"] != user_id:
        raise HTTPException(403, "Not authorized")
    await db.posts.delete_one({"_id": ObjectId(post_id)})
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$inc": {"posts_count": -1}})
    return {"success": True}

@api_router.post("/posts/{post_id}/like")
async def toggle_like(post_id: str, current_user=Depends(get_current_user)):
    user_id = str(current_user["_id"])
    post = await db.posts.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(404, "Post not found")

    existing = await db.likes.find_one({"user_id": user_id, "post_id": post_id})
    if existing:
        await db.likes.delete_one({"user_id": user_id, "post_id": post_id})
        await db.posts.update_one({"_id": ObjectId(post_id)}, {"$inc": {"like_count": -1}})
        return {"liked": False}
    else:
        await db.likes.insert_one({"user_id": user_id, "post_id": post_id, "created_at": datetime.now(timezone.utc)})
        await db.posts.update_one({"_id": ObjectId(post_id)}, {"$inc": {"like_count": 1}})
        await create_notification(post["author_id"], "like", user_id, post_id)
        return {"liked": True}

@api_router.post("/posts/{post_id}/repost")
async def toggle_repost(post_id: str, current_user=Depends(get_current_user)):
    user_id = str(current_user["_id"])
    post = await db.posts.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(404, "Post not found")

    existing = await db.reposts.find_one({"user_id": user_id, "post_id": post_id})
    if existing:
        await db.reposts.delete_one({"user_id": user_id, "post_id": post_id})
        await db.posts.update_one({"_id": ObjectId(post_id)}, {"$inc": {"repost_count": -1}})
        return {"reposted": False}
    else:
        await db.reposts.insert_one({"user_id": user_id, "post_id": post_id, "created_at": datetime.now(timezone.utc)})
        await db.posts.update_one({"_id": ObjectId(post_id)}, {"$inc": {"repost_count": 1}})
        await create_notification(post["author_id"], "repost", user_id, post_id)
        return {"reposted": True}

@api_router.post("/posts/{post_id}/bookmark")
async def toggle_bookmark(post_id: str, current_user=Depends(get_current_user)):
    user_id = str(current_user["_id"])
    post = await db.posts.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(404, "Post not found")

    existing = await db.bookmarks.find_one({"user_id": user_id, "post_id": post_id})
    if existing:
        await db.bookmarks.delete_one({"user_id": user_id, "post_id": post_id})
        await db.posts.update_one({"_id": ObjectId(post_id)}, {"$inc": {"bookmark_count": -1}})
        return {"bookmarked": False}
    else:
        await db.bookmarks.insert_one({"user_id": user_id, "post_id": post_id, "created_at": datetime.now(timezone.utc)})
        await db.posts.update_one({"_id": ObjectId(post_id)}, {"$inc": {"bookmark_count": 1}})
        return {"bookmarked": True}

@api_router.get("/posts/{post_id}/replies")
async def get_replies(post_id: str, current_user=Depends(get_current_user_opt)):
    replies = await db.posts.find({"reply_to": post_id, "is_reply": True}).sort("created_at", 1).to_list(100)
    uid = str(current_user["_id"]) if current_user else None
    return [await serialize_post(r, uid) for r in replies]

# ===== USERS =====

@api_router.get("/users/suggestions")
async def get_suggestions(current_user=Depends(get_current_user)):
    user_id = str(current_user["_id"])
    follows = await db.follows.find({"follower_id": user_id}).to_list(1000)
    following_ids = [f["following_id"] for f in follows] + [user_id]
    users = await db.users.find(
        {"_id": {"$nin": [ObjectId(uid) for uid in following_ids]}}
    ).limit(5).to_list(5)
    return [serialize_user(u) for u in users]

@api_router.get("/users/{username}")
async def get_user_profile(username: str, current_user=Depends(get_current_user_opt)):
    user = await db.users.find_one({"username": username.lower()})
    if not user:
        raise HTTPException(404, "User not found")

    user_data = serialize_user(user)
    if current_user:
        uid = str(current_user["_id"])
        user_data["is_following"] = await db.follows.find_one({
            "follower_id": uid, "following_id": str(user["_id"])
        }) is not None
        user_data["is_me"] = uid == str(user["_id"])
    else:
        user_data["is_following"] = False
        user_data["is_me"] = False
    return user_data

@api_router.get("/users/{username}/posts")
async def get_user_posts(username: str, skip: int = 0, current_user=Depends(get_current_user_opt)):
    user = await db.users.find_one({"username": username.lower()})
    if not user:
        raise HTTPException(404, "User not found")
    posts = await db.posts.find(
        {"author_id": str(user["_id"]), "is_reply": False}
    ).sort("created_at", -1).skip(skip).limit(20).to_list(20)
    uid = str(current_user["_id"]) if current_user else None
    return [await serialize_post(p, uid) for p in posts]

@api_router.get("/users/{username}/replies")
async def get_user_replies(username: str, skip: int = 0, current_user=Depends(get_current_user_opt)):
    user = await db.users.find_one({"username": username.lower()})
    if not user:
        raise HTTPException(404, "User not found")
    posts = await db.posts.find(
        {"author_id": str(user["_id"]), "is_reply": True}
    ).sort("created_at", -1).skip(skip).limit(20).to_list(20)
    uid = str(current_user["_id"]) if current_user else None
    return [await serialize_post(p, uid) for p in posts]

@api_router.get("/users/{username}/likes")
async def get_user_liked_posts(username: str, skip: int = 0, current_user=Depends(get_current_user_opt)):
    user = await db.users.find_one({"username": username.lower()})
    if not user:
        raise HTTPException(404, "User not found")
    user_id = str(user["_id"])
    liked_docs = await db.likes.find({"user_id": user_id}).sort("created_at", -1).skip(skip).limit(20).to_list(20)
    post_ids = [ObjectId(l["post_id"]) for l in liked_docs]
    if not post_ids:
        return []
    posts = await db.posts.find({"_id": {"$in": post_ids}}).to_list(20)
    uid = str(current_user["_id"]) if current_user else None
    return [await serialize_post(p, uid) for p in posts]

@api_router.put("/users/profile")
async def update_profile(data: ProfileUpdate, current_user=Depends(get_current_user)):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if update:
        await db.users.update_one({"_id": current_user["_id"]}, {"$set": update})
    updated = await db.users.find_one({"_id": current_user["_id"]})
    return serialize_user(updated, include_email=True)

@api_router.post("/users/{username}/follow")
async def toggle_follow(username: str, current_user=Depends(get_current_user)):
    target = await db.users.find_one({"username": username.lower()})
    if not target:
        raise HTTPException(404, "User not found")

    follower_id = str(current_user["_id"])
    following_id = str(target["_id"])

    if follower_id == following_id:
        raise HTTPException(400, "Cannot follow yourself")

    existing = await db.follows.find_one({"follower_id": follower_id, "following_id": following_id})
    if existing:
        await db.follows.delete_one({"follower_id": follower_id, "following_id": following_id})
        await db.users.update_one({"_id": current_user["_id"]}, {"$inc": {"following_count": -1}})
        await db.users.update_one({"_id": target["_id"]}, {"$inc": {"followers_count": -1}})
        return {"following": False}
    else:
        await db.follows.insert_one({
            "follower_id": follower_id,
            "following_id": following_id,
            "created_at": datetime.now(timezone.utc),
        })
        await db.users.update_one({"_id": current_user["_id"]}, {"$inc": {"following_count": 1}})
        await db.users.update_one({"_id": target["_id"]}, {"$inc": {"followers_count": 1}})
        await create_notification(following_id, "follow", follower_id)
        return {"following": True}

# ===== EXPLORE =====

@api_router.get("/explore/trending")
async def get_trending():
    since = datetime.now(timezone.utc) - timedelta(days=7)
    posts = await db.posts.find(
        {"created_at": {"$gte": since}, "hashtags": {"$ne": []}}
    ).to_list(1000)
    counts: dict = {}
    for post in posts:
        for tag in post.get("hashtags", []):
            counts[tag] = counts.get(tag, 0) + 1
    trending = sorted(counts.items(), key=lambda x: x[1], reverse=True)[:10]
    return [{"tag": t[0], "count": t[1]} for t in trending]

@api_router.get("/explore/search")
async def search(q: str = "", current_user=Depends(get_current_user_opt)):
    if not q:
        return {"posts": [], "users": []}
    uid = str(current_user["_id"]) if current_user else None
    posts = await db.posts.find(
        {"content": {"$regex": q, "$options": "i"}}
    ).sort("created_at", -1).limit(20).to_list(20)
    users = await db.users.find(
        {"$or": [
            {"username": {"$regex": q, "$options": "i"}},
            {"display_name": {"$regex": q, "$options": "i"}},
        ]}
    ).limit(5).to_list(5)
    return {
        "posts": [await serialize_post(p, uid) for p in posts],
        "users": [serialize_user(u) for u in users],
    }

# ===== NOTIFICATIONS =====

@api_router.get("/notifications")
async def get_notifications(current_user=Depends(get_current_user)):
    user_id = str(current_user["_id"])
    notifs = await db.notifications.find({"recipient_id": user_id}).sort("created_at", -1).limit(50).to_list(50)
    result = []
    for n in notifs:
        from_user = await db.users.find_one({"_id": ObjectId(n["from_user_id"])})
        result.append({
            "id": str(n["_id"]),
            "type": n["type"],
            "from_user": serialize_user(from_user) if from_user else None,
            "post_id": n.get("post_id"),
            "read": n.get("read", False),
            "created_at": n["created_at"].isoformat() if isinstance(n["created_at"], datetime) else n.get("created_at", ""),
        })
    return result

@api_router.get("/notifications/unread-count")
async def get_unread_count(current_user=Depends(get_current_user)):
    user_id = str(current_user["_id"])
    count = await db.notifications.count_documents({"recipient_id": user_id, "read": False})
    return {"count": count}

@api_router.put("/notifications/read")
async def mark_notifications_read(current_user=Depends(get_current_user)):
    user_id = str(current_user["_id"])
    await db.notifications.update_many(
        {"recipient_id": user_id, "read": False},
        {"$set": {"read": True}}
    )
    return {"success": True}

# ===== BOOKMARKS =====

@api_router.get("/bookmarks")
async def get_bookmarks(current_user=Depends(get_current_user)):
    user_id = str(current_user["_id"])
    bookmarks = await db.bookmarks.find({"user_id": user_id}).sort("created_at", -1).limit(50).to_list(50)
    post_ids = [ObjectId(b["post_id"]) for b in bookmarks]
    if not post_ids:
        return []
    posts = await db.posts.find({"_id": {"$in": post_ids}}).to_list(50)
    return [await serialize_post(p, user_id) for p in posts]

# ===== INCLUDE ROUTER =====

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
